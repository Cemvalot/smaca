<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * Mirrors overview sensor freshness rules from smaca-telemetry-bootstrap.js.
 */
class SensorFreshnessClassifier
{
    private const PROFILES = [
        'default' => ['online' => 90, 'stale' => 360, 'offline' => 1440],
        'indoorairquality' => ['online' => 90, 'stale' => 360, 'offline' => 1440],
        'iaq' => ['online' => 90, 'stale' => 360, 'offline' => 1440],
        'peoplecounter' => ['online' => 90, 'stale' => 360, 'offline' => 1440],
        'occupancy' => ['online' => 90, 'stale' => 360, 'offline' => 1440],
        'sensornetworkquality' => ['online' => 90, 'stale' => 360, 'offline' => 1440],
        'connectivity' => ['online' => 90, 'stale' => 360, 'offline' => 1440],
        'energymeter' => ['online' => 480, 'stale' => 1440, 'offline' => 2880],
        'energy' => ['online' => 480, 'stale' => 1440, 'offline' => 2880],
        'watermeter' => ['online' => 1440, 'stale' => 4320, 'offline' => 10080],
        'water' => ['online' => 1440, 'stale' => 4320, 'offline' => 10080],
        'sensoruv' => ['online' => 180, 'stale' => 720, 'offline' => 2880],
        'environmental' => ['online' => 180, 'stale' => 720, 'offline' => 2880],
    ];

    /**
     * @param object|array<string, mixed> $sensor
     */
    public function classify($sensor): string
    {
        $row = (array) $sensor;
        $isActive = $row['is_active'] ?? true;
        if ($isActive === false || $isActive === 0 || $isActive === '0') {
            return 'offline';
        }

        $minutes = $this->freshnessMinutes($row);
        if ($minutes === null) {
            return 'offline';
        }

        $profile = $this->profileFor($row);
        if ($minutes < $profile['online']) {
            return 'online';
        }
        if ($minutes < $profile['offline']) {
            return 'delayed';
        }

        return 'offline';
    }

    /**
     * @param object|array<string, mixed> $sensor
     */
    public function freshnessMinutes($sensor): ?int
    {
        $row = (array) $sensor;
        $newest = null;

        foreach (['last_seen_at', 'measured_at'] as $key) {
            $value = $row[$key] ?? null;
            if ($value === null || $value === '') {
                continue;
            }
            try {
                $parsed = Carbon::parse((string) $value);
            } catch (\Throwable $e) {
                continue;
            }
            if ($newest === null || $parsed->greaterThan($newest)) {
                $newest = $parsed;
            }
        }

        if ($newest === null) {
            return null;
        }

        $diffSeconds = now()->getTimestamp() - $newest->getTimestamp();
        return max(0, (int) floor($diffSeconds / 60));
    }

    /**
     * @param array<string, mixed> $sensor
     * @return array{online:int,stale:int,offline:int}
     */
    private function profileFor(array $sensor): array
    {
        $key = $this->normalizeDeviceTypeKey($sensor);
        if (isset(self::PROFILES[$key])) {
            return self::PROFILES[$key];
        }
        if (preg_match('/energy|meter|sdm|kwh/', $key)) {
            return self::PROFILES['energymeter'];
        }
        if (preg_match('/water/', $key)) {
            return self::PROFILES['watermeter'];
        }
        if (preg_match('/people|counter|occupancy/', $key)) {
            return self::PROFILES['peoplecounter'];
        }
        if (preg_match('/iaq|airquality|indoor/', $key)) {
            return self::PROFILES['indoorairquality'];
        }
        if (preg_match('/network|connectivity|wireless|lora|rssi|networkquality/', $key)) {
            return self::PROFILES['sensornetworkquality'];
        }
        if (preg_match('/uv|environmental|sensoruv/', $key)) {
            return self::PROFILES['sensoruv'];
        }

        return self::PROFILES['default'];
    }

    /**
     * @param array<string, mixed> $sensor
     */
    private function normalizeDeviceTypeKey(array $sensor): string
    {
        $deviceType = strtolower(preg_replace('/[^a-z0-9]/', '', (string) ($sensor['device_type'] ?? '')));
        if ($deviceType !== '' && $deviceType !== 'unknown') {
            return $deviceType;
        }

        return strtolower(preg_replace('/[^a-z0-9]/', '', (string) ($sensor['name'] ?? $sensor['sensor_name'] ?? '')));
    }
}
