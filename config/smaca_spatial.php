<?php

/**
 * SMACA Spatial Intelligence Layer.
 *
 * Semantic mapping of the location codes that arrive on every reading via
 * `readings.sensor_location` (e.g. "F0", "F1", "B1", "AUD", "F0-2").
 *
 * Each location declares:
 *   - label / type / group / parent / order
 *   - supported_modules: which dashboard modules can be filtered to this code
 *   - sensor_types: capabilities physically present at this location
 *   - visibility: which roles may see this code in selectors
 *
 * Module capabilities are declared at the top under `module_capabilities` so
 * `SpatialService::resolveSensorIds($code, $module)` can drop sensors that
 * don't match the module being viewed (e.g. iaq + F0 must include the AM300
 * at F0 but NOT the people counters at F0-1..F0-5).
 *
 * No DB schema changes are required.
 */
return [
    /*
    |--------------------------------------------------------------------------
    | Group metadata (display order, labels)
    |--------------------------------------------------------------------------
    */
    'groups' => [
        'floors' => ['label' => 'Floors', 'order' => 1],
        'basements' => ['label' => 'Basements', 'order' => 2],
        'special_spaces' => ['label' => 'Special spaces', 'order' => 3],
        'passages' => ['label' => 'Passages', 'order' => 4],
    ],

    /*
    |--------------------------------------------------------------------------
    | Modules → required sensor_types
    |
    | Empty array means "no capability filter for this module" (overview /
    | admin-only modules show all visible locations).
    |--------------------------------------------------------------------------
    */
    'module_capabilities' => [
        'overview' => [],
        'iaq' => ['air_quality'],
        'occupancy' => ['people_counter', 'occupancy_aggregate'],
        'energy' => ['energy_meter'],
        'environmental' => ['environmental', 'uv'],
        'connectivity' => [],
        'ai-insights' => [],
        'management' => [],
    ],

    /*
    |--------------------------------------------------------------------------
    | Locations
    |
    | Topology (from real deployment):
    |   IAQ:           F0..F5, B1, B2, AUD, CR
    |   Occupancy:     F0-1..F0-5, F1-1, F1-2, B1-1..B1-4, AUD-1, AUD-2, B2
    |   Energy:        F0..F5
    |   Environmental: GH
    |
    | Parents (floors / basements / special spaces) also expose
    | `occupancy_aggregate` so a non-admin who picks "Ground Floor" on the
    | occupancy page still receives aggregated movement KPIs.
    |--------------------------------------------------------------------------
    */
    'locations' => [
        // ----- Floors --------------------------------------------------------
        'F0' => [
            'label' => 'Ground Floor',
            'label_el' => 'Ισόγειο',
            'type' => 'floor', 'group' => 'floors', 'order' => 0,
            'supported_modules' => ['overview', 'iaq', 'energy', 'occupancy'],
            'sensor_types' => ['air_quality', 'energy_meter', 'occupancy_aggregate'],
            'visibility' => ['admin', 'researcher', 'user'],
        ],
        'F1' => [
            'label' => '1st Floor',
            'label_el' => '1ος Όροφος',
            'type' => 'floor', 'group' => 'floors', 'order' => 1,
            'supported_modules' => ['overview', 'iaq', 'energy', 'occupancy'],
            'sensor_types' => ['air_quality', 'energy_meter', 'occupancy_aggregate'],
            'visibility' => ['admin', 'researcher', 'user'],
        ],
        'F2' => [
            'label' => '2nd Floor',
            'label_el' => '2ος Όροφος',
            'type' => 'floor', 'group' => 'floors', 'order' => 2,
            'supported_modules' => ['overview', 'iaq', 'energy', 'occupancy'],
            'sensor_types' => ['air_quality', 'energy_meter', 'occupancy_aggregate'],
            'visibility' => ['admin', 'researcher', 'user'],
        ],
        'F3' => [
            'label' => '3rd Floor',
            'label_el' => '3ος Όροφος',
            'type' => 'floor', 'group' => 'floors', 'order' => 3,
            'supported_modules' => ['overview', 'iaq', 'energy', 'occupancy'],
            'sensor_types' => ['air_quality', 'energy_meter', 'occupancy_aggregate'],
            'visibility' => ['admin', 'researcher', 'user'],
        ],
        'F4' => [
            'label' => '4th Floor',
            'label_el' => '4ος Όροφος',
            'type' => 'floor', 'group' => 'floors', 'order' => 4,
            'supported_modules' => ['overview', 'iaq', 'energy', 'occupancy'],
            'sensor_types' => ['air_quality', 'energy_meter', 'occupancy_aggregate'],
            'visibility' => ['admin', 'researcher', 'user'],
        ],
        'F5' => [
            'label' => '5th Floor',
            'label_el' => '5ος Όροφος',
            'type' => 'floor', 'group' => 'floors', 'order' => 5,
            'supported_modules' => ['overview', 'iaq', 'energy', 'occupancy'],
            'sensor_types' => ['air_quality', 'energy_meter', 'occupancy_aggregate'],
            'visibility' => ['admin', 'researcher', 'user'],
        ],

        // ----- Basements -----------------------------------------------------
        'B1' => [
            'label' => 'Basement 1',
            'label_el' => '1ο Υπόγειο',
            'type' => 'floor', 'group' => 'basements', 'order' => -1,
            'supported_modules' => ['overview', 'iaq', 'occupancy'],
            'sensor_types' => ['air_quality', 'occupancy_aggregate'],
            'visibility' => ['admin', 'researcher', 'user'],
        ],
        'B2' => [
            'label' => 'Basement 2',
            'label_el' => '2ο Υπόγειο',
            'type' => 'floor', 'group' => 'basements', 'order' => -2,
            'supported_modules' => ['overview', 'iaq', 'occupancy'],
            'sensor_types' => ['air_quality', 'people_counter', 'occupancy_aggregate'],
            'visibility' => ['admin', 'researcher', 'user'],
        ],

        // ----- Special spaces -----------------------------------------------
        'AUD' => [
            'label' => 'Auditorium',
            'label_el' => 'Αμφιθέατρο',
            'type' => 'special_space', 'group' => 'special_spaces', 'order' => 100,
            'supported_modules' => ['overview', 'iaq', 'occupancy'],
            'sensor_types' => ['air_quality', 'occupancy_aggregate'],
            'visibility' => ['admin', 'researcher', 'user'],
        ],
        'CR' => [
            'label' => 'Computer Room',
            'label_el' => 'Computer Room',
            'type' => 'special_space', 'group' => 'special_spaces', 'order' => 101,
            'supported_modules' => ['overview', 'iaq'],
            'sensor_types' => ['air_quality'],
            'visibility' => ['admin', 'researcher', 'user'],
        ],
        'GH' => [
            'label' => 'Gate House',
            'label_el' => 'Φυλάκιο Εισόδου',
            'type' => 'special_space', 'group' => 'special_spaces', 'order' => 102,
            'supported_modules' => ['overview', 'environmental'],
            'sensor_types' => ['environmental', 'uv'],
            'visibility' => ['admin', 'researcher', 'user'],
        ],
        // LIB has no deployed sensors yet. We keep it in config so any UI that
        // resolves a raw code (e.g. a future reading or the management table)
        // shows the human label instead of "LIB". It is intentionally NOT
        // included in any module's `supported_modules` so it never appears in
        // the module-aware location selectors.
        'LIB' => [
            'label' => 'Library',
            'label_el' => 'Βιβλιοθήκη',
            'type' => 'special_space', 'group' => 'special_spaces', 'order' => 103,
            'supported_modules' => [],
            'sensor_types' => [],
            'visibility' => ['admin', 'researcher', 'user'],
        ],

        // ----- Passages (people counters) -----------------------------------
        // visible to admin + researcher only; not normal users.
        'F0-1' => [
            'label' => 'Ground Floor Passage 1', 'label_el' => 'Ισόγειο – Πέρασμα 1',
            'type' => 'passage', 'parent' => 'F0', 'group' => 'passages', 'order' => 1,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'F0-2' => [
            'label' => 'Ground Floor Passage 2', 'label_el' => 'Ισόγειο – Πέρασμα 2',
            'type' => 'passage', 'parent' => 'F0', 'group' => 'passages', 'order' => 2,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'F0-3' => [
            'label' => 'Ground Floor Passage 3', 'label_el' => 'Ισόγειο – Πέρασμα 3',
            'type' => 'passage', 'parent' => 'F0', 'group' => 'passages', 'order' => 3,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'F0-4' => [
            'label' => 'Ground Floor Passage 4', 'label_el' => 'Ισόγειο – Πέρασμα 4',
            'type' => 'passage', 'parent' => 'F0', 'group' => 'passages', 'order' => 4,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'F0-5' => [
            'label' => 'Ground Floor Passage 5', 'label_el' => 'Ισόγειο – Πέρασμα 5',
            'type' => 'passage', 'parent' => 'F0', 'group' => 'passages', 'order' => 5,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'F1-1' => [
            'label' => '1st Floor Passage 1', 'label_el' => '1ος Όροφος – Πέρασμα 1',
            'type' => 'passage', 'parent' => 'F1', 'group' => 'passages', 'order' => 11,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'F1-2' => [
            'label' => '1st Floor Passage 2', 'label_el' => '1ος Όροφος – Πέρασμα 2',
            'type' => 'passage', 'parent' => 'F1', 'group' => 'passages', 'order' => 12,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'B1-1' => [
            'label' => 'Basement 1 Passage 1', 'label_el' => '1ο Υπόγειο – Πέρασμα 1',
            'type' => 'passage', 'parent' => 'B1', 'group' => 'passages', 'order' => 21,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'B1-2' => [
            'label' => 'Basement 1 Passage 2', 'label_el' => '1ο Υπόγειο – Πέρασμα 2',
            'type' => 'passage', 'parent' => 'B1', 'group' => 'passages', 'order' => 22,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'B1-3' => [
            'label' => 'Basement 1 Passage 3', 'label_el' => '1ο Υπόγειο – Πέρασμα 3',
            'type' => 'passage', 'parent' => 'B1', 'group' => 'passages', 'order' => 23,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'B1-4' => [
            'label' => 'Basement 1 Passage 4', 'label_el' => '1ο Υπόγειο – Πέρασμα 4',
            'type' => 'passage', 'parent' => 'B1', 'group' => 'passages', 'order' => 24,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'AUD-1' => [
            'label' => 'Auditorium Entrance 1', 'label_el' => 'Αμφιθέατρο – Είσοδος 1',
            'type' => 'passage', 'parent' => 'AUD', 'group' => 'passages', 'order' => 31,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
        'AUD-2' => [
            'label' => 'Auditorium Entrance 2', 'label_el' => 'Αμφιθέατρο – Είσοδος 2',
            'type' => 'passage', 'parent' => 'AUD', 'group' => 'passages', 'order' => 32,
            'supported_modules' => ['occupancy'], 'sensor_types' => ['people_counter'],
            'visibility' => ['admin', 'researcher'],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Module → required sensor_types (also used by the audit endpoint to
    | report which deployed sensor types serve which module).
    |--------------------------------------------------------------------------
    */
    'sensor_type_to_module' => [
        'air_quality' => 'iaq',
        'energy_meter' => 'energy',
        'people_counter' => 'occupancy',
        'occupancy_aggregate' => 'occupancy',
        'environmental' => 'environmental',
        'uv' => 'environmental',
    ],
];
