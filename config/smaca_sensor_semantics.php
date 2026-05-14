<?php

/**
 * SMACA IAQ / environmental sensor semantics registry
 * =====================================================
 *
 * Single configurable layer for semantic types, interpretation modes,
 * thresholds (by reference into threshold keys or inline bands), and
 * translation keys for user-facing explainers.
 *
 * Operational overrides (optional):
 *   SMACA_TVOC_SEMANTIC_MODE=iaq_rating_level|raw_tvoc_ugm3
 *   SMACA_LIGHT_SEMANTIC_MODE=normalized_level_0_5|raw_lux
 */

return [
    'version' => '1.0.0-iaq-semantic',

    'defaults' => [
        'tvoc_semantic_mode' => env('SMACA_TVOC_SEMANTIC_MODE', 'iaq_rating_level'),
        'light_semantic_mode' => env('SMACA_LIGHT_SEMANTIC_MODE', 'normalized_level_0_5'),
    ],

    /**
     * Per-metric registry. `threshold_config_key` points into
     * config/smaca_thresholds.php when numeric threshold evaluation is used.
     */
    'metrics' => [
        'co2_ppm' => [
            'semantic_type' => 'ventilation_proxy',
            'value_kind' => 'raw_measurement',
            'unit' => 'ppm',
            'classification_type' => 'numeric_banded',
            'display_type' => 'measurement',
            'threshold_config_key' => 'co2_ppm',
            'explainer_key' => 'iaq_explainer.co2',
        ],
        'tvoc' => [
            'semantic_type' => 'volatile_compounds',
            'value_kind' => 'vendor_derived',
            'supported_modes' => ['iaq_rating_level', 'raw_tvoc_ugm3'],
            'classification_type' => 'mode_dependent',
            'display_type' => 'measurement_or_index',
            'explainer_keys' => [
                'iaq_rating_level' => 'iaq_explainer.tvoc_iaq_rating',
                'raw_tvoc_ugm3' => 'iaq_explainer.tvoc_raw',
            ],
        ],
        'pm2_5_ugm3' => [
            'semantic_type' => 'particulate_fine',
            'value_kind' => 'raw_measurement',
            'unit' => 'µg/m³',
            'classification_type' => 'numeric',
            'display_type' => 'measurement',
            'threshold_config_key' => 'pm2_5_ugm3',
            'explainer_key' => 'iaq_explainer.pm25',
        ],
        'pm10_ugm3' => [
            'semantic_type' => 'particulate_coarse',
            'value_kind' => 'raw_measurement',
            'unit' => 'µg/m³',
            'classification_type' => 'numeric',
            'display_type' => 'measurement',
            'threshold_config_key' => 'pm10_ugm3',
            'explainer_key' => 'iaq_explainer.pm10',
        ],
        'temperature_c' => [
            'semantic_type' => 'thermal',
            'value_kind' => 'raw_measurement',
            'unit' => '°C',
            'classification_type' => 'numeric',
            'display_type' => 'measurement',
            'threshold_config_key' => 'temperature_c',
            'explainer_key' => 'iaq_explainer.temperature',
        ],
        'humidity_rh' => [
            'semantic_type' => 'thermal',
            'value_kind' => 'raw_measurement',
            'unit' => '%',
            'classification_type' => 'numeric',
            'display_type' => 'measurement',
            'threshold_config_key' => 'humidity_rh',
            'explainer_key' => 'iaq_explainer.humidity',
        ],
        'light_level' => [
            'semantic_type' => 'visual_environment',
            'value_kind' => 'normalized_level',
            'supported_modes' => ['normalized_level_0_5', 'raw_lux'],
            'classification_type' => 'mode_dependent',
            'display_type' => 'categorical',
            'explainer_keys' => [
                'normalized_level_0_5' => 'iaq_explainer.lighting_normalized',
                'raw_lux' => 'iaq_explainer.lighting_lux',
            ],
        ],
    ],

    /** IAQ-derived TVOC rating (sensor-reported index), NOT µg/m³. */
    'tvoc_modes' => [
        'iaq_rating_level' => [
            'bands' => [
                ['max' => 1.99, 'label_key' => 'iaq_tvoc_rating.very_good', 'severity' => 0],
                ['max' => 2.99, 'label_key' => 'iaq_tvoc_rating.good', 'severity' => 0],
                ['max' => 3.99, 'label_key' => 'iaq_tvoc_rating.medium', 'severity' => 1],
                ['max' => 4.99, 'label_key' => 'iaq_tvoc_rating.poor', 'severity' => 2],
                ['max' => null, 'label_key' => 'iaq_tvoc_rating.bad', 'severity' => 2],
            ],
            /** Sub-score curve nodes [rating, score] for weighted IAQ health index. */
            'health_index_curve' => [
                [1.0, 100.0],
                [1.99, 100.0],
                [2.5, 85.0],
                [3.5, 55.0],
                [4.5, 30.0],
                [5.0, 12.0],
                [6.0, 5.0],
            ],
        ],
        'raw_tvoc_ugm3' => [
            'health_index_curve' => [
                [0.0, 100.0],
                [100.0, 95.0],
                [250.0, 85.0],
                [500.0, 65.0],
                [1000.0, 35.0],
                [2000.0, 15.0],
            ],
            /** Environmental safety composite (µg/m³) — see IaqSemanticKpiComposer. */
            'safety' => [
                'healthy_max' => 250.0,
                'unhealthy_min' => 1000.0,
            ],
        ],
    ],

    /** Normalized lighting level 0–5 → indicative lux ranges (documentation only). */
    'light_modes' => [
        'normalized_level_0_5' => [
            'levels' => [
                ['level' => 0, 'label_key' => 'iaq_lighting_level.minimal', 'lux_hint' => '0–5'],
                ['level' => 1, 'label_key' => 'iaq_lighting_level.dim_indoor', 'lux_hint' => '6–50'],
                ['level' => 2, 'label_key' => 'iaq_lighting_level.residential', 'lux_hint' => '51–100'],
                ['level' => 3, 'label_key' => 'iaq_lighting_level.office', 'lux_hint' => '101–500'],
                ['level' => 4, 'label_key' => 'iaq_lighting_level.detailed_work', 'lux_hint' => '501–2000'],
                ['level' => 5, 'label_key' => 'iaq_lighting_level.intense', 'lux_hint' => '>2000'],
            ],
        ],
        'raw_lux' => [
            'comfort_target_lux' => 400.0,
        ],
    ],

    /** CO₂ ppm bands for ventilation-quality KPI (aligned with spec). */
    'co2_ventilation_bands' => [
        ['max' => 400, 'status' => 'good', 'label_key' => 'iaq_co2_band.outdoor_normal'],
        ['max' => 1000, 'status' => 'good', 'label_key' => 'iaq_co2_band.good_ventilation'],
        ['max' => 2000, 'status' => 'warning', 'label_key' => 'iaq_co2_band.poor_ventilation'],
        ['max' => 5000, 'status' => 'critical', 'label_key' => 'iaq_co2_band.high_discomfort'],
        ['max' => 40000, 'status' => 'critical', 'label_key' => 'iaq_co2_band.workplace_limit'],
        ['max' => null, 'status' => 'critical', 'label_key' => 'iaq_co2_band.dangerous'],
    ],

    /** Particulate thresholds for environmental safety index (raw TVOC mode). */
    'environmental_safety' => [
        'pm25' => ['healthy_max' => 12.0, 'unhealthy_min' => 35.4],
        'pm10' => ['healthy_max' => 54.0, 'unhealthy_min' => 154.0],
    ],

    'thermal_comfort' => [
        'temp_min_c' => 20.0,
        'temp_max_c' => 24.0,
        'rh_min' => 40.0,
        'rh_max' => 60.0,
    ],
];
