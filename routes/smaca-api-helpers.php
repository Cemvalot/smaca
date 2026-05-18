<?php

use App\Support\TelemetryLatestNormalizer;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

// FTP deploys: always load Support helpers from disk (stale Composer classmaps may omit new methods).
$smacaSupportNormalizer = dirname(__DIR__).'/app/Support/TelemetryLatestNormalizer.php';
if (is_file($smacaSupportNormalizer)) {
    require_once $smacaSupportNormalizer;
}
$smacaSupportMetricCols = dirname(__DIR__).'/app/Support/TelemetryMetricColumns.php';
if (is_file($smacaSupportMetricCols)) {
    require_once $smacaSupportMetricCols;
}

// Implementation helpers used by `routes/web-api-legacy.php` wrappers.
// These are intentionally plain functions (no classes) to keep the route layer stable.

if (!function_exists('smacaApiMetricWhitelist_impl')) {
    function smacaApiMetricWhitelist_impl(): array
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
            'light_level',
            'signal_strength',
            'snr',
            'tx_ccq',
            'tx_rate',
        ];
    }
}

if (!function_exists('smacaApiParseTimeframe_impl')) {
    function smacaApiParseTimeframe_impl(?string $timeframe): array
    {
        $resolved = $timeframe ?: '24h';
        $nowAthens = Carbon::now('Europe/Athens');

        return match ($resolved) {
            '24h' => ['24h', $nowAthens->copy()->subHours(24)],
            '7d' => ['7d', $nowAthens->copy()->subDays(7)],
            '30d' => ['30d', $nowAthens->copy()->subDays(30)],
            '6m' => ['6m', $nowAthens->copy()->subMonths(6)],
            default => [null, null],
        };
    }
}

if (!function_exists('smacaApiIso_impl')) {
    function smacaApiIso_impl($value): ?string
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

if (!function_exists('smacaSensorLatestMissingIaqColumns_impl')) {
    /**
     * IAQ columns absent on sensor_latest (readings fallback applies).
     *
     * @return array<string, bool> column => true when missing on sensor_latest
     */
    function smacaSensorLatestMissingIaqColumns_impl(): array
    {
        static $cache = null;
        if ($cache !== null) {
            return $cache;
        }

        $cache = [];
        try {
            $schema = DB::getSchemaBuilder();
            foreach (['tvoc_index', 'light_level', 'lux'] as $column) {
                $cache[$column] = !$schema->hasColumn('sensor_latest', $column);
            }
        } catch (\Throwable $e) {
            $cache = ['tvoc_index' => true, 'light_level' => true, 'lux' => true];
        }

        return $cache;
    }
}

if (!function_exists('smacaReadingsIaqFallbackStatus_impl')) {
    /**
     * @return array{
     *   active: bool,
     *   fallback_from_readings: bool,
     *   schema_missing_in_sensor_latest: array<int, string>,
     *   warning: string|null
     * }
     */
    function smacaReadingsIaqFallbackStatus_impl(): array
    {
        $missing = smacaSensorLatestMissingIaqColumns_impl();
        $missingList = [];
        $active = false;

        foreach (['tvoc_index', 'light_level', 'lux'] as $col) {
            if (!($missing[$col] ?? false)) {
                continue;
            }
            $missingList[] = $col;
            if (in_array($col, ['tvoc_index', 'light_level'], true) && smacaReadingsHasColumn_impl($col)) {
                $active = true;
            }
        }

        $warning = null;
        if ($active) {
            $warning = 'tvoc_index/light_level not present in sensor_latest; API uses readings fallback.';
        }

        // Cannot run fallback without merge helper (never 500 public routes).
        if ($active && !method_exists(TelemetryLatestNormalizer::class, 'mergeNormalizedSemanticKeys')) {
            $active = false;
            $warning = null;
        }

        return [
            'active' => $active,
            'fallback_from_readings' => $active,
            'schema_missing_in_sensor_latest' => $missingList,
            'warning' => $warning,
        ];
    }
}

if (!function_exists('smacaDetectReadingsScopeColumn_impl')) {
    function smacaDetectReadingsScopeColumn_impl(): ?string
    {
        if (smacaReadingsHasColumn_impl('sensor_uid')) {
            return 'sensor_uid';
        }
        if (smacaReadingsHasColumn_impl('sensor_id')) {
            return 'sensor_id';
        }

        return null;
    }
}

if (!function_exists('smacaReadingsLatestIaqMapForSensors_impl')) {
    /**
     * Newest readings row per sensor (IAQ fields only), keyed by sensors.id.
     *
     * @param iterable<int, object> $sensors rows with id + external_id|sensor_uid
     * @return array<int, object>
     */
    function smacaReadingsLatestIaqMapForSensors_impl(iterable $sensors): array
    {
        $status = smacaReadingsIaqFallbackStatus_impl();
        if (!$status['active'] || !smacaReadingsHasColumn_impl('measured_at')) {
            return [];
        }

        $scope = smacaDetectReadingsScopeColumn_impl();
        if ($scope === null) {
            return [];
        }

        $sensorIds = [];
        $uidBySensorId = [];
        foreach ($sensors as $sensor) {
            $sid = (int) ($sensor->id ?? 0);
            if ($sid <= 0) {
                continue;
            }
            $sensorIds[] = $sid;
            $uid = $sensor->external_id ?? $sensor->sensor_uid ?? null;
            if ($uid !== null && $uid !== '') {
                $uidBySensorId[$sid] = (string) $uid;
            }
        }

        if ($sensorIds === []) {
            return [];
        }

        $select = ['r.id', 'r.measured_at'];
        if ($scope === 'sensor_uid') {
            $select[] = 'r.sensor_uid';
        } else {
            $select[] = 'r.sensor_id';
        }
        foreach (['tvoc_index', 'light_level', 'lux'] as $col) {
            if (smacaReadingsHasColumn_impl($col)) {
                $select[] = 'r.'.$col;
            }
        }

        $query = DB::table('readings as r')->select($select);

        if ($scope === 'sensor_uid') {
            $uids = array_values(array_unique(array_values($uidBySensorId)));
            if ($uids === []) {
                return [];
            }
            $query->whereIn('r.sensor_uid', $uids)
                ->whereRaw(
                    'r.measured_at = (SELECT MAX(r2.measured_at) FROM readings r2 WHERE r2.sensor_uid = r.sensor_uid)'
                );
        } else {
            $query->whereIn('r.sensor_id', $sensorIds)
                ->whereRaw(
                    'r.measured_at = (SELECT MAX(r2.measured_at) FROM readings r2 WHERE r2.sensor_id = r.sensor_id)'
                );
        }

        $rows = $query->orderByDesc('r.id')->get();
        $map = [];
        foreach ($rows as $reading) {
            if ($scope === 'sensor_uid') {
                $uid = (string) ($reading->sensor_uid ?? '');
                foreach ($uidBySensorId as $sid => $u) {
                    if ($u === $uid) {
                        $map[$sid] = $reading;
                        break;
                    }
                }
            } else {
                $map[(int) $reading->sensor_id] = $reading;
            }
        }

        return $map;
    }
}

if (!function_exists('smacaApiSnapshotFromRow_impl')) {
    function smacaApiSnapshotFromRow_impl(object $row): array
    {
        $snap = [
            'measured_at' => smacaApiIso_impl($row->measured_at ?? null),
            'battery_pct' => $row->battery_pct ?? null,
            'co2_ppm' => $row->co2_ppm ?? null,
            'temperature_c' => $row->temperature_c ?? null,
            'humidity_rh' => $row->humidity_rh ?? null,
            'pm2_5_ugm3' => $row->pm2_5_ugm3 ?? $row->pm2_5ugm3 ?? null,
            'pm10_ugm3' => $row->pm10_ugm3 ?? $row->pm10ugm3 ?? null,
            'energy_kwh' => $row->energy_kwh ?? null,
            'uv_index' => $row->uv_index ?? null,
            'people_in' => $row->people_in ?? null,
            'people_out' => $row->people_out ?? null,
            'people_total_in' => $row->people_total_in ?? null,
            'people_total_out' => $row->people_total_out ?? null,
            'tvoc_index' => $row->tvoc_index ?? null,
            'light_level' => $row->light_level ?? null,
            'lux' => $row->lux ?? null,
            'signal_strength' => $row->signal_strength ?? null,
            'snr' => $row->snr ?? null,
            'tx_ccq' => $row->tx_ccq ?? null,
            'tx_rate' => $row->tx_rate ?? null,
        ];

        return TelemetryLatestNormalizer::mergeNormalizedSemanticKeys($snap, $row);
    }
}

if (!function_exists('smacaApplyReadingsIaqFallback_impl')) {
    /**
     * Readings → snapshot merge when sensor_latest lacks IAQ columns.
     * Implemented here (not only on the class) so FTP deploys never 500 when an
     * older TelemetryLatestNormalizer was already autoloaded without this method.
     *
     * @param array<string, mixed> $snapshot
     * @param array<int, string> $missingOnSensorLatest
     * @return array<string, mixed>
     */
    function smacaApplyReadingsIaqFallback_impl(
        array $snapshot,
        ?object $reading,
        array $missingOnSensorLatest
    ): array {
        if ($reading === null || $missingOnSensorLatest === []) {
            return $snapshot;
        }

        if (method_exists(TelemetryLatestNormalizer::class, 'applyReadingsIaqFallback')) {
            return TelemetryLatestNormalizer::applyReadingsIaqFallback(
                $snapshot,
                $reading,
                $missingOnSensorLatest
            );
        }

        $out = $snapshot;
        $touched = false;

        if (in_array('tvoc_index', $missingOnSensorLatest, true)) {
            $v = $reading->tvoc_index ?? null;
            if ($v !== null && $v !== '' && ($out['tvoc'] ?? null) === null && ($out['tvoc_index'] ?? null) === null) {
                $out['tvoc_index'] = $v;
                $touched = true;
            }
        }
        if (in_array('light_level', $missingOnSensorLatest, true)) {
            $v = $reading->light_level ?? null;
            if ($v !== null && $v !== '' && ($out['lighting'] ?? null) === null && ($out['light_level'] ?? null) === null) {
                $out['light_level'] = $v;
                $touched = true;
            }
        }
        if (in_array('lux', $missingOnSensorLatest, true)) {
            $v = $reading->lux ?? null;
            if ($v !== null && $v !== '' && ($out['lux'] ?? null) === null) {
                $out['lux'] = $v;
                $touched = true;
            }
        }

        if (!$touched) {
            return $out;
        }

        $out = TelemetryLatestNormalizer::mergeNormalizedSemanticKeys($out, $reading);
        $out['fallback_from_readings'] = true;

        return $out;
    }
}

if (!function_exists('smacaAdminIaqFallbackDiagnostics_impl')) {
    /**
     * Admin-only deploy diagnostics (never surfaced on public sensor list routes).
     *
     * @return array<string, mixed>
     */
    function smacaAdminIaqFallbackDiagnostics_impl(): array
    {
        $diag = [
            'applyReadingsIaqFallback_available' => method_exists(
                TelemetryLatestNormalizer::class,
                'applyReadingsIaqFallback'
            ),
            'smacaApplyReadingsIaqFallback_impl_available' => function_exists('smacaApplyReadingsIaqFallback_impl'),
        ];
        if (!$diag['applyReadingsIaqFallback_available']) {
            $diag['deploy_mismatch'] = 'Upload app/Support/TelemetryLatestNormalizer.php (missing applyReadingsIaqFallback). '
                .'Public APIs use smacaApplyReadingsIaqFallback_impl until then.';
        }

        return $diag;
    }
}

if (!function_exists('smacaApiSnapshotFromRowWithIaqFallback_impl')) {
    function smacaApiSnapshotFromRowWithIaqFallback_impl(object $row, ?object $readingFallback = null): array
    {
        $snap = smacaApiSnapshotFromRow_impl($row);
        $status = smacaReadingsIaqFallbackStatus_impl();
        if (!($status['active'] ?? false)) {
            return $snap;
        }

        if (!function_exists('smacaApplyReadingsIaqFallback_impl')) {
            return $snap;
        }

        return smacaApplyReadingsIaqFallback_impl(
            $snap,
            $readingFallback,
            $status['schema_missing_in_sensor_latest']
        );
    }
}

if (!function_exists('smacaApiSensorLatestOptionalSelectColumns_impl')) {
    /**
     * Optional `sensor_latest` columns (present only when migrated / deployed).
     *
     * @return array<int, string>
     */
    function smacaApiSensorLatestOptionalSelectColumns_impl(): array
    {
        $cols = [];
        try {
            $schema = DB::getSchemaBuilder();
            foreach (['tvoc_index', 'light_level', 'lux', 'signal_strength', 'snr', 'tx_ccq', 'tx_rate'] as $column) {
                if ($schema->hasColumn('sensor_latest', $column)) {
                    $cols[] = 'sl.'.$column;
                }
            }
        } catch (\Throwable $e) {
            return [];
        }

        return $cols;
    }
}

if (!function_exists('smacaReadingsHasColumn_impl')) {
    function smacaReadingsHasColumn_impl(string $column): bool
    {
        return DB::getSchemaBuilder()->hasColumn('readings', $column);
    }
}

/**
 * Exclude historical "garbage" location rows from spatial / module aggregations.
 *
 * Background: early-deployment rows (before the spatial taxonomy was wired up)
 * arrive with `sensor_location` either NULL, empty, or the literal string
 * 'Default Site'. Including them in module-by-location aggregates pollutes
 * charts with a fake "Default Site" bucket. Per-sensor charts are fine — this
 * filter only matters when the chart groups by `sensor_location`.
 *
 * Safe to call on any builder: when the `sensor_location` column does not exist
 * (older dev DBs), the helper is a no-op so it never raises a SQL error.
 *
 * Returns the same builder for chaining.
 */
if (!function_exists('smacaApiExcludeBadLocation_impl')) {
    function smacaApiExcludeBadLocation_impl($query, string $table = 'readings')
    {
        if ($query === null) {
            return $query;
        }
        try {
            $hasColumn = DB::getSchemaBuilder()->hasColumn($table, 'sensor_location');
        } catch (\Throwable $e) {
            $hasColumn = false;
        }
        if (!$hasColumn) {
            return $query;
        }
        // Use a closure so we OR-group all of the bad-location predicates and
        // do not stomp on caller-supplied WHEREs.
        $col = $table === 'readings' ? 'sensor_location' : ($table . '.sensor_location');
        return $query->whereNotNull($col)
            ->where($col, '<>', '')
            ->where($col, '<>', 'Default Site');
    }
}

if (!function_exists('smacaApiExcludeBadLocation')) {
    function smacaApiExcludeBadLocation($query, string $table = 'readings')
    {
        return smacaApiExcludeBadLocation_impl($query, $table);
    }
}

