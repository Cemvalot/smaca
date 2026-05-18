<?php

namespace App\Services\KPI;

/**
 * WiFi link quality bands for RSSI, SNR, TX-CCQ and TX-rate (CONNECTIVITY-1).
 */
class ConnectivityQualityClassifier
{
    /** @var array<string, mixed> */
    private array $config;

    public function __construct(?array $config = null)
    {
        $this->config = $config ?? (array) config('smaca_connectivity_quality', []);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function classifyRssi(?float $value): ?array
    {
        return $this->classifyMetric('rssi', $value);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function classifySnr(?float $value): ?array
    {
        return $this->classifyMetric('snr', $value);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function classifyTxCcq(?float $value): ?array
    {
        return $this->classifyMetric('tx_ccq', $value);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function classifyTxRate(?float $value): ?array
    {
        return $this->classifyMetric('tx_rate', $value);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function classifyMetric(string $metricKey, ?float $value): ?array
    {
        if ($value === null || !is_finite($value)) {
            return null;
        }

        $metricCfg = (array) (($this->config['metrics'] ?? [])[$metricKey] ?? []);
        if ($metricCfg === []) {
            return null;
        }

        $bandKey = $this->resolveBandKey($value, (array) ($metricCfg['thresholds'] ?? []));
        if ($bandKey === null) {
            return null;
        }

        return $this->buildResult($metricKey, $value, $bandKey, $metricCfg);
    }

    /**
     * Worst band among provided metric values (weakest link).
     *
     * @param array<string, float|null> $metrics keys: rssi, snr, tx_ccq, tx_rate
     * @return array<string, mixed>
     */
    public function classifyOverall(array $metrics): array
    {
        $order = (array) ($this->config['metric_order'] ?? ['rssi', 'snr', 'tx_ccq', 'tx_rate']);
        $classifications = [];
        foreach ($order as $key) {
            $raw = $metrics[$key] ?? null;
            if ($raw === null) {
                continue;
            }
            $cls = $this->classifyMetric((string) $key, is_numeric($raw) ? (float) $raw : null);
            if ($cls !== null) {
                $classifications[(string) $key] = $cls;
            }
        }

        if ($classifications === []) {
            return [
                'overall_band' => null,
                'overall_label' => null,
                'overall_severity' => 'insufficient_data',
                'limiting_metric' => null,
                'limiting_metric_value' => null,
                'recommendation' => __('messages.connectivity_kpi.overall.insufficient_action'),
                'metrics' => [],
            ];
        }

        $worstRank = -1;
        $worstBand = null;
        $limitingKey = null;
        $limitingCls = null;

        foreach ($order as $key) {
            if (!isset($classifications[$key])) {
                continue;
            }
            $cls = $classifications[$key];
            $rank = (int) ($cls['band_rank'] ?? 0);
            if ($rank > $worstRank) {
                $worstRank = $rank;
                $worstBand = (string) ($cls['band_key'] ?? '');
                $limitingKey = (string) $key;
                $limitingCls = $cls;
            }
        }

        $bandKey = $worstBand ?? 'bad';
        $severity = (string) (($this->config['bands'][$bandKey]['severity'] ?? 'warning'));

        return [
            'overall_band' => $bandKey,
            'overall_label' => $this->bandLabel($bandKey),
            'overall_severity' => $severity,
            'limiting_metric' => $limitingKey !== null ? $this->metricDisplayName($limitingKey) : null,
            'limiting_metric_key' => $limitingKey,
            'limiting_metric_value' => $limitingCls['value'] ?? null,
            'limiting_metric_unit' => $limitingCls['unit'] ?? null,
            'recommendation' => $this->recommendationForBand($bandKey, $limitingKey),
            'metrics' => $classifications,
        ];
    }

    public function bandLabel(string $bandKey): string
    {
        return match ($bandKey) {
            'excellent' => __('messages.connectivity_quality.excellent'),
            'very_good' => __('messages.connectivity_quality.very_good'),
            'good_usable' => __('messages.connectivity_quality.good_usable'),
            'weak_unstable' => __('messages.connectivity_quality.weak_unstable'),
            'bad' => __('messages.connectivity_quality.bad'),
            default => $bandKey,
        };
    }

    public function metricDisplayName(string $metricKey): string
    {
        return match ($metricKey) {
            'rssi' => __('messages.connectivity_quality.signal_strength'),
            'snr' => __('messages.connectivity_quality.signal_to_noise'),
            'tx_ccq' => __('messages.connectivity_quality.client_connection_quality'),
            'tx_rate' => __('messages.connectivity_quality.transmission_rate'),
            default => $metricKey,
        };
    }

    /**
     * Pick numeric value from snapshot using canonical + alias keys.
     *
     * @param array<string, mixed>|object $row
     */
    public function pickMetricValue(array|object $row, string $metricKey): ?float
    {
        $metricCfg = (array) (($this->config['metrics'] ?? [])[$metricKey] ?? []);
        $keys = array_merge([$metricKey], (array) ($metricCfg['aliases'] ?? []));
        foreach ($keys as $k) {
            $v = is_array($row) ? ($row[$k] ?? null) : (property_exists($row, $k) ? $row->{$k} : null);
            if ($v === null || $v === '') {
                continue;
            }
            if (is_numeric($v) && is_finite((float) $v)) {
                return (float) $v;
            }
        }

        return null;
    }

    private function resolveBandKey(float $value, array $thresholds): ?string
    {
        foreach ($thresholds as $rule) {
            if (!is_array($rule)) {
                continue;
            }
            $band = (string) ($rule['band'] ?? '');
            $min = array_key_exists('min', $rule) ? (float) $rule['min'] : null;
            $max = array_key_exists('max', $rule) ? (float) $rule['max'] : null;

            $minOk = $min === null || $value >= $min;
            $maxOk = $max === null || $value <= $max;
            if ($minOk && $maxOk) {
                return $band !== '' ? $band : null;
            }
        }

        return 'bad';
    }

    /**
     * @param array<string, mixed> $metricCfg
     * @return array<string, mixed>
     */
    private function buildResult(string $metricKey, float $value, string $bandKey, array $metricCfg): array
    {
        $bands = (array) ($this->config['bands'] ?? []);
        $bandMeta = (array) ($bands[$bandKey] ?? []);
        $severity = (string) ($bandMeta['severity'] ?? 'warning');
        $rank = (int) ($bandMeta['rank'] ?? 99);
        $unit = (string) ($metricCfg['unit'] ?? '');

        return [
            'metric_key' => $metricKey,
            'value' => round($value, $metricKey === 'tx_rate' ? 1 : 0),
            'unit' => $unit,
            'band_key' => $bandKey,
            'band_rank' => $rank,
            'label' => $this->bandLabel($bandKey),
            'severity' => $severity,
            'explanation' => $this->metricExplanation($metricKey, $bandKey),
        ];
    }

    private function metricExplanation(string $metricKey, string $bandKey): string
    {
        $band = $this->bandLabel($bandKey);
        $metric = $this->metricDisplayName($metricKey);

        return __('messages.connectivity_kpi.metric_explanation', [
            'metric' => $metric,
            'band' => $band,
        ]);
    }

    private function recommendationForBand(string $bandKey, ?string $limitingKey): string
    {
        if ($bandKey === 'excellent' || $bandKey === 'very_good') {
            return __('messages.connectivity_kpi.overall.action_good');
        }
        if ($bandKey === 'good_usable') {
            return __('messages.connectivity_kpi.overall.action_usable');
        }
        if ($limitingKey === 'rssi') {
            return __('messages.connectivity_kpi.overall.action_weak_rssi');
        }
        if ($limitingKey === 'snr') {
            return __('messages.connectivity_kpi.overall.action_weak_snr');
        }
        if ($limitingKey === 'tx_ccq') {
            return __('messages.connectivity_kpi.overall.action_weak_ccq');
        }
        if ($limitingKey === 'tx_rate') {
            return __('messages.connectivity_kpi.overall.action_weak_rate');
        }

        return __('messages.connectivity_kpi.overall.action_bad');
    }
}
