<?php

use Carbon\Carbon;
use App\Services\KPI\KPIInputAssembler;
use App\Services\KPI\KPIMetadataService;
use App\Services\KPI\KPIService;
use App\Services\Spatial\SpatialService;
use App\Services\Thresholds\ThresholdService;
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

    // SpatialService is locale-aware; instantiating once here keeps the
    // per-row map() cheap and avoids re-resolving the active locale.
    $spatial = new SpatialService();

    return response()->json([
        'rows' => $rows->map(function ($row) use ($spatial) {
            return [
                'id' => $row->id,
                'sensor_uid' => $row->sensor_uid,
                'name' => $row->name,
                'sensor_name' => $row->latest_sensor_name ?: $row->name,
                'sensor_location' => $row->latest_sensor_location,
                // Human-readable label for the location code (e.g. "F0" →
                // "Ground Floor"). Frontend / exports prefer this over the
                // raw code; the raw code stays as technical metadata.
                'sensor_location_label' => $row->latest_sensor_location
                    ? $spatial->labelFor($row->latest_sensor_location)
                    : null,
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

    $spatial = new SpatialService();

    return response()->json([
        'row' => [
            'id' => $row->id,
            'sensor_uid' => $row->sensor_uid,
            'name' => $row->name,
            'sensor_name' => $row->latest_sensor_name ?: $row->name,
            'sensor_location' => $row->latest_sensor_location,
            'sensor_location_label' => $row->latest_sensor_location
                ? $spatial->labelFor($row->latest_sensor_location)
                : null,
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
    // The KPI summary route MUST never 500. Any unexpected exception is
    // logged and surfaced to the UI as an empty (insufficient_data) payload
    // so the dashboard degrades gracefully on unknown topology / DB issues.
    try {
        $spatial = new SpatialService();
        $service = new KPIService(new KPIInputAssembler(), new ThresholdService(), $spatial);

        $module = $spatial->normalizeModule((string) ($request->query('module') ?? ''));
        $location = $spatial->normalizeLocation((string) ($request->query('location') ?? ''));
        $timeframe = KPIInputAssembler::resolveTimeframe($request->query('timeframe'));

        return response()->json($service->getSummary($module, $location, $timeframe));
    } catch (\Throwable $e) {
        try {
            \Illuminate\Support\Facades\Log::warning('GET /api/kpis/summary: unexpected exception, returning safe empty payload', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
                'module' => $request->query('module'),
                'location' => $request->query('location'),
                'timeframe' => $request->query('timeframe'),
            ]);
        } catch (\Throwable $ignored) {}

        $module = strtolower(trim((string) ($request->query('module') ?? 'overview')));
        $location = $request->query('location');
        $timeframe = KPIInputAssembler::resolveTimeframe($request->query('timeframe'));
        return response()->json([
            'module' => $module !== '' ? $module : 'overview',
            'location' => $location ? strtoupper((string) $location) : null,
            'location_label' => null,
            'timeframe' => $timeframe,
            'kpis' => [],
            'degraded' => true,
        ]);
    }
});

Route::get('/api/config/thresholds', function () {
    $service = new ThresholdService();
    return response()->json([
        'thresholds' => $service->getPublicThresholds(),
    ]);
});

// D5.1 clarity layer — public-safe KPI metadata dictionary. Returns ALL KPIs
// (locale-resolved). The frontend uses this to render "How to read this"
// expandable details on every KPI card.
Route::get('/api/config/kpis', function (Request $request) {
    try {
        $locale = $request->query('locale');
        $service = new KPIMetadataService(is_string($locale) ? $locale : null);
        return response()->json($service->getAllKpis());
    } catch (\Throwable $e) {
        try {
            \Illuminate\Support\Facades\Log::warning('GET /api/config/kpis failed', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $ignored) {}
        return response()->json([
            'version' => '0.0.0',
            'locale' => 'en',
            'source_types' => new \stdClass(),
            'role_detail_level' => new \stdClass(),
            'kpis' => new \stdClass(),
            'error' => 'metadata_unavailable',
        ], 200);
    }
});

// D5.1 clarity layer — public-safe chart explanation dictionary. Used by the
// `smaca-chart-explainer.js` module to inject expandable explanations under
// every chart panel.
Route::get('/api/config/charts', function (Request $request) {
    try {
        $locale = $request->query('locale');
        $service = new KPIMetadataService(is_string($locale) ? $locale : null);
        return response()->json($service->getAllCharts());
    } catch (\Throwable $e) {
        try {
            \Illuminate\Support\Facades\Log::warning('GET /api/config/charts failed', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $ignored) {}
        return response()->json([
            'version' => '0.0.0',
            'locale' => 'en',
            'charts' => new \stdClass(),
            'error' => 'metadata_unavailable',
        ], 200);
    }
});

Route::get('/api/spatial/locations', function (Request $request) {
    try {
        $service = new SpatialService();
        $module = $request->query('module');
        $module = $module === null || $module === '' ? null : (string) $module;

        // Role: prefer explicit query param (admin tools), otherwise derive
        // from session. Default to "user" when no session is established.
        $role = $request->query('role');
        if ($role === null || $role === '') {
            $role = function_exists('session') ? (string) session('role', 'user') : 'user';
        }

        return response()->json($service->getLocationsForModule($module, $role));
    } catch (\Throwable $e) {
        try {
            \Illuminate\Support\Facades\Log::warning('GET /api/spatial/locations: unexpected exception', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $ignored) {}
        return response()->json([
            'groups' => [
                'floors' => ['label' => 'Floors', 'order' => 1, 'items' => []],
                'basements' => ['label' => 'Basements', 'order' => 2, 'items' => []],
                'special_spaces' => ['label' => 'Special spaces', 'order' => 3, 'items' => []],
                'passages' => ['label' => 'Passages', 'order' => 4, 'items' => []],
            ],
            'degraded' => true,
        ]);
    }
});

// -----------------------------------------------------------------------------
// Admin-only topology audit. Returns a topology-validation summary so an
// operator can verify that real deployed sensors match the configured spatial
// topology / module assignment. No data writes; safe to call repeatedly.
// -----------------------------------------------------------------------------
Route::get('/api/admin/topology-audit', function (Request $request) {
    if ((string) session('role', '') !== 'admin') {
        return response()->json(['message' => 'Forbidden'], 403);
    }

    try {
        $spatial = new SpatialService();
        $cfg = (array) (function_exists('config') ? config('smaca_spatial', []) : []);
        $configuredLocations = $spatial->getConfiguredLocations();
        $moduleCapabilities = $spatial->getModuleCapabilities();
        $sensorTypeToModule = is_array($cfg['sensor_type_to_module'] ?? null)
            ? $cfg['sensor_type_to_module']
            : [];

        $schema = DB::getSchemaBuilder();
        $hasSensors = $schema->hasTable('sensors');
        $hasReadings = $schema->hasTable('readings');
        $hasSensorLatest = $schema->hasTable('sensor_latest');

        // Total sensors + by device_type + active count
        $totalSensors = 0; $activeSensors = 0;
        $byDeviceType = []; $byLocation = [];
        $sensorsAggByLocation = [];
        $stale = []; $batteryLow = [];
        $nullLocationReadings = 0; $totalReadings = 0;
        $observedLocations = [];
        $latestPerSensor = [];

        if ($hasSensors) {
            $sensors = DB::table('sensors')
                ->select(['id', 'external_id', 'name', 'device_type', 'is_active'])
                ->get();
            $totalSensors = $sensors->count();
            $activeSensors = (int) $sensors->where('is_active', 1)->count();
            foreach ($sensors as $s) {
                $type = (string) ($s->device_type ?? 'unknown');
                $byDeviceType[$type] = ($byDeviceType[$type] ?? 0) + 1;
            }
        }

        // Latest reading per sensor (location, measured_at, battery if present)
        if ($hasSensorLatest && $hasReadings) {
            $hasBattery = $schema->hasColumn('sensor_latest', 'battery_pct');
            $select = ['sl.sensor_id', 'sl.measured_at', 'r.sensor_location'];
            if ($hasBattery) $select[] = 'sl.battery_pct';
            $rows = DB::table('sensor_latest as sl')
                ->leftJoin('readings as r', 'r.id', '=', 'sl.reading_id')
                ->select($select)
                ->get();

            $now = \Carbon\Carbon::now();
            foreach ($rows as $r) {
                $sid = (int) $r->sensor_id;
                $latestPerSensor[$sid] = $r;
                $loc = $r->sensor_location ?? null;
                $loc = $loc !== null ? strtoupper(trim((string) $loc)) : null;
                if ($loc !== null && $loc !== '') {
                    $observedLocations[$loc] = true;
                    $byLocation[$loc] = ($byLocation[$loc] ?? 0) + 1;
                    $sensorsAggByLocation[$loc][] = $sid;
                }

                if ($r->measured_at) {
                    try {
                        $diff = $now->diffInMinutes(\Carbon\Carbon::parse($r->measured_at));
                        if ($diff > 60) {
                            $stale[] = [
                                'sensor_id' => $sid,
                                'minutes_since_last' => $diff,
                                'last_seen_at' => (string) $r->measured_at,
                                'location' => $loc,
                            ];
                        }
                    } catch (\Throwable $ignored) {}
                }

                if ($hasBattery && isset($r->battery_pct) && $r->battery_pct !== null) {
                    if ((float) $r->battery_pct < 20.0) {
                        $batteryLow[] = [
                            'sensor_id' => $sid,
                            'battery_pct' => (float) $r->battery_pct,
                            'location' => $loc,
                        ];
                    }
                }
            }
        }

        // Null sensor_location count (raw readings, last 30 days)
        if ($hasReadings && $schema->hasColumn('readings', 'sensor_location')) {
            try {
                $since = \Carbon\Carbon::now()->subDays(30);
                $totalReadings = (int) DB::table('readings')->where('measured_at', '>=', $since)->count();
                $nullLocationReadings = (int) DB::table('readings')
                    ->where('measured_at', '>=', $since)
                    ->where(function ($q) {
                        $q->whereNull('sensor_location')->orWhere('sensor_location', '');
                    })
                    ->count();
            } catch (\Throwable $ignored) {}
        }

        // Locations per module (configured + observed) and gaps.
        $locationsPerModule = [];
        $missingPerModule = [];
        $modules = ['iaq', 'occupancy', 'energy', 'environmental'];
        foreach ($modules as $m) {
            $valid = []; $missing = [];
            foreach (array_keys($configuredLocations) as $code) {
                if (!$spatial->locationSupportsModule($code, $m)) continue;
                $hasObservedSensor = !empty($sensorsAggByLocation[$code]);
                $info = [
                    'code' => $code,
                    'label' => $spatial->labelFor($code),
                    'sensor_count' => count($sensorsAggByLocation[$code] ?? []),
                ];
                if ($hasObservedSensor) {
                    $valid[] = $info;
                } else {
                    $missing[] = $info;
                }
            }
            $locationsPerModule[$m] = $valid;
            $missingPerModule[$m] = $missing;
        }

        // Locations seen in DB but unknown to config.
        $unknownLocations = [];
        foreach (array_keys($observedLocations) as $code) {
            if (!isset($configuredLocations[$code])) {
                $unknownLocations[] = $code;
            }
        }
        sort($unknownLocations);

        return response()->json([
            'generated_at' => \Carbon\Carbon::now()->toIso8601String(),
            'sensors' => [
                'total' => $totalSensors,
                'active' => $activeSensors,
                'by_device_type' => $byDeviceType,
                'by_location' => $byLocation,
            ],
            'readings' => [
                'window_days' => 30,
                'total' => $totalReadings,
                'with_null_location' => $nullLocationReadings,
            ],
            'modules' => [
                'capabilities' => $moduleCapabilities,
                'sensor_type_to_module' => $sensorTypeToModule,
                'locations_with_sensors' => $locationsPerModule,
                'locations_without_sensors' => $missingPerModule,
            ],
            'health' => [
                'stale_sensors_count' => count($stale),
                'stale_sensors' => array_slice($stale, 0, 50),
                'battery_low_count' => count($batteryLow),
                'battery_low' => array_slice($batteryLow, 0, 50),
                'unknown_locations' => $unknownLocations,
            ],
        ]);
    } catch (\Throwable $e) {
        try {
            \Illuminate\Support\Facades\Log::warning('GET /api/admin/topology-audit: unexpected exception', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $ignored) {}
        return response()->json(['message' => 'Topology audit unavailable', 'degraded' => true], 200);
    }
});
