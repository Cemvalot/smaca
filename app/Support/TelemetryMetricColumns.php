<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Resolves physical DB column names for PM metrics across schema variants
 * (e.g. pm2_5_ugm3 vs pm2_5ugm3) and builds SELECT fragments that always
 * project canonical API aliases on joined rows.
 */
final class TelemetryMetricColumns
{
    /**
     * @param array<int, string> $candidates
     */
    public static function firstPhysicalColumn(string $table, array $candidates): ?string
    {
        try {
            $schema = DB::getSchemaBuilder();
            foreach ($candidates as $col) {
                if ($schema->hasColumn($table, $col)) {
                    return $col;
                }
            }
        } catch (\Throwable $e) {
        }

        return null;
    }

    public static function sensorLatestPm25PhysicalColumn(): ?string
    {
        return self::firstPhysicalColumn('sensor_latest', ['pm2_5_ugm3', 'pm2_5ugm3']);
    }

    public static function sensorLatestPm10PhysicalColumn(): ?string
    {
        return self::firstPhysicalColumn('sensor_latest', ['pm10_ugm3', 'pm10ugm3']);
    }

    public static function readingsPm25PhysicalColumn(): ?string
    {
        return self::firstPhysicalColumn('readings', ['pm2_5_ugm3', 'pm2_5ugm3']);
    }

    public static function readingsPm10PhysicalColumn(): ?string
    {
        return self::firstPhysicalColumn('readings', ['pm10_ugm3', 'pm10ugm3']);
    }

    /**
     * @return array<int, string|\Illuminate\Database\Query\Expression>
     */
    public static function sensorLatestPm25SelectFragments(string $tableAlias = 'sl'): array
    {
        $phys = self::sensorLatestPm25PhysicalColumn();
        if ($phys === null) {
            return [];
        }
        if ($phys === 'pm2_5_ugm3') {
            return [$tableAlias.'.pm2_5_ugm3'];
        }

        return [DB::raw($tableAlias.'.'.$phys.' as pm2_5_ugm3')];
    }

    /**
     * @return array<int, string|\Illuminate\Database\Query\Expression>
     */
    public static function sensorLatestPm10SelectFragments(string $tableAlias = 'sl'): array
    {
        $phys = self::sensorLatestPm10PhysicalColumn();
        if ($phys === null) {
            return [];
        }
        if ($phys === 'pm10_ugm3') {
            return [$tableAlias.'.pm10_ugm3'];
        }

        return [DB::raw($tableAlias.'.'.$phys.' as pm10_ugm3')];
    }
}
