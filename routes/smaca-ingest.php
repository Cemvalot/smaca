<?php

use App\Support\TelemetryMetricColumns;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Implementation helper used by `routes/web-api-legacy.php` wrapper.

if (!function_exists('smacaHandleIngest_impl')) {
    function smacaHandleIngest_impl(Request $request)
    {
        $nowAthens = Carbon::now('Europe/Athens');

        // Sensors send sensor_id primarily via querystring
        $sensorUid = $request->input('sensor_id', $request->input('sensor_uid'));

        if (empty($sensorUid)) {
            return response()->json([
                'ok' => false,
                'message' => 'sensor_id or sensor_uid is required',
            ], 422);
        }

        $sensor = DB::table('sensors as s')
            ->leftJoin('sites as si', 'si.id', '=', 's.site_id')
            ->select([
                's.id',
                's.external_id',
                's.name',
                's.site_id',
                'si.name as site_name',
                'si.address as site_address',
            ])
            ->where('s.external_id', (string) $sensorUid)
            ->first();

        if (!$sensor && is_numeric($sensorUid)) {
            $sensor = DB::table('sensors as s')
                ->leftJoin('sites as si', 'si.id', '=', 's.site_id')
                ->select([
                    's.id',
                    's.external_id',
                    's.name',
                    's.site_id',
                    'si.name as site_name',
                    'si.address as site_address',
                ])
                ->where('s.id', (int) $sensorUid)
                ->first();
        }

        if (!$sensor) {
            return response()->json([
                'ok' => false,
                'message' => 'Sensor not found',
                'incoming_sensor' => $sensorUid,
            ], 404);
        }

        if ($request->filled('measured_at')) {
            try {
                $measuredAt = Carbon::parse($request->input('measured_at'), 'Europe/Athens');
            } catch (\Throwable $e) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Invalid measured_at timestamp',
                ], 422);
            }
        } else {
            $measuredAt = $nowAthens;
        }

        $readingMetricFields = [
            'battery_pct',
            'co2_ppm',
            'temperature_c',
            'humidity_rh',
            'pressure_hpa',
            'tvoc_index',
            'pm2_5_ugm3',
            'pm10_ugm3',
            'light_level',
            'pir',
            'people_in',
            'people_out',
            'people_total_in',
            'people_total_out',
            'uv_index',
            'gpio_in1',
            'gpio_in2',
            'energy_kwh',
            'current_a',
            'power_factor',
            'frequency_hz',
            'max_demand_kw',

            // NETWORK QUALITY
            'signal_strength',
            'tx_ccq',
            'snr',
            'tx_rate',

            'meter_serial',
        ];

        $metricValues = [];
        foreach ($readingMetricFields as $field) {
            $physical = $field;
            if ($field === 'pm2_5_ugm3') {
                $physical = TelemetryMetricColumns::readingsPm25PhysicalColumn() ?? $field;
            } elseif ($field === 'pm10_ugm3') {
                $physical = TelemetryMetricColumns::readingsPm10PhysicalColumn() ?? $field;
            }
            if (smacaReadingsHasColumn_impl($physical)) {
                $metricValues[$physical] = $request->input($field);
            }
        }

        $readingBase = [
            'sensor_uid' => (string) $sensor->external_id,
            'measured_at' => $measuredAt,
            'message_uid' => $request->input('message_uid'),
            'created_at' => $nowAthens,
            'updated_at' => $nowAthens,
        ];

        if (smacaReadingsHasColumn_impl('sensor_name')) {
            $readingBase['sensor_name'] = $request->input('sensor_name', $sensor->name ?? null);
        }

        if (smacaReadingsHasColumn_impl('sensor_location')) {
            $readingBase['sensor_location'] = $request->input(
                'sensor_location',
                ($sensor->site_name ?? null) ?: ($sensor->site_address ?? null)
            );
        }

        $readingInsert = array_merge($readingBase, $metricValues);
        foreach ([
            'signal_strength' => $request->input('signal_strength'),
            'tx_ccq' => $request->input('tx_ccq'),
            'snr' => $request->input('snr'),
            'tx_rate' => $request->input('tx_rate'),
        ] as $col => $val) {
            if (smacaReadingsHasColumn_impl($col)) {
                $readingInsert[$col] = $val;
            }
        }

        $readingId = DB::table('readings')->insertGetId($readingInsert);

        DB::table('sensors')
            ->where('id', $sensor->id)
            ->update([
                'last_seen_at' => $measuredAt,
                'updated_at' => $nowAthens,
            ]);

        $latestSchema = DB::getSchemaBuilder();
        $pm25LatestCol = TelemetryMetricColumns::sensorLatestPm25PhysicalColumn();
        $pm10LatestCol = TelemetryMetricColumns::sensorLatestPm10PhysicalColumn();
        $pm25ReadingCol = TelemetryMetricColumns::readingsPm25PhysicalColumn();
        $pm10ReadingCol = TelemetryMetricColumns::readingsPm10PhysicalColumn();

        $latestRow = [
            'sensor_id' => $sensor->id,
            'reading_id' => $readingId,
            'measured_at' => $measuredAt,
            'battery_pct' => $metricValues['battery_pct'] ?? null,
            'co2_ppm' => $metricValues['co2_ppm'] ?? null,
            'temperature_c' => $metricValues['temperature_c'] ?? null,
            'humidity_rh' => $metricValues['humidity_rh'] ?? null,
            'energy_kwh' => $metricValues['energy_kwh'] ?? null,
            'uv_index' => $metricValues['uv_index'] ?? null,
            'people_in' => $metricValues['people_in'] ?? null,
            'people_out' => $metricValues['people_out'] ?? null,
            'people_total_in' => $metricValues['people_total_in'] ?? null,
            'people_total_out' => $metricValues['people_total_out'] ?? null,
            'created_at' => $nowAthens,
            'updated_at' => $nowAthens,
        ];
        if ($pm25LatestCol !== null) {
            $latestRow[$pm25LatestCol] = $pm25ReadingCol !== null
                ? ($metricValues[$pm25ReadingCol] ?? null)
                : null;
        }
        if ($pm10LatestCol !== null) {
            $latestRow[$pm10LatestCol] = $pm10ReadingCol !== null
                ? ($metricValues[$pm10ReadingCol] ?? null)
                : null;
        }
        foreach (['tvoc_index', 'light_level', 'lux'] as $iaqCol) {
            if ($latestSchema->hasColumn('sensor_latest', $iaqCol)) {
                $latestRow[$iaqCol] = $metricValues[$iaqCol] ?? null;
            }
        }
        foreach ([
            'signal_strength' => $request->input('signal_strength'),
            'tx_ccq' => $request->input('tx_ccq'),
            'snr' => $request->input('snr'),
            'tx_rate' => $request->input('tx_rate'),
        ] as $col => $val) {
            if ($latestSchema->hasColumn('sensor_latest', $col)) {
                $latestRow[$col] = $val;
            }
        }

        $latestUpdateCols = array_values(array_diff(array_keys($latestRow), ['sensor_id', 'created_at']));

        DB::table('sensor_latest')->upsert([$latestRow], ['sensor_id'], $latestUpdateCols);

        return response()->json([
            'ok' => true,
            'sensor_id' => $sensor->id,
            'sensor_uid' => $sensor->external_id,
            'reading_id' => $readingId,
            'measured_at' => $measuredAt->toISOString(),
        ], 201);
    }
}

