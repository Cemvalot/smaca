<?php

/**
 * WiFi / wireless link quality bands (CONNECTIVITY-1).
 * Higher metric values are better for all axes except none inverted.
 */
return [
    'version' => '1.0.0',

    'bands' => [
        'excellent' => ['rank' => 0, 'severity' => 'good'],
        'very_good' => ['rank' => 1, 'severity' => 'good'],
        'good_usable' => ['rank' => 2, 'severity' => 'normal'],
        'weak_unstable' => ['rank' => 3, 'severity' => 'warning'],
        'bad' => ['rank' => 4, 'severity' => 'critical'],
    ],

    'metrics' => [
        'rssi' => [
            'unit' => 'dBm',
            'aliases' => ['signal_strength', 'rssi'],
            'higher_is_better' => true,
            'thresholds' => [
                ['band' => 'excellent', 'min' => -60],
                ['band' => 'very_good', 'min' => -67, 'max' => -61],
                ['band' => 'good_usable', 'min' => -75, 'max' => -68],
                ['band' => 'weak_unstable', 'min' => -82, 'max' => -76],
                ['band' => 'bad', 'max' => -83],
            ],
        ],
        'snr' => [
            'unit' => 'dB',
            'aliases' => ['snr', 'signal_to_noise', 'signal_to_noise_ratio'],
            'higher_is_better' => true,
            'thresholds' => [
                ['band' => 'excellent', 'min' => 35],
                ['band' => 'very_good', 'min' => 25, 'max' => 34],
                ['band' => 'good_usable', 'min' => 20, 'max' => 24],
                ['band' => 'weak_unstable', 'min' => 10, 'max' => 19],
                ['band' => 'bad', 'max' => 9],
            ],
        ],
        'tx_ccq' => [
            'unit' => '%',
            'aliases' => ['tx_ccq'],
            'higher_is_better' => true,
            'thresholds' => [
                ['band' => 'excellent', 'min' => 90],
                ['band' => 'very_good', 'min' => 80, 'max' => 89],
                ['band' => 'good_usable', 'min' => 65, 'max' => 79],
                ['band' => 'weak_unstable', 'min' => 40, 'max' => 64],
                ['band' => 'bad', 'max' => 39],
            ],
        ],
        'tx_rate' => [
            'unit' => 'Mbps',
            'aliases' => ['tx_rate'],
            'higher_is_better' => true,
            'thresholds' => [
                ['band' => 'excellent', 'min' => 300],
                ['band' => 'very_good', 'min' => 150, 'max' => 299],
                ['band' => 'good_usable', 'min' => 72, 'max' => 149],
                ['band' => 'weak_unstable', 'min' => 24, 'max' => 71],
                ['band' => 'bad', 'max' => 23],
            ],
        ],
    ],

    'metric_order' => ['rssi', 'snr', 'tx_ccq', 'tx_rate'],
];
