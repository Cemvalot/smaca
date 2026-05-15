<?php

namespace App\Services\Telemetry;

use App\Support\TelemetryMetricColumns;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Rebuilds sensor_latest rows from the newest readings per sensor.
 */
final class SensorLatestRebuilder
{
    private const STALE_MINUTES = 90;

    /** @var array<string, bool> */
    private array $readingsColumns = [];

    /** @var array<string, bool> */
    private array $latestColumns = [];

    private ?string $readingsScopeColumn = null;

    public function __construct()
    {
        $this->readingsColumns = $this->columnMap('readings');
        $this->latestColumns = $this->columnMap('sensor_latest');
        $this->readingsScopeColumn = $this->detectReadingsScopeColumn();
    }

    /**
     * @return array<string, mixed>
     */
    public function auditSchema(): array
    {
        $iaqLatest = array_values(array_filter(
            ['tvoc_index', 'light_level', 'lux', 'pm2_5_ugm3', 'pm2_5ugm3', 'pm10_ugm3', 'pm10ugm3'],
            fn (string $c) => isset($this->latestColumns[$c])
        ));
        $iaqReadings = array_values(array_filter(
            ['tvoc_index', 'light_level', 'lux', 'pm2_5_ugm3', 'pm2_5ugm3', 'pm10_ugm3', 'pm10ugm3'],
            fn (string $c) => isset($this->readingsColumns[$c])
        ));

        $schemaMissing = [];
        foreach (['tvoc_index', 'light_level', 'lux'] as $col) {
            if (!isset($this->latestColumns[$col]) && isset($this->readingsColumns[$col])) {
                $schemaMissing[] = $col;
            }
        }

        $fallbackActive = $schemaMissing !== []
            && count(array_intersect($schemaMissing, ['tvoc_index', 'light_level'])) > 0;

        return [
            'readings_scope_column' => $this->readingsScopeColumn,
            'sensor_latest_columns' => array_keys($this->latestColumns),
            'readings_iaq_columns' => $iaqReadings,
            'sensor_latest_iaq_columns' => $iaqLatest,
            'schema_missing_in_sensor_latest' => $schemaMissing,
            'fallback_from_readings' => $fallbackActive,
            'readings_fallback_warning' => $fallbackActive
                ? 'tvoc_index/light_level not present in sensor_latest; API uses readings fallback.'
                : null,
            'pm25_latest_physical' => TelemetryMetricColumns::sensorLatestPm25PhysicalColumn(),
            'pm10_latest_physical' => TelemetryMetricColumns::sensorLatestPm10PhysicalColumn(),
            'pm25_readings_physical' => TelemetryMetricColumns::readingsPm25PhysicalColumn(),
            'pm10_readings_physical' => TelemetryMetricColumns::readingsPm10PhysicalColumn(),
            'normalized_aliases_in_db' => false,
            'normalized_aliases_note' => 'Canonical keys (tvoc, lighting, pm25, …) are applied at API snapshot time only.',
        ];
    }

    /**
     * @param array{sensor_id?: int|null, dry_run?: bool, verbose?: bool} $options
     * @return array<string, mixed>
     */
    public function rebuild(array $options = []): array
    {
        $sensorIdFilter = isset($options['sensor_id']) ? (int) $options['sensor_id'] : null;
        $dryRun = (bool) ($options['dry_run'] ?? false);
        $verbose = (bool) ($options['verbose'] ?? false);

        if ($this->readingsScopeColumn === null || !isset($this->latestColumns['sensor_id'])) {
            return [
                'ok' => false,
                'message' => 'Cannot rebuild: readings scope or sensor_latest table unavailable',
                'schema' => $this->auditSchema(),
            ];
        }

        $sensorsQuery = DB::table('sensors')->select(['id', 'external_id', 'name', 'device_type']);
        if ($sensorIdFilter !== null && $sensorIdFilter > 0) {
            $sensorsQuery->where('id', $sensorIdFilter);
        }
        $sensors = $sensorsQuery->orderBy('id')->get();

        $now = Carbon::now('Europe/Athens');
        $updated = 0;
        $skippedNoReading = 0;
        $unchanged = 0;
        $errors = [];

        if (!$dryRun) {
            DB::beginTransaction();
        }

        try {
            foreach ($sensors as $sensor) {
                $reading = $this->latestReadingForSensor($sensor);
                if ($reading === null) {
                    $skippedNoReading++;
                    if ($verbose) {
                        $errors[] = ['sensor_id' => (int) $sensor->id, 'reason' => 'no_readings'];
                    }
                    continue;
                }

                $existing = DB::table('sensor_latest')->where('sensor_id', (int) $sensor->id)->first();
                $row = $this->mapReadingToSensorLatestRow($reading, (int) $sensor->id, $now, $existing);
                if ($row === null) {
                    $skippedNoReading++;
                    continue;
                }

                if ($existing !== null && $this->rowsEquivalent($existing, $row)) {
                    $unchanged++;
                    if ($verbose) {
                        $errors[] = ['sensor_id' => (int) $sensor->id, 'reason' => 'unchanged'];
                    }
                    continue;
                }

                if ($verbose) {
                    $errors[] = [
                        'sensor_id' => (int) $sensor->id,
                        'reason' => $existing === null ? 'insert' : 'update',
                        'reading_id' => $row['reading_id'] ?? null,
                        'measured_at' => $row['measured_at'] ?? null,
                    ];
                }

                if (!$dryRun) {
                    DB::table('sensor_latest')->updateOrInsert(
                        ['sensor_id' => (int) $sensor->id],
                        $row
                    );
                }
                $updated++;
            }

            if (!$dryRun) {
                DB::commit();
            }
        } catch (\Throwable $e) {
            if (!$dryRun) {
                DB::rollBack();
            }

            return [
                'ok' => false,
                'message' => $e->getMessage(),
                'dry_run' => $dryRun,
            ];
        }

        $report = (new TelemetryReconcileReporter())->build();
        $schema = $this->auditSchema();
        $warnings = [];
        if (!empty($schema['readings_fallback_warning'])) {
            $warnings[] = (string) $schema['readings_fallback_warning'];
        }

        return [
            'ok' => true,
            'dry_run' => $dryRun,
            'sensors_total' => $sensors->count(),
            'updated' => $updated,
            'unchanged' => $unchanged,
            'skipped_no_reading' => $skippedNoReading,
            'verbose_log' => $verbose ? $errors : [],
            'schema' => $schema,
            'warnings' => $warnings,
            'report' => $report,
        ];
    }

    private function latestReadingForSensor(object $sensor): ?object
    {
        $q = DB::table('readings')->orderByDesc('measured_at')->orderByDesc('id')->limit(1);

        if ($this->readingsScopeColumn === 'sensor_uid') {
            $q->where('sensor_uid', (string) $sensor->external_id);
        } else {
            $q->where('sensor_id', (int) $sensor->id);
        }

        return $q->first();
    }

    /**
     * Build sensor_latest patch from newest reading. Non-null reading values win;
     * existing sensor_latest values are kept when the reading field is empty.
     *
     * @return array<string, mixed>|null
     */
    private function mapReadingToSensorLatestRow(
        object $reading,
        int $sensorId,
        Carbon $now,
        ?object $existing = null
    ): ?array {
        $row = [
            'sensor_id' => $sensorId,
            'reading_id' => $reading->id ?? null,
            'measured_at' => $reading->measured_at ?? null,
            'updated_at' => $now,
        ];

        if (isset($this->latestColumns['created_at']) && $existing === null) {
            $row['created_at'] = $now;
        }

        $copyPairs = [
            'battery_pct',
            'co2_ppm',
            'temperature_c',
            'humidity_rh',
            'energy_kwh',
            'uv_index',
            'people_in',
            'people_out',
            'people_total_in',
            'people_total_out',
            'tvoc_index',
            'light_level',
            'lux',
        ];

        foreach ($copyPairs as $field) {
            if (!isset($this->latestColumns[$field])) {
                continue;
            }
            $row[$field] = $this->mergeScalar(
                property_exists($reading, $field) ? $reading->{$field} : null,
                $existing !== null && property_exists($existing, $field) ? $existing->{$field} : null
            );
        }

        $pm25Latest = TelemetryMetricColumns::sensorLatestPm25PhysicalColumn();
        $pm25Reading = TelemetryMetricColumns::readingsPm25PhysicalColumn();
        if ($pm25Latest !== null && $pm25Reading !== null && isset($this->latestColumns[$pm25Latest])) {
            $fromReading = property_exists($reading, $pm25Reading) ? $reading->{$pm25Reading} : null;
            $fromExisting = $existing !== null && property_exists($existing, $pm25Latest)
                ? $existing->{$pm25Latest}
                : null;
            $row[$pm25Latest] = $this->mergeScalar($fromReading, $fromExisting);
        }

        $pm10Latest = TelemetryMetricColumns::sensorLatestPm10PhysicalColumn();
        $pm10Reading = TelemetryMetricColumns::readingsPm10PhysicalColumn();
        if ($pm10Latest !== null && $pm10Reading !== null && isset($this->latestColumns[$pm10Latest])) {
            $fromReading = property_exists($reading, $pm10Reading) ? $reading->{$pm10Reading} : null;
            $fromExisting = $existing !== null && property_exists($existing, $pm10Latest)
                ? $existing->{$pm10Latest}
                : null;
            $row[$pm10Latest] = $this->mergeScalar($fromReading, $fromExisting);
        }

        return $row;
    }

    /** Prefer non-empty reading value; never replace a stored value with null. */
    private function mergeScalar(mixed $fromReading, mixed $fromExisting): mixed
    {
        if ($fromReading !== null && $fromReading !== '') {
            return $fromReading;
        }

        return $fromExisting;
    }

  /**
     * @param array<string, mixed> $target
     */
    private function rowsEquivalent(object $existing, array $target): bool
    {
        $compare = [
            'reading_id', 'measured_at', 'battery_pct', 'co2_ppm', 'temperature_c', 'humidity_rh',
            'energy_kwh', 'uv_index', 'people_in', 'people_out', 'people_total_in', 'people_total_out',
            'tvoc_index', 'light_level', 'lux',
        ];
        $pm25 = TelemetryMetricColumns::sensorLatestPm25PhysicalColumn();
        $pm10 = TelemetryMetricColumns::sensorLatestPm10PhysicalColumn();
        if ($pm25 !== null) {
            $compare[] = $pm25;
        }
        if ($pm10 !== null) {
            $compare[] = $pm10;
        }

        foreach ($compare as $key) {
            if (!property_exists($existing, $key) && !array_key_exists($key, $target)) {
                continue;
            }
            $a = property_exists($existing, $key) ? $existing->{$key} : null;
            $b = $target[$key] ?? null;
            if ($this->scalarEqual($a, $b)) {
                continue;
            }
            return false;
        }

        return true;
    }

    private function scalarEqual(mixed $a, mixed $b): bool
    {
        if ($a === null && $b === null) {
            return true;
        }
        if ($a === null || $b === null) {
            return false;
        }

        return (string) $a === (string) $b;
    }

    /** @return array<string, bool> */
    private function columnMap(string $table): array
    {
        $out = [];
        try {
            if (!Schema::hasTable($table)) {
                return $out;
            }
            foreach (Schema::getColumnListing($table) as $col) {
                $out[$col] = true;
            }
        } catch (\Throwable $e) {
        }

        return $out;
    }

    private function detectReadingsScopeColumn(): ?string
    {
        if (isset($this->readingsColumns['sensor_uid'])) {
            return 'sensor_uid';
        }
        if (isset($this->readingsColumns['sensor_id'])) {
            return 'sensor_id';
        }

        return null;
    }
}
