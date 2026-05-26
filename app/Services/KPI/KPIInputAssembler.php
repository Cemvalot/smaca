<?php

namespace App\Services\KPI;

use App\Support\TelemetryMetricColumns;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class KPIInputAssembler
{
    /** Allowed UI timeframes. 6m is intentionally excluded — it is export-only. */
    public const ALLOWED_TIMEFRAMES = ['24h', '7d', '30d'];

    /** Cap on movement-derived presence proxy (passage events ≠ unique people). */
    public const ESTIMATED_PRESENCE_CAP = 2000.0;

    /** Rolling window for base-load KPI (fixed by D5.1, independent of UI timeframe). */
    public const BASELINE_WINDOW_DAYS = 7;

    /**
     * Assemble the inputs the KPI engine needs from sensor_latest + readings.
     *
     * @param array{
     *   sensor_ids?: array<int>|null,
     *   sensor_uids?: array<string>|null,
     *   timeframe?: string|null
     * } $context
     *   - sensor_ids:  numeric IDs (used to filter sensors / sensor_latest).
     *   - sensor_uids: external_id strings (used to filter readings on
     *                  production where the FK column is `sensor_uid`).
     *   - timeframe:   one of '24h' | '7d' | '30d'. Drives the `current
     *                  readings` window. Defaults to 24h on null/invalid.
     */
    public function assembleSummaryInputs(array $context = []): array
    {
        $sensorIds = $this->normaliseList($context['sensor_ids'] ?? null, 'int');
        $sensorUids = $this->normaliseList($context['sensor_uids'] ?? null, 'string');
        $timeframe = self::resolveTimeframe($context['timeframe'] ?? null);

        // If either scope was provided and ended up empty, treat globally as
        // "scope matched no sensors" → safe empty inputs.
        $sensorIdsScoped = $sensorIds !== null;
        $sensorUidsScoped = $sensorUids !== null;
        if ($sensorIdsScoped && empty($sensorIds)) {
            return $this->emptyInputs(0, $timeframe);
        }
        if ($sensorUidsScoped && empty($sensorUids)) {
            return $this->emptyInputs(0, $timeframe);
        }

        try {
            $schema = DB::getSchemaBuilder();
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: schema builder unavailable', $e);
            return $this->emptyInputs(0, $timeframe);
        }

        // ----- sensor_latest aggregates -------------------------------------
        $latest = null;
        try {
            if ($schema->hasTable('sensor_latest')) {
                $latestSelects = [];
                if ($schema->hasColumn('sensor_latest', 'co2_ppm')) {
                    $latestSelects[] = 'AVG(co2_ppm) as avg_co2_ppm';
                }
                if ($schema->hasColumn('sensor_latest', 'tvoc_index')) {
                    $latestSelects[] = 'AVG(tvoc_index) as avg_tvoc_index';
                }
                $pm25Col = TelemetryMetricColumns::sensorLatestPm25PhysicalColumn();
                if ($pm25Col !== null) {
                    $latestSelects[] = 'AVG('.$pm25Col.') as avg_pm25_ugm3';
                }
                $pm10Col = TelemetryMetricColumns::sensorLatestPm10PhysicalColumn();
                if ($pm10Col !== null) {
                    $latestSelects[] = 'AVG('.$pm10Col.') as avg_pm10_ugm3';
                }
                if ($schema->hasColumn('sensor_latest', 'temperature_c')) {
                    $latestSelects[] = 'AVG(temperature_c) as avg_temperature_c';
                }
                if ($schema->hasColumn('sensor_latest', 'humidity_rh')) {
                    $latestSelects[] = 'AVG(humidity_rh) as avg_humidity_rh';
                }
                if ($schema->hasColumn('sensor_latest', 'light_level')) {
                    $latestSelects[] = 'AVG(light_level) as avg_light_level';
                }
                if ($schema->hasColumn('sensor_latest', 'lux')) {
                    $latestSelects[] = 'AVG(lux) as avg_lux';
                }
                if ($schema->hasColumn('sensor_latest', 'energy_kwh')) {
                    $latestSelects[] = 'AVG(energy_kwh) as avg_energy_kwh';
                }
                if ($schema->hasColumn('sensor_latest', 'uv_index')) {
                    $latestSelects[] = 'AVG(uv_index) as avg_uv_index';
                }
                if ($schema->hasColumn('sensor_latest', 'solar_radiation')) {
                    $latestSelects[] = 'AVG(solar_radiation) as avg_solar_radiation';
                }
                if ($schema->hasColumn('sensor_latest', 'people_total_in') && $schema->hasColumn('sensor_latest', 'people_total_out')) {
                    $latestSelects[] = 'AVG(COALESCE(people_total_in, 0) - COALESCE(people_total_out, 0)) as avg_people_present';
                }
                foreach ([
                    'signal_strength' => 'avg_rssi_dbm',
                    'snr' => 'avg_snr_db',
                    'tx_ccq' => 'avg_tx_ccq_pct',
                    'tx_rate' => 'avg_tx_rate_mbps',
                ] as $col => $alias) {
                    if ($schema->hasColumn('sensor_latest', $col)) {
                        $latestSelects[] = 'AVG('.$col.') as '.$alias;
                    }
                }

                if (!empty($latestSelects)) {
                    $q = DB::table('sensor_latest')->selectRaw(implode(', ', $latestSelects));
                    if ($sensorIdsScoped) {
                        $q->whereIn('sensor_id', $sensorIds);
                    }
                    $latest = $q->first();
                }
            }
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: sensor_latest query failed', $e);
            $latest = null;
        }

        // ----- readings aggregates ------------------------------------------
        $currentWindowStart = self::timeframeStart($timeframe);
        // Off-hours base load is a 7-day analysis by KPI definition; it does
        // NOT follow the user's UI timeframe.
        $offHoursStart = Carbon::now()->subDays(7);

        $readingsScopeColumn = $this->detectReadingsScopeColumn($schema);

        // Every `readings` aggregate query below filters by `measured_at`. If
        // that column is missing the queries cannot execute meaningfully, so
        // skip them entirely (the surrounding try/catch would otherwise swallow
        // the exception silently with a warning per query).
        $hasMeasuredAt = false;
        try {
            $hasMeasuredAt = $schema->hasColumn('readings', 'measured_at');
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: failed to detect readings.measured_at', $e);
        }

        $readingsSelects = [];
        try {
            // IAQ metrics — these now follow the user's timeframe instead of
            // being snapshots from sensor_latest. That fixes the "24h/7d/30d
            // return identical values" bug.
            if ($schema->hasColumn('readings', 'co2_ppm')) {
                $readingsSelects[] = 'AVG(co2_ppm) as avg_co2_ppm_window';
            }
            if ($schema->hasColumn('readings', 'tvoc_index')) {
                $readingsSelects[] = 'AVG(tvoc_index) as avg_tvoc_index_window';
            }
            $rpm25 = TelemetryMetricColumns::readingsPm25PhysicalColumn();
            if ($rpm25 !== null) {
                $readingsSelects[] = 'AVG('.$rpm25.') as avg_pm25_ugm3_window';
            }
            $rpm10 = TelemetryMetricColumns::readingsPm10PhysicalColumn();
            if ($rpm10 !== null) {
                $readingsSelects[] = 'AVG('.$rpm10.') as avg_pm10_ugm3_window';
            }
            if ($schema->hasColumn('readings', 'temperature_c')) {
                $readingsSelects[] = 'AVG(temperature_c) as avg_temperature_c_window';
            }
            if ($schema->hasColumn('readings', 'humidity_rh')) {
                $readingsSelects[] = 'AVG(humidity_rh) as avg_humidity_rh_window';
            }
            // Energy / electrical / lighting metrics
            if ($schema->hasColumn('readings', 'current_a')) {
                $readingsSelects[] = 'AVG(current_a) as avg_current_a';
            }
            if ($schema->hasColumn('readings', 'power_factor')) {
                $readingsSelects[] = 'AVG(power_factor) as avg_power_factor';
            }
            if ($schema->hasColumn('readings', 'max_demand_kw')) {
                $readingsSelects[] = 'AVG(max_demand_kw) as avg_max_demand_kw';
            }
            if ($schema->hasColumn('readings', 'light_level')) {
                $readingsSelects[] = 'AVG(light_level) as avg_light_level';
            }
            if ($schema->hasColumn('readings', 'lux')) {
                $readingsSelects[] = 'AVG(lux) as avg_lux';
            }
            // Solar Exposure (UV) — outdoor / VS350-class sensors
            if ($schema->hasColumn('readings', 'solar_radiation')) {
                $readingsSelects[] = 'AVG(solar_radiation) as avg_solar_radiation';
            }
            if ($schema->hasColumn('readings', 'uv_index')) {
                $readingsSelects[] = 'AVG(uv_index) as avg_uv_index';
            }
            if ($schema->hasColumn('readings', 'modbus_chn_1')) {
                // Some VS350 ingest paths store UV on a generic modbus channel.
                $readingsSelects[] = 'AVG(modbus_chn_1) as avg_modbus_chn_1';
            }
            // NOTE: we deliberately do NOT do `AVG(energy_kwh)` here.
            // `energy_kwh` is a CUMULATIVE meter reading, so the average has no
            // physical meaning. The total kWh actually consumed inside the
            // window is computed below via per-sensor MAX − MIN deltas. The
            // legacy `avg_energy_kwh` field is then derived as
            //   avg kW = total_kwh_window / timeframe_hours
            // so downstream KPI math (`normalized_energy_intensity`,
            // `base_load_index`) keeps a consistent, dimensionally-correct
            // input.
            //
            // NOTE: we deliberately stop AVG'ing (people_total_in - people_total_out).
            // Those are cumulative lifetime counters, NOT a "people present"
            // signal; averaging them produced absurd densities (e.g. 455×).
            // See the per-sensor delta query below for movement semantics.
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: failed to inspect readings columns', $e);
        }

        $currentReadings = null;
        try {
            if ($hasMeasuredAt && !empty($readingsSelects)) {
                $q = DB::table('readings')
                    ->selectRaw(implode(', ', $readingsSelects))
                    ->where('measured_at', '>=', $currentWindowStart);
                $this->applyReadingsScope($q, $readingsScopeColumn, $sensorIdsScoped, $sensorIds, $sensorUidsScoped, $sensorUids);
                $this->excludeBadLocation($q, $schema);
                $currentReadings = $q->first();
            }
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: 24h readings query failed', $e);
            $currentReadings = null;
        }

        // ----- energy (per-sensor MAX-MIN deltas, summed) ------------------
        // `energy_kwh` is a cumulative meter; the right semantics for "total
        // energy consumed in the window" is per-sensor MAX-MIN, clamped to
        // [0, MAX_DELTA_PER_METER] to absorb counter resets/rollovers.
        $totalEnergyKwhWindow = $this->sumPerSensorDeltaInWindow(
            $schema,
            'energy_kwh',
            $currentWindowStart,
            $readingsScopeColumn,
            $sensorIdsScoped,
            $sensorIds,
            $sensorUidsScoped,
            $sensorUids,
            500000.0  // 500k kWh per meter per window: very generous safety cap
        );

        // ----- movement (per-sensor deltas, summed) -------------------------
        // people_total_in / people_total_out are cumulative lifetime counters
        // on Milesight UC50x devices. Computing AVG over them is meaningless.
        // The right signal for movement is: per-sensor (MAX-MIN) of each
        // counter inside the timeframe window, then summed across in-scope
        // sensors. Per-sensor deltas are clamped to [0, MAX_DELTA_PER_SENSOR]
        // so a counter reset doesn't produce a runaway value.
        $movementEntries = null;
        $movementExits = null;
        try {
            if ($hasMeasuredAt
                && $schema->hasColumn('readings', 'people_total_in')
                && $schema->hasColumn('readings', 'people_total_out')
                && $readingsScopeColumn !== null
            ) {
                $maxPerSensorDelta = 10000; // safety cap per sensor per window
                $sub = DB::table('readings')
                    ->select([
                        $readingsScopeColumn,
                        DB::raw('MAX(people_total_in) as max_in'),
                        DB::raw('MIN(people_total_in) as min_in'),
                        DB::raw('MAX(people_total_out) as max_out'),
                        DB::raw('MIN(people_total_out) as min_out'),
                    ])
                    ->where('measured_at', '>=', $currentWindowStart)
                    ->whereNotNull('people_total_in')
                    ->groupBy($readingsScopeColumn);
                $this->applyReadingsScope($sub, $readingsScopeColumn, $sensorIdsScoped, $sensorIds, $sensorUidsScoped, $sensorUids);
                $this->excludeBadLocation($sub, $schema);

                $rows = $sub->get();
                $entrySum = 0.0; $exitSum = 0.0;
                foreach ($rows as $r) {
                    $inDelta = (float) ($r->max_in ?? 0) - (float) ($r->min_in ?? 0);
                    $outDelta = (float) ($r->max_out ?? 0) - (float) ($r->min_out ?? 0);
                    $entrySum += max(0.0, min((float) $maxPerSensorDelta, $inDelta));
                    $exitSum  += max(0.0, min((float) $maxPerSensorDelta, $outDelta));
                }
                $movementEntries = $entrySum;
                $movementExits = $exitSum;
            }
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: movement deltas query failed', $e);
            $movementEntries = null;
            $movementExits = null;
        }

        // ----- base load (last 7d, off-hours) -------------------------------
        // Base-load semantics: ratio of off-hours energy delta to total energy
        // delta over the last 7 days. Both halves use per-sensor MAX-MIN
        // (clamped) so we never average cumulative meter readings.
        // Pure-snapshot off-hours query: rows whose timestamp falls in the
        // off-hours window AND whose occupancy is near zero (when those columns
        // exist). MAX-MIN of the matched rows per sensor approximates the kWh
        // consumed in those quiet periods.
        $baseLoadTotalKwh7d = $this->sumPerSensorDeltaInWindow(
            $schema,
            'energy_kwh',
            $offHoursStart,
            $readingsScopeColumn,
            $sensorIdsScoped,
            $sensorIds,
            $sensorUidsScoped,
            $sensorUids,
            500000.0
        );

        $baseLoadOffHoursKwh7d = null;
        try {
            if ($hasMeasuredAt
                && $schema->hasColumn('readings', 'energy_kwh')
                && $readingsScopeColumn !== null
            ) {
                $occupancyNearZeroSql = '';
                if ($schema->hasColumn('readings', 'people_total_in')
                    && $schema->hasColumn('readings', 'people_total_out')
                ) {
                    $occupancyNearZeroSql = ' AND ABS(COALESCE(people_total_in,0) - COALESCE(people_total_out,0)) <= 1';
                }
                $sub = DB::table('readings')
                    ->select([
                        $readingsScopeColumn,
                        DB::raw('MAX(energy_kwh) as max_kwh'),
                        DB::raw('MIN(energy_kwh) as min_kwh'),
                    ])
                    ->where('measured_at', '>=', $offHoursStart)
                    ->whereNotNull('energy_kwh')
                    // Off-hours predicate: nights (00:00–06:59) or weekends.
                    ->whereRaw('(HOUR(measured_at) BETWEEN 0 AND 6 OR DAYOFWEEK(measured_at) IN (1, 7))' . $occupancyNearZeroSql)
                    ->groupBy($readingsScopeColumn);
                $this->applyReadingsScope($sub, $readingsScopeColumn, $sensorIdsScoped, $sensorIds, $sensorUidsScoped, $sensorUids);
                $this->excludeBadLocation($sub, $schema);

                $rows = $sub->get();
                $sum = 0.0;
                foreach ($rows as $r) {
                    $delta = (float) ($r->max_kwh ?? 0) - (float) ($r->min_kwh ?? 0);
                    $sum += max(0.0, min(500000.0, $delta));
                }
                $baseLoadOffHoursKwh7d = $sum;
            }
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: base-load off-hours query failed', $e);
            $baseLoadOffHoursKwh7d = null;
        }

        // ----- capacity / sensor counts -------------------------------------
        $roomCapacity = null;
        try {
            if ($schema->hasTable('rooms') && $schema->hasColumn('rooms', 'capacity') && $schema->hasColumn('sensors', 'room_id')) {
                $q = DB::table('sensors')
                    ->leftJoin('rooms', 'rooms.id', '=', 'sensors.room_id')
                    ->where('sensors.is_active', true);
                if ($sensorIdsScoped) {
                    $q->whereIn('sensors.id', $sensorIds);
                }
                $roomCapacity = $q->avg('rooms.capacity');
            }
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: room capacity query failed', $e);
            $roomCapacity = null;
        }

        $activeSensors = 0;
        try {
            $q = DB::table('sensors');
            if ($schema->hasColumn('sensors', 'is_active')) {
                $q->where('is_active', true);
            }
            if ($sensorIdsScoped) {
                $q->whereIn('id', $sensorIds);
            }
            $activeSensors = (int) $q->count();
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: active sensor count failed', $e);
            $activeSensors = 0;
        }
        $fallbackCapacity = max(50, $activeSensors * 20);

        // Coalesce strategy: prefer the timeframe-windowed average from
        // `readings`. Fall back to the `sensor_latest` snapshot only if the
        // window had no rows (e.g. a brand-new sensor or DB pruning).
        $avgCo2 = $this->toFloat($currentReadings->avg_co2_ppm_window ?? null)
            ?? $this->toFloat($latest->avg_co2_ppm ?? null);
        $avgTvoc = $this->toFloat($currentReadings->avg_tvoc_index_window ?? null)
            ?? $this->toFloat($latest->avg_tvoc_index ?? null);
        $avgPm25 = $this->toFloat($currentReadings->avg_pm25_ugm3_window ?? null)
            ?? $this->toFloat($latest->avg_pm25_ugm3 ?? null);
        $avgPm10 = $this->toFloat($currentReadings->avg_pm10_ugm3_window ?? null)
            ?? $this->toFloat($latest->avg_pm10_ugm3 ?? null);
        $avgTemp = $this->toFloat($currentReadings->avg_temperature_c_window ?? null)
            ?? $this->toFloat($latest->avg_temperature_c ?? null);
        $avgHumidity = $this->toFloat($currentReadings->avg_humidity_rh_window ?? null)
            ?? $this->toFloat($latest->avg_humidity_rh ?? null);
        $avgLightLevel = $this->toFloat($currentReadings->avg_light_level ?? null)
            ?? $this->toFloat($latest?->avg_light_level ?? null);
        $avgLuxReading = $this->toFloat($currentReadings->avg_lux ?? null)
            ?? $this->toFloat($latest?->avg_lux ?? null);
        $avgUv = $this->toFloat($currentReadings?->avg_uv_index ?? null)
            ?? $this->toFloat($currentReadings?->avg_modbus_chn_1 ?? null)
            ?? $this->toFloat($latest?->avg_uv_index ?? null);
        $avgSolar = $this->toFloat($currentReadings?->avg_solar_radiation ?? null)
            ?? $this->toFloat($latest?->avg_solar_radiation ?? null);

        $timeframeHours = self::timeframeHours($timeframe);

        // Derive a dimensionally-correct `avg_energy_kwh` for downstream KPI
        // math. Total kWh consumed during the window divided by the window
        // length (in hours) gives average kW — a single representative power
        // draw for the period.
        $avgEnergy = null;
        if ($totalEnergyKwhWindow !== null && $timeframeHours > 0) {
            $avgEnergy = round($totalEnergyKwhWindow / max(1, $timeframeHours), 4);
        }

        // Movement-derived estimated presence: passage-event proxy, not headcount.
        $rawEstimatedPresence = null;
        $cappedEstimatedPresence = null;
        $denominatorCapped = false;
        $occupancyContextConfidence = 'none';
        if ($movementEntries !== null || $movementExits !== null) {
            $entries = max(0.0, (float) ($movementEntries ?? 0));
            $exits = max(0.0, (float) ($movementExits ?? 0));
            if ($entries > 0 && $exits > 0) {
                $activityBalance = ($entries + $exits) / 2.0;
                $rawEstimatedPresence = max($entries, $activityBalance);
                $occupancyContextConfidence = 'balanced_movement';
            } elseif ($entries > 0) {
                $rawEstimatedPresence = $entries;
                $occupancyContextConfidence = 'entries_only';
            } elseif ($exits > 0) {
                $rawEstimatedPresence = $exits;
                $occupancyContextConfidence = 'exits_only';
            }
            if ($rawEstimatedPresence !== null) {
                $denominatorCapped = $rawEstimatedPresence > self::ESTIMATED_PRESENCE_CAP;
                $cappedEstimatedPresence = min(self::ESTIMATED_PRESENCE_CAP, $rawEstimatedPresence);
            }
        }
        $estimatedPresence = $cappedEstimatedPresence;

        // Base-load inputs: per-sensor MAX−MIN kWh deltas (7d rolling window).
        // `avg_*` keys kept for KPIService backward compatibility.
        $baseLoadAvg = ($baseLoadTotalKwh7d !== null) ? (float) $baseLoadTotalKwh7d : null;
        $offHoursAvg = ($baseLoadOffHoursKwh7d !== null) ? (float) $baseLoadOffHoursKwh7d : null;
        $activeHoursKwh7d = null;
        if ($baseLoadTotalKwh7d !== null && $baseLoadOffHoursKwh7d !== null) {
            $activeHoursKwh7d = max(0.0, (float) $baseLoadTotalKwh7d - (float) $baseLoadOffHoursKwh7d);
        }
        $detectedBaselineWindows = '00:00–06:59 local, weekends (DAYOFWEEK 1,7), near-zero movement when counters exist';
        $baselineWindowRule = $detectedBaselineWindows;
        $baselineHoursCount = null;
        $activeHoursCount = null;
        if ($hasMeasuredAt && $readingsScopeColumn !== null) {
            $baselineHoursCount = $this->countDistinctEnergyHourBuckets(
                $schema,
                $offHoursStart,
                $readingsScopeColumn,
                $sensorIdsScoped,
                $sensorIds,
                $sensorUidsScoped,
                $sensorUids,
                true
            );
            $activeHoursCount = $this->countDistinctEnergyHourBuckets(
                $schema,
                $offHoursStart,
                $readingsScopeColumn,
                $sensorIdsScoped,
                $sensorIds,
                $sensorUidsScoped,
                $sensorUids,
                false
            );
        }
        $baselineEnergySharePercent = null;
        if ($baseLoadTotalKwh7d !== null && $baseLoadTotalKwh7d > 0 && $baseLoadOffHoursKwh7d !== null) {
            $baselineEnergySharePercent = round(100.0 * (float) $baseLoadOffHoursKwh7d / (float) $baseLoadTotalKwh7d, 1);
        }

        return [
            'avg_co2_ppm' => $avgCo2,
            'avg_tvoc_index' => $avgTvoc,
            'avg_pm25_ugm3' => $avgPm25,
            'avg_pm10_ugm3' => $avgPm10,
            'avg_temperature_c' => $avgTemp,
            'avg_humidity_rh' => $avgHumidity,
            'tvoc' => $avgTvoc,
            'pm25' => $avgPm25,
            'pm10' => $avgPm10,
            'temperature' => $avgTemp,
            'humidity' => $avgHumidity,
            'lighting' => $avgLightLevel,
            'avg_energy_kwh' => $avgEnergy,
            'total_energy_kwh_window' => $totalEnergyKwhWindow,
            'energy_consumption_kwh_window' => $totalEnergyKwhWindow,
            'estimated_presence' => $estimatedPresence,
            'raw_estimated_presence' => $rawEstimatedPresence,
            'capped_estimated_presence' => $cappedEstimatedPresence,
            'denominator_capped' => $denominatorCapped,
            'denominator_cap_value' => self::ESTIMATED_PRESENCE_CAP,
            'occupancy_context_confidence' => $occupancyContextConfidence,
            'total_energy_kwh_7d' => $baseLoadTotalKwh7d,
            'baseline_kwh_7d' => $baseLoadOffHoursKwh7d,
            'active_hours_kwh_7d' => $activeHoursKwh7d,
            'baseline_energy_share_percent' => $baselineEnergySharePercent,
            'baseline_window_rule' => $baselineWindowRule,
            'baseline_hours_count' => $baselineHoursCount,
            'active_hours_count' => $activeHoursCount,
            'detected_baseline_windows' => $detectedBaselineWindows,
            'avg_current_a' => $this->toFloat($currentReadings->avg_current_a ?? null),
            'avg_power_factor' => $this->toFloat($currentReadings->avg_power_factor ?? null),
            'avg_max_demand_kw' => $this->toFloat($currentReadings->avg_max_demand_kw ?? null),
            'avg_light_level' => $avgLightLevel,
            'avg_lux' => $avgLuxReading,
            'avg_solar_radiation' => $avgSolar,
            'avg_uv_index' => $avgUv,
            'avg_people_present' => $estimatedPresence,
            'movement_entries' => $movementEntries,
            'movement_exits' => $movementExits,
            'timeframe_hours' => $timeframeHours,
            'max_capacity' => $this->toFloat($roomCapacity) ?? (float) $fallbackCapacity,
            'capacity_confidence' => $roomCapacity !== null ? 'measured' : 'estimated',
            'avg_base_load_energy' => $baseLoadAvg,
            'avg_off_hours_energy' => $offHoursAvg,
            'active_sensor_count' => $activeSensors,
            'has_scope' => $sensorIdsScoped || $sensorUidsScoped,
            'timeframe' => $timeframe,
            'avg_rssi_dbm' => $this->toFloat($latest->avg_rssi_dbm ?? null),
            'avg_snr_db' => $this->toFloat($latest->avg_snr_db ?? null),
            'avg_tx_ccq_pct' => $this->toFloat($latest->avg_tx_ccq_pct ?? null),
            'avg_tx_rate_mbps' => $this->toFloat($latest->avg_tx_rate_mbps ?? null),
            'connectivity_reporting_devices' => $this->countConnectivityReportingDevices(
                $schema,
                $sensorIdsScoped,
                $sensorIds,
                $sensorUidsScoped,
                $sensorUids
            ),
            'connectivity_total_devices' => $activeSensors,
        ];
    }

    /**
     * Sensors with at least one wireless quality metric on sensor_latest.
     */
    private function countConnectivityReportingDevices(
        \Illuminate\Database\Schema\Builder $schema,
        bool $sensorIdsScoped,
        ?array $sensorIds,
        bool $sensorUidsScoped,
        ?array $sensorUids
    ): int {
        if (!$schema->hasTable('sensor_latest')) {
            return 0;
        }
        $cols = [];
        foreach (['signal_strength', 'snr', 'tx_ccq', 'tx_rate'] as $col) {
            if ($schema->hasColumn('sensor_latest', $col)) {
                $cols[] = $col;
            }
        }
        if ($cols === []) {
            return 0;
        }
        try {
            $q = DB::table('sensor_latest');
            $q->where(function ($sub) use ($cols) {
                foreach ($cols as $i => $col) {
                    if ($i === 0) {
                        $sub->whereNotNull($col);
                    } else {
                        $sub->orWhereNotNull($col);
                    }
                }
            });
            if ($sensorIdsScoped && !empty($sensorIds)) {
                $q->whereIn('sensor_id', $sensorIds);
            }
            return (int) $q->count();
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: connectivity reporting count failed', $e);

            return 0;
        }
    }

    /**
     * Sum per-sensor (MAX − MIN) delta of a cumulative metric inside a window.
     *
     * Energy meters and people-counters are CUMULATIVE on the device; the
     * physically-meaningful "consumed in window" value is the per-sensor
     * MAX − MIN inside the window, then summed across in-scope sensors.
     * Negative deltas (counter resets / rollovers) are clamped to zero, and
     * each per-sensor delta is capped at $maxPerSensorDelta to absorb
     * malformed data without poisoning the campus total.
     *
     * Returns null when the column is missing, the schema cannot be inspected,
     * or the query fails for any reason — callers must treat null as
     * "no usable data" and fall back accordingly.
     */
    /**
     * Count distinct hour-buckets with energy readings in the 7d baseline window.
     *
     * @param bool $baselineOnly when true, only buckets matching off-hours / weekend rule
     */
    private function countDistinctEnergyHourBuckets(
        $schema,
        Carbon $windowStart,
        ?string $readingsScopeColumn,
        bool $sensorIdsScoped,
        ?array $sensorIds,
        bool $sensorUidsScoped,
        ?array $sensorUids,
        bool $baselineOnly
    ): ?int {
        try {
            if (!$schema->hasColumn('readings', 'measured_at')
                || !$schema->hasColumn('readings', 'energy_kwh')
                || $readingsScopeColumn === null
            ) {
                return null;
            }
            $occupancyNearZeroSql = '';
            if ($schema->hasColumn('readings', 'people_total_in')
                && $schema->hasColumn('readings', 'people_total_out')
            ) {
                $occupancyNearZeroSql = ' AND ABS(COALESCE(people_total_in,0) - COALESCE(people_total_out,0)) <= 1';
            }
            $baselineSql = '(HOUR(measured_at) BETWEEN 0 AND 6 OR DAYOFWEEK(measured_at) IN (1, 7))'.$occupancyNearZeroSql;

            $q = DB::table('readings')
                ->where('measured_at', '>=', $windowStart)
                ->whereNotNull('energy_kwh');
            if ($baselineOnly) {
                $q->whereRaw($baselineSql);
            } else {
                $q->whereRaw('NOT '.$baselineSql);
            }
            $this->applyReadingsScope($q, $readingsScopeColumn, $sensorIdsScoped, $sensorIds, $sensorUidsScoped, $sensorUids);
            $this->excludeBadLocation($q, $schema);

            $row = $q->selectRaw(
                "COUNT(DISTINCT CONCAT(DATE(measured_at), '-', LPAD(HOUR(measured_at), 2, '0'))) as bucket_count"
            )->first();

            return $row ? (int) ($row->bucket_count ?? 0) : null;
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: hour bucket count failed', $e);

            return null;
        }
    }

    private function sumPerSensorDeltaInWindow(
        $schema,
        string $metric,
        Carbon $windowStart,
        ?string $readingsScopeColumn,
        bool $sensorIdsScoped,
        ?array $sensorIds,
        bool $sensorUidsScoped,
        ?array $sensorUids,
        float $maxPerSensorDelta
    ): ?float {
        try {
            if (!$schema->hasColumn('readings', 'measured_at')
                || !$schema->hasColumn('readings', $metric)
                || $readingsScopeColumn === null
            ) {
                return null;
            }
            $sub = DB::table('readings')
                ->select([
                    $readingsScopeColumn,
                    DB::raw('MAX(' . $metric . ') as max_v'),
                    DB::raw('MIN(' . $metric . ') as min_v'),
                ])
                ->where('measured_at', '>=', $windowStart)
                ->whereNotNull($metric)
                ->groupBy($readingsScopeColumn);
            $this->applyReadingsScope($sub, $readingsScopeColumn, $sensorIdsScoped, $sensorIds, $sensorUidsScoped, $sensorUids);
            $this->excludeBadLocation($sub, $schema);

            $rows = $sub->get();
            if ($rows->isEmpty()) {
                return null;
            }
            $sum = 0.0;
            foreach ($rows as $r) {
                $delta = (float) ($r->max_v ?? 0) - (float) ($r->min_v ?? 0);
                $sum += max(0.0, min($maxPerSensorDelta, $delta));
            }
            return $sum;
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: per-sensor delta query failed', $e, ['metric' => $metric]);
            return null;
        }
    }

    /**
     * Apply the Default-Site / null-location exclusion to a `readings` query
     * when the column is present. Aligns with `smacaApiExcludeBadLocation_impl`
     * in the route helpers — kept here so the KPI assembler does not depend
     * on the route layer.
     */
    private function excludeBadLocation($query, $schema): void
    {
        try {
            if (!$schema->hasColumn('readings', 'sensor_location')) {
                return;
            }
            $query->whereNotNull('sensor_location')
                ->where('sensor_location', '<>', '')
                ->where('sensor_location', '<>', 'Default Site');
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: excludeBadLocation failed', $e);
        }
    }

    /** Approximate hour count for a (validated) timeframe. */
    public static function timeframeHours(string $timeframe): int
    {
        return match ($timeframe) {
            '7d' => 24 * 7,
            '30d' => 24 * 30,
            default => 24,
        };
    }

    /** Validate / normalise a timeframe string. Defaults to 24h. */
    public static function resolveTimeframe($timeframe): string
    {
        $tf = strtolower(trim((string) ($timeframe ?? '')));
        if (in_array($tf, self::ALLOWED_TIMEFRAMES, true)) {
            return $tf;
        }
        return '24h';
    }

    /** Return the Carbon start-of-window for a (validated) timeframe. */
    public static function timeframeStart(string $timeframe): Carbon
    {
        $nowAthens = Carbon::now('Europe/Athens');

        return match ($timeframe) {
            '7d' => $nowAthens->copy()->subDays(7),
            '30d' => $nowAthens->copy()->subDays(30),
            default => $nowAthens->copy()->subHours(24),
        };
    }

    /**
     * Detect which column on `readings` is used to identify the sensor.
     * Production uses `sensor_uid` (string), some dev DBs use `sensor_id`.
     * Returns one of: 'sensor_uid', 'sensor_id', or null when neither exists.
     */
    private function detectReadingsScopeColumn($schema): ?string
    {
        try {
            if ($schema->hasColumn('readings', 'sensor_uid')) {
                return 'sensor_uid';
            }
            if ($schema->hasColumn('readings', 'sensor_id')) {
                return 'sensor_id';
            }
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: failed to detect readings scope column', $e);
        }
        return null;
    }

    /**
     * Apply the right scope clause to a `readings` query depending on which
     * FK column the schema actually exposes. If neither caller-provided list
     * matches the available column, the query is left unscoped (campus-wide
     * average) — that's the safe fallback rather than 500.
     */
    private function applyReadingsScope($query, ?string $col, bool $idsScoped, ?array $ids, bool $uidsScoped, ?array $uids): void
    {
        if ($col === 'sensor_uid' && $uidsScoped && !empty($uids)) {
            $query->whereIn('sensor_uid', $uids);
            return;
        }
        if ($col === 'sensor_id' && $idsScoped && !empty($ids)) {
            $query->whereIn('sensor_id', $ids);
            return;
        }
        if ($col === 'sensor_uid' && $idsScoped && !empty($ids)) {
            // Translate ids → uids on the fly via subquery.
            $query->whereIn('sensor_uid', function ($sub) use ($ids) {
                $sub->select('external_id')->from('sensors')->whereIn('id', $ids);
            });
            return;
        }
        if ($col === 'sensor_id' && $uidsScoped && !empty($uids)) {
            $query->whereIn('sensor_id', function ($sub) use ($uids) {
                $sub->select('id')->from('sensors')->whereIn('external_id', $uids);
            });
            return;
        }
        // No usable scope-column / scope-list combo → leave unscoped.
    }

    private function emptyInputs(int $activeSensors, string $timeframe = '24h'): array
    {
        return [
            'avg_co2_ppm' => null,
            'avg_tvoc_index' => null,
            'avg_pm25_ugm3' => null,
            'avg_pm10_ugm3' => null,
            'avg_temperature_c' => null,
            'avg_humidity_rh' => null,
            'tvoc' => null,
            'pm25' => null,
            'pm10' => null,
            'temperature' => null,
            'humidity' => null,
            'lighting' => null,
            'avg_energy_kwh' => null,
            'total_energy_kwh_window' => null,
            'energy_consumption_kwh_window' => null,
            'estimated_presence' => null,
            'raw_estimated_presence' => null,
            'capped_estimated_presence' => null,
            'denominator_capped' => false,
            'denominator_cap_value' => self::ESTIMATED_PRESENCE_CAP,
            'occupancy_context_confidence' => 'none',
            'total_energy_kwh_7d' => null,
            'baseline_kwh_7d' => null,
            'active_hours_kwh_7d' => null,
            'baseline_energy_share_percent' => null,
            'baseline_window_rule' => null,
            'baseline_hours_count' => null,
            'active_hours_count' => null,
            'detected_baseline_windows' => null,
            'avg_current_a' => null,
            'avg_power_factor' => null,
            'avg_max_demand_kw' => null,
            'avg_light_level' => null,
            'avg_lux' => null,
            'avg_solar_radiation' => null,
            'avg_uv_index' => null,
            'avg_people_present' => null,
            'movement_entries' => null,
            'movement_exits' => null,
            'timeframe_hours' => self::timeframeHours($timeframe),
            'max_capacity' => 50.0,
            'capacity_confidence' => 'estimated',
            'avg_base_load_energy' => null,
            'avg_off_hours_energy' => null,
            'active_sensor_count' => $activeSensors,
            'has_scope' => true,
            'timeframe' => $timeframe,
            'avg_rssi_dbm' => null,
            'avg_snr_db' => null,
            'avg_tx_ccq_pct' => null,
            'avg_tx_rate_mbps' => null,
            'connectivity_reporting_devices' => 0,
            'connectivity_total_devices' => $activeSensors,
        ];
    }

    /**
     * @param mixed $value
     */
    private function toFloat($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        $numeric = (float) $value;
        return is_finite($numeric) ? $numeric : null;
    }

    /**
     * Coerce a list of mixed values into a unique array of int|string. Returns
     * null when the input itself is null (= "not scoped"), [] when it was a
     * scope but is empty after coercion.
     *
     * @param mixed $list
     * @return array<int, int|string>|null
     */
    private function normaliseList($list, string $kind): ?array
    {
        if ($list === null) {
            return null;
        }
        if (!is_array($list)) {
            return [];
        }
        $out = [];
        foreach ($list as $v) {
            if ($v === null) {
                continue;
            }
            if ($kind === 'int') {
                $iv = (int) $v;
                if ($iv > 0) {
                    $out[$iv] = $iv;
                }
            } else {
                $sv = trim((string) $v);
                if ($sv !== '') {
                    $out[$sv] = $sv;
                }
            }
        }
        return array_values($out);
    }

    private function safeLogWarning(string $msg, \Throwable $e, array $context = []): void
    {
        try {
            Log::warning($msg, array_merge($context, [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]));
        } catch (\Throwable $ignored) {
            // logging must never throw
        }
    }
}
