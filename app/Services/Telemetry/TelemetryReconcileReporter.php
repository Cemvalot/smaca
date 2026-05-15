<?php

namespace App\Services\Telemetry;

use App\Support\TelemetryLatestNormalizer;
use App\Support\TelemetryMetricColumns;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Post-rebuild validation: coverage, gaps, and readings vs sensor_latest drift.
 */
final class TelemetryReconcileReporter
{
    private const STALE_MINUTES = 90;

    /**
     * @return array<string, mixed>
     */
    public function build(?int $sampleLimit = null): array
    {
        if (!Schema::hasTable('sensor_latest') || !Schema::hasTable('sensors')) {
            return ['ok' => false, 'message' => 'sensor_latest or sensors table missing'];
        }

        $fallback = $this->fallbackStatus();
        $pm25Col = TelemetryMetricColumns::sensorLatestPm25PhysicalColumn();
        $pm10Col = TelemetryMetricColumns::sensorLatestPm10PhysicalColumn();
        $hasTvocCol = Schema::hasColumn('sensor_latest', 'tvoc_index');
        $hasLightCol = Schema::hasColumn('sensor_latest', 'light_level');

        $sensors = DB::table('sensors')->select(['id', 'external_id', 'device_type'])->get();
        $readingsMap = [];
        if ($fallback['active']) {
            $readingsMap = $this->readingsIaqMapForSensors($sensors);
        }

        $rows = DB::table('sensor_latest as sl')
            ->leftJoin('sensors as s', 's.id', '=', 'sl.sensor_id')
            ->select([
                'sl.sensor_id',
                's.external_id as sensor_uid',
                's.device_type',
                'sl.measured_at',
                'sl.co2_ppm',
                DB::raw($hasTvocCol ? 'sl.tvoc_index' : 'NULL as tvoc_index'),
                DB::raw($hasLightCol ? 'sl.light_level' : 'NULL as light_level'),
                DB::raw($pm25Col ? 'sl.'.$pm25Col.' as pm25_v' : 'NULL as pm25_v'),
                DB::raw($pm10Col ? 'sl.'.$pm10Col.' as pm10_v' : 'NULL as pm10_v'),
            ])
            ->get();

        $now = Carbon::now('Europe/Athens');
        $withTvocLatest = 0;
        $withLightLatest = 0;
        $withTvocEffective = 0;
        $withLightEffective = 0;
        $withTvocFromReadings = 0;
        $withLightFromReadings = 0;
        $missingPm = [];
        $incomplete = [];
        $stale = [];

        foreach ($rows as $r) {
            $sid = (int) $r->sensor_id;
            $reading = $readingsMap[$sid] ?? null;
            $apiSnap = $this->apiSnapshotForSensorRow($r, $reading, $fallback);

            if ($hasTvocCol && $r->tvoc_index !== null && $r->tvoc_index !== '') {
                $withTvocLatest++;
            }
            if ($hasLightCol && $r->light_level !== null && $r->light_level !== '') {
                $withLightLatest++;
            }

            $tvocEff = $apiSnap['tvoc'] ?? null;
            $lightEff = $apiSnap['lighting'] ?? null;
            if ($tvocEff !== null && $tvocEff !== '') {
                $withTvocEffective++;
                if (!empty($apiSnap['fallback_from_readings']) && ($r->tvoc_index ?? null) === null) {
                    $withTvocFromReadings++;
                }
            }
            if ($lightEff !== null && $lightEff !== '') {
                $withLightEffective++;
                if (!empty($apiSnap['fallback_from_readings']) && ($r->light_level ?? null) === null) {
                    $withLightFromReadings++;
                }
            }

            $hasPm25 = $r->pm25_v !== null && $r->pm25_v !== '';
            $hasPm10 = $r->pm10_v !== null && $r->pm10_v !== '';
            if (!$hasPm25 && !$hasPm10) {
                $missingPm[] = $sid;
            }
            $hasCo2 = $r->co2_ppm !== null && $r->co2_ppm !== '';
            if (!$hasCo2 && ($tvocEff === null || $tvocEff === '') && !$hasPm25 && !$hasPm10) {
                $incomplete[] = $sid;
            }
            if ($r->measured_at) {
                try {
                    $mins = $now->diffInMinutes(Carbon::parse($r->measured_at));
                    if ($mins > self::STALE_MINUTES) {
                        $stale[] = [
                            'sensor_id' => $sid,
                            'minutes_since_last' => $mins,
                        ];
                    }
                } catch (\Throwable $e) {
                }
            } else {
                $stale[] = ['sensor_id' => $sid, 'minutes_since_last' => null];
            }
        }

        $drift = $this->sampleDrift($sampleLimit ?? 10, $fallback);

        return [
            'ok' => true,
            'generated_at' => $now->toIso8601String(),
            'sensors_in_sensor_latest' => $rows->count(),
            'with_tvoc_index_in_sensor_latest' => $withTvocLatest,
            'with_light_level_in_sensor_latest' => $withLightLatest,
            'with_tvoc_effective' => $withTvocEffective,
            'with_light_level_effective' => $withLightEffective,
            'with_tvoc_from_readings_fallback' => $withTvocFromReadings,
            'with_light_from_readings_fallback' => $withLightFromReadings,
            'schema_missing_in_sensor_latest' => $fallback['schema_missing_in_sensor_latest'],
            'fallback_from_readings' => $fallback['active'],
            'readings_fallback_warning' => $fallback['warning'],
            'missing_pm_sensor_ids' => array_slice($missingPm, 0, 50),
            'missing_pm_count' => count($missingPm),
            'incomplete_telemetry_sensor_ids' => array_slice($incomplete, 0, 50),
            'incomplete_telemetry_count' => count($incomplete),
            'stale_sensors' => array_slice($stale, 0, 50),
            'stale_count' => count($stale),
            'stale_threshold_minutes' => self::STALE_MINUTES,
            'drift_samples' => $drift,
        ];
    }

    /**
     * @return array{
     *   active: bool,
     *   schema_missing_in_sensor_latest: array<int, string>,
     *   warning: string|null
     * }
     */
    private function fallbackStatus(): array
    {
        if (function_exists('smacaReadingsIaqFallbackStatus_impl')) {
            $s = smacaReadingsIaqFallbackStatus_impl();

            return [
                'active' => (bool) ($s['active'] ?? false),
                'schema_missing_in_sensor_latest' => (array) ($s['schema_missing_in_sensor_latest'] ?? []),
                'warning' => $s['warning'] ?? null,
            ];
        }

        $missing = [];
        foreach (['tvoc_index', 'light_level', 'lux'] as $col) {
            if (Schema::hasTable('sensor_latest') && !Schema::hasColumn('sensor_latest', $col)) {
                $missing[] = $col;
            }
        }
        $active = count(array_intersect($missing, ['tvoc_index', 'light_level'])) > 0;

        return [
            'active' => $active,
            'schema_missing_in_sensor_latest' => $missing,
            'warning' => $active
                ? 'tvoc_index/light_level not present in sensor_latest; API uses readings fallback.'
                : null,
        ];
    }

    /**
     * @param iterable<int, object> $sensors
     * @return array<int, object>
     */
    private function readingsIaqMapForSensors(iterable $sensors): array
    {
        if (function_exists('smacaReadingsLatestIaqMapForSensors_impl')) {
            return smacaReadingsLatestIaqMapForSensors_impl($sensors);
        }

        return [];
    }

    /**
     * @return array<string, mixed>
     */
    private function apiSnapshotForSensorRow(object $slRow, ?object $reading, array $fallback): array
    {
        if (function_exists('smacaApiSnapshotFromRowWithIaqFallback_impl')) {
            return smacaApiSnapshotFromRowWithIaqFallback_impl($slRow, $reading);
        }

        $snap = TelemetryLatestNormalizer::mergeNormalizedSemanticKeys([], $slRow);
        if ($fallback['active'] && function_exists('smacaApplyReadingsIaqFallback_impl')) {
            return smacaApplyReadingsIaqFallback_impl(
                $snap,
                $reading,
                $fallback['schema_missing_in_sensor_latest']
            );
        }

        if ($fallback['active']
            && method_exists(TelemetryLatestNormalizer::class, 'applyReadingsIaqFallback')
        ) {
            return TelemetryLatestNormalizer::applyReadingsIaqFallback(
                $snap,
                $reading,
                $fallback['schema_missing_in_sensor_latest']
            );
        }

        return $snap;
    }

    /**
     * @param array{
     *   active: bool,
     *   schema_missing_in_sensor_latest: array<int, string>,
     *   warning: string|null
     * } $fallback
     * @return array<int, array<string, mixed>>
     */
    public function sampleDrift(int $limit = 10, ?array $fallback = null): array
    {
        if (!Schema::hasTable('readings')) {
            return [];
        }

        $fallback ??= $this->fallbackStatus();
        $scope = $this->detectReadingsScopeColumn();
        if ($scope === null) {
            return [];
        }

        $pm25Read = TelemetryMetricColumns::readingsPm25PhysicalColumn();
        $pm10Read = TelemetryMetricColumns::readingsPm10PhysicalColumn();
        $pm25Latest = TelemetryMetricColumns::sensorLatestPm25PhysicalColumn();
        $pm10Latest = TelemetryMetricColumns::sensorLatestPm10PhysicalColumn();
        $hasTvocLatest = Schema::hasColumn('sensor_latest', 'tvoc_index');
        $hasLightLatest = Schema::hasColumn('sensor_latest', 'light_level');

        $sensors = DB::table('sensors')->select(['id', 'external_id'])->orderByDesc('id')->limit($limit)->get();
        $readingsMap = $fallback['active'] ? $this->readingsIaqMapForSensors($sensors) : [];
        $out = [];

        foreach ($sensors as $sensor) {
            $reading = $readingsMap[(int) $sensor->id] ?? $this->latestReadingForSensor($sensor, $scope);
            $latest = DB::table('sensor_latest')->where('sensor_id', (int) $sensor->id)->first();
            $apiLatest = $latest !== null
                ? $this->apiSnapshotForSensorRow($latest, $reading, $fallback)
                : null;

            $out[] = [
                'sensor_id' => (int) $sensor->id,
                'sensor_uid' => (string) $sensor->external_id,
                'readings_latest' => $reading ? [
                    'reading_id' => $reading->id,
                    'measured_at' => $reading->measured_at ?? null,
                    'tvoc_index' => $reading->tvoc_index ?? null,
                    'light_level' => $reading->light_level ?? null,
                    'pm25' => $pm25Read && property_exists($reading, $pm25Read) ? $reading->{$pm25Read} : null,
                    'pm10' => $pm10Read && property_exists($reading, $pm10Read) ? $reading->{$pm10Read} : null,
                ] : null,
                'sensor_latest' => $latest ? [
                    'reading_id' => $latest->reading_id ?? null,
                    'measured_at' => $latest->measured_at ?? null,
                    'tvoc_index' => $hasTvocLatest ? ($latest->tvoc_index ?? null) : null,
                    'light_level' => $hasLightLatest ? ($latest->light_level ?? null) : null,
                    'schema_missing_tvoc_light' => !$hasTvocLatest || !$hasLightLatest,
                    'pm25' => $pm25Latest && property_exists($latest, $pm25Latest) ? $latest->{$pm25Latest} : null,
                    'pm10' => $pm10Latest && property_exists($latest, $pm10Latest) ? $latest->{$pm10Latest} : null,
                ] : null,
                'api_latest_normalized' => $apiLatest ? [
                    'tvoc' => $apiLatest['tvoc'] ?? null,
                    'lighting' => $apiLatest['lighting'] ?? null,
                    'pm25' => $apiLatest['pm25'] ?? null,
                    'pm10' => $apiLatest['pm10'] ?? null,
                    'fallback_from_readings' => (bool) ($apiLatest['fallback_from_readings'] ?? false),
                ] : null,
                'in_sync' => $this->driftInSync(
                    $reading,
                    $latest,
                    $apiLatest,
                    $pm25Read,
                    $pm10Read,
                    $pm25Latest,
                    $pm10Latest,
                    $fallback
                ),
            ];
        }

        return $out;
    }

    /**
     * @param array<string, mixed>|null $apiLatest
     * @param array{
     *   active: bool,
     *   schema_missing_in_sensor_latest: array<int, string>
     * } $fallback
     */
    private function driftInSync(
        ?object $reading,
        ?object $latest,
        ?array $apiLatest,
        ?string $pm25Read,
        ?string $pm10Read,
        ?string $pm25Latest,
        ?string $pm10Latest,
        array $fallback
    ): bool {
        if ($reading === null) {
            return false;
        }

        if ($fallback['active'] && $apiLatest !== null) {
            $rTvoc = $reading->tvoc_index ?? null;
            $rLight = $reading->light_level ?? null;
            if (in_array('tvoc_index', $fallback['schema_missing_in_sensor_latest'], true)) {
                if ((string) ($apiLatest['tvoc'] ?? '') !== (string) ($rTvoc ?? '')) {
                    return false;
                }
            }
            if (in_array('light_level', $fallback['schema_missing_in_sensor_latest'], true)) {
                if ((string) ($apiLatest['lighting'] ?? '') !== (string) ($rLight ?? '')) {
                    return false;
                }
            }
            if ($pm25Read && $pm25Latest && $latest !== null) {
                $a = $reading->{$pm25Read} ?? null;
                $b = $latest->{$pm25Latest} ?? null;
                if ((string) ($a ?? '') !== (string) ($b ?? '')) {
                    return false;
                }
            }
            if ($pm10Read && $pm10Latest && $latest !== null) {
                $a = $reading->{$pm10Read} ?? null;
                $b = $latest->{$pm10Latest} ?? null;
                if ((string) ($a ?? '') !== (string) ($b ?? '')) {
                    return false;
                }
            }

            return true;
        }

        if ($latest === null) {
            return false;
        }
        if ((int) ($latest->reading_id ?? 0) !== (int) ($reading->id ?? -1)) {
            return false;
        }
        foreach (['tvoc_index', 'light_level'] as $col) {
            if (!property_exists($reading, $col) && !property_exists($latest, $col)) {
                continue;
            }
            $a = property_exists($reading, $col) ? $reading->{$col} : null;
            $b = property_exists($latest, $col) ? $latest->{$col} : null;
            if ((string) ($a ?? '') !== (string) ($b ?? '')) {
                return false;
            }
        }
        if ($pm25Read && $pm25Latest) {
            $a = $reading->{$pm25Read} ?? null;
            $b = $latest->{$pm25Latest} ?? null;
            if ((string) ($a ?? '') !== (string) ($b ?? '')) {
                return false;
            }
        }
        if ($pm10Read && $pm10Latest) {
            $a = $reading->{$pm10Read} ?? null;
            $b = $latest->{$pm10Latest} ?? null;
            if ((string) ($a ?? '') !== (string) ($b ?? '')) {
                return false;
            }
        }

        return true;
    }

    private function detectReadingsScopeColumn(): ?string
    {
        if (Schema::hasColumn('readings', 'sensor_uid')) {
            return 'sensor_uid';
        }
        if (Schema::hasColumn('readings', 'sensor_id')) {
            return 'sensor_id';
        }

        return null;
    }

    private function latestReadingForSensor(object $sensor, string $scope): ?object
    {
        $q = DB::table('readings')->orderByDesc('measured_at')->orderByDesc('id')->limit(1);
        if ($scope === 'sensor_uid') {
            $q->where('sensor_uid', (string) $sensor->external_id);
        } else {
            $q->where('sensor_id', (int) $sensor->id);
        }

        return $q->first();
    }
}
