<?php

return [
    'co2_ppm' => [
        'unit' => 'ppm',
        'good_max' => 800,
        'warning_max' => 1000,
        'critical_min' => 1001,
    ],
    'pm2_5_ugm3' => [
        'unit' => 'ug/m3',
        'good_max' => 12,
        'warning_max' => 35,
        'critical_min' => 36,
    ],
    'pm10_ugm3' => [
        'unit' => 'ug/m3',
        'good_max' => 20,
        'warning_max' => 50,
        'critical_min' => 51,
    ],
    'tvoc_index' => [
        'unit' => 'index',
        'good_max' => 150,
        'warning_max' => 400,
        'critical_min' => 401,
    ],
    'temperature_c' => [
        'unit' => 'C',
        'good_min' => 20,
        'good_max' => 24,
        'warning_min' => 18,
        'warning_max' => 27,
    ],
    'humidity_rh' => [
        'unit' => '%',
        'good_min' => 40,
        'good_max' => 60,
        'warning_min' => 30,
        'warning_max' => 70,
    ],
    'light_level' => [
        'unit' => 'lux',
        'good_min' => 300,
        'good_max' => 500,
        'warning_min' => 200,
        'warning_max' => 700,
    ],
    'lux' => [
        'unit' => 'lux',
        'good_min' => 300,
        'good_max' => 500,
        'warning_min' => 200,
        'warning_max' => 700,
    ],
    'uv_index' => [
        'unit' => 'uv',
        'good_max' => 2,
        'warning_max' => 5,
        'critical_min' => 6,
    ],
    // Movement pressure (events/hour). Used by both `crowd_density_level`
    // (floor/area aggregates) and `movement_activity_index` (passages).
    // The old ratio scale (people / capacity) was wrong: people_total_in/out
    // are cumulative lifetime counters so the ratio could overflow to 100×+.
    'crowd_density' => [
        'unit' => 'events/h',
        'good_max' => 10,
        'warning_max' => 50,
        'critical_min' => 50,
    ],
    // Outdoor UV / solar exposure risk (UV index value). Aligned with the
    // WHO UV-index bands: 0–2 low, 3–5 moderate, 6+ high.
    'uv_exposure_risk' => [
        'unit' => 'index',
        'good_max' => 2,
        'warning_max' => 5,
        'critical_min' => 6,
    ],
    'normalized_energy_intensity' => [
        'unit' => 'kWh/person',
        'efficient_max' => 2.5,
        'moderate_max' => 5.0,
        'high_max' => 10.0,
        'good_max' => 2.5,
        'warning_max' => 5.0,
        'critical_min' => 10.01,
    ],
    'base_load_index' => [
        'unit' => 'ratio',
        'good_max' => 0.6,
        'warning_max' => 0.85,
        'critical_min' => 0.86,
    ],
    'thermal_comfort_index' => [
        'unit' => '%',
        'good_min' => 80,
        'warning_min' => 55,
        'critical_max' => 54,
    ],
    'visual_comfort_kpi' => [
        'unit' => '%',
        'good_min' => 75,
        'warning_min' => 50,
        'critical_max' => 49,
    ],
    'iaq_health_index' => [
        'unit' => '%',
        'good_min' => 80,
        'warning_min' => 55,
        'critical_max' => 54,
    ],

    /*
    | Composite-KPI overrides applied AFTER the base index is computed.
    | Each override is checked in order; first match wins (most-severe first).
    | Keys: metric (input field on KPI inputs), op (>=, >, <=, <), threshold,
    |       force_status (final KPI status), only_if_not_critical (bool).
    */
    'iaq_health_index_overrides' => [
        [
            'metric' => 'avg_co2_ppm',
            'op' => '>',
            'threshold' => 1500,
            'force_status' => 'critical',
            'only_if_not_critical' => false,
        ],
        [
            'metric' => 'avg_co2_ppm',
            'op' => '>',
            'threshold' => 1000,
            'force_status' => 'warning',
            'only_if_not_critical' => true,
        ],
    ],
];
