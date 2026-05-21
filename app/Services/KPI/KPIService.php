<?php

namespace App\Services\KPI;

use App\Services\Occupancy\OccupancyMetricsService;
use App\Services\Spatial\SpatialService;
use App\Services\Thresholds\ThresholdService;

class KPIService
{
    private const DEFAULT_INSUFFICIENT_ACTION = 'Connect the required sensor stream to enable this KPI.';

    private SpatialService $spatialService;
    private ?KPIMetadataService $metadataService;
    private ?OccupancyMetricsService $occupancyMetricsService = null;
    private ?IaqSemanticKpiComposer $iaqSemanticComposer = null;
    private ?ConnectivitySemanticKpiComposer $connectivitySemanticComposer = null;

    public function __construct(
        private KPIInputAssembler $inputAssembler,
        private ?ThresholdService $thresholdService = null,
        ?SpatialService $spatialService = null,
        ?KPIMetadataService $metadataService = null
    )
    {
        $this->thresholdService = $this->thresholdService ?? new ThresholdService();
        $this->spatialService = $spatialService ?? new SpatialService();
        // Lazily lazy-init: only create when actually used, so unit tests that
        // bypass the framework still work.
        $this->metadataService = $metadataService;
    }

    private function metadata(): KPIMetadataService
    {
        if ($this->metadataService === null) {
            try {
                $this->metadataService = new KPIMetadataService();
            } catch (\Throwable $e) {
                $this->metadataService = new KPIMetadataService('en');
            }
        }
        return $this->metadataService;
    }

    private function occupancyMetrics(): OccupancyMetricsService
    {
        if ($this->occupancyMetricsService === null) {
            $this->occupancyMetricsService = new OccupancyMetricsService($this->spatialService);
        }

        return $this->occupancyMetricsService;
    }

    private function iaqSemanticComposer(): IaqSemanticKpiComposer
    {
        if ($this->iaqSemanticComposer === null) {
            $this->iaqSemanticComposer = new IaqSemanticKpiComposer(new SensorSemanticRegistry());
        }

        return $this->iaqSemanticComposer;
    }

    private function connectivitySemanticComposer(): ConnectivitySemanticKpiComposer
    {
        if ($this->connectivitySemanticComposer === null) {
            $this->connectivitySemanticComposer = new ConnectivitySemanticKpiComposer();
        }

        return $this->connectivitySemanticComposer;
    }

    /**
     * Build the KPI summary for a module, optionally scoped to a spatial code
     * such as "F0", "AUD" or "B1-2". The response always includes `module`,
     * `location`, `location_label` and `kpis`. Pre-existing callers that do
     * not pass a location keep the original behaviour.
     */
    public function getSummary(?string $module = null, ?string $location = null, ?string $timeframe = null): array
    {
        $moduleKey = $this->normalizeModule($module);
        $normalizedLocation = $this->spatialService->normalizeLocation($location);
        $resolvedTimeframe = KPIInputAssembler::resolveTimeframe($timeframe);

        // Module-aware sensor scope. If the picked location does not support
        // the active module, both lookups return [] and the assembler renders
        // every KPI as insufficient_data — never a 500.
        $sensorIds = $this->spatialService->resolveSensorIds($normalizedLocation, $moduleKey);
        $sensorUids = $this->spatialService->resolveSensorUids($normalizedLocation, $moduleKey);

        $context = ['timeframe' => $resolvedTimeframe];
        if ($sensorIds !== null) {
            $context['sensor_ids'] = $sensorIds;
        }
        if ($sensorUids !== null) {
            $context['sensor_uids'] = $sensorUids;
        }

        try {
            $inputs = $this->inputAssembler->assembleSummaryInputs($context);
        } catch (\Throwable $e) {
            // Last-line defence: never propagate to the route layer.
            try {
                \Illuminate\Support\Facades\Log::warning('KPIService: assembler threw, falling back to empty inputs', [
                    'exception' => get_class($e),
                    'message' => $e->getMessage(),
                    'module' => $moduleKey,
                    'location' => $normalizedLocation,
                ]);
            } catch (\Throwable $ignored) {}
            $inputs = [
                'avg_co2_ppm' => null, 'avg_tvoc_index' => null, 'avg_pm25_ugm3' => null, 'avg_pm10_ugm3' => null,
                'avg_temperature_c' => null, 'avg_humidity_rh' => null, 'avg_energy_kwh' => null,
                'tvoc' => null, 'pm25' => null, 'pm10' => null, 'temperature' => null, 'humidity' => null, 'lighting' => null,
                'avg_current_a' => null, 'avg_power_factor' => null, 'avg_max_demand_kw' => null,
                'avg_light_level' => null, 'avg_lux' => null, 'avg_solar_radiation' => null,
                'avg_people_present' => 0.0, 'max_capacity' => 50.0, 'capacity_confidence' => 'estimated',
                'avg_base_load_energy' => null, 'avg_off_hours_energy' => null,
                'active_sensor_count' => 0, 'has_scope' => true, 'timeframe' => $resolvedTimeframe,
            ];
        }
        $locationMeta = $normalizedLocation !== null
            ? $this->spatialService->getLocationMeta($normalizedLocation)
            : null;
        $isPassageScope = is_array($locationMeta) && (($locationMeta['type'] ?? null) === 'passage');

        $kpisByModule = $this->buildKpisByModule($inputs, $isPassageScope);

        $kpis = $kpisByModule[$moduleKey] ?? $kpisByModule['overview'];

        // Clarity layer: enrich each KPI item with locale-resolved
        // metadata (plain_definition, unit_explanation, calculation_summary,
        // limitations, source_type, kpi_category, sensors_used and
        // status-meaning for the current status). This is purely additive —
        // existing keys (key, value, unit, status, description, recommended
        // action, confidence) are preserved.
        $kpis = $this->enrichKpisWithMetadata($kpis);

        $response = [
            'module' => $moduleKey,
            'location' => $normalizedLocation,
            'location_label' => $locationMeta['label'] ?? null,
            'timeframe' => $resolvedTimeframe,
            'kpis' => $kpis,
        ];

        if ($moduleKey === 'iaq') {
            try {
                $reg = new SensorSemanticRegistry();
                $response['semantic_context'] = [
                    'registry_version' => (string) (config('smaca_sensor_semantics.version') ?? ''),
                    'tvoc_semantic_mode' => $reg->tvocMode(),
                    'light_semantic_mode' => $reg->lightMode(),
                ];
            } catch (\Throwable $e) {
                $response['semantic_context'] = [];
            }
        }

        if ($moduleKey === 'occupancy') {
            try {
                $response['occupancy_metrics'] = $this->occupancyMetrics()->build($sensorIds, $sensorUids);
            } catch (\Throwable $e) {
                try {
                    \Illuminate\Support\Facades\Log::warning('KPIService: occupancy metrics failed, returning empty payload', [
                        'exception' => get_class($e),
                        'message' => $e->getMessage(),
                        'module' => $moduleKey,
                        'location' => $normalizedLocation,
                    ]);
                } catch (\Throwable $ignored) {}
                $response['occupancy_metrics'] = $this->occupancyMetrics()->emptyPayload(
                    $this->occupancyMetrics()->dailyWindow()
                );
            }
        }

        if ($moduleKey === 'connectivity') {
            try {
                $response['connectivity_quality_index'] = $this->connectivitySemanticComposer()
                    ->buildConnectivityQualityIndex($inputs);
            } catch (\Throwable $e) {
                $response['connectivity_quality_index'] = [
                    'overall_band' => null,
                    'overall_severity' => 'insufficient_data',
                    'reporting_devices' => 0,
                    'total_devices' => (int) ($inputs['active_sensor_count'] ?? 0),
                    'worst_device' => null,
                ];
            }
        }

        return $response;
    }

    /**
     * Attach locale-resolved metadata fields to every KPI item without
     * touching pre-existing keys. If metadata is unavailable for a KPI key
     * (e.g. an experimental KPI), the item is returned unchanged.
     */
    private function enrichKpisWithMetadata(array $kpis): array
    {
        try {
            $service = $this->metadata();
        } catch (\Throwable $e) {
            return $kpis;
        }

        return array_map(function (array $kpi) use ($service): array {
            $key = (string) ($kpi['key'] ?? '');
            if ($key === '') return $kpi;

            $meta = $service->forKpi($key);
            if (!is_array($meta)) return $kpi;

            $statusKey = strtolower((string) ($kpi['status'] ?? ''));
            // Map renderer-side aliases back to canonical status meanings.
            $aliasMap = [
                'normal' => 'good',
                'low' => 'good',
                'medium' => 'warning',
                'elevated' => 'warning',
                'high' => 'critical',
                'crowded' => 'critical',
            ];
            $canonical = $aliasMap[$statusKey] ?? $statusKey;
            $statusMeaning = $meta['status_meanings'][$canonical] ?? null;

            // Additive merge — never overwrite caller-provided fields.
            return array_merge($kpi, [
                'kpi_category' => $meta['kpi_category'] ?? null,
                'metadata_complete' => $meta['metadata_complete'] ?? false,
                'source_type' => $meta['source_type'] ?? 'measured',
                'plain_definition' => $meta['plain_definition'] ?? null,
                'technical_definition' => $meta['technical_definition'] ?? null,
                'unit_label' => $meta['unit_label'] ?? ($kpi['unit'] ?? null),
                'unit_explanation' => $meta['unit_explanation'] ?? null,
                'calculation_summary' => $meta['calculation_summary'] ?? null,
                'sensors_used' => $meta['sensors_used'] ?? [],
                'limitations' => $meta['limitations'] ?? null,
                'limitations_simple' => $meta['limitations_simple'] ?? null,
                'status_meaning' => $statusMeaning,
            ]);
        }, $kpis);
    }

    private function buildKpisByModule(array $inputs, bool $isPassageScope = false): array
    {
        $normalizedEnergyIntensity = $this->calculateNormalizedEnergyIntensity($inputs);
        $baseLoadIndex = $this->calculateBaseLoadIndex($inputs);
        $thermalComfort = $this->calculateThermalComfortIndex($inputs);
        $visualComfort = $this->calculateVisualComfortKpi($inputs);
        $crowdDensity = $this->calculateCrowdDensityLevel($inputs);
        $movementActivity = $this->calculateMovementActivityIndex($inputs);
        $uvExposure = $this->calculateUvExposureRisk($inputs);

        // Occupancy module: a passage-scoped query has no aggregate density
        // semantics — only movement events matter. For floor / area scopes we
        // continue to surface "Crowd Density Level" (re-defined as movement
        // pressure events/hour, see KPIService::calculateCrowdDensityLevel).
        $occupancyKpis = $isPassageScope
            ? [$movementActivity]
            : [$crowdDensity];

        return [
            'overview' => [
                $crowdDensity,
                $normalizedEnergyIntensity,
                $thermalComfort,
            ],
            'energy' => [
                $normalizedEnergyIntensity,
                $baseLoadIndex,
            ],
            'iaq' => [
                $this->iaqSemanticComposer()->buildEnvironmentalSafetyIndex($inputs),
                $this->iaqSemanticComposer()->buildThermalComfortBoolean($inputs),
                $this->iaqSemanticComposer()->buildVentilationQuality($inputs),
                $this->iaqSemanticComposer()->buildVisualLightingCondition($inputs),
            ],
            'occupancy' => $occupancyKpis,
            'environmental' => [
                // Outdoor / VS350-class sensors at GH expose UV / solar — not
                // indoor temp/humidity/lux. Indoor comfort KPIs would render
                // permanently as `insufficient_data` here, so they have been
                // removed from the environmental module.
                $uvExposure,
            ],
            'connectivity' => $this->connectivitySemanticComposer()->buildModuleKpis($inputs),
        ];
    }

    private function calculateNormalizedEnergyIntensity(array $inputs): array
    {
        $label = 'Normalized Energy Intensity';
        $energyKwh = $inputs['total_energy_kwh_window']
            ?? $inputs['energy_consumption_kwh_window']
            ?? null;
        $rawPresence = $inputs['raw_estimated_presence'] ?? null;
        $cappedPresence = $inputs['capped_estimated_presence']
            ?? $inputs['estimated_presence']
            ?? $inputs['avg_people_present']
            ?? null;
        $denominatorCapped = (bool) ($inputs['denominator_capped'] ?? false);
        $capValue = (float) ($inputs['denominator_cap_value'] ?? KPIInputAssembler::ESTIMATED_PRESENCE_CAP);
        $occConfidence = (string) ($inputs['occupancy_context_confidence'] ?? 'none');
        $contextNote = __('messages.dashboard_i18n.kpi_note_occupancy_estimate');

        if ($energyKwh === null) {
            return $this->insufficientKpi(
                'normalized_energy_intensity',
                $label,
                'kWh/person',
                'Energy consumption data is missing for the selected timeframe.'
            );
        }
        if ($cappedPresence === null || $cappedPresence <= 0 || $occConfidence === 'none') {
            return array_merge($this->insufficientKpi(
                'normalized_energy_intensity',
                $label,
                'kWh/person',
                'Limited occupancy context — movement-derived presence is unavailable. Use Base Load Index for off-hours behavior.'
            ), [
                'energy_kwh' => round((float) $energyKwh, 2),
                'raw_estimated_presence' => $rawPresence,
                'capped_estimated_presence' => null,
                'estimated_presence' => null,
                'intensity_kwh_per_estimated_person' => null,
                'denominator_capped' => false,
                'occupancy_context_confidence' => $occConfidence,
                'semantic_explainer' => $contextNote,
            ]);
        }

        $denominator = max(1.0, (float) $cappedPresence);
        $value = round((float) $energyKwh / $denominator, 2);
        $limitedProxy = $denominatorCapped || in_array($occConfidence, ['entries_only', 'exits_only'], true);
        $interp = $this->interpretNei($value, $limitedProxy);
        $confidence = $limitedProxy ? 'estimated_limited' : match ($occConfidence) {
            'balanced_movement' => 'estimated',
            'entries_only', 'exits_only' => 'partial',
            default => 'none',
        };

        $captionParts = [
            number_format($value, 2).' kWh / est. person',
        ];
        if ($denominatorCapped) {
            $captionParts[] = __('messages.dashboard_i18n.nei_denominator_capped', [
                'cap' => (int) $capValue,
            ]);
        }
        if ($rawPresence !== null && $denominatorCapped) {
            $captionParts[] = __('messages.dashboard_i18n.nei_raw_presence', [
                'raw' => number_format((float) $rawPresence, 0),
            ]);
        }

        return [
            'key' => 'normalized_energy_intensity',
            'label' => $label,
            'value' => $value,
            'unit' => 'kWh/person',
            'status' => $interp['status'],
            'interpretation_status' => $interp['interpretation_status'],
            'interpretation_label' => $interp['interpretation_label'],
            'confidence' => $confidence,
            'description' => $interp['description'],
            'recommended_action' => $interp['recommended_action'],
            'energy_kwh' => round((float) $energyKwh, 2),
            'raw_estimated_presence' => $rawPresence !== null ? round((float) $rawPresence, 0) : null,
            'capped_estimated_presence' => round((float) $cappedPresence, 0),
            'estimated_presence' => round((float) $cappedPresence, 0),
            'denominator_capped' => $denominatorCapped,
            'denominator_cap_value' => $capValue,
            'intensity_kwh_per_estimated_person' => $value,
            'occupancy_context_confidence' => $occConfidence,
            'value_caption' => implode(' · ', $captionParts),
            'semantic_explainer' => $contextNote,
            'threshold_profile' => $this->neiThresholdProfile(),
        ];
    }

    private function calculateBaseLoadIndex(array $inputs): array
    {
        $label = 'Base Load Index';
        $total7d = $inputs['total_energy_kwh_7d'] ?? $inputs['avg_base_load_energy'] ?? null;
        $baselineKwh = $inputs['baseline_kwh_7d'] ?? $inputs['avg_off_hours_energy'] ?? null;
        $activeKwh = $inputs['active_hours_kwh_7d'] ?? null;
        $windows = $inputs['baseline_window_rule'] ?? $inputs['detected_baseline_windows'] ?? '00:00–06:59, weekends, near-zero movement';
        $sharePercent = $inputs['baseline_energy_share_percent'] ?? null;

        if ($total7d === null || $baselineKwh === null || (float) $total7d <= 0) {
            return $this->insufficientKpi(
                'base_load_index',
                $label,
                'ratio',
                'No reliable low-occupancy baseline windows in the last 7 days.'
            );
        }

        $value = round((float) $baselineKwh / (float) $total7d, 2);
        if ($sharePercent === null) {
            $sharePercent = round(100.0 * $value, 1);
        }
        $baselineState = $this->resolveBaselineState($value);
        $interp = $this->interpretBaseLoad($value, $baselineState);

        if ($activeKwh === null) {
            $activeKwh = max(0.0, (float) $total7d - (float) $baselineKwh);
        }

        $baseExplainer = __('messages.dashboard_i18n.base_load_high_explainer');

        return [
            'key' => 'base_load_index',
            'label' => $label,
            'value' => $value,
            'unit' => 'ratio',
            'status' => $interp['status'],
            'interpretation_status' => $interp['interpretation_status'],
            'interpretation_label' => $interp['interpretation_label'],
            'confidence' => 'estimated',
            'description' => $interp['description'],
            'recommended_action' => $interp['recommended_action'],
            'baseline_kwh' => round((float) $baselineKwh, 2),
            'active_hours_kwh' => round((float) $activeKwh, 2),
            'base_load_ratio' => $value,
            'baseline_energy_share_percent' => $sharePercent,
            'baseline_window_rule' => $windows,
            'baseline_hours_count' => $inputs['baseline_hours_count'] ?? null,
            'active_hours_count' => $inputs['active_hours_count'] ?? null,
            'detected_baseline_windows' => $windows,
            'baseline_state' => $baselineState,
            'value_caption' => number_format($value, 2).' · '.number_format((float) $sharePercent, 1).'% · '.$interp['interpretation_label'],
            'semantic_explainer' => $value > 0.6 ? $baseExplainer : __('messages.dashboard_i18n.kpi_tooltip_base_load_index'),
            'threshold_profile' => $this->baseLoadThresholdProfile(),
        ];
    }

    /**
     * @return array{interpretation_status: string, interpretation_label: string, status: string, description: string, recommended_action: string}
     */
    private function interpretNei(float $value, bool $limitedProxy): array
    {
        $profile = $this->neiThresholdProfile();
        $efficientMax = (float) ($profile['efficient_max'] ?? 2.5);
        $moderateMax = (float) ($profile['moderate_max'] ?? 5.0);
        $highMax = (float) ($profile['high_max'] ?? 10.0);

        if ($limitedProxy) {
            if ($value <= $efficientMax) {
                $interp = 'efficient';
            } elseif ($value <= $moderateMax) {
                $interp = 'moderate';
            } elseif ($value <= $highMax) {
                $interp = 'needs_calibration';
            } else {
                $interp = 'high';
            }
        } else {
            if ($value <= $efficientMax) {
                $interp = 'efficient';
            } elseif ($value <= $moderateMax) {
                $interp = 'moderate';
            } elseif ($value <= $highMax) {
                $interp = 'high';
            } else {
                $interp = 'needs_calibration';
            }
        }

        $status = match ($interp) {
            'efficient' => 'good',
            'moderate' => 'warning',
            'high' => $limitedProxy ? 'warning' : 'critical',
            'needs_calibration' => 'warning',
            default => 'warning',
        };

        $labelKey = 'messages.dashboard_i18n.nei_interp_'.$interp;

        return [
            'interpretation_status' => $interp,
            'interpretation_label' => __($labelKey),
            'status' => $status,
            'description' => __($labelKey.'_desc'),
            'recommended_action' => __($labelKey.'_action'),
        ];
    }

    /**
     * @return array{interpretation_status: string, interpretation_label: string, status: string, description: string, recommended_action: string}
     */
    private function interpretBaseLoad(float $ratio, string $baselineState): array
    {
        $evaluation = $this->thresholdService->evaluate('base_load_index', $ratio);
        $status = $this->normalizeStatus($evaluation['status']);

        $interp = match ($baselineState) {
            'efficient_baseline' => 'efficient_baseline',
            'elevated_standby_load' => 'elevated_standby_load',
            default => 'excessive_overnight_load',
        };

        $labelKey = 'messages.dashboard_i18n.base_load_interp_'.$interp;

        return [
            'interpretation_status' => $interp,
            'interpretation_label' => __($labelKey),
            'status' => $status,
            'description' => $ratio > 0.6
                ? __('messages.dashboard_i18n.base_load_high_explainer')
                : $evaluation['explanation'],
            'recommended_action' => $evaluation['recommended_action'],
        ];
    }

    /** @return array<string, float|int> */
    private function neiThresholdProfile(): array
    {
        $t = (array) config('smaca_thresholds.normalized_energy_intensity', []);

        return [
            'efficient_max' => (float) ($t['efficient_max'] ?? 2.5),
            'moderate_max' => (float) ($t['moderate_max'] ?? 5.0),
            'high_max' => (float) ($t['high_max'] ?? 10.0),
            'presence_cap' => KPIInputAssembler::ESTIMATED_PRESENCE_CAP,
        ];
    }

    /** @return array<string, float> */
    private function baseLoadThresholdProfile(): array
    {
        $t = (array) config('smaca_thresholds.base_load_index', []);

        return [
            'good_max' => (float) ($t['good_max'] ?? 0.6),
            'warning_max' => (float) ($t['warning_max'] ?? 0.85),
            'critical_min' => (float) ($t['critical_min'] ?? 0.86),
        ];
    }

    private function resolveBaselineState(float $ratio): string
    {
        if ($ratio <= 0.6) {
            return 'efficient_baseline';
        }
        if ($ratio <= 0.85) {
            return 'elevated_standby_load';
        }

        return 'excessive_overnight_load';
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
        $evaluation = $this->thresholdService->evaluate('thermal_comfort_index', $value);
        $status = $this->normalizeStatus($evaluation['status']);

        return [
            'key' => 'thermal_comfort_index',
            'label' => 'Thermal Comfort Index',
            'value' => $value,
            'unit' => '%',
            'status' => $status,
            'confidence' => 'high',
            'description' => $evaluation['explanation'],
            'recommended_action' => $evaluation['recommended_action'],
        ];
    }

    private function calculateVisualComfortKpi(array $inputs): array
    {
        $light = $inputs['avg_lux'] ?? $inputs['lighting'] ?? $inputs['avg_light_level'] ?? null;
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
        $evaluation = $this->thresholdService->evaluate('visual_comfort_kpi', $value);
        $status = $this->normalizeStatus($evaluation['status']);
        $confidence = $solar === null ? 'partial' : 'high';

        return [
            'key' => 'visual_comfort_kpi',
            'label' => 'Visual Comfort KPI',
            'value' => $value,
            'unit' => '%',
            'status' => $status,
            'confidence' => $confidence,
            'description' => $evaluation['explanation'].($solar === null ? ' '.__('messages.thresholds.partial_data_suffix') : ''),
            'recommended_action' => $evaluation['recommended_action'],
        ];
    }

    /**
     * Crowd Density Level — used for floor / area aggregates (parents that
     * contain people counters as children). REDEFINED in events/hour:
     *
     *   value = (entries + exits over the timeframe) / timeframe_hours
     *
     * The previous implementation divided AVG(people_total_in - people_total_out)
     * by capacity; both `total_in` and `total_out` are cumulative lifetime
     * counters, so for a passage with even a small bidirectional asymmetry
     * the residual grows unbounded (one site reported 22,763 → ratio 455).
     * Movement pressure is the right signal for this deployment.
     */
    private function calculateCrowdDensityLevel(array $inputs): array
    {
        return $this->buildMovementKpi($inputs, [
            'key' => 'crowd_density_level',
            'label' => 'Crowd Density Level',
            'description_kind' => 'aggregate',
        ]);
    }

    /**
     * Movement Activity — passage-level scope. Same math as the aggregate
     * "Crowd Density Level" but presented as activity rather than density.
     */
    private function calculateMovementActivityIndex(array $inputs): array
    {
        return $this->buildMovementKpi($inputs, [
            'key' => 'movement_activity_index',
            'label' => 'Movement Activity',
            'description_kind' => 'passage',
        ]);
    }

    private function buildMovementKpi(array $inputs, array $opts): array
    {
        $entries = $inputs['movement_entries'] ?? null;
        $exits = $inputs['movement_exits'] ?? null;
        $hours = (int) ($inputs['timeframe_hours'] ?? 24);
        $hours = $hours > 0 ? $hours : 24;

        if ($entries === null && $exits === null) {
            return $this->insufficientKpi(
                $opts['key'],
                $opts['label'],
                'events/h',
                $opts['description_kind'] === 'passage'
                    ? 'Movement events recorded by the people counters at this passage over the selected timeframe.'
                    : 'Aggregated movement events from people counters in this zone over the selected timeframe.'
            );
        }

        $totalEvents = (float) ($entries ?? 0) + (float) ($exits ?? 0);
        $value = round($totalEvents / max(1, $hours), 1);
        // Defence in depth: never let this KPI overflow into nonsensical
        // ratios. 5,000 events/h would already be 1.4 events/sec across the
        // whole campus — well above any realistic case.
        $value = max(0.0, min(5000.0, $value));

        // We use a single shared threshold series (`crowd_density`) for both
        // KPI keys so operators read a consistent scale, regardless of
        // whether they're on a floor or a passage.
        $evaluation = $this->thresholdService->evaluate('crowd_density', $value);
        $status = $this->normalizeStatus($evaluation['status'], true);

        return [
            'key' => $opts['key'],
            'label' => $opts['label'],
            'value' => $value,
            'unit' => 'events/h',
            'status' => $status,
            'confidence' => 'estimated',
            'description' => $evaluation['explanation'],
            'recommended_action' => $evaluation['recommended_action'],
        ];
    }

    /**
     * UV Exposure Risk — environmental module (outdoor VS350 / UV sensors).
     * Status follows the standard WHO UV-index bands.
     */
    private function calculateUvExposureRisk(array $inputs): array
    {
        $uv = $inputs['avg_uv_index'] ?? null;
        if ($uv === null) {
            // Solar radiation can be a fallback signal: > ~120 W/m² with no
            // UV index reported usually means a sunny window still occurred.
            $solar = $inputs['avg_solar_radiation'] ?? null;
            if ($solar === null || $solar <= 0) {
                return $this->insufficientKpi(
                    'uv_exposure_risk',
                    __('messages.labels.uv_exposure_risk'),
                    'index',
                    'No UV/environmental sensor data is available for this location.'
                );
            }
            // Crude approximation when only solar is available.
            $uv = max(0.0, min(11.0, $solar / 100.0));
        }

        $value = round((float) $uv, 1);
        $evaluation = $this->thresholdService->evaluate('uv_exposure_risk', $value);
        $status = $this->normalizeStatus($evaluation['status']);

        return [
            'key' => 'uv_exposure_risk',
            'label' => __('messages.labels.uv_exposure_risk'),
            'value' => $value,
            'unit' => 'index',
            'status' => $status,
            'confidence' => 'estimated',
            'description' => $evaluation['explanation'],
            'recommended_action' => $evaluation['recommended_action'],
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
        $allowed = ['overview', 'energy', 'iaq', 'occupancy', 'environmental', 'connectivity'];
        return in_array($resolved, $allowed, true) ? $resolved : 'overview';
    }

    private function applyCompositeOverrides(string $configKey, string $currentStatus, array $inputs): string
    {
        $rules = (array) config('smaca_thresholds.'.$configKey, []);
        if (empty($rules)) {
            return $currentStatus;
        }

        $resolved = $currentStatus;
        foreach ($rules as $rule) {
            if (!is_array($rule)) {
                continue;
            }
            $metric = $rule['metric'] ?? null;
            $op = $rule['op'] ?? null;
            $threshold = $rule['threshold'] ?? null;
            $forceStatus = $rule['force_status'] ?? null;
            $onlyIfNotCritical = (bool) ($rule['only_if_not_critical'] ?? false);
            if ($metric === null || $op === null || $threshold === null || $forceStatus === null) {
                continue;
            }
            $value = $inputs[$metric] ?? null;
            if ($value === null || !is_numeric($value)) {
                continue;
            }
            if ($onlyIfNotCritical && $resolved === 'critical') {
                continue;
            }
            $numeric = (float) $value;
            $thresholdNumeric = (float) $threshold;
            $matched = match ($op) {
                '>' => $numeric > $thresholdNumeric,
                '>=' => $numeric >= $thresholdNumeric,
                '<' => $numeric < $thresholdNumeric,
                '<=' => $numeric <= $thresholdNumeric,
                '==' => $numeric == $thresholdNumeric,
                default => false,
            };
            if ($matched) {
                $resolved = (string) $forceStatus;
            }
        }

        return $resolved;
    }

    private function normalizeStatus(string $status, bool $isCrowdDensity = false): string
    {
        $normalized = strtolower(trim($status));
        if ($isCrowdDensity) {
            if ($normalized === 'good') return 'low';
            if ($normalized === 'warning') return 'normal';
            if ($normalized === 'critical') return 'crowded';
        }
        if ($normalized === 'good') return 'normal';
        return in_array($normalized, ['warning', 'critical', 'insufficient_data'], true) ? $normalized : 'normal';
    }
}
