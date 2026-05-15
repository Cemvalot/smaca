<?php

namespace App\Support;

/**
 * Adds canonical IAQ axis keys to sensor "latest" snapshots while keeping
 * legacy / raw field names for backward compatibility.
 */
final class TelemetryLatestNormalizer
{
    /**
     * @param array<string, mixed> $snapshot
     * @return array<string, mixed>
     */
    public static function mergeNormalizedSemanticKeys(array $snapshot, object $row): array
    {
        $out = $snapshot;

        $pm25 = self::pickScalar([
            $snapshot['pm25'] ?? null,
            $snapshot['pm2_5_ugm3'] ?? null,
            $snapshot['pm2_5ugm3'] ?? null,
            self::rowProp($row, 'pm25'),
            self::rowProp($row, 'pm2_5_ugm3'),
            self::rowProp($row, 'pm2_5ugm3'),
        ]);
        $out['pm25'] = $pm25;

        $pm10 = self::pickScalar([
            $snapshot['pm10'] ?? null,
            $snapshot['pm10_ugm3'] ?? null,
            $snapshot['pm10ugm3'] ?? null,
            self::rowProp($row, 'pm10'),
            self::rowProp($row, 'pm10_ugm3'),
            self::rowProp($row, 'pm10ugm3'),
        ]);
        $out['pm10'] = $pm10;

        $tvoc = self::pickScalar([
            $snapshot['tvoc'] ?? null,
            $snapshot['tvoc_index'] ?? null,
            self::rowProp($row, 'tvoc'),
            self::rowProp($row, 'tvoc_index'),
        ]);
        $out['tvoc'] = $tvoc;

        $lighting = self::pickScalar([
            $snapshot['lighting'] ?? null,
            $snapshot['light_level'] ?? null,
            self::rowProp($row, 'lighting'),
            self::rowProp($row, 'light_level'),
        ]);
        $out['lighting'] = $lighting;

        $temperature = self::pickScalar([
            $snapshot['temperature'] ?? null,
            $snapshot['temperature_c'] ?? null,
            self::rowProp($row, 'temperature'),
            self::rowProp($row, 'temperature_c'),
        ]);
        $out['temperature'] = $temperature;

        $humidity = self::pickScalar([
            $snapshot['humidity'] ?? null,
            $snapshot['humidity_rh'] ?? null,
            self::rowProp($row, 'humidity'),
            self::rowProp($row, 'humidity_rh'),
        ]);
        $out['humidity'] = $humidity;

        if (($out['pm2_5_ugm3'] ?? null) === null && $pm25 !== null) {
            $out['pm2_5_ugm3'] = $pm25;
        }
        if (($out['pm2_5ugm3'] ?? null) === null && $pm25 !== null) {
            $out['pm2_5ugm3'] = $pm25;
        }
        if (($out['pm10_ugm3'] ?? null) === null && $pm10 !== null) {
            $out['pm10_ugm3'] = $pm10;
        }
        if (($out['pm10ugm3'] ?? null) === null && $pm10 !== null) {
            $out['pm10ugm3'] = $pm10;
        }
        if (($out['tvoc_index'] ?? null) === null && $tvoc !== null) {
            $out['tvoc_index'] = $tvoc;
        }
        if (($out['light_level'] ?? null) === null && $lighting !== null) {
            $out['light_level'] = $lighting;
        }
        if (($out['temperature_c'] ?? null) === null && $temperature !== null) {
            $out['temperature_c'] = $temperature;
        }
        if (($out['humidity_rh'] ?? null) === null && $humidity !== null) {
            $out['humidity_rh'] = $humidity;
        }

        return $out;
    }

    /**
     * Fill IAQ fields from newest readings when sensor_latest lacks those columns.
     *
     * @param array<string, mixed> $snapshot
     * @param array<int, string> $missingOnSensorLatest e.g. ['tvoc_index', 'light_level']
     * @return array<string, mixed>
     */
    public static function applyReadingsIaqFallback(
        array $snapshot,
        ?object $reading,
        array $missingOnSensorLatest
    ): array {
        if ($reading === null || $missingOnSensorLatest === []) {
            return $snapshot;
        }

        $out = $snapshot;
        $touched = false;

        if (in_array('tvoc_index', $missingOnSensorLatest, true)) {
            $v = self::rowProp($reading, 'tvoc_index');
            if ($v !== null && $v !== '' && ($out['tvoc'] ?? null) === null && ($out['tvoc_index'] ?? null) === null) {
                $out['tvoc_index'] = $v;
                $touched = true;
            }
        }

        if (in_array('light_level', $missingOnSensorLatest, true)) {
            $v = self::rowProp($reading, 'light_level');
            if ($v !== null && $v !== '' && ($out['lighting'] ?? null) === null && ($out['light_level'] ?? null) === null) {
                $out['light_level'] = $v;
                $touched = true;
            }
        }

        if (in_array('lux', $missingOnSensorLatest, true)) {
            $v = self::rowProp($reading, 'lux');
            if ($v !== null && $v !== '' && ($out['lux'] ?? null) === null) {
                $out['lux'] = $v;
                $touched = true;
            }
        }

        if (!$touched) {
            return $out;
        }

        $out = self::mergeNormalizedSemanticKeys($out, $reading);
        $out['fallback_from_readings'] = true;

        return $out;
    }

    private static function rowProp(object $row, string $key): mixed
    {
        return property_exists($row, $key) ? $row->{$key} : null;
    }

    /** @param array<mixed> $candidates */
    private static function pickScalar(array $candidates): mixed
    {
        foreach ($candidates as $v) {
            if ($v === null || $v === '') {
                continue;
            }

            return $v;
        }

        return null;
    }
}
