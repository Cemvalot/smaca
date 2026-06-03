<?php

/**
 * FTP / Plesk-safe loader for SMACA alert evaluation and alert event APIs.
 */

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

if (!function_exists('smacaAlertsEnsureLoaded')) {
    function smacaAlertsEnsureLoaded(): void
    {
        static $loaded = false;
        if ($loaded) {
            return;
        }

        $base = dirname(__DIR__);
        $paths = [
            $base.'/app/Support/TelemetryMetricColumns.php',
            $base.'/app/Services/Alerts/AlertEvaluator.php',
        ];

        $missing = [];
        foreach ($paths as $path) {
            if (!is_file($path)) {
                $missing[] = str_replace($base.'/', '', $path);
                continue;
            }
            require_once $path;
        }

        if ($missing !== []) {
            throw new \RuntimeException(
                'Alert evaluator files missing on server. Upload: '.implode(', ', $missing)
            );
        }

        if (!class_exists(\App\Services\Alerts\AlertEvaluator::class, false)) {
            throw new \RuntimeException('AlertEvaluator class not defined after require');
        }

        $loaded = true;
    }
}

if (!function_exists('smacaAlertEvaluator')) {
    function smacaAlertEvaluator(): \App\Services\Alerts\AlertEvaluator
    {
        smacaAlertsEnsureLoaded();

        return new \App\Services\Alerts\AlertEvaluator();
    }
}

if (!function_exists('smacaAlertsEventsPayload')) {
    /**
     * @return array<int, array<string, mixed>>
     */
    function smacaAlertsEventsPayload(): array
    {
        $rows = DB::table('alert_events as ae')
            ->join('alerts as a', 'a.id', '=', 'ae.alert_id')
            ->select([
                'ae.id',
                'ae.alert_id',
                'ae.sensor_id',
                'ae.reading_id',
                'ae.value',
                'ae.status',
                'ae.triggered_at',
                'ae.resolved_at',
                'ae.created_at',
                'ae.updated_at',
                'a.name as alert_name',
                'a.metric_key',
                'a.threshold',
                'a.operator',
            ])
            ->orderByDesc('ae.triggered_at')
            ->orderByDesc('ae.id')
            ->limit(100)
            ->get();

        return $rows->map(static function ($row) {
            return [
                'id' => (int) $row->id,
                'alert_id' => (int) $row->alert_id,
                'alert_name' => $row->alert_name,
                'metric_key' => $row->metric_key,
                'threshold' => $row->threshold !== null ? (float) $row->threshold : null,
                'operator' => $row->operator,
                'sensor_id' => (int) $row->sensor_id,
                'reading_id' => $row->reading_id !== null ? (int) $row->reading_id : null,
                'value' => $row->value !== null ? (float) $row->value : null,
                'status' => $row->status,
                'triggered_at' => $row->triggered_at,
                'resolved_at' => $row->resolved_at,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ];
        })->all();
    }
}

if (!function_exists('smacaAlertsSummaryPayload')) {
    /**
     * @return array<string, int>
     */
    function smacaAlertsSummaryPayload(): array
    {
        $today = Carbon::today();

        return [
            'active_events' => (int) DB::table('alert_events')->where('status', 'active')->count(),
            'resolved_today' => (int) DB::table('alert_events')
                ->where('status', 'resolved')
                ->whereNotNull('resolved_at')
                ->whereDate('resolved_at', $today)
                ->count(),
            'enabled_rules' => (int) DB::table('alerts')->where('is_enabled', 1)->count(),
            'total_rules' => (int) DB::table('alerts')->count(),
        ];
    }
}
