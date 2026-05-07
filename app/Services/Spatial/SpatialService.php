<?php

namespace App\Services\Spatial;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Spatial Intelligence Layer.
 *
 * Adds spatial awareness to KPIs without modifying the DB schema. All
 * filtering is done at query time against the existing
 * `readings.sensor_location` column populated by the ingest pipeline.
 *
 * Responsibilities:
 *   - normalize / classify location codes
 *   - tell whether a code supports a module (e.g. F0-1 does NOT support iaq)
 *   - tell whether a code is visible to a role (passages → admin/researcher)
 *   - resolve a code+module to a set of sensor IDs (numeric, for sensors /
 *     sensor_latest joins) and sensor UIDs (external_id strings, for the
 *     `readings` table on production where the FK column is `sensor_uid`)
 *
 * Every public method is defensive: failures degrade to safe empties / nulls
 * so callers never produce 500s for unknown topology.
 */
class SpatialService
{
    private array $config;
    private string $locale;

    /** @var array<string,array<int>>|null per-instance cache: ids by "code|module" */
    private ?array $sensorIdCache = null;
    /** @var array<string,array<string>>|null per-instance cache: uids by "code|module" */
    private ?array $sensorUidCache = null;

    public function __construct(?array $config = null, ?string $locale = null)
    {
        $this->config = $config ?? (array) (function_exists('config') ? config('smaca_spatial', []) : []);
        if ($locale !== null) {
            $this->locale = strtolower(substr($locale, 0, 2));
        } else {
            $resolved = 'en';
            try {
                if (function_exists('app')) {
                    $resolved = (string) app()->getLocale();
                } elseif (function_exists('config')) {
                    $resolved = (string) config('app.locale', 'en');
                }
            } catch (\Throwable $ignored) {}
            $this->locale = strtolower(substr($resolved ?: 'en', 0, 2));
        }
    }

    /** Pick the right label field based on the active locale. */
    private function resolveLabel(array $meta, string $code): string
    {
        $key = 'label_' . $this->locale;
        if (isset($meta[$key]) && $meta[$key] !== '') {
            return (string) $meta[$key];
        }
        if (isset($meta['label']) && $meta['label'] !== '') {
            return (string) $meta['label'];
        }
        return $code;
    }

    /** Public helper for label-only lookups (used by management table etc.). */
    public function labelFor(?string $code): ?string
    {
        $code = $this->normalizeLocation($code);
        if ($code === null) {
            return null;
        }
        $configured = $this->getConfiguredLocations();
        if (isset($configured[$code]) && is_array($configured[$code])) {
            return $this->resolveLabel($configured[$code], $code);
        }
        // Inferred passage: derive parent label, append " – <suffix>".
        $parent = $this->deriveParentFromCode($code);
        if ($parent !== null) {
            $parentLabel = $this->labelFor($parent) ?? $parent;
            $suffix = substr($code, strlen($parent) + 1);
            $sep = $this->locale === 'el' ? ' – Πέρασμα ' : ' – Passage ';
            return $parentLabel . $sep . $suffix;
        }
        return $code;
    }

    /* -------------------------------------------------------------------------
     * Configuration / metadata
     * ---------------------------------------------------------------------- */

    public function getConfiguredLocations(): array
    {
        $locations = $this->config['locations'] ?? [];
        return is_array($locations) ? $locations : [];
    }

    public function getConfiguredGroups(): array
    {
        $groups = $this->config['groups'] ?? [];
        return is_array($groups) ? $groups : [];
    }

    public function getModuleCapabilities(): array
    {
        $caps = $this->config['module_capabilities'] ?? [];
        return is_array($caps) ? $caps : [];
    }

    public function normalizeLocation(?string $code): ?string
    {
        if ($code === null) {
            return null;
        }
        $trim = trim((string) $code);
        if ($trim === '') {
            return null;
        }
        $upper = strtoupper($trim);
        if (!preg_match('/^[A-Z0-9][A-Z0-9-]{0,31}$/', $upper)) {
            return null;
        }
        return $upper;
    }

    public function normalizeModule(?string $module): string
    {
        $module = $module === null ? '' : strtolower(trim((string) $module));
        $known = ['overview', 'iaq', 'occupancy', 'energy', 'environmental', 'connectivity', 'ai-insights', 'management'];
        return in_array($module, $known, true) ? $module : 'overview';
    }

    public function normalizeRole(?string $role): string
    {
        $role = $role === null ? '' : strtolower(trim((string) $role));
        if ($role === 'admin' || $role === 'researcher') {
            return $role;
        }
        return 'user';
    }

    public function getLocationMeta(?string $code): ?array
    {
        $code = $this->normalizeLocation($code);
        if ($code === null) {
            return null;
        }

        $configured = $this->getConfiguredLocations();
        if (isset($configured[$code]) && is_array($configured[$code])) {
            $meta = $configured[$code];
            $meta['code'] = $code;
            $meta['label'] = $this->resolveLabel($meta, $code);
            $meta['parent'] = $meta['parent'] ?? $this->deriveParentFromCode($code);
            $meta['supported_modules'] = isset($meta['supported_modules']) && is_array($meta['supported_modules'])
                ? array_values($meta['supported_modules'])
                : [];
            $meta['sensor_types'] = isset($meta['sensor_types']) && is_array($meta['sensor_types'])
                ? array_values($meta['sensor_types'])
                : [];
            $meta['visibility'] = isset($meta['visibility']) && is_array($meta['visibility'])
                ? array_values($meta['visibility'])
                : ['admin', 'researcher', 'user'];
            return $meta;
        }

        // Inferred for codes seen in DB but not in config.
        $parent = $this->deriveParentFromCode($code);
        if ($parent !== null) {
            return [
                'code' => $code,
                'label' => $this->labelFor($code) ?? $code,
                'type' => 'passage',
                'group' => 'passages',
                'parent' => $parent,
                'supported_modules' => ['occupancy'],
                'sensor_types' => ['people_counter'],
                'visibility' => ['admin', 'researcher'],
                'inferred' => true,
            ];
        }

        return [
            'code' => $code,
            'label' => $code,
            'type' => 'special_space',
            'group' => 'special_spaces',
            'supported_modules' => ['overview'],
            'sensor_types' => [],
            'visibility' => ['admin', 'researcher', 'user'],
            'inferred' => true,
        ];
    }

    public function getParentLocation(?string $code): ?string
    {
        $code = $this->normalizeLocation($code);
        if ($code === null) {
            return null;
        }
        $configured = $this->getConfiguredLocations();
        if (isset($configured[$code]['parent']) && is_string($configured[$code]['parent'])) {
            $parent = $this->normalizeLocation($configured[$code]['parent']);
            if ($parent !== null) {
                return $parent;
            }
        }
        return $this->deriveParentFromCode($code);
    }

    private function deriveParentFromCode(string $code): ?string
    {
        $dash = strpos($code, '-');
        if ($dash === false || $dash === 0) {
            return null;
        }
        return substr($code, 0, $dash);
    }

    /* -------------------------------------------------------------------------
     * Module / role decisions
     * ---------------------------------------------------------------------- */

    public function locationSupportsModule(?string $code, ?string $module): bool
    {
        $code = $this->normalizeLocation($code);
        $meta = $this->getLocationMeta($code);
        if ($meta === null) {
            return false;
        }
        $module = $this->normalizeModule($module);

        // 1) explicit allow-list on the location
        $supported = $meta['supported_modules'] ?? [];
        if (in_array($module, $supported, true)) {
            return true;
        }

        // 2) capability match: module requires sensor_types that the location has
        $caps = $this->getModuleCapabilities();
        $required = $caps[$module] ?? [];
        if (empty($required)) {
            return true; // overview / admin modules accept any visible code
        }
        foreach (($meta['sensor_types'] ?? []) as $type) {
            if (in_array($type, $required, true)) {
                return true;
            }
        }
        return false;
    }

    public function locationVisibleForRole(?string $code, ?string $role): bool
    {
        $meta = $this->getLocationMeta($this->normalizeLocation($code));
        if ($meta === null) {
            return false;
        }
        $role = $this->normalizeRole($role);
        $visibility = $meta['visibility'] ?? ['admin', 'researcher', 'user'];
        return in_array($role, $visibility, true);
    }

    /* -------------------------------------------------------------------------
     * Grouped locations (config + observed)
     * ---------------------------------------------------------------------- */

    /**
     * Return locations grouped by `floors`, `basements`, `special_spaces`,
     * `passages`, optionally filtered by `module` (only codes that support it)
     * and by `role` (only codes whose `visibility` allows that role).
     *
     * @return array{groups: array<string, array{label: string, order: int, items: array<int, array<string, mixed>>}>}
     */
    public function getGroupedLocations(int $observedDays = 30, ?string $module = null, ?string $role = null): array
    {
        $declared = $this->getConfiguredLocations();
        $observed = $this->getObservedLocationCodes($observedDays);

        $merged = [];

        foreach ($declared as $code => $meta) {
            $code = $this->normalizeLocation((string) $code);
            if ($code === null || !is_array($meta)) {
                continue;
            }
            $merged[$code] = $this->shapeEntry($code, $meta, false);
        }

        foreach ($observed as $code) {
            if (isset($merged[$code])) {
                continue;
            }
            $stub = $this->getLocationMeta($code);
            if ($stub === null) {
                continue;
            }
            $merged[$code] = $this->shapeEntry($code, $stub, true);
        }

        // Filter by module + role.
        $moduleFilter = ($module === null) ? null : $this->normalizeModule($module);
        $roleFilter = ($role === null) ? null : $this->normalizeRole($role);
        if ($moduleFilter !== null || $roleFilter !== null) {
            foreach ($merged as $code => $entry) {
                if ($moduleFilter !== null && !$this->locationSupportsModule($code, $moduleFilter)) {
                    unset($merged[$code]);
                    continue;
                }
                if ($roleFilter !== null && !in_array($roleFilter, $entry['visibility'], true)) {
                    unset($merged[$code]);
                }
            }
        }

        $groupsMeta = $this->getConfiguredGroups();
        $defaultGroups = [
            'floors' => ['label' => 'Floors', 'order' => 1],
            'basements' => ['label' => 'Basements', 'order' => 2],
            'special_spaces' => ['label' => 'Special spaces', 'order' => 3],
            'passages' => ['label' => 'Passages', 'order' => 4],
        ];
        $resolvedGroups = [];
        foreach ($defaultGroups as $key => $default) {
            $resolvedGroups[$key] = [
                'label' => (string) ($groupsMeta[$key]['label'] ?? $default['label']),
                'order' => (int) ($groupsMeta[$key]['order'] ?? $default['order']),
                'items' => [],
            ];
        }

        foreach ($merged as $entry) {
            $groupKey = $entry['group'];
            if (!isset($resolvedGroups[$groupKey])) {
                $resolvedGroups[$groupKey] = [
                    'label' => ucfirst(str_replace('_', ' ', $groupKey)),
                    'order' => 99,
                    'items' => [],
                ];
            }
            unset($entry['visibility']); // not needed by frontend
            $resolvedGroups[$groupKey]['items'][] = $entry;
        }

        foreach ($resolvedGroups as $key => &$group) {
            usort($group['items'], static function (array $a, array $b): int {
                $oa = $a['order'];
                $ob = $b['order'];
                if ($oa !== null && $ob !== null && $oa !== $ob) {
                    return $oa <=> $ob;
                }
                if ($oa !== null && $ob === null) return -1;
                if ($oa === null && $ob !== null) return 1;
                return strcmp($a['code'], $b['code']);
            });
        }
        unset($group);

        uasort($resolvedGroups, static fn ($a, $b) => $a['order'] <=> $b['order']);

        return ['groups' => $resolvedGroups];
    }

    /** Convenience alias for the route layer. */
    public function getLocationsForModule(?string $module, ?string $role): array
    {
        return $this->getGroupedLocations(30, $module, $role);
    }

    /**
     * @return array<int, string>  Distinct sensor_location values seen in
     *                              `readings` over the lookback window.
     */
    public function getObservedLocationCodes(int $observedDays = 30): array
    {
        try {
            $schema = DB::getSchemaBuilder();
            if (!$schema->hasTable('readings') || !$schema->hasColumn('readings', 'sensor_location')) {
                return [];
            }

            $since = now()->subDays(max(1, $observedDays));

            $rows = DB::table('readings')
                ->select('sensor_location')
                ->where('measured_at', '>=', $since)
                ->whereNotNull('sensor_location')
                ->where('sensor_location', '!=', '')
                ->distinct()
                ->limit(500)
                ->pluck('sensor_location');

            $codes = [];
            foreach ($rows as $raw) {
                $norm = $this->normalizeLocation((string) $raw);
                if ($norm !== null) {
                    $codes[$norm] = true;
                }
            }
            return array_keys($codes);
        } catch (\Throwable $e) {
            $this->safeLogWarning('SpatialService::getObservedLocationCodes failed', $e);
            return [];
        }
    }

    private function shapeEntry(string $code, array $meta, bool $inferred): array
    {
        return [
            'code' => $code,
            'label' => $this->resolveLabel($meta, $code),
            'type' => (string) ($meta['type'] ?? 'special_space'),
            'group' => (string) ($meta['group'] ?? 'special_spaces'),
            'parent' => isset($meta['parent']) ? $this->normalizeLocation((string) $meta['parent']) : null,
            'order' => isset($meta['order']) ? (int) $meta['order'] : null,
            'supported_modules' => isset($meta['supported_modules']) && is_array($meta['supported_modules'])
                ? array_values($meta['supported_modules'])
                : [],
            'sensor_types' => isset($meta['sensor_types']) && is_array($meta['sensor_types'])
                ? array_values($meta['sensor_types'])
                : [],
            'visibility' => isset($meta['visibility']) && is_array($meta['visibility'])
                ? array_values($meta['visibility'])
                : ['admin', 'researcher', 'user'],
            'inferred' => $inferred,
        ];
    }

    /* -------------------------------------------------------------------------
     * Sensor scope resolution (numeric IDs + string UIDs)
     * ---------------------------------------------------------------------- */

    /**
     * Codes that should be matched in `sensor_location` for a given user-picked
     * code under a given module. This is the set of (code itself) ∪ (children
     * "code-*") restricted to those that support the module.
     *
     * Returns null when the code itself is invalid; returns [] when nothing
     * matches under the module.
     *
     * @return array<int, string>|null
     */
    public function getMatchingLocationCodes(?string $code, ?string $module = null): ?array
    {
        $code = $this->normalizeLocation($code);
        if ($code === null) {
            return null;
        }
        $module = $module === null ? null : $this->normalizeModule($module);

        $declared = array_keys($this->getConfiguredLocations());
        $observed = $this->getObservedLocationCodes(30);
        $known = array_unique(array_merge(
            array_map(fn ($c) => (string) $c, $declared),
            $observed,
            [$code]
        ));

        $matches = [];
        foreach ($known as $candidate) {
            $candidate = $this->normalizeLocation((string) $candidate);
            if ($candidate === null) {
                continue;
            }
            $isSelf = $candidate === $code;
            $isChild = strpos($candidate, $code . '-') === 0;
            if (!$isSelf && !$isChild) {
                continue;
            }
            if ($module !== null && !$this->locationSupportsModule($candidate, $module)) {
                continue;
            }
            $matches[$candidate] = true;
        }

        return array_keys($matches);
    }

    /**
     * Resolve a location (and optional module) to numeric sensor IDs. Suitable
     * for filtering tables that have a `sensor_id` column (sensors,
     * sensor_latest).
     *
     * Returns:
     *   - null  when no scope is requested (caller treats as "all")
     *   - []    when scope is requested but matches no sensors
     *   - [int] otherwise
     */
    public function resolveSensorIds(?string $code, ?string $module = null): ?array
    {
        $code = $this->normalizeLocation($code);
        if ($code === null) {
            return null;
        }
        $module = $module === null ? null : $this->normalizeModule($module);
        $cacheKey = $code . '|' . ($module ?? '');
        if (isset($this->sensorIdCache[$cacheKey])) {
            return $this->sensorIdCache[$cacheKey];
        }

        $rows = $this->resolveScopedSensorRows($code, $module);
        if ($rows === null) {
            return $this->sensorIdCache[$cacheKey] = [];
        }
        $ids = array_values(array_unique(array_map(static fn ($r) => (int) $r->id, $rows)));
        $ids = array_values(array_filter($ids, static fn (int $v) => $v > 0));
        return $this->sensorIdCache[$cacheKey] = $ids;
    }

    /**
     * Resolve a location (and optional module) to sensor UIDs (external_id
     * strings). Suitable for filtering tables that have a `sensor_uid` column
     * (the production `readings` table).
     *
     * Same null/[]/list semantics as resolveSensorIds.
     *
     * @return array<int, string>|null
     */
    public function resolveSensorUids(?string $code, ?string $module = null): ?array
    {
        $code = $this->normalizeLocation($code);
        if ($code === null) {
            return null;
        }
        $module = $module === null ? null : $this->normalizeModule($module);
        $cacheKey = $code . '|' . ($module ?? '');
        if (isset($this->sensorUidCache[$cacheKey])) {
            return $this->sensorUidCache[$cacheKey];
        }

        $rows = $this->resolveScopedSensorRows($code, $module);
        if ($rows === null) {
            return $this->sensorUidCache[$cacheKey] = [];
        }
        $uids = [];
        foreach ($rows as $r) {
            $uid = isset($r->external_id) ? (string) $r->external_id : '';
            if ($uid !== '') {
                $uids[$uid] = true;
            }
        }
        return $this->sensorUidCache[$cacheKey] = array_keys($uids);
    }

    /**
     * Internal helper: returns sensor rows (id + external_id) that match the
     * scope. Returns null on hard failure (so callers can return safe empty).
     */
    private function resolveScopedSensorRows(string $code, ?string $module): ?array
    {
        $matchingCodes = $this->getMatchingLocationCodes($code, $module);
        if ($matchingCodes === null || empty($matchingCodes)) {
            return [];
        }

        try {
            $schema = DB::getSchemaBuilder();
            if (!$schema->hasTable('sensors')) {
                return null;
            }

            // Strategy A: join sensor_latest -> readings to get the latest
            // sensor_location per sensor.
            if ($schema->hasTable('sensor_latest') && $schema->hasTable('readings') && $schema->hasColumn('readings', 'sensor_location')) {
                $query = DB::table('sensors as s')
                    ->leftJoin('sensor_latest as sl', 'sl.sensor_id', '=', 's.id')
                    ->leftJoin('readings as r', 'r.id', '=', 'sl.reading_id')
                    ->whereIn('r.sensor_location', $matchingCodes)
                    ->select(['s.id', 's.external_id']);
                if ($schema->hasColumn('sensors', 'is_active')) {
                    $query->where('s.is_active', true);
                }
                $rows = $query->get()->all();
                if (!empty($rows)) {
                    return $rows;
                }
                // Fall through to strategy B if sensor_latest is empty/stale.
            }

            // Strategy B: derive from any reading in the last 30 days.
            if ($schema->hasTable('readings') && $schema->hasColumn('readings', 'sensor_location')) {
                $since = now()->subDays(30);
                $sensorJoinColumn = null;
                if ($schema->hasColumn('readings', 'sensor_uid') && $schema->hasColumn('sensors', 'external_id')) {
                    $sensorJoinColumn = 'sensor_uid';
                    $rows = DB::table('readings as r')
                        ->join('sensors as s', 's.external_id', '=', 'r.sensor_uid')
                        ->whereIn('r.sensor_location', $matchingCodes)
                        ->where('r.measured_at', '>=', $since)
                        ->select(['s.id', 's.external_id'])
                        ->distinct()
                        ->get()->all();
                    return $rows;
                }
                if ($schema->hasColumn('readings', 'sensor_id')) {
                    $rows = DB::table('readings as r')
                        ->join('sensors as s', 's.id', '=', 'r.sensor_id')
                        ->whereIn('r.sensor_location', $matchingCodes)
                        ->where('r.measured_at', '>=', $since)
                        ->select(['s.id', 's.external_id'])
                        ->distinct()
                        ->get()->all();
                    return $rows;
                }
            }

            return [];
        } catch (\Throwable $e) {
            $this->safeLogWarning('SpatialService::resolveScopedSensorRows failed', $e, [
                'code' => $code,
                'module' => $module,
            ]);
            return null;
        }
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
