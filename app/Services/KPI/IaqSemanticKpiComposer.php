<?php

namespace App\Services\KPI;

/**
 * IAQ-specific composite KPIs driven by {@see SensorSemanticRegistry}
 * semantics (TVOC mode, light mode, CO₂ bands, thermal rectangle).
 */
class IaqSemanticKpiComposer
{
    public function __construct(
        private SensorSemanticRegistry $registry,
        private KpiClassificationEngine $engine = new KpiClassificationEngine()
    ) {}

    public function tvocMode(): string
    {
        return $this->registry->tvocMode();
    }

    /**
     * TVOC contribution to the weighted IAQ health index (0–100 sub-score).
     */
    public function tvocHealthSubscore(?float $tvoc, string $tvocMode): ?float
    {
        if ($tvoc === null) {
            return null;
        }
        $cfg = $this->registry->tvocModeConfig($tvocMode);
        $curve = (array) ($cfg['health_index_curve'] ?? []);

        return $this->interpolateCurve($tvoc, $curve);
    }

    /**
     * @return array<string, mixed>
     */
    public function buildEnvironmentalSafetyIndex(array $inputs): array
    {
        $tvocMode = $this->registry->tvocMode();
        $pm25 = $inputs['avg_pm25_ugm3'] ?? null;
        $pm10 = $inputs['avg_pm10_ugm3'] ?? null;
        $tvoc = $inputs['avg_tvoc_index'] ?? null;

        $pmCfg = $this->registry->environmentalSafetyDefaults();
        $pm25H = (float) ($pmCfg['pm25']['healthy_max'] ?? 12.0);
        $pm25U = (float) ($pmCfg['pm25']['unhealthy_min'] ?? 35.4);
        $pm10H = (float) ($pmCfg['pm10']['healthy_max'] ?? 54.0);
        $pm10U = (float) ($pmCfg['pm10']['unhealthy_min'] ?? 154.0);

        $levels = [];

        if ($pm25 !== null) {
            $levels[] = $this->pmSeverityTriLevel((float) $pm25, $pm25H, $pm25U);
        }
        if ($pm10 !== null) {
            $levels[] = $this->pmSeverityTriLevel((float) $pm10, $pm10H, $pm10U);
        }

        if ($tvoc !== null) {
            if ($tvocMode === 'raw_tvoc_ugm3') {
                $tvCfg = $this->registry->tvocModeConfig('raw_tvoc_ugm3');
                $s = (array) ($tvCfg['safety'] ?? []);
                $h = (float) ($s['healthy_max'] ?? 250.0);
                $u = (float) ($s['unhealthy_min'] ?? 1000.0);
                $levels[] = $this->pmSeverityTriLevel((float) $tvoc, $h, $u);
            } else {
                $levels[] = $this->tvocIaqRatingSeverity((float) $tvoc);
            }
        }

        if (count($levels) === 0) {
        return $this->wrapKpi('environmental_safety_index', [
            'value' => null,
            'unit' => '',
            'status' => 'insufficient_data',
            'confidence' => 'none',
            'description' => __('messages.iaq_kpi.environmental_safety.insufficient'),
            'recommended_action' => __('messages.thresholds.insufficient_data_action'),
            'display_kind' => 'categorical',
            'semantic_mode' => $tvocMode,
        ], __('messages.iaq_explainer.environmental_safety'));
        }

        $worst = $this->engine->mergeWorst($levels);
        $expectedDims = ($tvoc !== null ? 1 : 0) + ($pm25 !== null ? 1 : 0) + ($pm10 !== null ? 1 : 0);
        $confidence = count($levels) < $expectedDims ? 'partial' : 'high';

        $cls = $this->engine->categoricalFromSeverity(
            $worst,
            '',
            fn (int $s) => match ($s) {
                KpiClassificationEngine::SEVERITY_GOOD => __('messages.iaq_kpi.environmental_safety.healthy'),
                KpiClassificationEngine::SEVERITY_MEDIUM => __('messages.iaq_kpi.environmental_safety.medium'),
                default => __('messages.iaq_kpi.environmental_safety.unhealthy'),
            },
            fn (int $s) => match ($s) {
                KpiClassificationEngine::SEVERITY_GOOD => __('messages.iaq_kpi.environmental_safety.explain_healthy'),
                KpiClassificationEngine::SEVERITY_MEDIUM => __('messages.iaq_kpi.environmental_safety.explain_medium'),
                default => __('messages.iaq_kpi.environmental_safety.explain_unhealthy'),
            },
            fn (int $s) => match ($s) {
                KpiClassificationEngine::SEVERITY_GOOD => __('messages.iaq_kpi.environmental_safety.action_healthy'),
                KpiClassificationEngine::SEVERITY_MEDIUM => __('messages.iaq_kpi.environmental_safety.action_medium'),
                default => __('messages.iaq_kpi.environmental_safety.action_unhealthy'),
            },
            $confidence
        );

        return $this->wrapKpi('environmental_safety_index', [
            'value' => $cls['label'],
            'unit' => '',
            'status' => $cls['status'],
            'confidence' => $cls['confidence'],
            'description' => $cls['explanation'] ?? '',
            'recommended_action' => $cls['recommendation'] ?? '',
            'display_kind' => 'categorical',
            'semantic_mode' => $tvocMode,
            'value_numeric' => $worst,
        ], __('messages.iaq_explainer.environmental_safety'));
    }

    /**
     * @return array<string, mixed>
     */
    public function buildThermalComfortBoolean(array $inputs): array
    {
        $t = $inputs['avg_temperature_c'] ?? null;
        $rh = $inputs['avg_humidity_rh'] ?? null;
        if ($t === null || $rh === null) {
            return $this->wrapKpi('iaq_thermal_comfort', [
                'value' => null,
                'unit' => '',
                'status' => 'insufficient_data',
                'confidence' => 'none',
                'description' => __('messages.iaq_kpi.thermal_comfort.insufficient'),
                'recommended_action' => __('messages.thresholds.insufficient_data_action'),
                'display_kind' => 'boolean',
            ], __('messages.iaq_explainer.thermal_comfort'));
        }

        $bands = $this->registry->thermalComfortBands();
        $tMin = (float) ($bands['temp_min_c'] ?? 20.0);
        $tMax = (float) ($bands['temp_max_c'] ?? 24.0);
        $rhMin = (float) ($bands['rh_min'] ?? 40.0);
        $rhMax = (float) ($bands['rh_max'] ?? 60.0);

        $okT = ((float) $t) >= $tMin && ((float) $t) <= $tMax;
        $okRh = ((float) $rh) >= $rhMin && ((float) $rh) <= $rhMax;
        $comfortable = $okT && $okRh;

        $cls = $this->engine->booleanComfort(
            $comfortable,
            __('messages.iaq_kpi.thermal_comfort.comfortable'),
            __('messages.iaq_kpi.thermal_comfort.uncomfortable'),
            __('messages.iaq_kpi.thermal_comfort.explanation', [
                'temp' => round((float) $t, 1),
                'rh' => round((float) $rh, 0),
                'tmin' => $tMin,
                'tmax' => $tMax,
                'rhmin' => $rhMin,
                'rhmax' => $rhMax,
            ]),
            $comfortable
                ? __('messages.iaq_kpi.thermal_comfort.action_ok')
                : __('messages.iaq_kpi.thermal_comfort.action_adjust'),
            'high'
        );

        return $this->wrapKpi('iaq_thermal_comfort', [
            'value' => $cls['label'],
            'unit' => '',
            'status' => $cls['status'],
            'confidence' => $cls['confidence'],
            'description' => $cls['explanation'] ?? '',
            'recommended_action' => $cls['recommendation'] ?? '',
            'display_kind' => 'boolean',
            'value_boolean' => $comfortable,
        ], __('messages.iaq_explainer.thermal_comfort'));
    }

    /**
     * @return array<string, mixed>
     */
    public function buildVentilationQuality(array $inputs): array
    {
        $co2 = $inputs['avg_co2_ppm'] ?? null;
        if ($co2 === null) {
            return $this->wrapKpi('ventilation_quality_index', [
                'value' => null,
                'unit' => 'ppm',
                'status' => 'insufficient_data',
                'confidence' => 'none',
                'description' => __('messages.iaq_kpi.ventilation.insufficient'),
                'recommended_action' => __('messages.thresholds.insufficient_data_action'),
                'display_kind' => 'categorical',
            ], __('messages.iaq_explainer.co2'));
        }

        $bands = $this->registry->co2VentilationBands();
        $v = (float) $co2;
        $status = 'good';
        $labelKey = 'iaq_co2_band.dangerous';
        foreach ($bands as $b) {
            $max = $b['max'] ?? null;
            if ($max === null) {
                $status = (string) ($b['status'] ?? 'critical');
                $labelKey = (string) ($b['label_key'] ?? $labelKey);
                break;
            }
            if ($v <= (float) $max) {
                $status = (string) ($b['status'] ?? 'good');
                $labelKey = (string) ($b['label_key'] ?? 'iaq_co2_band.good_ventilation');
                break;
            }
        }

        $label = __($labelKey);
        $mapStatus = static function (string $s): string {
            return match ($s) {
                'warning' => 'warning',
                'critical' => 'critical',
                default => 'good',
            };
        };
        $cardStatus = $mapStatus($status);

        return $this->wrapKpi('ventilation_quality_index', [
            'value' => $label,
            'unit' => '',
            'status' => $cardStatus,
            'confidence' => 'high',
            'description' => __('messages.iaq_kpi.ventilation.description', ['ppm' => (int) round($v)]),
            'recommended_action' => __('messages.iaq_kpi.ventilation.action_'.$cardStatus),
            'display_kind' => 'categorical',
            'value_numeric' => $v,
            'co2_ppm' => $v,
        ], __('messages.iaq_explainer.co2'));
    }

    /**
     * @return array<string, mixed>
     */
    public function buildVisualLightingCondition(array $inputs): array
    {
        $mode = $this->registry->lightMode();
        $lux = $inputs['avg_lux'] ?? null;
        $level = $inputs['avg_light_level'] ?? null;

        if ($mode === 'raw_lux' && $lux !== null) {
            return $this->lightingFromLux((float) $lux);
        }

        if ($mode === 'raw_lux' && $lux === null && $level !== null) {
            return $this->lightingFromNormalizedLevel((float) $level);
        }

        if ($level !== null) {
            return $this->lightingFromNormalizedLevel((float) $level);
        }

        if ($lux !== null) {
            return $this->lightingFromLux((float) $lux);
        }

        return $this->wrapKpi('visual_lighting_condition', [
            'value' => null,
            'unit' => '',
            'status' => 'insufficient_data',
            'confidence' => 'none',
            'description' => __('messages.iaq_kpi.lighting.insufficient'),
            'recommended_action' => __('messages.thresholds.insufficient_data_action'),
            'display_kind' => 'categorical',
            'semantic_mode' => $mode,
        ], __('messages.iaq_explainer.lighting_normalized'));
    }

    /**
     * @return array<string, mixed>
     */
    private function lightingFromNormalizedLevel(float $rawLevel): array
    {
        $mode = 'normalized_level_0_5';
        $lvl = (int) max(0, min(5, round($rawLevel)));
        $cfg = $this->registry->lightModeConfig($mode);
        $levels = (array) ($cfg['levels'] ?? []);
        $labelKey = 'iaq_lighting_level.minimal';
        foreach ($levels as $row) {
            if ((int) ($row['level'] ?? -1) === $lvl) {
                $labelKey = (string) ($row['label_key'] ?? $labelKey);
                break;
            }
        }
        $label = __($labelKey);
        $status = $lvl <= 1 ? 'warning' : ($lvl >= 4 ? 'warning' : 'good');

        return $this->wrapKpi('visual_lighting_condition', [
            'value' => $label,
            'unit' => '',
            'status' => $status,
            'confidence' => 'high',
            'description' => __('messages.iaq_kpi.lighting.description_level', ['level' => $lvl]),
            'recommended_action' => __('messages.iaq_kpi.lighting.action_'.$status),
            'display_kind' => 'categorical',
            'semantic_mode' => $mode,
            'value_numeric' => $lvl,
            'lighting_level' => $lvl,
        ], __('messages.iaq_explainer.lighting_normalized'));
    }

    /**
     * @return array<string, mixed>
     */
    private function lightingFromLux(float $lux): array
    {
        $mode = 'raw_lux';
        if ($lux < 50) {
            $labelKey = 'iaq_lighting_lux.very_low';
            $status = 'warning';
        } elseif ($lux < 200) {
            $labelKey = 'iaq_lighting_lux.low';
            $status = 'warning';
        } elseif ($lux < 500) {
            $labelKey = 'iaq_lighting_lux.moderate';
            $status = 'good';
        } elseif ($lux < 2000) {
            $labelKey = 'iaq_lighting_lux.bright';
            $status = 'good';
        } else {
            $labelKey = 'iaq_lighting_lux.very_bright';
            $status = 'warning';
        }

        return $this->wrapKpi('visual_lighting_condition', [
            'value' => __($labelKey),
            'unit' => 'lux',
            'status' => $status,
            'confidence' => 'high',
            'description' => __('messages.iaq_kpi.lighting.description_lux', ['lux' => (int) round($lux)]),
            'recommended_action' => __('messages.iaq_kpi.lighting.action_'.$status),
            'display_kind' => 'categorical',
            'semantic_mode' => $mode,
            'value_numeric' => round($lux, 1),
        ], __('messages.iaq_explainer.lighting_lux'));
    }

    /**
     * @param list<array{0:float,1:float}> $curve
     */
    private function interpolateCurve(float $x, array $curve): ?float
    {
        if ($curve === []) {
            return null;
        }
        usort($curve, static fn ($a, $b) => ($a[0] <=> $b[0]));
        if ($x <= $curve[0][0]) {
            return $curve[0][1];
        }
        $n = count($curve);
        for ($i = 1; $i < $n; $i++) {
            $x0 = $curve[$i - 1][0];
            $y0 = $curve[$i - 1][1];
            $x1 = $curve[$i][0];
            $y1 = $curve[$i][1];
            if ($x <= $x1) {
                if ($x1 <= $x0) {
                    return $y1;
                }
                $t = ($x - $x0) / ($x1 - $x0);

                return $y0 + $t * ($y1 - $y0);
            }
        }

        return $curve[$n - 1][1];
    }

    private function pmSeverityTriLevel(float $v, float $healthyMax, float $unhealthyMin): int
    {
        if ($v > $unhealthyMin) {
            return KpiClassificationEngine::SEVERITY_BAD;
        }
        if ($v <= $healthyMax) {
            return KpiClassificationEngine::SEVERITY_GOOD;
        }

        return KpiClassificationEngine::SEVERITY_MEDIUM;
    }

    private function tvocIaqRatingSeverity(float $rating): int
    {
        if ($rating <= 1.99) {
            return KpiClassificationEngine::SEVERITY_GOOD;
        }
        if ($rating <= 2.99) {
            return KpiClassificationEngine::SEVERITY_GOOD;
        }
        if ($rating <= 3.99) {
            return KpiClassificationEngine::SEVERITY_MEDIUM;
        }
        if ($rating <= 4.99) {
            return KpiClassificationEngine::SEVERITY_BAD;
        }

        return KpiClassificationEngine::SEVERITY_BAD;
    }

    /**
     * @param array<string, mixed> $base
     * @return array<string, mixed>
     */
    private function wrapKpi(string $key, array $base, ?string $semanticExplainer = null): array
    {
        $titles = [
            'environmental_safety_index' => ['label' => __('messages.labels.environmental_safety_index')],
            'iaq_thermal_comfort' => ['label' => __('messages.labels.iaq_thermal_comfort')],
            'ventilation_quality_index' => ['label' => __('messages.labels.ventilation_quality_index')],
            'visual_lighting_condition' => ['label' => __('messages.labels.visual_lighting_condition')],
        ];
        $meta = $titles[$key] ?? ['label' => $key];

        $row = array_merge([
            'key' => $key,
            'label' => $meta['label'],
        ], $base);
        if ($semanticExplainer !== null) {
            $row['semantic_explainer'] = $semanticExplainer;
        }

        return $row;
    }
}
