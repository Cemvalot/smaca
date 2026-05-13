<?php

namespace App\Services\Occupancy;

use App\Services\Spatial\SpatialService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class OccupancyMetricsService
{
    private const TZ = 'Europe/Athens';
    private const MAX_DELTA_PER_SENSOR = 10000.0;

    public function __construct(private SpatialService $spatial)
    {
    }

    /**
     * Calendar-day occupancy metrics for the current Athens day.
     *
     * @param array<int>|null $sensorIds
     * @param array<string>|null $sensorUids
     */
    public function build(?array $sensorIds = null, ?array $sensorUids = null): array
    {
        $window = $this->dailyWindow();
        $payload = $this->emptyPayload($window);

        $sensorIds = $this->normaliseList($sensorIds, 'int');
        $sensorUids = $this->normaliseList($sensorUids, 'string');
        $sensorIdsScoped = $sensorIds !== null;
        $sensorUidsScoped = $sensorUids !== null;

        if (($sensorIdsScoped && empty($sensorIds)) || ($sensorUidsScoped && empty($sensorUids))) {
            return $payload;
        }

        try {
            $schema = DB::getSchemaBuilder();
        } catch (\Throwable $e) {
            $this->safeLogWarning('OccupancyMetricsService: schema builder unavailable', $e);
            return $payload;
        }

        if (!$schema->hasTable('readings')
            || !$schema->hasColumn('readings', 'measured_at')
            || !$schema->hasColumn('readings', 'people_total_in')
            || !$schema->hasColumn('readings', 'people_total_out')
        ) {
            return $payload;
        }

        $scopeColumn = $this->detectReadingsScopeColumn($schema);
        if ($scopeColumn === null) {
            return $payload;
        }

        $hasSensorLocation = $schema->hasColumn('readings', 'sensor_location');
        $sensorNames = $this->loadSensorNames($schema, $sensorIdsScoped, $sensorIds, $sensorUidsScoped, $sensorUids);

        try {
            $selects = [
                $scopeColumn . ' as scope_key',
                DB::raw('MAX(people_total_in) as max_in'),
                DB::raw('MIN(people_total_in) as min_in'),
                DB::raw('MAX(people_total_out) as max_out'),
                DB::raw('MIN(people_total_out) as min_out'),
            ];
            if ($hasSensorLocation) {
                $selects[] = 'sensor_location';
            } else {
                $selects[] = DB::raw('NULL as sensor_location');
            }

            $query = DB::table('readings')
                ->select($selects)
                ->where('measured_at', '>=', $window['start'])
                ->where('measured_at', '<', $window['end'])
                ->whereNotNull('people_total_in')
                ->whereNotNull('people_total_out');

            if ($hasSensorLocation) {
                $query->groupBy($scopeColumn, 'sensor_location');
            } else {
                $query->groupBy($scopeColumn);
            }

            $this->applyReadingsScope($query, $scopeColumn, $sensorIdsScoped, $sensorIds, $sensorUidsScoped, $sensorUids);
            $this->excludeBadLocation($query, $schema);

            $rows = $query->get();
        } catch (\Throwable $e) {
            $this->safeLogWarning('OccupancyMetricsService: daily movement query failed', $e);
            return $payload;
        }

        if ($rows->isEmpty()) {
            return $payload;
        }

        $sensors = [];
        $peopleIn = 0.0;
        $peopleOut = 0.0;
        $audPeopleIn = 0.0;
        $audPeopleOut = 0.0;
        $peak = null;
        $hasTotals = false;

        foreach ($rows as $row) {
            $scopeKey = $row->scope_key ?? null;
            if ($scopeKey === null || $scopeKey === '') {
                continue;
            }

            $locationCode = $hasSensorLocation
                ? $this->spatial->normalizeLocation($row->sensor_location ?? null)
                : null;
            $sensorName = $this->resolveSensorName($scopeColumn, $scopeKey, $sensorNames);
            $sensorUid = $scopeColumn === 'sensor_uid' ? (string) $scopeKey : null;

            $peopleInDelta = $this->safeDelta($row->max_in ?? null, $row->min_in ?? null);
            $peopleOutDelta = $this->safeDelta($row->max_out ?? null, $row->min_out ?? null);
            $remainingInside = max(0.0, $peopleInDelta - $peopleOutDelta);
            $isAuditorium = $this->isAuditoriumSensor($locationCode, $sensorName, $sensorUid);

            $sensors[] = [
                'sensor_scope_key' => $scopeColumn === 'sensor_id' ? (int) $scopeKey : (string) $scopeKey,
                'sensor_location' => $locationCode,
                'sensor_floor' => $this->resolveSensorFloor($locationCode, $isAuditorium),
                'is_auditorium_sensor' => $isAuditorium,
                'people_in' => $peopleInDelta,
                'people_out' => $peopleOutDelta,
                'remaining_inside' => $remainingInside,
            ];

            $peopleIn += $peopleInDelta;
            $peopleOut += $peopleOutDelta;
            $hasTotals = true;

            if ($isAuditorium) {
                $audPeopleIn += $peopleInDelta;
                $audPeopleOut += $peopleOutDelta;
                continue;
            }

            $peak = $peak === null ? $peopleInDelta : max($peak, $peopleInDelta);
        }

        if (!$hasTotals) {
            return $payload;
        }

        $remainingInside = max(0.0, $peopleIn - $peopleOut);
        $audRemainingInside = max(0.0, $audPeopleIn - $audPeopleOut);

        $payload['people_in'] = $peopleIn;
        $payload['people_out'] = $peopleOut;
        $payload['remaining_inside'] = $remainingInside;
        $payload['net_flow'] = $remainingInside;
        $payload['crowd_density'] = $audRemainingInside;
        $payload['auditorium_remaining_inside'] = $audRemainingInside;
        $payload['auditorium_crowd_density'] = $audRemainingInside;
        $payload['peak'] = $peak;
        $payload['sensors'] = $sensors;

        return $payload;
    }

    /**
     * @return array{start: Carbon, end: Carbon}
     */
    public function dailyWindow(): array
    {
        $start = Carbon::now(self::TZ)->startOfDay();
        $end = $start->copy()->addDay();

        return [
            'start' => $start,
            'end' => $end,
        ];
    }

    /**
     * @param array{start: Carbon, end: Carbon} $window
     */
    public function emptyPayload(array $window): array
    {
        return [
            'calculation_window_start' => $this->iso($window['start']),
            'calculation_window_end' => $this->iso($window['end']),
            'calculation_window_timezone' => self::TZ,
            'people_in' => null,
            'people_out' => null,
            'remaining_inside' => null,
            'net_flow' => null,
            'crowd_density' => null,
            'auditorium_remaining_inside' => null,
            'auditorium_crowd_density' => null,
            'peak' => null,
            'sensors' => [],
        ];
    }

    private function safeDelta($maxValue, $minValue): float
    {
        $delta = (float) ($maxValue ?? 0) - (float) ($minValue ?? 0);
        return max(0.0, min(self::MAX_DELTA_PER_SENSOR, $delta));
    }

    private function iso(Carbon $value): string
    {
        return $value->copy()->timezone(self::TZ)->toIso8601String();
    }

    private function isAuditoriumSensor(?string $locationCode, ?string $sensorName, ?string $sensorUid): bool
    {
        if ($locationCode !== null && $this->isAuditoriumLocationCode($locationCode)) {
            return true;
        }

        if ($locationCode !== null) {
            $meta = $this->spatial->getLocationMeta($locationCode);
            $parent = $meta['parent'] ?? $this->spatial->getParentLocation($locationCode);
            if (is_string($parent) && $this->isAuditoriumLocationCode($parent)) {
                return true;
            }
        }

        $fallback = strtoupper(trim(implode(' ', array_filter([
            $sensorName ?? '',
            $sensorUid ?? '',
        ], static fn ($value) => $value !== ''))));

        return $fallback !== '' && str_contains($fallback, 'AUD');
    }

    private function isAuditoriumLocationCode(string $code): bool
    {
        return $code === 'AUD' || str_starts_with($code, 'AUD-');
    }

    private function resolveSensorFloor(?string $locationCode, bool $isAuditorium): ?string
    {
        if ($isAuditorium) {
            return 'AUD';
        }

        $code = $this->spatial->normalizeLocation($locationCode);
        if ($code === null) {
            return null;
        }

        $cursor = $code;
        $visited = [];
        while ($cursor !== null && !isset($visited[$cursor])) {
            $visited[$cursor] = true;
            $meta = $this->spatial->getLocationMeta($cursor);
            if (is_array($meta) && ($meta['type'] ?? null) === 'floor') {
                return $cursor;
            }

            $parent = $meta['parent'] ?? $this->spatial->getParentLocation($cursor);
            if (!is_string($parent) || $parent === '') {
                break;
            }
            $cursor = $this->spatial->normalizeLocation($parent);
        }

        $parent = $this->spatial->getParentLocation($code);
        return $parent !== null ? $this->spatial->normalizeLocation($parent) : null;
    }

    /**
     * @param array<int, string> $sensorNames
     */
    private function resolveSensorName(string $scopeColumn, $scopeKey, array $sensorNames): ?string
    {
        if ($scopeColumn === 'sensor_uid') {
            return $sensorNames[(string) $scopeKey] ?? null;
        }

        if ($scopeColumn === 'sensor_id') {
            return $sensorNames[(int) $scopeKey] ?? null;
        }

        return null;
    }

    /**
     * @param array<int>|null $sensorIds
     * @param array<string>|null $sensorUids
     * @return array<int|string, string>
     */
    private function loadSensorNames($schema, bool $sensorIdsScoped, ?array $sensorIds, bool $sensorUidsScoped, ?array $sensorUids): array
    {
        if (!$schema->hasTable('sensors') || !$schema->hasColumn('sensors', 'name')) {
            return [];
        }

        try {
            $query = DB::table('sensors')->select(['id', 'external_id', 'name']);
            if ($schema->hasColumn('sensors', 'is_active')) {
                $query->where('is_active', true);
            }
            if ($sensorIdsScoped && !empty($sensorIds)) {
                $query->whereIn('id', $sensorIds);
            } elseif ($sensorUidsScoped && !empty($sensorUids) && $schema->hasColumn('sensors', 'external_id')) {
                $query->whereIn('external_id', $sensorUids);
            }

            $rows = $query->get();
        } catch (\Throwable $e) {
            $this->safeLogWarning('OccupancyMetricsService: sensor name lookup failed', $e);
            return [];
        }

        $names = [];
        foreach ($rows as $row) {
            $name = trim((string) ($row->name ?? ''));
            if ($name === '') {
                continue;
            }
            $names[(int) $row->id] = $name;
            if (isset($row->external_id) && $row->external_id !== '') {
                $names[(string) $row->external_id] = $name;
            }
        }

        return $names;
    }

    /**
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
        foreach ($list as $value) {
            if ($value === null) {
                continue;
            }
            if ($kind === 'int') {
                $id = (int) $value;
                if ($id > 0) {
                    $out[$id] = $id;
                }
                continue;
            }

            $stringValue = trim((string) $value);
            if ($stringValue !== '') {
                $out[$stringValue] = $stringValue;
            }
        }

        return array_values($out);
    }

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
            $this->safeLogWarning('OccupancyMetricsService: failed to detect readings scope column', $e);
        }

        return null;
    }

    /**
     * @param array<int>|null $sensorIds
     * @param array<string>|null $sensorUids
     */
    private function applyReadingsScope($query, ?string $column, bool $idsScoped, ?array $ids, bool $uidsScoped, ?array $uids): void
    {
        if ($column === 'sensor_uid' && $uidsScoped && !empty($uids)) {
            $query->whereIn('sensor_uid', $uids);
            return;
        }
        if ($column === 'sensor_id' && $idsScoped && !empty($ids)) {
            $query->whereIn('sensor_id', $ids);
            return;
        }
        if ($column === 'sensor_uid' && $idsScoped && !empty($ids)) {
            $query->whereIn('sensor_uid', function ($sub) use ($ids) {
                $sub->select('external_id')->from('sensors')->whereIn('id', $ids);
            });
            return;
        }
        if ($column === 'sensor_id' && $uidsScoped && !empty($uids)) {
            $query->whereIn('sensor_id', function ($sub) use ($uids) {
                $sub->select('id')->from('sensors')->whereIn('external_id', $uids);
            });
        }
    }

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
            $this->safeLogWarning('OccupancyMetricsService: excludeBadLocation failed', $e);
        }
    }

    private function safeLogWarning(string $message, \Throwable $e, array $context = []): void
    {
        try {
            Log::warning($message, array_merge($context, [
                'exception' => get_class($e),
                'error' => $e->getMessage(),
            ]));
        } catch (\Throwable $ignored) {
        }
    }
}
