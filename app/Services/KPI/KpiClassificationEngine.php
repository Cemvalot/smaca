<?php

namespace App\Services\KPI;

/**
 * Reusable classification outputs for KPI cards (numeric, boolean, categorical).
 *
 * All methods are side-effect free; thresholds come from callers or config.
 */
class KpiClassificationEngine
{
    public const SEVERITY_GOOD = 0;

    public const SEVERITY_MEDIUM = 1;

    public const SEVERITY_BAD = 2;

    /**
     * @return array{
     *   status: string,
     *   severity: int,
     *   label: string|null,
     *   explanation: string|null,
     *   recommendation: string|null,
     *   color_token: string|null,
     *   confidence: string|null
     * }
     */
    public function categoricalFromSeverity(
        int $severity,
        string $insufficientReason,
        ?callable $labelForSeverity,
        ?callable $explainForSeverity,
        ?callable $recommendForSeverity,
        ?string $confidence = null
    ): array {
        if ($severity < 0) {
            return $this->insufficient($insufficientReason, $confidence);
        }

        $status = match ($severity) {
            self::SEVERITY_GOOD => 'good',
            self::SEVERITY_MEDIUM => 'warning',
            default => 'critical',
        };

        return [
            'status' => $status,
            'severity' => $severity,
            'label' => $labelForSeverity ? $labelForSeverity($severity) : null,
            'explanation' => $explainForSeverity ? $explainForSeverity($severity) : null,
            'recommendation' => $recommendForSeverity ? $recommendForSeverity($severity) : null,
            'color_token' => $status === 'good' ? 'success' : ($status === 'warning' ? 'warning' : 'danger'),
            'confidence' => $confidence,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function booleanComfort(bool $isPositive, string $positiveLabel, string $negativeLabel, string $explanation, string $recommendation, ?string $confidence = null): array
    {
        return [
            'status' => $isPositive ? 'good' : 'critical',
            'severity' => $isPositive ? self::SEVERITY_GOOD : self::SEVERITY_BAD,
            'label' => $isPositive ? $positiveLabel : $negativeLabel,
            'explanation' => $explanation,
            'recommendation' => $recommendation,
            'color_token' => $isPositive ? 'success' : 'danger',
            'confidence' => $confidence,
        ];
    }

    /**
     * Worst severity wins. Unknown dimensions are skipped.
     *
     * @param list<int|null> $levels self::SEVERITY_* or null to skip
     */
    public function mergeWorst(array $levels): int
    {
        $worst = self::SEVERITY_GOOD;
        foreach ($levels as $l) {
            if ($l === null) {
                continue;
            }
            if ($l > $worst) {
                $worst = $l;
            }
        }

        return $worst;
    }

    /**
     * @return array<string, mixed>
     */
    private function insufficient(string $reason, ?string $confidence): array
    {
        return [
            'status' => 'insufficient_data',
            'severity' => -1,
            'label' => null,
            'explanation' => $reason,
            'recommendation' => null,
            'color_token' => 'muted',
            'confidence' => $confidence ?? 'none',
        ];
    }
}
