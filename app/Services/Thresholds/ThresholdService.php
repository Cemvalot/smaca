<?php

namespace App\Services\Thresholds;

class ThresholdService
{
    public function all(): array
    {
        return (array) config('smaca_thresholds', []);
    }

    public function get(string $metricKey): ?array
    {
        $all = $this->all();
        return isset($all[$metricKey]) && is_array($all[$metricKey]) ? $all[$metricKey] : null;
    }

    public function getPublicThresholds(): array
    {
        return $this->all();
    }

    public function evaluate(string $metricKey, $value): array
    {
        if ($value === null || $value === '' || !is_numeric($value)) {
            return [
                'status' => 'insufficient_data',
                'explanation' => __('messages.thresholds.insufficient_data_explanation'),
                'recommended_action' => __('messages.thresholds.insufficient_data_action'),
            ];
        }

        $numericValue = (float) $value;
        $threshold = $this->get($metricKey);
        if (!$threshold) {
            return [
                'status' => 'normal',
                'explanation' => __('messages.thresholds.default_explanation'),
                'recommended_action' => __('messages.thresholds.default_action'),
            ];
        }

        $status = $this->resolveStatus($numericValue, $threshold);

        return [
            'status' => $status,
            'explanation' => __('messages.thresholds.'.$metricKey.'.'.$status.'.explanation'),
            'recommended_action' => __('messages.thresholds.'.$metricKey.'.'.$status.'.action'),
        ];
    }

    private function resolveStatus(float $value, array $threshold): string
    {
        $goodMin = $this->toFloat($threshold['good_min'] ?? null);
        $goodMax = $this->toFloat($threshold['good_max'] ?? null);
        $warningMin = $this->toFloat($threshold['warning_min'] ?? null);
        $warningMax = $this->toFloat($threshold['warning_max'] ?? null);
        $criticalMin = $this->toFloat($threshold['critical_min'] ?? null);
        $criticalMax = $this->toFloat($threshold['critical_max'] ?? null);

        if ($goodMin !== null && $goodMax !== null && $value >= $goodMin && $value <= $goodMax) {
            return 'good';
        }
        if ($warningMin !== null && $warningMax !== null && $value >= $warningMin && $value <= $warningMax) {
            return 'warning';
        }
        if ($criticalMin !== null && $value >= $criticalMin) {
            return 'critical';
        }
        if ($criticalMax !== null && $value <= $criticalMax) {
            return 'critical';
        }

        if ($goodMax !== null && $value <= $goodMax) {
            return 'good';
        }
        if ($warningMax !== null && $value <= $warningMax) {
            return 'warning';
        }
        if ($goodMin !== null && $value >= $goodMin) {
            return 'good';
        }
        if ($warningMin !== null && $value >= $warningMin) {
            return 'warning';
        }

        return 'critical';
    }

    private function toFloat($value): ?float
    {
        if ($value === null || $value === '' || !is_numeric($value)) {
            return null;
        }
        return (float) $value;
    }
}
