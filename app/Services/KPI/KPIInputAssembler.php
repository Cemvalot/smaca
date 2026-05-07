<?php

namespace App\Services\KPI;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class KPIInputAssembler
{
    /** Allowed UI timeframes. 6m is intentionally excluded — it is export-only. */
    public const ALLOWED_TIMEFRAMES = ['24h', '7d', '30d'];

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
                if ($schema->hasColumn('sensor_latest', 'pm2_5_ugm3')) {
                    $latestSelects[] = 'AVG(pm2_5_ugm3) as avg_pm25_ugm3';
                }
                if ($schema->hasColumn('sensor_latest', 'pm10_ugm3')) {
                    $latestSelects[] = 'AVG(pm10_ugm3) as avg_pm10_ugm3';
                }
                if ($schema->hasColumn('sensor_latest', 'temperature_c')) {
                    $latestSelects[] = 'AVG(temperature_c) as avg_temperature_c';
                }
                if ($schema->hasColumn('sensor_latest', 'humidity_rh')) {
                    $latestSelects[] = 'AVG(humidity_rh) as avg_humidity_rh';
                }
                if ($schema->hasColumn('sensor_latest', 'energy_kwh')) {
                    $latestSelects[] = 'AVG(energy_kwh) as avg_energy_kwh';
                }
                if ($schema->hasColumn('sensor_latest', 'people_total_in') && $schema->hasColumn('sensor_latest', 'people_total_out')) {
                    $latestSelects[] = 'AVG(COALESCE(people_total_in, 0) - COALESCE(people_total_out, 0)) as avg_people_present';
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
            if ($schema->hasColumn('readings', 'pm2_5_ugm3')) {
                $readingsSelects[] = 'AVG(pm2_5_ugm3) as avg_pm25_ugm3_window';
            }
            if ($schema->hasColumn('readings', 'pm10_ugm3')) {
                $readingsSelects[] = 'AVG(pm10_ugm3) as avg_pm10_ugm3_window';
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
            // Environmental / UV (outdoor / VS350-class sensors)
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
            if ($schema->hasColumn('readings', 'energy_kwh')) {
                $readingsSelects[] = 'AVG(energy_kwh) as avg_energy_kwh_recent';
            }
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
                $currentReadings = $q->first();
            }
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: 24h readings query failed', $e);
            $currentReadings = null;
        }

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
        $baseLoadData = null;
        try {
            if ($hasMeasuredAt && $schema->hasColumn('readings', 'energy_kwh')) {
                $offHourCondition = "(
                    HOUR(measured_at) BETWEEN 0 AND 6
                    OR DAYOFWEEK(measured_at) IN (1, 7)
                )";
                $occupancyNearZero = '';
                if ($schema->hasColumn('readings', 'people_total_in') && $schema->hasColumn('readings', 'people_total_out')) {
                    $occupancyNearZero = " AND ABS(COALESCE(people_total_in, 0) - COALESCE(people_total_out, 0)) <= 1";
                }

                $q = DB::table('readings')
                    ->selectRaw('AVG(energy_kwh) as avg_base_load_energy')
                    ->selectRaw('AVG(CASE WHEN '.$offHourCondition.$occupancyNearZero.' THEN energy_kwh END) as avg_off_hours_energy')
                    ->where('measured_at', '>=', $offHoursStart);
                $this->applyReadingsScope($q, $readingsScopeColumn, $sensorIdsScoped, $sensorIds, $sensorUidsScoped, $sensorUids);
                $baseLoadData = $q->first();
            }
        } catch (\Throwable $e) {
            $this->safeLogWarning('KPIInputAssembler: base-load query failed', $e);
            $baseLoadData = null;
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
        $avgEnergy = $this->toFloat($currentReadings->avg_energy_kwh_recent ?? null)
            ?? $this->toFloat($latest->avg_energy_kwh ?? null);
        $avgUv = $this->toFloat($currentReadings->avg_uv_index ?? null)
            ?? $this->toFloat($currentReadings->avg_modbus_chn_1 ?? null);

        $timeframeHours = self::timeframeHours($timeframe);

        // For energy intensity we still need an "occupancy" proxy. Use the
        // movement entry rate (people who entered during the window) as a
        // capped proxy. Confidence is downgraded to "estimated".
        $entryProxy = ($movementEntries !== null && $movementEntries > 0)
            ? min(2000.0, (float) $movementEntries)
            : null;

        return [
            'avg_co2_ppm' => $avgCo2,
            'avg_tvoc_index' => $avgTvoc,
            'avg_pm25_ugm3' => $avgPm25,
            'avg_pm10_ugm3' => $avgPm10,
            'avg_temperature_c' => $avgTemp,
            'avg_humidity_rh' => $avgHumidity,
            'avg_energy_kwh' => $avgEnergy,
            'avg_current_a' => $this->toFloat($currentReadings->avg_current_a ?? null),
            'avg_power_factor' => $this->toFloat($currentReadings->avg_power_factor ?? null),
            'avg_max_demand_kw' => $this->toFloat($currentReadings->avg_max_demand_kw ?? null),
            'avg_light_level' => $this->toFloat($currentReadings->avg_light_level ?? null),
            'avg_lux' => $this->toFloat($currentReadings->avg_lux ?? null),
            'avg_solar_radiation' => $this->toFloat($currentReadings->avg_solar_radiation ?? null),
            'avg_uv_index' => $avgUv,
            'avg_people_present' => $entryProxy, // null when no movement data
            'movement_entries' => $movementEntries,
            'movement_exits' => $movementExits,
            'timeframe_hours' => $timeframeHours,
            'max_capacity' => $this->toFloat($roomCapacity) ?? (float) $fallbackCapacity,
            'capacity_confidence' => $roomCapacity !== null ? 'measured' : 'estimated',
            'avg_base_load_energy' => $this->toFloat($baseLoadData->avg_base_load_energy ?? null),
            'avg_off_hours_energy' => $this->toFloat($baseLoadData->avg_off_hours_energy ?? null),
            'active_sensor_count' => $activeSensors,
            'has_scope' => $sensorIdsScoped || $sensorUidsScoped,
            'timeframe' => $timeframe,
        ];
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
        return match ($timeframe) {
            '7d' => Carbon::now()->subDays(7),
            '30d' => Carbon::now()->subDays(30),
            default => Carbon::now()->subHours(24),
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
            'avg_energy_kwh' => null,
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
