<?php

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

if (!function_exists('smacaWaterParseAlarmsList_impl')) {
    /**
     * @return array<int, string>
     */
    function smacaWaterParseAlarmsList_impl(mixed $raw): array
    {
        if ($raw === null || $raw === '') {
            return [];
        }

        $s = trim((string) $raw);
        if ($s === '' || strcasecmp($s, 'none') === 0 || $s === '[]') {
            return [];
        }

        $parts = array_map(static fn ($p) => trim((string) $p), explode(',', $s));

        return array_values(array_filter($parts, static fn ($p) => $p !== ''));
    }
}

if (!function_exists('smacaWaterComputeStatus_impl')) {
    /**
     * @param array<int, string> $alarms
     */
    function smacaWaterComputeStatus_impl(array $alarms, bool $hasData): string
    {
        if (!$hasData) {
            return 'no_data';
        }

        if ($alarms === []) {
            return 'normal';
        }

        $criticalTypes = ['leakage', 'burst', 'backflow'];
        foreach ($alarms as $alarm) {
            if (in_array(strtolower($alarm), $criticalTypes, true)) {
                return 'critical';
            }
        }

        if (count($alarms) > 1) {
            return 'critical';
        }

        if (count($alarms) === 1) {
            return 'warning';
        }

        return 'normal';
    }
}

if (!function_exists('smacaWaterHasAnyColumn_impl')) {
    function smacaWaterHasAnyColumn_impl(): bool
    {
        if (smacaReadingsHasColumn_impl('volume_at_log_time_liters')) {
            return true;
        }

        try {
            $schema = DB::getSchemaBuilder();
            foreach (['volume_at_log_time_liters', 'battery_lifetime_months', 'active_alarms'] as $col) {
                if ($schema->hasColumn('sensor_latest', $col)) {
                    return true;
                }
            }
        } catch (\Throwable $e) {
            return false;
        }

        return false;
    }
}

if (!function_exists('smacaWaterLatestSnapshotRow_impl')) {
    function smacaWaterLatestSnapshotRow_impl(): ?object
    {
        if (!smacaWaterHasAnyColumn_impl()) {
            return null;
        }

        $schema = DB::getSchemaBuilder();
        $select = [
            's.id as sensor_id',
            's.external_id as sensor_uid',
            's.name as sensor_name',
            'sl.measured_at',
            'sl.reading_id',
        ];

        foreach (['volume_at_log_time_liters', 'battery_lifetime_months', 'active_alarms'] as $col) {
            if ($schema->hasColumn('sensor_latest', $col)) {
                $select[] = 'sl.'.$col;
            } elseif (smacaReadingsHasColumn_impl($col)) {
                $select[] = 'r.'.$col;
            }
        }

        $query = DB::table('sensor_latest as sl')
            ->join('sensors as s', 's.id', '=', 'sl.sensor_id')
            ->leftJoin('readings as r', 'r.id', '=', 'sl.reading_id')
            ->select($select);

        $query->where(function ($w) use ($schema) {
            $first = true;
            foreach (['volume_at_log_time_liters', 'battery_lifetime_months', 'active_alarms'] as $col) {
                if ($schema->hasColumn('sensor_latest', $col)) {
                    if ($first) {
                        $w->whereNotNull('sl.'.$col);
                        $first = false;
                    } else {
                        $w->orWhereNotNull('sl.'.$col);
                    }
                } elseif (smacaReadingsHasColumn_impl($col)) {
                    if ($first) {
                        $w->whereNotNull('r.'.$col);
                        $first = false;
                    } else {
                        $w->orWhereNotNull('r.'.$col);
                    }
                }
            }
            if ($first) {
                $w->whereRaw('0 = 1');
            }
        });

        $row = $query->orderByDesc('sl.measured_at')->orderByDesc('sl.reading_id')->first();
        if ($row) {
            return $row;
        }

        if (!smacaReadingsHasColumn_impl('volume_at_log_time_liters')
            && !smacaReadingsHasColumn_impl('battery_lifetime_months')
            && !smacaReadingsHasColumn_impl('active_alarms')) {
            return null;
        }

        $scope = smacaDetectReadingsScopeColumn_impl();
        if ($scope === null) {
            return null;
        }

        $fallbackSelect = [
            's.id as sensor_id',
            's.external_id as sensor_uid',
            's.name as sensor_name',
            'r.measured_at',
            'r.id as reading_id',
        ];
        foreach (['volume_at_log_time_liters', 'battery_lifetime_months', 'active_alarms'] as $col) {
            if (smacaReadingsHasColumn_impl($col)) {
                $fallbackSelect[] = 'r.'.$col;
            }
        }

        $readingsJoin = DB::table('readings as r');
        if (smacaReadingsHasColumn_impl('sensor_uid')) {
            $readingsJoin->join('sensors as s', 's.external_id', '=', 'r.sensor_uid');
        } else {
            $readingsJoin->join('sensors as s', 's.id', '=', 'r.sensor_id');
        }

        $fallback = $readingsJoin->select($fallbackSelect)
            ->where(function ($w) {
                $first = true;
                foreach (['volume_at_log_time_liters', 'battery_lifetime_months', 'active_alarms'] as $col) {
                    if (!smacaReadingsHasColumn_impl($col)) {
                        continue;
                    }
                    if ($first) {
                        $w->whereNotNull('r.'.$col);
                        $first = false;
                    } else {
                        $w->orWhereNotNull('r.'.$col);
                    }
                }
                if ($first) {
                    $w->whereRaw('0 = 1');
                }
            })
            ->orderByDesc('r.measured_at')
            ->orderByDesc('r.id')
            ->first();

        return $fallback ?: null;
    }
}

if (!function_exists('smacaWaterBuildLatestPayload_impl')) {
    /**
     * @return array<string, mixed>|null
     */
    function smacaWaterBuildLatestPayload_impl(?object $row): ?array
    {
        if ($row === null) {
            return null;
        }

        $liters = isset($row->volume_at_log_time_liters) && $row->volume_at_log_time_liters !== ''
            ? (int) $row->volume_at_log_time_liters
            : null;
        $battery = isset($row->battery_lifetime_months) && $row->battery_lifetime_months !== ''
            ? (int) $row->battery_lifetime_months
            : null;
        $alarms = smacaWaterParseAlarmsList_impl($row->active_alarms ?? null);

        $hasData = $liters !== null || $battery !== null || $alarms !== [];

        if (!$hasData) {
            return null;
        }

        return [
            'sensor_id' => (int) ($row->sensor_id ?? 0),
            'sensor_uid' => (string) ($row->sensor_uid ?? ''),
            'sensor_name' => (string) ($row->sensor_name ?? ''),
            'measured_at' => smacaApiIso_impl($row->measured_at ?? null),
            'volume_at_log_time_liters' => $liters,
            'volume_at_log_time_m3' => $liters !== null ? round($liters / 1000, 3) : null,
            'battery_lifetime_months' => $battery,
            'active_alarms' => $alarms,
        ];
    }
}

if (!function_exists('smacaWaterSummaryPayload_impl')) {
    /**
     * @return array<string, mixed>
     */
    function smacaWaterSummaryPayload_impl(): array
    {
        $row = smacaWaterLatestSnapshotRow_impl();
        $latest = smacaWaterBuildLatestPayload_impl($row);
        $available = $latest !== null;
        $alarms = $latest['active_alarms'] ?? [];
        $status = smacaWaterComputeStatus_impl(
            is_array($alarms) ? $alarms : [],
            $available
        );

        return [
            'available' => $available,
            'latest' => $latest,
            'status' => $status,
        ];
    }
}

Route::get('/api/water/summary', function () {
    return response()->json(smacaWaterSummaryPayload_impl());
});

Route::get('/api/water/timeseries', function (Request $request) {
    if (!smacaReadingsHasColumn_impl('volume_at_log_time_liters')) {
        return response()->json(['points' => []]);
    }

    [$timeframe, $from] = smacaApiParseTimeframe_impl($request->query('timeframe'));
    if (!$timeframe || !$from) {
        return response()->json([
            'message' => 'Invalid timeframe. Use one of: 24h, 7d, 30d, 6m',
        ], 422);
    }

    $scope = smacaDetectReadingsScopeColumn_impl();
    if ($scope === null) {
        return response()->json(['points' => []]);
    }

    $summary = smacaWaterSummaryPayload_impl();
    $sensorUid = trim((string) $request->query('sensor_uid', ''));
    if ($sensorUid === '' && !empty($summary['latest']['sensor_uid'])) {
        $sensorUid = (string) $summary['latest']['sensor_uid'];
    }

    $query = DB::table('readings')
        ->select(['measured_at', 'volume_at_log_time_liters'])
        ->where('measured_at', '>=', $from)
        ->whereNotNull('volume_at_log_time_liters')
        ->orderBy('measured_at');

    if ($sensorUid !== '') {
        if ($scope === 'sensor_uid') {
            $query->where('sensor_uid', $sensorUid);
        } else {
            $sensor = DB::table('sensors')->select(['id'])->where('external_id', $sensorUid)->first();
            if ($sensor) {
                $query->where('sensor_id', (int) $sensor->id);
            }
        }
    }

    $points = $query->get()->map(static function ($point) {
        return [
            'measured_at' => smacaApiIso_impl($point->measured_at ?? null),
            'volume_at_log_time_liters' => $point->volume_at_log_time_liters !== null
                ? (int) $point->volume_at_log_time_liters
                : null,
        ];
    })->values();

    return response()->json([
        'timeframe' => $timeframe,
        'sensor_uid' => $sensorUid !== '' ? $sensorUid : null,
        'points' => $points,
    ]);
});
