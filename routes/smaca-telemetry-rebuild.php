<?php

/**
 * FTP / Plesk-safe loader for telemetry reconcile classes.
 * Does not depend on `composer dump-autoload` after adding new namespaces.
 */

if (!function_exists('smacaTelemetryRebuildEnsureLoaded')) {
    function smacaTelemetryRebuildEnsureLoaded(): void
    {
        static $loaded = false;
        if ($loaded) {
            return;
        }

        $base = dirname(__DIR__);
        $paths = [
            $base.'/app/Support/TelemetryMetricColumns.php',
            $base.'/app/Support/TelemetryLatestNormalizer.php',
            $base.'/app/Services/Telemetry/SensorLatestRebuilder.php',
            $base.'/app/Services/Telemetry/TelemetryReconcileReporter.php',
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
                'Telemetry rebuild files missing on server. Upload: '.implode(', ', $missing)
            );
        }

        if (!class_exists(\App\Services\Telemetry\SensorLatestRebuilder::class, false)) {
            throw new \RuntimeException('SensorLatestRebuilder class not defined after require');
        }

        $loaded = true;
    }
}

if (!function_exists('smacaTelemetryRebuilder')) {
    function smacaTelemetryRebuilder(): \App\Services\Telemetry\SensorLatestRebuilder
    {
        smacaTelemetryRebuildEnsureLoaded();

        return new \App\Services\Telemetry\SensorLatestRebuilder();
    }
}

if (!function_exists('smacaTelemetryReconcileReporter')) {
    function smacaTelemetryReconcileReporter(): \App\Services\Telemetry\TelemetryReconcileReporter
    {
        smacaTelemetryRebuildEnsureLoaded();

        return new \App\Services\Telemetry\TelemetryReconcileReporter();
    }
}
