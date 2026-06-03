<?php

namespace App\Services\Alerts;

use App\Support\TelemetryMetricColumns;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AlertEvaluator
{
    private const SUPPORTED_OPERATORS = ['>', '>=', '<', '<=', '==', '!='];

    /**
     * @return array{checked: int, triggered: int, updated: int, resolved: int, skipped: int}
     */
    public function run(?Carbon $now = null): array
    {
        $now = $now ?? Carbon::now();
        $stats = [
            'checked' => 0,
            'triggered' => 0,
            'updated' => 0,
            'resolved' => 0,
            'skipped' => 0,
        ];

        $alerts = DB::table('alerts')
            ->where('is_enabled', 1)
            ->orderBy('id')
            ->get();

        foreach ($alerts as $alert) {
            $stats['checked']++;
            $this->evaluateAlert($alert, $now, $stats);
        }

        return $stats;
    }

    /**
     * @param array{checked: int, triggered: int, updated: int, resolved: int, skipped: int} $stats
     */
    private function evaluateAlert(object $alert, Carbon $now, array &$stats): void
    {
        $sensorId = (int) ($alert->sensor_id ?? 0);
        $alertId = (int) ($alert->id ?? 0);
        if ($sensorId <= 0 || $alertId <= 0) {
            $stats['skipped']++;

            return;
        }

        $operator = (string) ($alert->operator ?? '');
        if (!in_array($operator, self::SUPPORTED_OPERATORS, true)) {
            $stats['skipped']++;

            return;
        }

        $metricKey = (string) ($alert->metric_key ?? '');
        $column = $this->resolveSensorLatestColumn($metricKey);
        if ($column === null) {
            $stats['skipped']++;

            return;
        }

        $latest = DB::table('sensor_latest')
            ->where('sensor_id', $sensorId)
            ->first();

        if ($latest === null) {
            $stats['skipped']++;

            return;
        }

        $rawValue = $latest->{$column} ?? null;
        if ($rawValue === null || $rawValue === '') {
            $stats['skipped']++;

            return;
        }

        if (!is_numeric($rawValue) || !is_numeric($alert->threshold ?? null)) {
            $stats['skipped']++;

            return;
        }

        $value = (float) $rawValue;
        $threshold = (float) $alert->threshold;
        $violates = $this->violates($value, $operator, $threshold);

        $activeEvent = DB::table('alert_events')
            ->where('alert_id', $alertId)
            ->where('sensor_id', $sensorId)
            ->where('status', 'active')
            ->orderByDesc('id')
            ->first();

        if ($violates) {
            $this->upsertActiveEvent($alert, $latest, $value, $now, $activeEvent, $stats);

            return;
        }

        if ($activeEvent !== null) {
            DB::table('alert_events')
                ->where('id', (int) $activeEvent->id)
                ->update([
                    'status' => 'resolved',
                    'resolved_at' => $now,
                    'updated_at' => $now,
                ]);
            $stats['resolved']++;
        }
    }

    /**
     * @param array{checked: int, triggered: int, updated: int, resolved: int, skipped: int} $stats
     */
    private function upsertActiveEvent(
        object $alert,
        object $latest,
        float $value,
        Carbon $now,
        ?object $activeEvent,
        array &$stats
    ): void {
        $readingId = isset($latest->reading_id) && is_numeric($latest->reading_id)
            ? (int) $latest->reading_id
            : null;

        $payload = [
            'value' => $value,
            'reading_id' => $readingId,
            'details' => json_encode($this->buildDetails($alert, $latest, $value), JSON_THROW_ON_ERROR),
            'updated_at' => $now,
        ];

        if ($activeEvent !== null) {
            DB::table('alert_events')
                ->where('id', (int) $activeEvent->id)
                ->update($payload);
            $stats['updated']++;

            return;
        }

        DB::table('alert_events')->insert([
            'alert_id' => (int) $alert->id,
            'sensor_id' => (int) $alert->sensor_id,
            'reading_id' => $readingId,
            'triggered_at' => $now,
            'value' => $value,
            'status' => 'active',
            'details' => $payload['details'],
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $stats['triggered']++;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildDetails(object $alert, object $latest, float $value): array
    {
        return [
            'metric_key' => (string) ($alert->metric_key ?? ''),
            'operator' => (string) ($alert->operator ?? ''),
            'threshold' => is_numeric($alert->threshold ?? null) ? (float) $alert->threshold : null,
            'observed_value' => $value,
            'measured_at' => $latest->measured_at ?? null,
            'rule_name' => (string) ($alert->name ?? ''),
        ];
    }

    private function violates(float $value, string $operator, float $threshold): bool
    {
        return match ($operator) {
            '>' => $value > $threshold,
            '>=' => $value >= $threshold,
            '<' => $value < $threshold,
            '<=' => $value <= $threshold,
            '==' => $value == $threshold,
            '!=' => $value != $threshold,
            default => false,
        };
    }

    private function resolveSensorLatestColumn(string $metricKey): ?string
    {
        if ($metricKey === '') {
            return null;
        }

        if ($metricKey === 'pm2_5_ugm3') {
            $physical = TelemetryMetricColumns::sensorLatestPm25PhysicalColumn();

            return $physical ?? ($this->tableHasColumn('pm2_5_ugm3') ? 'pm2_5_ugm3' : null);
        }

        if ($metricKey === 'pm10_ugm3') {
            $physical = TelemetryMetricColumns::sensorLatestPm10PhysicalColumn();

            return $physical ?? ($this->tableHasColumn('pm10_ugm3') ? 'pm10_ugm3' : null);
        }

        return $this->tableHasColumn($metricKey) ? $metricKey : null;
    }

    private function tableHasColumn(string $column): bool
    {
        try {
            return Schema::hasColumn('sensor_latest', $column);
        } catch (\Throwable $e) {
            return false;
        }
    }
}
