<?php

namespace App\Services\KPI;

/**
 * Connectivity module KPI cards + overview-ready quality index.
 */
class ConnectivitySemanticKpiComposer
{
    public function __construct(
        private ConnectivityQualityClassifier $classifier = new ConnectivityQualityClassifier()
    ) {}

    /**
     * @param array<string, mixed> $inputs from KPIInputAssembler
     * @return list<array<string, mixed>>
     */
    public function buildModuleKpis(array $inputs): array
    {
        $overall = $this->classifyOverallFromAverages($inputs);

        return [
            $this->buildOverallKpi($overall),
            $this->buildAverageMetricKpi('rssi', $inputs['avg_rssi_dbm'] ?? null),
            $this->buildAverageMetricKpi('snr', $inputs['avg_snr_db'] ?? null),
            $this->buildAverageMetricKpi('tx_ccq', $inputs['avg_tx_ccq_pct'] ?? null),
            $this->buildAverageMetricKpi('tx_rate', $inputs['avg_tx_rate_mbps'] ?? null),
        ];
    }

    /**
     * Overview-compatible payload (not wired to Overview page yet).
     *
     * @param array<string, mixed> $inputs
     * @param list<array<string, mixed>> $deviceRows
     * @return array<string, mixed>
     */
    public function buildConnectivityQualityIndex(array $inputs, array $deviceRows = []): array
    {
        $overall = $this->classifyOverallFromAverages($inputs);
        $reporting = (int) ($inputs['connectivity_reporting_devices'] ?? 0);
        $total = (int) ($inputs['connectivity_total_devices'] ?? 0);

        $worstDevice = null;
        $worstRank = -1;
        foreach ($deviceRows as $row) {
            $deviceOverall = $row['overall'] ?? null;
            if (!is_array($deviceOverall)) {
                continue;
            }
            $band = (string) ($deviceOverall['overall_band'] ?? '');
            $rank = $this->bandRank($band);
            if ($rank > $worstRank) {
                $worstRank = $rank;
                $worstDevice = [
                    'device_name' => $row['device_name'] ?? null,
                    'sensor_id' => $row['sensor_id'] ?? null,
                    'overall_band' => $band,
                    'overall_label' => $deviceOverall['overall_label'] ?? null,
                    'limiting_metric' => $deviceOverall['limiting_metric'] ?? null,
                ];
            }
        }

        return [
            'overall_band' => $overall['overall_band'] ?? null,
            'overall_label' => $overall['overall_label'] ?? null,
            'overall_severity' => $overall['overall_severity'] ?? 'insufficient_data',
            'reporting_devices' => $reporting,
            'total_devices' => $total,
            'worst_device' => $worstDevice,
            'limiting_metric' => $overall['limiting_metric'] ?? null,
        ];
    }

    /**
     * @param array<string, mixed> $inputs
     * @return array<string, mixed>
     */
    private function classifyOverallFromAverages(array $inputs): array
    {
        return $this->classifier->classifyOverall([
            'rssi' => $this->toFloat($inputs['avg_rssi_dbm'] ?? null),
            'snr' => $this->toFloat($inputs['avg_snr_db'] ?? null),
            'tx_ccq' => $this->toFloat($inputs['avg_tx_ccq_pct'] ?? null),
            'tx_rate' => $this->toFloat($inputs['avg_tx_rate_mbps'] ?? null),
        ]);
    }

    /**
     * @param array<string, mixed> $overall
     * @return array<string, mixed>
     */
    private function buildOverallKpi(array $overall): array
    {
        $band = $overall['overall_band'] ?? null;
        if ($band === null) {
            return [
                'key' => 'overall_connectivity_quality',
                'label' => __('messages.connectivity_kpi.overall.label'),
                'value' => null,
                'unit' => '',
                'display_kind' => 'categorical',
                'status' => 'insufficient_data',
                'confidence' => 'none',
                'description' => __('messages.connectivity_kpi.overall.insufficient'),
                'recommended_action' => __('messages.connectivity_kpi.overall.insufficient_action'),
                'semantic_explainer' => __('messages.connectivity_explainer.overall'),
            ];
        }

        $severity = (string) ($overall['overall_severity'] ?? 'warning');
        $status = match ($severity) {
            'good' => 'good',
            'normal' => 'normal',
            'warning' => 'warning',
            default => 'critical',
        };

        $limiting = $overall['limiting_metric'] ?? null;
        $caption = $limiting
            ? __('messages.connectivity_kpi.overall.limiting_caption', ['metric' => $limiting])
            : null;

        return [
            'key' => 'overall_connectivity_quality',
            'label' => __('messages.connectivity_kpi.overall.label'),
            'value' => $overall['overall_label'] ?? $this->classifier->bandLabel((string) $band),
            'unit' => '',
            'display_kind' => 'categorical',
            'status' => $status,
            'confidence' => 'high',
            'description' => $overall['recommendation'] ?? '',
            'recommended_action' => $overall['recommendation'] ?? '',
            'interpretation_label' => $caption,
            'semantic_explainer' => __('messages.connectivity_explainer.overall'),
            'overall_band' => $band,
            'limiting_metric' => $limiting,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildAverageMetricKpi(string $metricKey, mixed $rawValue): array
    {
        $labels = [
            'rssi' => __('messages.connectivity_kpi.avg_rssi.label'),
            'snr' => __('messages.connectivity_kpi.avg_snr.label'),
            'tx_ccq' => __('messages.connectivity_kpi.avg_tx_ccq.label'),
            'tx_rate' => __('messages.connectivity_kpi.avg_tx_rate.label'),
        ];
        $explainers = [
            'rssi' => __('messages.connectivity_explainer.rssi'),
            'snr' => __('messages.connectivity_explainer.snr'),
            'tx_ccq' => __('messages.connectivity_explainer.tx_ccq'),
            'tx_rate' => __('messages.connectivity_explainer.tx_rate'),
        ];

        $value = $this->toFloat($rawValue);
        $cls = match ($metricKey) {
            'rssi' => $this->classifier->classifyRssi($value),
            'snr' => $this->classifier->classifySnr($value),
            'tx_ccq' => $this->classifier->classifyTxCcq($value),
            'tx_rate' => $this->classifier->classifyTxRate($value),
            default => null,
        };

        if ($cls === null) {
            return [
                'key' => 'avg_'.$metricKey,
                'label' => $labels[$metricKey] ?? $metricKey,
                'value' => null,
                'unit' => '',
                'status' => 'insufficient_data',
                'confidence' => 'none',
                'description' => __('messages.connectivity_kpi.metric.insufficient'),
                'recommended_action' => __('messages.connectivity_kpi.overall.insufficient_action'),
                'semantic_explainer' => $explainers[$metricKey] ?? '',
            ];
        }

        $severity = (string) ($cls['severity'] ?? 'warning');
        $status = match ($severity) {
            'good' => 'good',
            'normal' => 'normal',
            'warning' => 'warning',
            default => 'critical',
        };

        return [
            'key' => 'avg_'.$metricKey,
            'label' => $labels[$metricKey] ?? $metricKey,
            'value' => $cls['value'],
            'unit' => $cls['unit'],
            'status' => $status,
            'confidence' => 'high',
            'description' => $cls['explanation'] ?? '',
            'recommended_action' => '',
            'interpretation_label' => $cls['label'] ?? '',
            'semantic_explainer' => $explainers[$metricKey] ?? '',
            'band_key' => $cls['band_key'] ?? null,
        ];
    }

    private function bandRank(string $bandKey): int
    {
        $bands = (array) config('smaca_connectivity_quality.bands', []);

        return (int) (($bands[$bandKey]['rank'] ?? 99));
    }

    private function toFloat(mixed $v): ?float
    {
        if ($v === null || $v === '') {
            return null;
        }
        if (!is_numeric($v)) {
            return null;
        }
        $f = (float) $v;

        return is_finite($f) ? $f : null;
    }
}
