<?php

use App\Support\TelemetryMetricColumns;
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
require_once __DIR__ . '/smaca-telemetry-rebuild.php';
require_once __DIR__ . '/smaca-energy-kpi-audit.php';

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

if (!function_exists('smacaApiSnapshotFromRowWithIaqFallback')) {
    function smacaApiSnapshotFromRowWithIaqFallback(object $row, ?object $readingFallback = null): array
    {
        return smacaApiSnapshotFromRowWithIaqFallback_impl($row, $readingFallback);
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
        ->select(array_merge([
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
            'sl.energy_kwh',
            'sl.uv_index',
            'sl.people_in',
            'sl.people_out',
            'sl.people_total_in',
            'sl.people_total_out',
        ], TelemetryMetricColumns::sensorLatestPm25SelectFragments('sl'),
            TelemetryMetricColumns::sensorLatestPm10SelectFragments('sl'),
            smacaApiSensorLatestOptionalSelectColumns_impl()))
        ->orderByDesc('sl.measured_at')
        ->get();

    $overviewIaqFallback = smacaReadingsLatestIaqMapForSensors_impl($latestSnapshotRows);

    return response()->json([
        'totals' => [
            'sites' => $sitesCount,
            'sensors' => $sensorsCount,
            'active_alerts' => $activeAlertsCount,
        ],
        'latest_update_at' => smacaApiIso($latestUpdateAt),
        'latest_sensor_snapshot_rows' => $latestSnapshotRows->map(function ($row) use ($overviewIaqFallback) {
            return smacaApiSnapshotFromRowWithIaqFallback(
                $row,
                $overviewIaqFallback[(int) ($row->sensor_id ?? 0)] ?? null
            ) + [
                'sensor_id' => $row->sensor_id,
                'sensor_uid' => $row->sensor_uid,
                'sensor_name' => $row->sensor_name,
                'device_type' => $row->device_type,
                'is_active' => $row->is_active,
                'site_id' => $row->site_id,
                'site_name' => $row->site_name,
            ];
        })->values(),
    ]);
});

Route::get('/api/sensors', function () {
    $rows = DB::table('sensors as s')
        ->leftJoin('sites as si', 'si.id', '=', 's.site_id')
        ->leftJoin('sensor_latest as sl', 'sl.sensor_id', '=', 's.id')
        ->leftJoin('readings as r', 'r.id', '=', 'sl.reading_id')
        ->select(array_merge([
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
            'sl.energy_kwh',
            'sl.uv_index',
            'sl.people_in',
            'sl.people_out',
            'sl.people_total_in',
            'sl.people_total_out',
        ], TelemetryMetricColumns::sensorLatestPm25SelectFragments('sl'),
            TelemetryMetricColumns::sensorLatestPm10SelectFragments('sl'),
            smacaApiSensorLatestOptionalSelectColumns_impl()))
        ->orderBy('s.id')
        ->get();

    $iaqReadingsBySensorId = smacaReadingsLatestIaqMapForSensors_impl($rows);
    $iaqFallbackStatus = smacaReadingsIaqFallbackStatus_impl();

    // SpatialService is locale-aware; instantiating once here keeps the
    // per-row map() cheap and avoids re-resolving the active locale.
    $spatial = new SpatialService();

    // Treat the historical "Default Site" placeholder (and null / empty) as
    // "no real spatial code" so the dashboard doesn't render it as if it were
    // a configured location. This is purely a presentation-layer cleanup —
    // the underlying readings rows are untouched.
    $sanitizeLocation = static function ($raw): ?string {
        if ($raw === null) return null;
        $trimmed = trim((string) $raw);
        if ($trimmed === '' || strcasecmp($trimmed, 'Default Site') === 0) {
            return null;
        }
        return $trimmed;
    };

    return response()->json([
        'iaq_readings_fallback' => $iaqFallbackStatus,
        'rows' => $rows->map(function ($row) use ($spatial, $sanitizeLocation, $iaqReadingsBySensorId) {
            $location = $sanitizeLocation($row->latest_sensor_location);
            return [
                'id' => $row->id,
                'sensor_uid' => $row->sensor_uid,
                'name' => $row->name,
                'sensor_name' => $row->latest_sensor_name ?: $row->name,
                'sensor_location' => $location,
                // Human-readable label for the location code (e.g. "F0" →
                // "Ground Floor"). Frontend / exports prefer this over the
                // raw code; the raw code stays as technical metadata.
                'sensor_location_label' => $location
                    ? $spatial->labelFor($location)
                    : null,
                'device_type' => $row->device_type,
                'is_active' => $row->is_active,
                'last_seen_at' => smacaApiIso($row->last_seen_at),
                'site' => [
                    'id' => $row->site_id,
                    'name' => $row->site_name,
                ],
                'latest' => smacaApiSnapshotFromRowWithIaqFallback(
                    $row,
                    $iaqReadingsBySensorId[(int) $row->id] ?? null
                ),
            ];
        })->values(),
    ]);
});

Route::get('/api/sensors/{id}/latest', function ($id) {
    $row = DB::table('sensors as s')
        ->leftJoin('sites as si', 'si.id', '=', 's.site_id')
        ->leftJoin('sensor_latest as sl', 'sl.sensor_id', '=', 's.id')
        ->leftJoin('readings as r', 'r.id', '=', 'sl.reading_id')
        ->select(array_merge([
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
            'sl.energy_kwh',
            'sl.uv_index',
            'sl.people_in',
            'sl.people_out',
            'sl.people_total_in',
            'sl.people_total_out',
        ], TelemetryMetricColumns::sensorLatestPm25SelectFragments('sl'),
            TelemetryMetricColumns::sensorLatestPm10SelectFragments('sl'),
            smacaApiSensorLatestOptionalSelectColumns_impl()))
        ->where('s.id', (int) $id)
        ->first();

    if (!$row) {
        return response()->json([
            'message' => 'Sensor not found',
        ], 404);
    }

    $spatial = new SpatialService();

    $rawLoc = $row->latest_sensor_location;
    $trimmedLoc = $rawLoc === null ? null : trim((string) $rawLoc);
    $location = ($trimmedLoc === null || $trimmedLoc === '' || strcasecmp($trimmedLoc, 'Default Site') === 0)
        ? null
        : $trimmedLoc;

    $iaqFallbackMap = smacaReadingsLatestIaqMapForSensors_impl([$row]);

    return response()->json([
        'iaq_readings_fallback' => smacaReadingsIaqFallbackStatus_impl(),
        'row' => [
            'id' => $row->id,
            'sensor_uid' => $row->sensor_uid,
            'name' => $row->name,
            'sensor_name' => $row->latest_sensor_name ?: $row->name,
            'sensor_location' => $location,
            'sensor_location_label' => $location
                ? $spatial->labelFor($location)
                : null,
            'device_type' => $row->device_type,
            'is_active' => $row->is_active,
            'last_seen_at' => smacaApiIso($row->last_seen_at),
            'site' => [
                'id' => $row->site_id,
                'name' => $row->site_name,
            ],
            'latest' => smacaApiSnapshotFromRowWithIaqFallback(
                $row,
                $iaqFallbackMap[(int) $row->id] ?? null
            ),
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

    $dbMetric = $metric;
    if ($metric === 'pm2_5_ugm3') {
        $dbMetric = TelemetryMetricColumns::readingsPm25PhysicalColumn() ?? 'pm2_5_ugm3';
    } elseif ($metric === 'pm10_ugm3') {
        $dbMetric = TelemetryMetricColumns::readingsPm10PhysicalColumn() ?? 'pm10_ugm3';
    }

    if (!smacaReadingsHasColumn($dbMetric)) {
        return response()->json([
            'message' => 'Metric unavailable for readings schema',
            'metric' => $metric,
        ], 422);
    }

    $query = DB::table('readings')
        ->select(['measured_at', DB::raw($dbMetric.' as metric_value')])
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
        $query->whereNotNull($dbMetric);
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

// Clarity layer — public-safe KPI metadata dictionary. Returns ALL KPIs
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

// Clarity layer — public-safe chart explanation dictionary. Used by the
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
// Admin-only timeframe / aggregation validation endpoint.
//
// For each module + timeframe combination, returns the actual SQL-level row
// count, min / max measured_at inside the window, the bucket size that should
// be used, and which source table the chart code is supposed to use. Also
// reports the per-sensor delta sums for cumulative metrics so it is easy to
// confirm by hand that an energy chart shows non-zero kWh for 7d or 30d.
//
// Read-only. Safe to call repeatedly. Honours the `excludeBadLocation` filter
// so the row count matches what the dashboard sees.
// -----------------------------------------------------------------------------
Route::get('/api/admin/timeframe-validate', function (Request $request) {
    if ((string) session('role', '') !== 'admin') {
        return response()->json(['message' => 'Forbidden'], 403);
    }

    try {
        $schema = DB::getSchemaBuilder();
        $hasReadings = $schema->hasTable('readings');
        if (!$hasReadings) {
            return response()->json(['message' => 'readings table missing', 'degraded' => true], 200);
        }

        $hasMeasuredAt = $schema->hasColumn('readings', 'measured_at');
        $hasLocation   = $schema->hasColumn('readings', 'sensor_location');
        $hasUid        = $schema->hasColumn('readings', 'sensor_uid');
        $hasSid        = $schema->hasColumn('readings', 'sensor_id');
        $scopeCol      = $hasUid ? 'sensor_uid' : ($hasSid ? 'sensor_id' : null);

        $timeframes = ['24h', '7d', '30d'];
        $modules = [
            'iaq'           => ['readings_metric' => 'co2_ppm',    'agg' => 'AVG',   'source' => 'readings.measured_at'],
            'occupancy'     => ['readings_metric' => 'people_total_in', 'agg' => 'DELTA', 'source' => 'readings.measured_at'],
            'energy'        => ['readings_metric' => 'energy_kwh', 'agg' => 'DELTA', 'source' => 'readings.measured_at'],
            'environmental' => ['readings_metric' => 'uv_index',   'agg' => 'AVG',   'source' => 'readings.measured_at'],
        ];

        $location = $request->query('location');
        $location = is_string($location) && trim($location) !== '' ? strtoupper(trim($location)) : null;

        $results = [];
        foreach ($timeframes as $tf) {
            [$resolvedTf, $from] = smacaApiParseTimeframe($tf);
            if (!$from) continue;

            foreach ($modules as $modKey => $cfg) {
                $metric = $cfg['readings_metric'];
                $agg = $cfg['agg'];

                $row = [
                    'module' => $modKey,
                    'timeframe' => $resolvedTf,
                    'metric' => $metric,
                    'aggregation' => $agg,
                    'source_table' => 'readings',
                    'window_start' => smacaApiIso($from),
                    'window_end' => smacaApiIso(\Carbon\Carbon::now('Europe/Athens')),
                    'row_count' => null,
                    'min_measured_at' => null,
                    'max_measured_at' => null,
                    'distinct_days' => null,
                    'expected_bucket' => $tf === '24h' ? 'hourly (24)' : ($tf === '7d' ? 'daily (7)' : 'daily (30)'),
                    'distinct_sensor_count' => null,
                    'metric_total_delta' => null,   // only for DELTA metrics
                    'avg_metric_value' => null,     // only for AVG metrics
                    'note' => null,
                ];

                if (!$hasMeasuredAt || !$schema->hasColumn('readings', $metric)) {
                    $row['note'] = 'metric or measured_at column missing';
                    $results[] = $row;
                    continue;
                }

                try {
                    // Total row count + min/max measured_at + distinct days inside window.
                    $base = DB::table('readings')
                        ->where('measured_at', '>=', $from)
                        ->whereNotNull($metric);
                    if ($location && $hasLocation) {
                        $base->where('sensor_location', $location);
                    }
                    smacaApiExcludeBadLocation($base);

                    $stats = (clone $base)
                        ->selectRaw('COUNT(*) as cnt')
                        ->selectRaw('MIN(measured_at) as min_at')
                        ->selectRaw('MAX(measured_at) as max_at')
                        ->selectRaw('COUNT(DISTINCT DATE(measured_at)) as days')
                        ->first();
                    $row['row_count'] = (int) ($stats->cnt ?? 0);
                    $row['min_measured_at'] = smacaApiIso($stats->min_at ?? null);
                    $row['max_measured_at'] = smacaApiIso($stats->max_at ?? null);
                    $row['distinct_days'] = (int) ($stats->days ?? 0);

                    if ($scopeCol) {
                        $row['distinct_sensor_count'] = (int) (clone $base)
                            ->distinct()
                            ->count($scopeCol);
                    }

                    if ($agg === 'DELTA' && $scopeCol) {
                        $sub = (clone $base)
                            ->select([
                                $scopeCol,
                                DB::raw('MAX(' . $metric . ') as mx'),
                                DB::raw('MIN(' . $metric . ') as mn'),
                            ])
                            ->groupBy($scopeCol)
                            ->get();
                        $sum = 0.0;
                        foreach ($sub as $r) {
                            $delta = (float) ($r->mx ?? 0) - (float) ($r->mn ?? 0);
                            $sum += max(0.0, $delta);
                        }
                        $row['metric_total_delta'] = round($sum, 3);
                    } else {
                        $row['avg_metric_value'] = (float) (clone $base)->avg($metric);
                    }
                } catch (\Throwable $e) {
                    $row['note'] = 'query failed: ' . $e->getMessage();
                }

                $results[] = $row;
            }
        }

        return response()->json([
            'generated_at' => \Carbon\Carbon::now('Europe/Athens')->toIso8601String(),
            'location_filter' => $location,
            'schema' => [
                'has_measured_at' => $hasMeasuredAt,
                'has_sensor_location' => $hasLocation,
                'scope_column' => $scopeCol,
                'excludes_default_site' => true,
            ],
            'rows' => $results,
        ]);
    } catch (\Throwable $e) {
        try {
            \Illuminate\Support\Facades\Log::warning('GET /api/admin/timeframe-validate failed', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $ignored) {}
        return response()->json(['message' => 'Validation endpoint unavailable', 'degraded' => true], 200);
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

// -----------------------------------------------------------------------------
// Admin-only Energy KPI alignment audit (read-only).
// GET /api/admin/energy-kpi-audit?timeframe=24h|7d|30d&sample=10
// -----------------------------------------------------------------------------
Route::get('/api/admin/energy-kpi-audit', function (Request $request) {
    if ((string) session('role', '') !== 'admin') {
        return response()->json(['message' => 'Forbidden'], 403);
    }

    try {
        smacaEnergyKpiAuditEnsureLoaded();
        $reporter = smacaEnergyKpiAuditReporter();
        $timeframe = \App\Services\KPI\KPIInputAssembler::resolveTimeframe($request->query('timeframe'));
        $context = ['timeframe' => $timeframe];

        return response()->json([
            'generated_at' => \Carbon\Carbon::now('Europe/Athens')->toIso8601String(),
            'timeframe' => $timeframe,
            'deploy_diagnostics' => smacaEnergyKpiAuditDeployDiagnostics(),
            'report' => $reporter->build($context),
        ]);
    } catch (\Throwable $e) {
        try {
            \Illuminate\Support\Facades\Log::warning('GET /api/admin/energy-kpi-audit failed', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $ignored) {}

        return response()->json([
            'message' => 'Energy KPI audit unavailable',
            'degraded' => true,
            'deploy_diagnostics' => function_exists('smacaEnergyKpiAuditDeployDiagnostics')
                ? smacaEnergyKpiAuditDeployDiagnostics()
                : ['loader' => 'smaca-energy-kpi-audit.php not loaded'],
            'error' => $e->getMessage(),
        ], 200);
    }
});

// -----------------------------------------------------------------------------
// Admin-only IAQ telemetry reconcile audit (readings vs sensor_latest vs API keys).
// -----------------------------------------------------------------------------
Route::get('/api/admin/telemetry-reconcile', function (Request $request) {
    if ((string) session('role', '') !== 'admin') {
        return response()->json(['message' => 'Forbidden'], 403);
    }

    try {
        smacaTelemetryRebuildEnsureLoaded();
        $rebuilder = smacaTelemetryRebuilder();
        $reporter = smacaTelemetryReconcileReporter();
        $sample = max(1, min(50, (int) $request->query('sample', 10)));

        $iaqFallback = smacaReadingsIaqFallbackStatus_impl();
        $iaqFallback['deploy_diagnostics'] = smacaAdminIaqFallbackDiagnostics_impl();

        return response()->json([
            'generated_at' => \Carbon\Carbon::now('Europe/Athens')->toIso8601String(),
            'iaq_readings_fallback' => $iaqFallback,
            'schema' => $rebuilder->auditSchema(),
            'report' => $reporter->build($sample),
        ]);
    } catch (\Throwable $e) {
        try {
            \Illuminate\Support\Facades\Log::warning('GET /api/admin/telemetry-reconcile failed', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $ignored) {}

        return response()->json(['message' => 'Telemetry reconcile audit unavailable', 'degraded' => true], 200);
    }
});

// -----------------------------------------------------------------------------
// Admin-only: rebuild sensor_latest from newest readings (no migrations / no cache ops).
// POST body/query: dry_run=1, sensor_id=<optional>
// -----------------------------------------------------------------------------
Route::post('/api/admin/rebuild-sensor-latest', function (Request $request) {
    if ((string) session('role', '') !== 'admin') {
        return response()->json(['message' => 'Forbidden'], 403);
    }

    try {
        smacaTelemetryRebuildEnsureLoaded();
        $rebuilder = smacaTelemetryRebuilder();
        $dryRun = filter_var($request->input('dry_run', false), FILTER_VALIDATE_BOOLEAN);
        $sensorId = $request->input('sensor_id');
        $sensorId = is_numeric($sensorId) ? (int) $sensorId : null;

        $result = $rebuilder->rebuild([
            'dry_run' => $dryRun,
            'verbose' => filter_var($request->input('verbose', false), FILTER_VALIDATE_BOOLEAN),
            'sensor_id' => $sensorId,
        ]);

        $status = ($result['ok'] ?? false) ? 200 : 422;
        $result['deploy_diagnostics'] = smacaAdminIaqFallbackDiagnostics_impl();

        return response()->json($result, $status);
    } catch (\Throwable $e) {
        try {
            \Illuminate\Support\Facades\Log::warning('POST /api/admin/rebuild-sensor-latest failed', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $ignored) {}

        $payload = [
            'ok' => false,
            'message' => 'Rebuild failed',
            'error' => $e->getMessage(),
        ];
        if ($e instanceof \RuntimeException && str_contains($e->getMessage(), 'missing on server')) {
            $payload['ftp_upload_required'] = [
                'routes/smaca-telemetry-rebuild.php',
                'app/Support/TelemetryMetricColumns.php',
                'app/Support/TelemetryLatestNormalizer.php',
                'app/Services/Telemetry/SensorLatestRebuilder.php',
                'app/Services/Telemetry/TelemetryReconcileReporter.php',
            ];
        }

        return response()->json($payload, 500);
    }
});
