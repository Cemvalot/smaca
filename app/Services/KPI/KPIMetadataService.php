<?php

namespace App\Services\KPI;

use Illuminate\Support\Facades\Log;

/**
 * KPIMetadataService — locale-aware reader for `config/smaca_kpi_metadata.php`
 * and `config/smaca_chart_metadata.php`.
 *
 * Responsibilities:
 *   - resolve every bilingual ['en' => ..., 'el' => ...] string against the
 *     active locale
 *   - shape per-KPI / per-chart payloads into a plain associative array safe
 *     for JSON exposure on /api/config/kpis and /api/config/charts
 *   - never throw — defensive against missing config files
 */
class KPIMetadataService
{
    private string $locale;

    public function __construct(?string $locale = null)
    {
        $this->locale = $this->resolveLocale($locale);
    }

    private function resolveLocale(?string $locale): string
    {
        $loc = strtolower(trim((string) ($locale ?? '')));
        if ($loc === 'en' || $loc === 'el') return $loc;
        try {
            $appLoc = strtolower((string) app()->getLocale());
            if ($appLoc === 'en' || $appLoc === 'el') return $appLoc;
        } catch (\Throwable $e) { /* fallthrough */ }
        return 'en';
    }

    /** Pick the right side of an EN/EL string array, with sensible fallbacks. */
    private function localized($value, ?string $fallback = null): ?string
    {
        if ($value === null) return $fallback;
        if (is_string($value)) return $value;
        if (is_array($value)) {
            if (isset($value[$this->locale]) && is_string($value[$this->locale])) {
                return $value[$this->locale];
            }
            if (isset($value['en']) && is_string($value['en'])) return $value['en'];
            // For arrays-of-strings (e.g. sensors_used), the caller should use
            // localizedList() instead. Returning the fallback here is safe.
        }
        return $fallback;
    }

    /** Pick a list-of-strings against the active locale. */
    private function localizedList($value): array
    {
        if ($value === null) return [];
        if (is_array($value)) {
            if (isset($value[$this->locale]) && is_array($value[$this->locale])) {
                return array_values(array_filter($value[$this->locale], 'is_string'));
            }
            if (isset($value['en']) && is_array($value['en'])) {
                return array_values(array_filter($value['en'], 'is_string'));
            }
            // Plain array of strings? return as-is.
            $allStrings = array_filter($value, 'is_string');
            if (count($allStrings) === count($value)) return array_values($allStrings);
        }
        return [];
    }

    /** Read raw config arrays defensively. */
    private function rawKpiConfig(): array
    {
        try {
            $cfg = config('smaca_kpi_metadata');
            return is_array($cfg) ? $cfg : [];
        } catch (\Throwable $e) {
            $this->safeWarn('KPIMetadataService: kpi config unavailable', $e);
            return [];
        }
    }

    private function rawChartConfig(): array
    {
        try {
            $cfg = config('smaca_chart_metadata');
            return is_array($cfg) ? $cfg : [];
        } catch (\Throwable $e) {
            $this->safeWarn('KPIMetadataService: chart config unavailable', $e);
            return [];
        }
    }

    /** Public-safe metadata dictionary for ALL KPIs (locale-resolved). */
    public function getAllKpis(): array
    {
        $cfg = $this->rawKpiConfig();
        $kpis = (array) ($cfg['kpis'] ?? []);
        $out = [];
        foreach ($kpis as $key => $meta) {
            $out[$key] = $this->shapeKpi((string) $key, (array) $meta);
        }
        return [
            'version' => (string) ($cfg['version'] ?? '0.0.0'),
            'locale' => $this->locale,
            'source_types' => $this->shapeSourceTypes($cfg),
            'role_detail_level' => (array) ($cfg['role_detail_level'] ?? []),
            'kpis' => $out,
        ];
    }

    /** Per-KPI metadata, shaped for embedding inside a /api/kpis/summary item. */
    public function forKpi(string $key): ?array
    {
        $cfg = $this->rawKpiConfig();
        $meta = $cfg['kpis'][$key] ?? null;
        if (!is_array($meta)) return null;
        return $this->shapeKpi($key, $meta);
    }

    /** Public-safe chart metadata dictionary (locale-resolved). */
    public function getAllCharts(): array
    {
        $cfg = $this->rawChartConfig();
        $charts = (array) ($cfg['charts'] ?? []);
        $out = [];
        foreach ($charts as $id => $meta) {
            $out[$id] = $this->shapeChart((string) $id, (array) $meta);
        }
        return [
            'version' => (string) ($cfg['version'] ?? '0.0.0'),
            'locale' => $this->locale,
            'charts' => $out,
        ];
    }

    private function shapeKpi(string $key, array $meta): array
    {
        $statusMeanings = (array) ($meta['status_meanings'] ?? []);
        $shapedStatus = [];
        foreach (['good', 'warning', 'critical', 'insufficient_data'] as $s) {
            if (isset($statusMeanings[$s])) {
                $shapedStatus[$s] = $this->localized($statusMeanings[$s]);
            }
        }

        return [
            'key' => $key,
            'kpi_category' => (string) ($meta['kpi_category'] ?? 'Uncategorised'),
            'metadata_complete' => (bool) ($meta['metadata_complete'] ?? false),
            'role_visibility' => (string) ($meta['role_visibility'] ?? 'public'),
            'unit' => (string) ($meta['unit'] ?? ''),
            'unit_label' => $this->localized($meta['unit_label'] ?? null, (string) ($meta['unit'] ?? '')),
            'unit_explanation' => $this->localized($meta['unit_explanation'] ?? null),
            'plain_definition' => $this->localized($meta['plain_definition'] ?? null),
            'technical_definition' => $this->localized($meta['technical_definition'] ?? null),
            'sensors_used' => $this->localizedList($meta['sensors_used'] ?? []),
            'calculation_summary' => $this->localized($meta['calculation_summary'] ?? null),
            'source_type' => (string) ($meta['source_type'] ?? 'measured'),
            'limitations' => $this->localized($meta['limitations'] ?? null),
            'limitations_simple' => $this->localized(
                $meta['limitations_simple'] ?? ($meta['limitations'] ?? null)
            ),
            'status_meanings' => $shapedStatus,
        ];
    }

    private function shapeChart(string $id, array $meta): array
    {
        return [
            'id' => $id,
            'category' => (string) ($meta['category'] ?? 'General'),
            'title' => $this->localized($meta['title'] ?? null, $id),
            'what' => $this->localized($meta['what'] ?? null),
            'data_source' => $this->localized($meta['data_source'] ?? null),
            'how_to_read' => $this->localized($meta['how_to_read'] ?? null),
            'timeframe_note' => $this->localized($meta['timeframe_note'] ?? null),
            'actions' => $this->localized($meta['actions'] ?? null),
            'limitations' => $this->localized($meta['limitations'] ?? null),
        ];
    }

    private function shapeSourceTypes(array $cfg): array
    {
        $st = (array) ($cfg['source_types'] ?? []);
        $out = [];
        foreach ($st as $key => $value) {
            $out[(string) $key] = $this->localized($value);
        }
        return $out;
    }

    private function safeWarn(string $msg, \Throwable $e): void
    {
        try {
            Log::warning($msg, [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $ignored) {}
    }
}
