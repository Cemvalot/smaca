<?php

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

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

if (!function_exists('smacaApiSnapshotFromRow_impl')) {
    function smacaApiSnapshotFromRow_impl(object $row): array
    {
        return [
            'measured_at' => smacaApiIso_impl($row->measured_at ?? null),
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

if (!function_exists('smacaReadingsHasColumn_impl')) {
    function smacaReadingsHasColumn_impl(string $column): bool
    {
        return DB::getSchemaBuilder()->hasColumn('readings', $column);
    }
}

