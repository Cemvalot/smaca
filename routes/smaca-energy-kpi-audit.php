<?php

/**
 * FTP / Plesk-safe loader for Energy KPI alignment audit.
 * Does not depend on `composer dump-autoload` after adding new classes.
 */

if (!function_exists('smacaEnergyKpiAuditEnsureLoaded')) {
    function smacaEnergyKpiAuditEnsureLoaded(): void
    {
        static $loaded = false;
        if ($loaded) {
            return;
        }

        $base = dirname(__DIR__);
        $paths = [
            $base.'/app/Support/TelemetryMetricColumns.php',
            $base.'/app/Services/KPI/KPIInputAssembler.php',
            $base.'/app/Services/KPI/EnergyKpiAuditReporter.php',
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
                'Energy KPI audit files missing on server. Upload: '.implode(', ', $missing)
            );
        }

        if (!class_exists(\App\Services\KPI\EnergyKpiAuditReporter::class, false)) {
            throw new \RuntimeException('EnergyKpiAuditReporter class not defined after require');
        }

        $loaded = true;
    }
}

if (!function_exists('smacaEnergyKpiAuditReporter')) {
    function smacaEnergyKpiAuditReporter(): \App\Services\KPI\EnergyKpiAuditReporter
    {
        smacaEnergyKpiAuditEnsureLoaded();

        return new \App\Services\KPI\EnergyKpiAuditReporter(new \App\Services\KPI\KPIInputAssembler());
    }
}

if (!function_exists('smacaEnergyKpiAuditDeployDiagnostics')) {
    /**
     * @return array<string, mixed>
     */
    function smacaEnergyKpiAuditDeployDiagnostics(): array
    {
        $base = dirname(__DIR__);
        $paths = [
            'TelemetryMetricColumns' => $base.'/app/Support/TelemetryMetricColumns.php',
            'KPIInputAssembler' => $base.'/app/Services/KPI/KPIInputAssembler.php',
            'EnergyKpiAuditReporter' => $base.'/app/Services/KPI/EnergyKpiAuditReporter.php',
            'loader' => $base.'/routes/smaca-energy-kpi-audit.php',
        ];
        $files = [];
        foreach ($paths as $key => $path) {
            $files[$key] = [
                'path' => str_replace($base.'/', '', $path),
                'exists' => is_file($path),
                'readable' => is_readable($path),
            ];
        }

        $classOk = false;
        try {
            smacaEnergyKpiAuditEnsureLoaded();
            $classOk = class_exists(\App\Services\KPI\EnergyKpiAuditReporter::class, false);
        } catch (\Throwable $e) {
            return [
                'files' => $files,
                'class_loadable' => false,
                'error' => $e->getMessage(),
            ];
        }

        return [
            'files' => $files,
            'class_loadable' => $classOk,
            'error' => null,
        ];
    }
}
