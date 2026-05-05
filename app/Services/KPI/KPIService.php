<?php

namespace App\Services\KPI;

class KPIService
{
    private const DEFAULT_INSUFFICIENT_ACTION = 'Connect the required sensor stream to enable this KPI.';

    public function __construct(private KPIInputAssembler $inputAssembler)
    {
    }

    public function getSummary(?string $module = null): array
    {
        $inputs = $this->inputAssembler->assembleSummaryInputs();
        $moduleKey = $this->normalizeModule($module);
        $kpisByModule = $this->buildKpisByModule($inputs);

        return [
            'module' => $moduleKey,
            'kpis' => $kpisByModule[$moduleKey] ?? $kpisByModule['overview'],
        ];
    }

    private function buildKpisByModule(array $inputs): array
    {
        $normalizedEnergyIntensity = $this->calculateNormalizedEnergyIntensity($inputs);
        $baseLoadIndex = $this->calculateBaseLoadIndex($inputs);
        $thermalComfort = $this->calculateThermalComfortIndex($inputs);
        $visualComfort = $this->calculateVisualComfortKpi($inputs);
        $iaqHealth = $this->calculateIaqHealthIndex($inputs);
        $crowdDensity = $this->calculateCrowdDensityLevel($inputs);

        return [
            'overview' => [
                $iaqHealth,
                $crowdDensity,
                $normalizedEnergyIntensity,
                $baseLoadIndex,
                $thermalComfort,
                $visualComfort,
            ],
            'energy' => [
                $normalizedEnergyIntensity,
                $baseLoadIndex,
            ],
            'iaq' => [
                $iaqHealth,
            ],
            'occupancy' => [
                $crowdDensity,
            ],
            'environmental' => [
                $thermalComfort,
                $visualComfort,
            ],
        ];
    }

    private function calculateNormalizedEnergyIntensity(array $inputs): array
    {
        $energy = $inputs['avg_energy_kwh'] ?? null;
        $occupancy = $inputs['avg_people_present'] ?? null;
        if ($energy === null || $occupancy === null) {
            return $this->insufficientKpi(
                'normalized_energy_intensity',
                'Normalized Energy Intensity',
                'kWh/person',
                'Energy consumption normalized by current occupancy.'
            );
        }
        if ($occupancy <= 0) {
            return [
                'key' => 'normalized_energy_intensity',
                'label' => 'Normalized Energy Intensity',
                'value' => null,
                'unit' => 'kWh/person',
                'status' => 'insufficient_data',
                'confidence' => 'none',
                'description' => 'Occupancy is zero. Use Base Load Index to evaluate off-hours energy behavior.',
                'recommended_action' => 'Use Base Load Index for periods with zero occupancy.',
            ];
        }

        $value = round($energy / max(1.0, $occupancy), 2);
        $status = $value < 1.0 ? 'normal' : ($value < 2.0 ? 'warning' : 'critical');

        return [
            'key' => 'normalized_energy_intensity',
            'label' => 'Normalized Energy Intensity',
            'value' => $value,
            'unit' => 'kWh/person',
            'status' => $status,
            'confidence' => ($inputs['capacity_confidence'] ?? 'estimated') === 'measured' ? 'high' : 'estimated',
            'description' => 'Energy consumption normalized by current occupancy.',
            'recommended_action' => 'Review energy use if value remains high during low occupancy.',
        ];
    }

    private function calculateBaseLoadIndex(array $inputs): array
    {
        $base = $inputs['avg_base_load_energy'] ?? null;
        $offHours = $inputs['avg_off_hours_energy'] ?? null;
        $energy = $inputs['avg_energy_kwh'] ?? null;
        $occupancy = $inputs['avg_people_present'] ?? null;

        if ($base === null || $offHours === null || $base <= 0) {
            return $this->insufficientKpi(
                'base_load_index',
                'Base Load Index',
                'ratio',
                'Energy usage baseline during off-hours and low occupancy.'
            );
        }

        $value = round($offHours / $base, 3);
        if ($occupancy !== null && $energy !== null && $occupancy <= 0) {
            $value = round($energy / max($base, 0.0001), 3);
        }
        $status = $value < 0.6 ? 'normal' : ($value < 0.85 ? 'warning' : 'critical');

        return [
            'key' => 'base_load_index',
            'label' => 'Base Load Index',
            'value' => $value,
            'unit' => 'ratio',
            'status' => $status,
            'confidence' => 'estimated',
            'description' => 'Compares off-hours energy to overall baseline energy usage.',
            'recommended_action' => 'Investigate and reduce energy use during zero-occupancy periods.',
        ];
    }

    private function calculateThermalComfortIndex(array $inputs): array
    {
        $temperature = $inputs['avg_temperature_c'] ?? null;
        $humidity = $inputs['avg_humidity_rh'] ?? null;
        if ($temperature === null || $humidity === null) {
            return $this->insufficientKpi(
                'thermal_comfort_index',
                'Thermal Comfort Index',
                '%',
                'Comfort score based on indoor temperature and humidity bands.'
            );
        }

        $tempPenalty = abs($temperature - 22.0) * 10.0;
        $humidityPenalty = abs($humidity - 50.0) * 1.6;
        $value = max(0, min(100, (int) round(100 - $tempPenalty - $humidityPenalty)));
        $status = $value >= 80 ? 'normal' : ($value >= 55 ? 'warning' : 'critical');

        return [
            'key' => 'thermal_comfort_index',
            'label' => 'Thermal Comfort Index',
            'value' => $value,
            'unit' => '%',
            'status' => $status,
            'confidence' => 'high',
            'description' => 'Comfort score based on temperature target 20-24°C and humidity target 40-60%.',
            'recommended_action' => 'Adjust HVAC setpoints',
        ];
    }

    private function calculateVisualComfortKpi(array $inputs): array
    {
        $light = $inputs['avg_lux'] ?? $inputs['avg_light_level'] ?? null;
        $solar = $inputs['avg_solar_radiation'] ?? null;
        if ($light === null) {
            return $this->insufficientKpi(
                'visual_comfort_kpi',
                'Visual Comfort KPI',
                '%',
                'Indoor visual comfort based on available light levels.'
            );
        }

        $target = 400.0;
        $deviation = abs($light - $target);
        $value = max(0, min(100, (int) round(100 - ($deviation / $target) * 100)));
        $status = $value >= 75 ? 'normal' : ($value >= 50 ? 'warning' : 'critical');
        $confidence = $solar === null ? 'partial' : 'high';

        return [
            'key' => 'visual_comfort_kpi',
            'label' => 'Visual Comfort KPI',
            'value' => $value,
            'unit' => '%',
            'status' => $status,
            'confidence' => $confidence,
            'description' => 'Visual comfort score from indoor light levels.'.($solar === null ? ' Solar radiation is unavailable.' : ''),
            'recommended_action' => 'Rebalance artificial lighting if visual comfort remains low.',
        ];
    }

    private function calculateIaqHealthIndex(array $inputs): array
    {
        $co2 = $inputs['avg_co2_ppm'] ?? null;
        $tvoc = $inputs['avg_tvoc_index'] ?? null;
        $pm25 = $inputs['avg_pm25_ugm3'] ?? null;
        $pm10 = $inputs['avg_pm10_ugm3'] ?? null;
        $available = array_filter([$co2, $tvoc, $pm25, $pm10], static fn($v) => $v !== null);
        if (count($available) === 0) {
            return $this->insufficientKpi(
                'iaq_health_index',
                'IAQ Health Index',
                '%',
                'Indoor air quality health score using CO2, TVOC, PM2.5 and PM10.'
            );
        }
        $weights = [
            'co2' => 0.40,
            'tvoc' => 0.20,
            'pm25' => 0.25,
            'pm10' => 0.15,
        ];
        $subScores = [];
        if ($co2 !== null) {
            $subScores['co2'] = $this->scoreFromCurve($co2, [
                [400.0, 100.0],
                [600.0, 90.0],
                [800.0, 75.0],
                [1000.0, 60.0],
                [1500.0, 30.0],
                [2000.0, 10.0],
            ]);
        }
        if ($tvoc !== null) {
            $subScores['tvoc'] = $this->scoreFromCurve($tvoc, [
                [50.0, 100.0],
                [150.0, 85.0],
                [300.0, 70.0],
                [600.0, 40.0],
                [1000.0, 20.0],
            ]);
        }
        if ($pm25 !== null) {
            $subScores['pm25'] = $this->scoreFromCurve($pm25, [
                [0.0, 100.0],
                [5.0, 100.0],
                [10.0, 85.0],
                [20.0, 60.0],
                [35.0, 30.0],
                [55.0, 10.0],
            ]);
        }
        if ($pm10 !== null) {
            $subScores['pm10'] = $this->scoreFromCurve($pm10, [
                [0.0, 100.0],
                [20.0, 90.0],
                [40.0, 70.0],
                [70.0, 40.0],
                [120.0, 15.0],
            ]);
        }

        $effectiveWeight = 0.0;
        $weightedScore = 0.0;
        foreach ($subScores as $field => $subScore) {
            $effectiveWeight += $weights[$field];
            $weightedScore += $subScore * $weights[$field];
        }
        $value = $effectiveWeight > 0 ? (int) round($weightedScore / $effectiveWeight) : null;
        if ($value === null) {
            return $this->insufficientKpi(
                'iaq_health_index',
                'IAQ Health Index',
                '%',
                'Indoor air quality health score using CO2, TVOC, PM2.5 and PM10.'
            );
        }

        $allNearOptimal = $co2 !== null
            && $tvoc !== null
            && $pm25 !== null
            && $pm10 !== null
            && $co2 <= 450.0
            && $tvoc <= 80.0
            && $pm25 <= 5.0
            && $pm10 <= 10.0;

        // Avoid unrealistic perfect saturation unless all key metrics are truly near-ideal.
        if (!$allNearOptimal && $value >= 100) {
            $value = 99;
        }

        $status = $value >= 80 ? 'good' : ($value >= 55 ? 'warning' : 'critical');
        if ($co2 !== null && $co2 > 1500) {
            $status = 'critical';
        } elseif ($co2 !== null && $co2 > 1000 && $status !== 'critical') {
            $status = 'warning';
        }
        $confidence = count($subScores) < 4 ? 'partial' : 'high';

        return [
            'key' => 'iaq_health_index',
            'label' => 'IAQ Health Index',
            'value' => $value,
            'unit' => '%',
            'status' => $status,
            'confidence' => $confidence,
            'description' => 'Indoor air quality score combining CO2, TVOC, PM2.5 and PM10 metrics.',
            'recommended_action' => 'Increase ventilation and inspect pollutant sources when index degrades.',
        ];
    }

    private function calculateCrowdDensityLevel(array $inputs): array
    {
        $people = $inputs['avg_people_present'] ?? null;
        $capacity = $inputs['max_capacity'] ?? null;
        if ($people === null || $capacity === null || $capacity <= 0) {
            return $this->insufficientKpi(
                'crowd_density_level',
                'Crowd Density Level',
                'ratio',
                'Current occupancy relative to room or inferred capacity.'
            );
        }

        $value = round($people / $capacity, 3);
        $status = $value < 0.35 ? 'low' : ($value < 0.8 ? 'normal' : 'crowded');

        return [
            'key' => 'crowd_density_level',
            'label' => 'Crowd Density Level',
            'value' => $value,
            'unit' => 'ratio',
            'status' => $status,
            'confidence' => $inputs['capacity_confidence'] ?? 'estimated',
            'description' => 'Estimated occupancy density compared against room capacity.',
            'recommended_action' => 'Redistribute occupancy if dense periods persist.',
        ];
    }

    private function insufficientKpi(string $key, string $label, string $unit, string $description): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'value' => null,
            'unit' => $unit,
            'status' => 'insufficient_data',
            'confidence' => 'none',
            'description' => $description,
            'recommended_action' => self::DEFAULT_INSUFFICIENT_ACTION,
        ];
    }

    private function normalizeModule(?string $module): string
    {
        $resolved = strtolower(trim((string) ($module ?? 'overview')));
        $allowed = ['overview', 'energy', 'iaq', 'occupancy', 'environmental'];
        return in_array($resolved, $allowed, true) ? $resolved : 'overview';
    }

    private function clampToPercent(float $value): float
    {
        return max(0.0, min(100.0, $value));
    }

    private function scoreFromCurve(float $inputValue, array $points): float
    {
        usort($points, static fn(array $a, array $b) => $a[0] <=> $b[0]);
        $count = count($points);
        if ($count === 0) {
            return 0.0;
        }

        if ($inputValue <= $points[0][0]) {
            return $this->clampToPercent((float) $points[0][1]);
        }
        if ($inputValue >= $points[$count - 1][0]) {
            return $this->clampToPercent((float) $points[$count - 1][1]);
        }

        for ($i = 1; $i < $count; $i++) {
            $leftX = (float) $points[$i - 1][0];
            $leftY = (float) $points[$i - 1][1];
            $rightX = (float) $points[$i][0];
            $rightY = (float) $points[$i][1];
            if ($inputValue <= $rightX) {
                if ($rightX === $leftX) {
                    return $this->clampToPercent($rightY);
                }

                $ratio = ($inputValue - $leftX) / ($rightX - $leftX);
                return $this->clampToPercent($leftY + (($rightY - $leftY) * $ratio));
            }
        }

        return $this->clampToPercent((float) $points[$count - 1][1]);
    }
}
