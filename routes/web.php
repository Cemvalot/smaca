<?php

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

if (!function_exists('smacaApiMetricWhitelist')) {
    function smacaApiMetricWhitelist(): array
    {
        return [
            'battery_pct',
            'co2_ppm',
            'temperature_c',
            'humidity_rh',
            'pm2_5_ugm3',
            'pm10_ugm3',
            'energy_kwh',
            'uv_index',
            'people_in',
            'people_out',
            'people_total_in',
            'people_total_out',
            'tvoc_index',
        ];
    }
}

if (!function_exists('smacaApiParseTimeframe')) {
    function smacaApiParseTimeframe(?string $timeframe): array
    {
        $resolved = $timeframe ?: '24h';
        $nowAthens = Carbon::now('Europe/Athens');

        return match ($resolved) {
            '24h' => ['24h', $nowAthens->copy()->subHours(24)],
            '7d' => ['7d', $nowAthens->copy()->subDays(7)],
            '30d' => ['30d', $nowAthens->copy()->subDays(30)],
            default => [null, null],
        };
    }
}

if (!function_exists('smacaApiIso')) {
    function smacaApiIso($value): ?string
    {
        if (empty($value)) {
            return null;
        }
        try {
            return Carbon::parse($value, 'Europe/Athens')->toISOString();
        } catch (\Throwable $e) {
            return null;
        }
    }
}

if (!function_exists('smacaApiSnapshotFromRow')) {
    function smacaApiSnapshotFromRow(object $row): array
    {
        return [
            'measured_at' => smacaApiIso($row->measured_at ?? null),
            'battery_pct' => $row->battery_pct ?? null,
            'co2_ppm' => $row->co2_ppm ?? null,
            'temperature_c' => $row->temperature_c ?? null,
            'humidity_rh' => $row->humidity_rh ?? null,
            'pm2_5_ugm3' => $row->pm2_5_ugm3 ?? null,
            'pm10_ugm3' => $row->pm10_ugm3 ?? null,
            'energy_kwh' => $row->energy_kwh ?? null,
            'uv_index' => $row->uv_index ?? null,
            'people_in' => $row->people_in ?? null,
            'people_out' => $row->people_out ?? null,
            'people_total_in' => $row->people_total_in ?? null,
            'people_total_out' => $row->people_total_out ?? null,
        ];
    }
}

if (!function_exists('smacaReadingsHasColumn')) {
    function smacaReadingsHasColumn(string $column): bool
    {
        return DB::getSchemaBuilder()->hasColumn('readings', $column);
    }
}

if (!function_exists('smacaHandleIngest')) {
    function smacaHandleIngest(Request $request)
    {
        $nowAthens = Carbon::now('Europe/Athens');

        // αισθητήρες στέλνουν κυρίως sensor_id στο querystring
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
            'meter_serial',
        ];

        $metricValues = [];
        foreach ($readingMetricFields as $field) {
            if (smacaReadingsHasColumn($field)) {
                $metricValues[$field] = $request->input($field);
            }
        }

        $readingBase = [
            'sensor_uid' => (string) $sensor->external_id,
            'measured_at' => $measuredAt,
            'message_uid' => $request->input('message_uid'),
            'created_at' => $nowAthens,
            'updated_at' => $nowAthens,
        ];

        if (smacaReadingsHasColumn('sensor_name')) {
            $readingBase['sensor_name'] = $request->input('sensor_name', $sensor->name ?? null);
        }

        if (smacaReadingsHasColumn('sensor_location')) {
            $readingBase['sensor_location'] = $request->input(
                'sensor_location',
                ($sensor->site_name ?? null) ?: ($sensor->site_address ?? null)
            );
        }

        $readingInsert = array_merge($readingBase, $metricValues);

        $readingId = DB::table('readings')->insertGetId($readingInsert);

        DB::table('sensors')
            ->where('id', $sensor->id)
            ->update([
                'last_seen_at' => $measuredAt,
                'updated_at' => $nowAthens,
            ]);

        DB::table('sensor_latest')->upsert([
            [
                'sensor_id' => $sensor->id,
                'reading_id' => $readingId,
                'measured_at' => $measuredAt,
                'battery_pct' => $metricValues['battery_pct'] ?? null,
                'co2_ppm' => $metricValues['co2_ppm'] ?? null,
                'temperature_c' => $metricValues['temperature_c'] ?? null,
                'humidity_rh' => $metricValues['humidity_rh'] ?? null,
                'pm2_5_ugm3' => $metricValues['pm2_5_ugm3'] ?? null,
                'pm10_ugm3' => $metricValues['pm10_ugm3'] ?? null,
                'energy_kwh' => $metricValues['energy_kwh'] ?? null,
                'uv_index' => $metricValues['uv_index'] ?? null,
                'people_in' => $metricValues['people_in'] ?? null,
                'people_out' => $metricValues['people_out'] ?? null,
                'people_total_in' => $metricValues['people_total_in'] ?? null,
                'people_total_out' => $metricValues['people_total_out'] ?? null,
                'created_at' => $nowAthens,
                'updated_at' => $nowAthens,
            ],
        ], ['sensor_id'], [
            'reading_id',
            'measured_at',
            'battery_pct',
            'co2_ppm',
            'temperature_c',
            'humidity_rh',
            'pm2_5_ugm3',
            'pm10_ugm3',
            'energy_kwh',
            'uv_index',
            'people_in',
            'people_out',
            'people_total_in',
            'people_total_out',
            'updated_at',
        ]);

        return response()->json([
            'ok' => true,
            'sensor_id' => $sensor->id,
            'sensor_uid' => $sensor->external_id,
            'reading_id' => $readingId,
            'measured_at' => $measuredAt->toISOString(),
        ], 201);
    }
}

// Page routes
Route::get('/', function () {
    return redirect('/landing');
});

Route::get('/landing', function () {
    return view('landing');
});

Route::get('/login', function () {
    return view('login');
});

Route::get('/register', function () {
    return view('register');
});

if (!function_exists('smacaDashboardViewData')) {
    function smacaDashboardViewData(string $smacaPage): array
    {
        $sites = DB::table('sites')
            ->select(['id', 'name'])
            ->get();

        $sensors = DB::table('sensors')
            ->select(['id', 'site_id', 'name', 'external_id', 'device_type', 'is_active'])
            ->orderBy('id')
            ->get();

        $sensor_latest = DB::table('sensor_latest')
            ->select(['sensor_id', 'measured_at', 'battery_pct'])
            ->get();

        return [
            'smacaPage' => $smacaPage,
            'sites' => $sites,
            'sensors' => $sensors,
            'sensor_latest' => $sensor_latest,
        ];
    }
}

Route::get('/dashboard', function () {
    return view('dashboard.pages.overview', smacaDashboardViewData('overview'));
});

Route::get('/dashboard/iaq', function () {
    return view('dashboard.pages.iaq', smacaDashboardViewData('iaq'));
});

Route::get('/dashboard/occupancy', function () {
    return view('dashboard.pages.occupancy', smacaDashboardViewData('occupancy'));
});

Route::get('/dashboard/environmental', function () {
    return view('dashboard.pages.environmental', smacaDashboardViewData('environmental'));
});

Route::get('/dashboard/connectivity', function () {
    return view('dashboard.pages.connectivity', smacaDashboardViewData('connectivity'));
});

Route::get('/dashboard/ai-insights', function () {
    return view('dashboard.pages.ai-insights', smacaDashboardViewData('ai-insights'));
});

Route::get('/dashboard/energy', function () {
    return view('dashboard.pages.energy', smacaDashboardViewData('energy'));
});

Route::get('/dashboard/management', function () {
    return view('dashboard.pages.management', smacaDashboardViewData('management'));
});

Route::get('/dashboard-legacy', function () {
    $sites = DB::table('sites')
        ->select(['id', 'name'])
        ->get();

    $sensors = DB::table('sensors')
        ->select(['id', 'site_id', 'name', 'external_id', 'device_type', 'is_active'])
        ->orderBy('id')
        ->get();

    $sensor_latest = DB::table('sensor_latest')
        ->select(['sensor_id', 'measured_at', 'battery_pct'])
        ->get();

    return view('dashboard', [
        'sites' => $sites,
        'sensors' => $sensors,
        'sensor_latest' => $sensor_latest,
    ]);
});

// IMPORTANT: compatibility route για αισθητήρες που στέλνουν GET /api?... 
Route::match(['GET', 'POST'], '/api', function (Request $request) {
    return smacaHandleIngest($request);
});

// Νέο route, επίσης δέχεται και GET και POST για να μη σπάει τίποτα
Route::match(['GET', 'POST'], '/api/readings/ingest', function (Request $request) {
    return smacaHandleIngest($request);
});

Route::get('/api/dashboard/overview', function () {
    $sitesCount = DB::table('sites')->count();
    $sensorsCount = DB::table('sensors')->count();
    $activeAlertsCount = DB::table('alerts')->where('is_enabled', true)->count();
    $latestUpdateAt = DB::table('sensor_latest')->max('measured_at');

    $latestSnapshotRows = DB::table('sensor_latest as sl')
        ->leftJoin('sensors as s', 's.id', '=', 'sl.sensor_id')
        ->leftJoin('sites as si', 'si.id', '=', 's.site_id')
        ->select([
            'sl.sensor_id',
            's.external_id as sensor_uid',
            's.name as sensor_name',
            's.device_type',
            's.is_active',
            'si.id as site_id',
            'si.name as site_name',
            'sl.measured_at',
            'sl.battery_pct',
            'sl.co2_ppm',
            'sl.temperature_c',
            'sl.humidity_rh',
            'sl.pm2_5_ugm3',
            'sl.pm10_ugm3',
            'sl.energy_kwh',
            'sl.uv_index',
            'sl.people_in',
            'sl.people_out',
            'sl.people_total_in',
            'sl.people_total_out',
        ])
        ->orderByDesc('sl.measured_at')
        ->get();

    return response()->json([
        'totals' => [
            'sites' => $sitesCount,
            'sensors' => $sensorsCount,
            'active_alerts' => $activeAlertsCount,
        ],
        'latest_update_at' => smacaApiIso($latestUpdateAt),
        'latest_sensor_snapshot_rows' => $latestSnapshotRows->map(function ($row) {
            return [
                'sensor_id' => $row->sensor_id,
                'sensor_uid' => $row->sensor_uid,
                'sensor_name' => $row->sensor_name,
                'device_type' => $row->device_type,
                'is_active' => $row->is_active,
                'site_id' => $row->site_id,
                'site_name' => $row->site_name,
                'measured_at' => smacaApiIso($row->measured_at),
                'battery_pct' => $row->battery_pct,
                'co2_ppm' => $row->co2_ppm,
                'temperature_c' => $row->temperature_c,
                'humidity_rh' => $row->humidity_rh,
                'pm2_5_ugm3' => $row->pm2_5_ugm3,
                'pm10_ugm3' => $row->pm10_ugm3,
                'energy_kwh' => $row->energy_kwh,
                'uv_index' => $row->uv_index,
                'people_in' => $row->people_in,
                'people_out' => $row->people_out,
                'people_total_in' => $row->people_total_in,
                'people_total_out' => $row->people_total_out,
            ];
        })->values(),
    ]);
});

Route::get('/api/sensors', function () {
    $rows = DB::table('sensors as s')
        ->leftJoin('sites as si', 'si.id', '=', 's.site_id')
        ->leftJoin('sensor_latest as sl', 'sl.sensor_id', '=', 's.id')
        ->select([
            's.id',
            's.external_id as sensor_uid',
            's.name',
            's.device_type',
            's.is_active',
            's.last_seen_at',
            'si.id as site_id',
            'si.name as site_name',
            'sl.measured_at',
            'sl.battery_pct',
            'sl.co2_ppm',
            'sl.temperature_c',
            'sl.humidity_rh',
            'sl.pm2_5_ugm3',
            'sl.pm10_ugm3',
            'sl.energy_kwh',
            'sl.uv_index',
            'sl.people_in',
            'sl.people_out',
            'sl.people_total_in',
            'sl.people_total_out',
        ])
        ->orderBy('s.id')
        ->get();

    return response()->json([
        'rows' => $rows->map(function ($row) {
            return [
                'id' => $row->id,
                'sensor_uid' => $row->sensor_uid,
                'name' => $row->name,
                'device_type' => $row->device_type,
                'is_active' => $row->is_active,
                'last_seen_at' => smacaApiIso($row->last_seen_at),
                'site' => [
                    'id' => $row->site_id,
                    'name' => $row->site_name,
                ],
                'latest' => smacaApiSnapshotFromRow($row),
            ];
        })->values(),
    ]);
});

Route::get('/api/sensors/{id}/latest', function ($id) {
    $row = DB::table('sensors as s')
        ->leftJoin('sites as si', 'si.id', '=', 's.site_id')
        ->leftJoin('sensor_latest as sl', 'sl.sensor_id', '=', 's.id')
        ->select([
            's.id',
            's.external_id as sensor_uid',
            's.name',
            's.device_type',
            's.is_active',
            's.last_seen_at',
            'si.id as site_id',
            'si.name as site_name',
            'sl.measured_at',
            'sl.battery_pct',
            'sl.co2_ppm',
            'sl.temperature_c',
            'sl.humidity_rh',
            'sl.pm2_5_ugm3',
            'sl.pm10_ugm3',
            'sl.energy_kwh',
            'sl.uv_index',
            'sl.people_in',
            'sl.people_out',
            'sl.people_total_in',
            'sl.people_total_out',
        ])
        ->where('s.id', (int) $id)
        ->first();

    if (!$row) {
        return response()->json([
            'message' => 'Sensor not found',
        ], 404);
    }

    return response()->json([
        'row' => [
            'id' => $row->id,
            'sensor_uid' => $row->sensor_uid,
            'name' => $row->name,
            'device_type' => $row->device_type,
            'is_active' => $row->is_active,
            'last_seen_at' => smacaApiIso($row->last_seen_at),
            'site' => [
                'id' => $row->site_id,
                'name' => $row->site_name,
            ],
            'latest' => smacaApiSnapshotFromRow($row),
        ],
    ]);
});

Route::get('/api/sensors/{id}/timeseries', function (Request $request, $id) {
    $metric = (string) $request->query('metric', '');
    $allowedMetrics = smacaApiMetricWhitelist();

    if (!in_array($metric, $allowedMetrics, true)) {
        return response()->json([
            'message' => 'Invalid metric',
            'allowed_metrics' => $allowedMetrics,
        ], 422);
    }

    $sensor = DB::table('sensors')
        ->select(['id', 'external_id'])
        ->where('id', (int) $id)
        ->first();

    if (!$sensor) {
        return response()->json([
            'message' => 'Sensor not found',
        ], 404);
    }

    [$timeframe, $from] = smacaApiParseTimeframe($request->query('timeframe'));
    if (!$timeframe || !$from) {
        return response()->json([
            'message' => 'Invalid timeframe. Use one of: 24h, 7d, 30d',
        ], 422);
    }

    $query = DB::table('readings')
        ->select(['measured_at', DB::raw($metric . ' as metric_value')])
        ->where('measured_at', '>=', $from)
        ->orderBy('measured_at');

    if (smacaReadingsHasColumn('sensor_uid')) {
        $query->where('sensor_uid', $sensor->external_id);
    } elseif (smacaReadingsHasColumn('sensor_id')) {
        $query->where('sensor_id', $sensor->id);
    } else {
        return response()->json([
            'message' => 'Unsupported readings schema',
        ], 500);
    }

    if (!in_array($metric, ['people_total_in', 'people_total_out'], true)) {
        $query->whereNotNull($metric);
    }

    $points = $query->get();

    return response()->json([
        'sensor_id' => (int) $id,
        'metric' => $metric,
        'timeframe' => $timeframe,
        'points' => $points->map(function ($point) {
            return [
                'time' => smacaApiIso($point->measured_at),
                'value' => $point->metric_value,
            ];
        })->values(),
    ]);
});

Route::get('/logout', function () {
    return redirect('/landing');
});