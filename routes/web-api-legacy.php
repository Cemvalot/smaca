<?php

use Carbon\Carbon;
use App\Services\KPI\KPIInputAssembler;
use App\Services\KPI\KPIService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

require_once __DIR__ . '/smaca-api-helpers.php';
require_once __DIR__ . '/smaca-ingest.php';

if (!function_exists('smacaApiMetricWhitelist')) {
    function smacaApiMetricWhitelist(): array
    {
        return smacaApiMetricWhitelist_impl();
    }
}

if (!function_exists('smacaApiParseTimeframe')) {
    function smacaApiParseTimeframe(?string $timeframe): array
    {
        return smacaApiParseTimeframe_impl($timeframe);
    }
}

if (!function_exists('smacaApiIso')) {
    function smacaApiIso($value): ?string
    {
        return smacaApiIso_impl($value);
    }
}

if (!function_exists('smacaApiSnapshotFromRow')) {
    function smacaApiSnapshotFromRow(object $row): array
    {
        return smacaApiSnapshotFromRow_impl($row);
    }
}

if (!function_exists('smacaReadingsHasColumn')) {
    function smacaReadingsHasColumn(string $column): bool
    {
        return smacaReadingsHasColumn_impl($column);
    }
}

if (!function_exists('smacaHandleIngest')) {
    function smacaHandleIngest(Request $request)
    {
        return smacaHandleIngest_impl($request);
    }
}

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
        ->leftJoin('readings as r', 'r.id', '=', 'sl.reading_id')
        ->select([
            's.id',
            's.external_id as sensor_uid',
            's.name',
            's.device_type',
            's.is_active',
            's.last_seen_at',
            'si.id as site_id',
            'si.name as site_name',
            'r.sensor_name as latest_sensor_name',
            'r.sensor_location as latest_sensor_location',
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
                'sensor_name' => $row->latest_sensor_name ?: $row->name,
                'sensor_location' => $row->latest_sensor_location,
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
        ->leftJoin('readings as r', 'r.id', '=', 'sl.reading_id')
        ->select([
            's.id',
            's.external_id as sensor_uid',
            's.name',
            's.device_type',
            's.is_active',
            's.last_seen_at',
            'si.id as site_id',
            'si.name as site_name',
            'r.sensor_name as latest_sensor_name',
            'r.sensor_location as latest_sensor_location',
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
            'sensor_name' => $row->latest_sensor_name ?: $row->name,
            'sensor_location' => $row->latest_sensor_location,
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
            'message' => 'Invalid timeframe. Use one of: 24h, 7d, 30d, 6m',
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

Route::get('/api/kpis/summary', function (Request $request) {
    $service = new KPIService(new KPIInputAssembler());
    return response()->json($service->getSummary($request->query('module')));
});
