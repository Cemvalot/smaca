<?php

/**
 * SMACA KPI Metadata — Clarity & Interpretation Layer
 * =========================================================
 *
 * Single source of truth for every public KPI surfaced by the dashboard.
 *
 * For each KPI we describe:
 *   - kpi_category           : thematic grouping (IAQ, Comfort, Energy, etc.)
 *   - source_type            : measured | estimated | proxy
 *   - sensors_used           : human-readable list of sensor classes feeding it
 *   - calculation_summary    : short formula in plain English (admin / researcher detail)
 *   - plain_definition       : non-technical, every-day language for users / students
 *   - technical_definition   : full definition for admin / researcher view
 *   - unit + unit_explanation: clarify the unit (e.g. events/h ≠ people inside)
 *   - limitations            : known caveats (proxy, partial-data, sensor coverage)
 *   - status_meanings        : plain-language reading of good/warning/critical/insufficient
 *   - role_visibility        : 'public' = visible to all roles ; 'admin' = admin-only
 *   - detail_level           : which fields each role surface should display
 *
 * Localised strings are stored as ['en' => '...', 'el' => '...'] arrays and
 * resolved at runtime by KPIMetadataService against the active locale.
 *
 * NOTE: this file MUST stay public-safe — no DB credentials, raw SQL, file
 * paths or user PII. The /api/config/kpis endpoint exposes it directly.
 */

return [
    'version' => '1.0.0',

    'source_types' => [
        'measured' => [
            'en' => 'Directly measured by sensors.',
            'el' => 'Άμεσα μετρημένο από αισθητήρες.',
        ],
        'estimated' => [
            'en' => 'Calculated from sensor data using assumptions (e.g. capacity).',
            'el' => 'Υπολογισμένο από δεδομένα αισθητήρων με παραδοχές (π.χ. χωρητικότητα).',
        ],
        'proxy' => [
            'en' => 'A proxy indicator: best available signal when direct measurement is not possible.',
            'el' => 'Δείκτης-υποκατάστατο: η καλύτερη διαθέσιμη ένδειξη όταν δεν υπάρχει άμεση μέτρηση.',
        ],
    ],

    'role_detail_level' => [
        // Which metadata fields each role surface should see by default.
        'user' => [
            'plain_definition',
            'unit_explanation',
            'recommended_action',
            'limitations_simple',
            'status_meaning',
        ],
        'student' => [
            'plain_definition',
            'unit_explanation',
            'recommended_action',
            'limitations_simple',
            'status_meaning',
        ],
        'researcher' => [
            'plain_definition',
            'technical_definition',
            'unit_explanation',
            'sensors_used',
            'calculation_summary',
            'recommended_action',
            'limitations',
            'status_meaning',
            'source_type',
            'kpi_category',
        ],
        'admin' => [
            'plain_definition',
            'technical_definition',
            'unit_explanation',
            'sensors_used',
            'calculation_summary',
            'recommended_action',
            'limitations',
            'status_meaning',
            'source_type',
            'kpi_category',
            'confidence',
        ],
    ],

    'kpis' => [

        // --------------------------------------------------------------- IAQ
        'iaq_health_index' => [
            'kpi_category' => 'IAQ',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => '%',
            'unit_label' => ['en' => '%', 'el' => '%'],
            'unit_explanation' => [
                'en' => '0–100 score — higher means healthier indoor air.',
                'el' => 'Βαθμολογία 0–100 — υψηλότερο σημαίνει πιο υγιεινό αέρα.',
            ],
            'plain_definition' => [
                'en' => 'A combined score of indoor air quality based on CO₂, particulates and chemical pollutants in the selected zone.',
                'el' => 'Συνδυαστική βαθμολογία ποιότητας εσωτερικού αέρα με βάση CO₂, αιωρούμενα σωματίδια και χημικούς ρύπους στη επιλεγμένη ζώνη.',
            ],
            'technical_definition' => [
                'en' => 'Weighted index of CO₂ (ppm), TVOC (semantic mode from config: IAQ rating 1–6 or raw µg/m³ curve), PM2.5 (µg/m³) and PM10 (µg/m³) sub-scores. CO₂ above 1500 ppm forces a critical status; above 1000 ppm forces a warning.',
                'el' => 'Σταθμισμένος δείκτης από επιμέρους βαθμολογίες CO₂ (ppm), TVOC (σημασιολογική λειτουργία από ρύθμιση: βαθμολογία IAQ 1–6 ή καμπύλη raw µg/m³), PM2.5 (µg/m³) και PM10 (µg/m³). CO₂ άνω των 1500 ppm επιβάλλει κρίσιμη κατάσταση· άνω των 1000 ppm επιβάλλει προειδοποίηση.',
            ],
            'sensors_used' => [
                'en' => ['CO₂', 'TVOC', 'PM2.5', 'PM10'],
                'el' => ['CO₂', 'TVOC', 'PM2.5', 'PM10'],
            ],
            'calculation_summary' => [
                'en' => 'Average each pollutant over the selected timeframe, score each against its own thresholds, then take the weighted mean. Apply CO₂ overrides last.',
                'el' => 'Μέσος όρος κάθε ρύπου στο επιλεγμένο χρονικό διάστημα, βαθμολόγηση έναντι των ορίων του, στη συνέχεια σταθμισμένος μέσος. Οι κανόνες για CO₂ εφαρμόζονται τελευταίοι.',
            ],
            'source_type' => 'measured',
            'limitations' => [
                'en' => 'Confidence drops to "partial" when one or more of the four pollutants is missing for the selected location.',
                'el' => 'Η εμπιστοσύνη πέφτει σε «μερική» όταν λείπει ένας ή περισσότεροι από τους τέσσερις ρύπους για την επιλεγμένη τοποθεσία.',
            ],
            'limitations_simple' => [
                'en' => 'If some pollutants are not available for this zone, the score may be partial.',
                'el' => 'Αν λείπουν ορισμένοι ρύποι για τη ζώνη, η βαθμολογία μπορεί να είναι μερική.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Indoor air is healthy.',
                    'el' => 'Ο εσωτερικός αέρας είναι υγιεινός.',
                ],
                'warning' => [
                    'en' => 'Air quality is degrading — increase ventilation.',
                    'el' => 'Η ποιότητα αέρα επιδεινώνεται — αυξήστε τον αερισμό.',
                ],
                'critical' => [
                    'en' => 'Air quality is poor — apply ventilation actions immediately.',
                    'el' => 'Η ποιότητα αέρα είναι κακή — εφαρμόστε άμεσα μέτρα αερισμού.',
                ],
                'insufficient_data' => [
                    'en' => 'Not enough air-quality readings to evaluate this zone.',
                    'el' => 'Δεν υπάρχουν αρκετές μετρήσεις ποιότητας αέρα για αξιολόγηση.',
                ],
            ],
        ],

        'environmental_safety_index' => [
            'kpi_category' => 'IAQ',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => '',
            'unit_label' => ['en' => '', 'el' => ''],
            'unit_explanation' => [
                'en' => 'Categorical index (Healthy / Medium / Unhealthy), not a concentration.',
                'el' => 'Κατηγορικός δείκτης (Υγιής / Μέτριος / Μη υγιής), όχι συγκέντρωση.',
            ],
            'plain_definition' => [
                'en' => 'Combines PM2.5, PM10, and TVOC using the configured TVOC semantic mode (IAQ rating vs raw concentration).',
                'el' => 'Συνδυάζει PM2.5, PM10 και TVOC με βάση τη ρυθμισμένη σημασιολογική λειτουργία TVOC (βαθμολογία IAQ έναντι πρωτογενούς συγκέντρωσης).',
            ],
            'technical_definition' => [
                'en' => 'Raw TVOC mode: unhealthy if any of TVOC>1000 µg/m³, PM2.5>35.4, PM10>154; healthy only if TVOC≤250 AND PM2.5≤12 AND PM10≤54; else medium — worst wins. IAQ rating mode: TVOC mapped to severity bands; same PM gates.',
                'el' => 'Λειτουργία raw TVOC: μη υγιές αν TVOC>1000 µg/m³ ή PM2.5>35.4 ή PM10>154· υγιές μόνο αν TVOC≤250 ΚΑΙ PM2.5≤12 ΚΑΙ PM10≤54· αλλιώς μέτριο — ισχύει το χειρότερο. Λειτουργία βαθμολογίας IAQ: TVOC σε κλίμακα σοβαρότητας· ίδια όρια PM.',
            ],
            'sensors_used' => [
                'en' => ['TVOC (mode-dependent)', 'PM2.5', 'PM10'],
                'el' => ['TVOC (ανά λειτουργία)', 'PM2.5', 'PM10'],
            ],
            'calculation_summary' => [
                'en' => 'Per-dimension tri-level severity from config thresholds; overall = worst dimension.',
                'el' => 'Τριεπίπεδη σοβαρότητα ανά διάσταση από ορία ρύθμισης· συνολικά = χειρότερη διάσταση.',
            ],
            'source_type' => 'measured',
            'limitations' => [
                'en' => 'Requires correct TVOC semantic mode in deployment config; misconfiguration misclassifies TVOC.',
                'el' => 'Απαιτείται σωστή λειτουργία σημασιολογίας TVOC στη ρύθμιση· λανθασμένη ρύθμιση παραμορφώνει το TVOC.',
            ],
            'limitations_simple' => [
                'en' => 'Depends on the TVOC interpretation mode set for your sensors.',
                'el' => 'Εξαρτάται από τη λειτουργία ερμηνείας TVOC για τους αισθητήρες σας.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Environmental safety is in the healthy band.',
                    'el' => 'Η περιβαλλοντική ασφάλεια είναι στην υγιή ζώνη.',
                ],
                'warning' => [
                    'en' => 'Some pollutants are in a medium band — monitor and ventilate.',
                    'el' => 'Ορισμένοι ρύποι είναι σε μέτρια ζώνη — παρακολουθήστε και αερίστε.',
                ],
                'critical' => [
                    'en' => 'One or more pollutants indicate unhealthy conditions.',
                    'el' => 'Ένας ή περισσότεροι ρύποι υποδηλώνουν μη υγιείς συνθήκες.',
                ],
                'insufficient_data' => [
                    'en' => 'Not enough TVOC/PM data to compute this index.',
                    'el' => 'Ανεπαρκή δεδομένα TVOC/PM για τον δείκτη.',
                ],
            ],
        ],

        'iaq_thermal_comfort' => [
            'kpi_category' => 'Comfort',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => '',
            'unit_label' => ['en' => '', 'el' => ''],
            'unit_explanation' => [
                'en' => 'Boolean comfort from overlapping temperature and humidity bands.',
                'el' => 'Δυαδική άνεση από κοινές ζώνες θερμοκρασίας και υγρασίας.',
            ],
            'plain_definition' => [
                'en' => 'Comfortable when average temperature is 20–24 °C and humidity is 40–60 %.',
                'el' => 'Άνετο όταν η μέση θερμοκρασία είναι 20–24 °C και η υγρασία 40–60 %.',
            ],
            'technical_definition' => [
                'en' => 'Comfortable iff T∈[20,24] °C AND RH∈[40,60] % (configurable via smaca_sensor_semantics).',
                'el' => 'Άνετο αν και μόνο αν T∈[20,24] °C ΚΑΙ RH∈[40,60] % (ρυθμιζόμενο μέσω smaca_sensor_semantics).',
            ],
            'sensors_used' => [
                'en' => ['Temperature', 'Relative humidity'],
                'el' => ['Θερμοκρασία', 'Σχετική υγρασία'],
            ],
            'calculation_summary' => [
                'en' => 'AND of two range tests on timeframe-averaged inputs.',
                'el' => 'Λογικό AND δύο ελέγχων εύρους σε μέσους όρους διαστήματος.',
            ],
            'source_type' => 'measured',
            'limitations' => [
                'en' => 'Does not model radiant asymmetry, air speed, or clothing/activity — simplified comfort proxy.',
                'el' => 'Δεν μοντελοποιεί ακτινική ασυμμετρία, ταχύτητα αέρα ή ρουχισμό/δραστηριότητα — απλοποιημένο υποκατάστατο άνεσης.',
            ],
            'limitations_simple' => [
                'en' => 'A simplified comfort rule, not a full PMV/PPD model.',
                'el' => 'Απλοποιημένος κανόνας άνεσης, όχι πλήρες μοντέλο PMV/PPD.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Comfortable — temperature and humidity are both in band.',
                    'el' => 'Άνετο — θερμοκρασία και υγρασία εντός ζώνης.',
                ],
                'warning' => [
                    'en' => 'N/A for boolean comfort.',
                    'el' => 'Δεν εφαρμόζεται στη δυαδική άνεση.',
                ],
                'critical' => [
                    'en' => 'Uncomfortable — at least one of temperature or humidity is out of band.',
                    'el' => 'Άβολο — τουλάχιστον μία από θερμοκρασία ή υγρασία εκτός ζώνης.',
                ],
                'insufficient_data' => [
                    'en' => 'Temperature or humidity readings are missing.',
                    'el' => 'Λείπουν μετρήσεις θερμοκρασίας ή υγρασίας.',
                ],
            ],
        ],

        'ventilation_quality_index' => [
            'kpi_category' => 'IAQ',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => 'ppm',
            'unit_label' => ['en' => 'ppm', 'el' => 'ppm'],
            'unit_explanation' => [
                'en' => 'CO₂ is a direct ppm measurement used as a ventilation proxy.',
                'el' => 'Το CO₂ είναι άμεση μέτρηση ppm ως δείκτης αερισμού.',
            ],
            'plain_definition' => [
                'en' => 'Interprets average CO₂ in ppm against ventilation bands (outdoor reference through workplace limits).',
                'el' => 'Ερμηνεύει το μέσο CO₂ σε ppm με ζώνες αερισμού (αναφορά εξωτερικού αέρα έως όρια χώρου εργασίας).',
            ],
            'technical_definition' => [
                'en' => 'Bands from config/smaca_sensor_semantics.php co2_ventilation_bands; status is worst matched band.',
                'el' => 'Ζώνες από config/smaca_sensor_semantics.php co2_ventilation_bands· η κατάσταση είναι η χειρότερη ταυτοποιημένη ζώνη.',
            ],
            'sensors_used' => [
                'en' => ['CO₂'],
                'el' => ['CO₂'],
            ],
            'calculation_summary' => [
                'en' => 'Timeframe-averaged CO₂ compared to ordered ppm bands.',
                'el' => 'Μέσος CO₂ διαστήματος σε σχέση με διατεταγμένες ζώνες ppm.',
            ],
            'source_type' => 'measured',
            'limitations' => [
                'en' => 'Single-point proxy; local pockets or sensor placement can bias readings.',
                'el' => 'Μονοδιάστατο υποκατάστατο· τοπικές διακυμάνσεις ή θέση αισθητήρα μπορεί να μεροληπεί.',
            ],
            'limitations_simple' => [
                'en' => 'Reflects averaged CO₂ at sensor locations.',
                'el' => 'Αντικατοπτρίζει μέσο CO₂ στις θέσεις αισθητήρων.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Ventilation appears adequate for the averaged CO₂ level.',
                    'el' => 'Ο αερισμός φαίνεται επαρκής για το μέσο επίπεδο CO₂.',
                ],
                'warning' => [
                    'en' => 'CO₂ suggests ventilation should be improved.',
                    'el' => 'Το CO₂ υποδηλώνει βελτίωση αερισμού.',
                ],
                'critical' => [
                    'en' => 'CO₂ is high — increase fresh air urgently.',
                    'el' => 'Υψηλό CO₂ — αυξήστε τον φρέσκο αέρα επειγόντως.',
                ],
                'insufficient_data' => [
                    'en' => 'No CO₂ readings in scope.',
                    'el' => 'Δεν υπάρχουν μετρήσεις CO₂ στην εμβέλεια.',
                ],
            ],
        ],

        'visual_lighting_condition' => [
            'kpi_category' => 'Comfort',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => '',
            'unit_label' => ['en' => '', 'el' => ''],
            'unit_explanation' => [
                'en' => 'Normalized 0–5 sensor level maps to indicative lux ranges; not a calibrated lux meter.',
                'el' => 'Το κανονικοποιημένο επίπεδο 0–5 αντιστοιχεί σε ενδεικτικά εύρη lux· όχι βαθμονομημένο μετρητή lux.',
            ],
            'plain_definition' => [
                'en' => 'Describes visual lighting condition from the sensor lighting classification, not precise lux.',
                'el' => 'Περιγράφει την οπτική συνθήκη φωτισμού από ταξινόμηση αισθητήρα, όχι ακριβή lux.',
            ],
            'technical_definition' => [
                'en' => 'Mode from config: normalized_level_0_5 uses discrete level→label map; raw_lux uses lux bands.',
                'el' => 'Λειτουργία από ρύθμιση: normalized_level_0_5 με διακριτό επίπεδο→ετικέτα· raw_lux με εύρη lux.',
            ],
            'sensors_used' => [
                'en' => ['Light level / lux'],
                'el' => ['Επίπεδο φωτός / lux'],
            ],
            'calculation_summary' => [
                'en' => 'Average light_level or lux over the timeframe (preferring the active semantic mode).',
                'el' => 'Μέσος όρος light_level ή lux στο διάστημα (κατά προτίμηση ενεργή σημασιολογική λειτουργία).',
            ],
            'source_type' => 'measured',
            'limitations' => [
                'en' => 'Vendor-normalized levels are indicative; do not use as compliance photometry.',
                'el' => 'Οι κανονικοποιημένες κλίμακες είναι ενδεικτικές· όχι για συμμόρφωση φωτομετρίας.',
            ],
            'limitations_simple' => [
                'en' => 'Not a substitute for professional lux measurement when required.',
                'el' => 'Δεν υποκαθιστά επαγγελματική μέτρηση lux όταν απαιτείται.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Lighting condition is in a typical comfortable band.',
                    'el' => 'Η συνθήκη φωτισμού είναι σε τυπική άνετη ζώνη.',
                ],
                'warning' => [
                    'en' => 'Lighting is low or very bright relative to typical tasks.',
                    'el' => 'Ο φωτισμός είναι χαμηλός ή πολύ έντονος για τυπικές εργασίες.',
                ],
                'critical' => [
                    'en' => 'N/A — boolean-style severity not used for lighting card.',
                    'el' => 'Δεν εφαρμόζεται.',
                ],
                'insufficient_data' => [
                    'en' => 'No light level or lux data.',
                    'el' => 'Δεν υπάρχουν δεδομένα επιπέδου φωτός ή lux.',
                ],
            ],
        ],

        // ------------------------------------------------------- Crowd density
        'crowd_density_level' => [
            'kpi_category' => 'Occupancy',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => 'events/h',
            'unit_label' => ['en' => 'events/h', 'el' => 'διελεύσεις/ώρα'],
            'unit_explanation' => [
                'en' => 'events/h means detected entries + exits per hour. It is not the number of people currently inside the room.',
                'el' => 'διελεύσεις/ώρα σημαίνει ανιχνευμένες είσοδοι + έξοδοι ανά ώρα. Δεν είναι ο αριθμός ατόμων που βρίσκονται μέσα στον χώρο.',
            ],
            'plain_definition' => [
                'en' => 'How busy a floor or area is, based on movement detected by entry/exit counters across all its passages.',
                'el' => 'Πόσο πολυσύχναστος είναι ένας όροφος ή χώρος, με βάση την κίνηση που ανιχνεύεται από τους μετρητές εισόδου/εξόδου σε όλα τα περάσματά του.',
            ],
            'technical_definition' => [
                'en' => 'Sum of (max − min) of cumulative people-in and people-out counters per sensor over the selected timeframe, divided by timeframe hours, expressed as events/h. Per-sensor delta clamped to ≤ 10 000 to absorb counter resets.',
                'el' => 'Άθροισμα της (max − min) των αθροιστικών μετρητών εισερχομένων και εξερχομένων ανά αισθητήρα στο επιλεγμένο διάστημα, διαιρεμένο με τις ώρες, εκφρασμένο σε διελεύσεις/ώρα. Η ανά αισθητήρα διαφορά περιορίζεται σε ≤ 10 000 για επανεκκινήσεις μετρητή.',
            ],
            'sensors_used' => [
                'en' => ['People counters (passage entry/exit)'],
                'el' => ['Μετρητές ατόμων (είσοδος/έξοδος περάσματος)'],
            ],
            'calculation_summary' => [
                'en' => '(entries + exits) ÷ timeframe hours, summed across all in-scope passages.',
                'el' => '(είσοδοι + έξοδοι) ÷ ώρες διαστήματος, αθροιστικά από όλα τα περάσματα της εμβέλειας.',
            ],
            'source_type' => 'estimated',
            'limitations' => [
                'en' => 'People counters measure movement through a passage, not direct presence inside the whole room. Two people walking back and forth produce many events.',
                'el' => 'Οι μετρητές ατόμων μετρούν τη διέλευση από ένα πέρασμα, όχι την παρουσία μέσα στον χώρο. Δύο άνθρωποι που πηγαινοέρχονται παράγουν πολλές διελεύσεις.',
            ],
            'limitations_simple' => [
                'en' => 'Movement counters do not directly measure how many people are in the room.',
                'el' => 'Οι μετρητές κίνησης δεν μετρούν άμεσα πόσοι άνθρωποι βρίσκονται στον χώρο.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Movement is light — normal flow.',
                    'el' => 'Η κίνηση είναι χαμηλή — ομαλή ροή.',
                ],
                'warning' => [
                    'en' => 'Movement is moderate — keep monitoring.',
                    'el' => 'Η κίνηση είναι μέτρια — συνεχίστε την παρακολούθηση.',
                ],
                'critical' => [
                    'en' => 'Movement is heavy — consider crowd-flow controls.',
                    'el' => 'Η κίνηση είναι αυξημένη — εξετάστε μέτρα ροής πλήθους.',
                ],
                'insufficient_data' => [
                    'en' => 'No movement data is available for this zone.',
                    'el' => 'Δεν υπάρχουν δεδομένα κίνησης για τη ζώνη.',
                ],
            ],
        ],

        // ----------------------------------------------- Movement (passage-only)
        'movement_activity_index' => [
            'kpi_category' => 'Occupancy',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => 'events/h',
            'unit_label' => ['en' => 'events/h', 'el' => 'διελεύσεις/ώρα'],
            'unit_explanation' => [
                'en' => 'events/h means detected passages per hour. It is not the number of people currently inside the room.',
                'el' => 'διελεύσεις/ώρα σημαίνει ανιχνευμένες διελεύσεις ανά ώρα. Δεν είναι ο αριθμός ατόμων που βρίσκονται μέσα στον χώρο.',
            ],
            'plain_definition' => [
                'en' => 'How much movement was detected at this passage during the selected timeframe.',
                'el' => 'Πόση κίνηση ανιχνεύθηκε σε αυτό το πέρασμα στο επιλεγμένο χρονικό διάστημα.',
            ],
            'technical_definition' => [
                'en' => 'Per-passage variant of Crowd Density Level. Calculated from the change in cumulative people-in and people-out counters over the selected timeframe, normalised as events per hour.',
                'el' => 'Παραλλαγή ανά πέρασμα του Επιπέδου Πυκνότητας. Υπολογίζεται από τη μεταβολή των αθροιστικών μετρητών εισερχομένων και εξερχομένων στο επιλεγμένο διάστημα, κανονικοποιημένη σε διελεύσεις ανά ώρα.',
            ],
            'sensors_used' => [
                'en' => ['People counter (single passage)'],
                'el' => ['Μετρητής ατόμων (ένα πέρασμα)'],
            ],
            'calculation_summary' => [
                'en' => '(passage entries + passage exits) ÷ timeframe hours.',
                'el' => '(είσοδοι περάσματος + έξοδοι περάσματος) ÷ ώρες διαστήματος.',
            ],
            'source_type' => 'measured',
            'limitations' => [
                'en' => 'People counters measure movement through a passage, not direct presence inside the whole room behind it.',
                'el' => 'Οι μετρητές ατόμων μετρούν τη διέλευση από το πέρασμα, όχι την παρουσία μέσα στον χώρο πίσω του.',
            ],
            'limitations_simple' => [
                'en' => 'This shows passage activity, not how many people are inside the room.',
                'el' => 'Εμφανίζει κίνηση περάσματος, όχι πόσοι άνθρωποι είναι μέσα στον χώρο.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Normal movement level.',
                    'el' => 'Φυσιολογικό επίπεδο κίνησης.',
                ],
                'warning' => [
                    'en' => 'Increased movement.',
                    'el' => 'Αυξημένη κίνηση.',
                ],
                'critical' => [
                    'en' => 'Heavy movement flow — monitor congestion.',
                    'el' => 'Έντονη ροή κίνησης — παρακολουθείστε για συμφόρηση.',
                ],
                'insufficient_data' => [
                    'en' => 'No movement counter data for this passage.',
                    'el' => 'Δεν υπάρχουν δεδομένα μετρητή κίνησης για αυτό το πέρασμα.',
                ],
            ],
        ],

        // ----------------------------------------------------- Energy intensity
        'normalized_energy_intensity' => [
            'kpi_category' => 'Energy',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => 'kWh/person',
            'unit_label' => ['en' => 'kWh/person', 'el' => 'kWh/άτομο'],
            'unit_explanation' => [
                'en' => 'kWh of energy used per estimated person passing through the zone.',
                'el' => 'kWh ενέργειας που καταναλώθηκαν ανά εκτιμώμενο άτομο που διήλθε από τη ζώνη.',
            ],
            'plain_definition' => [
                'en' => 'How much energy is used compared with estimated occupancy in the selected timeframe.',
                'el' => 'Πόση ενέργεια καταναλώνεται σε σχέση με την εκτιμώμενη πληρότητα στο επιλεγμένο διάστημα.',
            ],
            'technical_definition' => [
                'en' => 'Total kWh consumed in the selected timeframe (SUM of per-meter MAX−MIN energy_kwh deltas) ÷ estimated presence from movement counter deltas (entries/exits, capped). Not cumulative meter snapshots.',
                'el' => 'Συνολικά kWh στο επιλεγμένο διάστημα (ΑΘΡΟΙΣΜΑ MAX−MIN energy_kwh ανά μετρητή) ÷ εκτιμώμενη παρουσία από deltas μετρητών κίνησης (είσοδοι/έξοδοι, με όριο). Όχι στιγμιότυπα αθροιστικών μετρητών.',
            ],
            'sensors_used' => [
                'en' => ['Energy meters', 'People counters (occupancy proxy)'],
                'el' => ['Μετρητές ενέργειας', 'Μετρητές ατόμων (υποκατάστατο πληρότητας)'],
            ],
            'calculation_summary' => [
                'en' => 'total_energy_kwh_window ÷ max(estimated_presence, 1). Presence = movement-derived estimate, not live headcount.',
                'el' => 'total_energy_kwh_window ÷ max(estimated_presence, 1). Παρουσία = εκτίμηση από κίνηση, όχι live headcount.',
            ],
            'source_type' => 'estimated',
            'limitations' => [
                'en' => 'Occupancy is derived from passage counters and capped, so this KPI is an estimate. If occupancy is zero, refer to Base Load Index instead.',
                'el' => 'Η πληρότητα προέρχεται από μετρητές περασμάτων με ανώτατο όριο, άρα ο δείκτης είναι εκτίμηση. Με μηδενική πληρότητα χρησιμοποιείστε το Base Load Index.',
            ],
            'limitations_simple' => [
                'en' => 'If occupancy is estimated or zero, this KPI has lower confidence.',
                'el' => 'Αν η πληρότητα είναι εκτιμώμενη ή μηδενική, ο δείκτης έχει χαμηλότερη εμπιστοσύνη.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Energy use is in line with occupancy.',
                    'el' => 'Η κατανάλωση είναι ευθυγραμμισμένη με την πληρότητα.',
                ],
                'warning' => [
                    'en' => 'Energy use is elevated for current occupancy.',
                    'el' => 'Η κατανάλωση είναι αυξημένη για την τρέχουσα πληρότητα.',
                ],
                'critical' => [
                    'en' => 'Energy use is much higher than occupancy justifies — investigate.',
                    'el' => 'Η κατανάλωση είναι πολύ μεγαλύτερη απ\' ό,τι δικαιολογεί η πληρότητα — διερευνήστε.',
                ],
                'insufficient_data' => [
                    'en' => 'Cannot compute — energy or occupancy data missing.',
                    'el' => 'Αδύνατος υπολογισμός — λείπουν δεδομένα ενέργειας ή πληρότητας.',
                ],
            ],
        ],

        // -------------------------------------------------------- Base load
        'base_load_index' => [
            'kpi_category' => 'Energy',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => 'ratio',
            'unit_label' => ['en' => 'ratio', 'el' => 'λόγος'],
            'unit_explanation' => [
                'en' => 'Off-hours energy use ÷ overall average. Lower is better.',
                'el' => 'Κατανάλωση εκτός ωρών λειτουργίας ÷ συνολικός μέσος. Μικρότερο είναι καλύτερο.',
            ],
            'plain_definition' => [
                'en' => 'Baseline energy demand during periods of minimal or near-zero occupancy (rolling 7 days).',
                'el' => 'Βασική ενεργειακή κατανάλωση κατά τις περιόδους ελάχιστης ή μηδενικής παρουσίας (κυλιόμενο 7-ήμερο).',
            ],
            'technical_definition' => [
                'en' => 'kWh in baseline windows (00:00–06:59, weekends, near-zero movement) ÷ total kWh over rolling 7 days. Both use per-meter MAX−MIN energy_kwh deltas.',
                'el' => 'kWh σε παράθυρα baseline (00:00–06:59, σαββατοκύριακα, σχεδόν μηδενική κίνηση) ÷ συνολικά kWh σε κυλιόμενο 7-ήμερο. Και τα δύο με MAX−MIN energy_kwh ανά μετρητή.',
            ],
            'sensors_used' => [
                'en' => ['Energy meters', 'People counters (off-hours filter)'],
                'el' => ['Μετρητές ενέργειας', 'Μετρητές ατόμων (φίλτρο εκτός ωρών)'],
            ],
            'calculation_summary' => [
                'en' => 'baseline_kwh_7d ÷ total_energy_kwh_7d (rolling 7 days, fixed window). Lower ratio = less standby load.',
                'el' => 'baseline_kwh_7d ÷ total_energy_kwh_7d (κυλιόμενο 7-ήμερο, σταθερό παράθυρο). Μικρότερος λόγος = λιγότερο standby.',
            ],
            'source_type' => 'estimated',
            'limitations' => [
                'en' => 'Uses a fixed 7-day window regardless of the dashboard timeframe selector — by design.',
                'el' => 'Χρησιμοποιεί σταθερό 7-ήμερο παράθυρο ανεξάρτητα από τον επιλογέα διαστήματος — σκόπιμα.',
            ],
            'limitations_simple' => [
                'en' => 'Always evaluated over a 7-day window, even if you selected a different timeframe.',
                'el' => 'Αξιολογείται πάντα σε 7-ήμερο διάστημα, ακόμη κι αν επιλέξατε άλλο.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Off-hours base load is under control.',
                    'el' => 'Το βασικό φορτίο εκτός ωρών είναι ελεγχόμενο.',
                ],
                'warning' => [
                    'en' => 'Off-hours base load is drifting upward.',
                    'el' => 'Το βασικό φορτίο εκτός ωρών αυξάνεται.',
                ],
                'critical' => [
                    'en' => 'Off-hours base load is excessively high — audit always-on equipment.',
                    'el' => 'Το βασικό φορτίο εκτός ωρών είναι υπερβολικά υψηλό — ελέγξτε εξοπλισμό σε συνεχή λειτουργία.',
                ],
                'insufficient_data' => [
                    'en' => 'Cannot compute — energy data missing.',
                    'el' => 'Αδύνατος υπολογισμός — λείπουν δεδομένα ενέργειας.',
                ],
            ],
        ],

        // -------------------------------------------------- Thermal comfort
        'thermal_comfort_index' => [
            'kpi_category' => 'Comfort',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => '%',
            'unit_label' => ['en' => '%', 'el' => '%'],
            'unit_explanation' => [
                'en' => '0–100 score — higher means more comfortable.',
                'el' => 'Βαθμολογία 0–100 — υψηλότερο σημαίνει πιο άνετο.',
            ],
            'plain_definition' => [
                'en' => 'Indoor thermal comfort score based on average temperature and humidity in the selected zone.',
                'el' => 'Βαθμολογία θερμικής άνεσης για εσωτερικούς χώρους με βάση τη μέση θερμοκρασία και υγρασία στη ζώνη.',
            ],
            'technical_definition' => [
                'en' => '100 − |T − 22°C| × 10 − |RH − 50%| × 1.6, clamped to [0, 100].',
                'el' => '100 − |T − 22°C| × 10 − |RH − 50%| × 1.6, με όριο [0, 100].',
            ],
            'sensors_used' => [
                'en' => ['Temperature', 'Relative humidity'],
                'el' => ['Θερμοκρασία', 'Σχετική υγρασία'],
            ],
            'calculation_summary' => [
                'en' => 'Penalty score around the 22 °C / 50 % RH comfort target.',
                'el' => 'Βαθμολογία ποινής γύρω από τον στόχο άνεσης 22 °C / 50 % RH.',
            ],
            'source_type' => 'measured',
            'limitations' => [
                'en' => 'Indoor metric only — not meaningful for outdoor sensor locations.',
                'el' => 'Μόνο για εσωτερικούς χώρους — δεν είναι ουσιαστικό για εξωτερικούς αισθητήρες.',
            ],
            'limitations_simple' => [
                'en' => 'Only meaningful for indoor sensor locations.',
                'el' => 'Έχει νόημα μόνο για εσωτερικούς χώρους.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Thermal comfort is in the target band.',
                    'el' => 'Η θερμική άνεση είναι εντός στόχου.',
                ],
                'warning' => [
                    'en' => 'Thermal comfort is slightly off-target.',
                    'el' => 'Η θερμική άνεση παρεκκλίνει ελαφρώς.',
                ],
                'critical' => [
                    'en' => 'Thermal conditions are far from target — adjust HVAC.',
                    'el' => 'Οι θερμικές συνθήκες είναι μακριά από τον στόχο — ρυθμίστε τον κλιματισμό.',
                ],
                'insufficient_data' => [
                    'en' => 'Temperature or humidity readings are missing.',
                    'el' => 'Λείπουν μετρήσεις θερμοκρασίας ή υγρασίας.',
                ],
            ],
        ],

        // ---------------------------------------------------- Visual comfort
        'visual_comfort_kpi' => [
            'kpi_category' => 'Comfort',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => '%',
            'unit_label' => ['en' => '%', 'el' => '%'],
            'unit_explanation' => [
                'en' => '0–100 score — higher means lighting is closer to the comfort target.',
                'el' => 'Βαθμολογία 0–100 — υψηλότερο σημαίνει ότι ο φωτισμός είναι πιο κοντά στον στόχο.',
            ],
            'plain_definition' => [
                'en' => 'How close indoor light levels are to the target comfort range.',
                'el' => 'Πόσο κοντά βρίσκονται τα επίπεδα εσωτερικού φωτισμού στον στόχο άνεσης.',
            ],
            'technical_definition' => [
                'en' => '100 − |lux − 400| / 400 × 100, clamped to [0, 100]. Confidence "partial" if solar radiation is missing.',
                'el' => '100 − |lux − 400| / 400 × 100, με όριο [0, 100]. Εμπιστοσύνη «μερική» αν λείπει η ηλιακή ακτινοβολία.',
            ],
            'sensors_used' => [
                'en' => ['Lux / light level', 'Solar radiation (supporting)'],
                'el' => ['Lux / επίπεδο φωτισμού', 'Ηλιακή ακτινοβολία (υποστηρικτικά)'],
            ],
            'calculation_summary' => [
                'en' => 'Distance from a 400 lux comfort target.',
                'el' => 'Απόσταση από στόχο 400 lux.',
            ],
            'source_type' => 'measured',
            'limitations' => [
                'en' => 'Indoor metric only — not meaningful for the outdoor Gate House sensor.',
                'el' => 'Μόνο για εσωτερικούς χώρους — δεν είναι ουσιαστικό για τον εξωτερικό αισθητήρα Φυλακίου.',
            ],
            'limitations_simple' => [
                'en' => 'Only meaningful for indoor lighting zones.',
                'el' => 'Έχει νόημα μόνο για εσωτερικές ζώνες φωτισμού.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Lighting is suitable for visual comfort.',
                    'el' => 'Ο φωτισμός είναι κατάλληλος για οπτική άνεση.',
                ],
                'warning' => [
                    'en' => 'Lighting is slightly imbalanced.',
                    'el' => 'Ο φωτισμός είναι ελαφρώς ανισόρροπος.',
                ],
                'critical' => [
                    'en' => 'Lighting is unsuitable — rebalance immediately.',
                    'el' => 'Ο φωτισμός είναι ακατάλληλος — επανισορροπείστε άμεσα.',
                ],
                'insufficient_data' => [
                    'en' => 'Light-level readings are missing.',
                    'el' => 'Λείπουν μετρήσεις επιπέδου φωτισμού.',
                ],
            ],
        ],

        // ----------------------------------------------------- UV exposure
        'uv_exposure_risk' => [
            'kpi_category' => 'Environmental',
            'metadata_complete' => true,
            'role_visibility' => 'public',
            'unit' => 'index',
            'unit_label' => ['en' => 'UV index', 'el' => 'δείκτης UV'],
            'unit_explanation' => [
                'en' => 'Average UV Index in the selected timeframe, classified into exposure-risk bands (0–2 Low, 3–5 Moderate, 6–7 High, 8–10 Very High, 11+ Extreme).',
                'el' => 'Μέσος Δείκτης UV στο επιλεγμένο διάστημα, ταξινομημένος σε ζώνες κινδύνου έκθεσης (0–2 Χαμηλός, 3–5 Μέτριος, 6–7 Υψηλός, 8–10 Πολύ υψηλός, 11+ Ακραίος).',
            ],
            'plain_definition' => [
                'en' => 'Outdoor UV exposure risk from measured sensors in scope — not indoor air quality.',
                'el' => 'Κίνδυνος έκθεσης UV σε εξωτερικό χώρο από μετρημένους αισθητήρες στην εμβέλεια — όχι ποιότητα εσωτερικού αέρα.',
            ],
            'technical_definition' => [
                'en' => 'Uses UV index measurements when available, or solar radiation × ~0.01 as a coarse fallback when the UV index is missing.',
                'el' => 'Χρησιμοποιεί μετρήσεις δείκτη UV όταν υπάρχουν, ή ηλιακή ακτινοβολία × ~0,01 ως πρόχειρη εφεδρεία όταν λείπει ο δείκτης UV.',
            ],
            'sensors_used' => [
                'en' => ['UV index sensor', 'Solar radiation (fallback)'],
                'el' => ['Αισθητήρας δείκτη UV', 'Ηλιακή ακτινοβολία (εφεδρεία)'],
            ],
            'calculation_summary' => [
                'en' => 'Average UV index over the selected timeframe at the Gate House.',
                'el' => 'Μέσος δείκτης UV στο επιλεγμένο διάστημα στο Φυλάκιο.',
            ],
            'source_type' => 'measured',
            'limitations' => [
                'en' => 'Represents the Gate House sensor location only — not all outdoor areas of the campus.',
                'el' => 'Αντιπροσωπεύει μόνο τη θέση του αισθητήρα στο Φυλάκιο — όχι όλους τους εξωτερικούς χώρους.',
            ],
            'limitations_simple' => [
                'en' => 'This reflects the Gate House location, not every outdoor area.',
                'el' => 'Αντικατοπτρίζει το Φυλάκιο, όχι κάθε εξωτερικό χώρο.',
            ],
            'status_meanings' => [
                'good' => [
                    'en' => 'Low UV exposure risk — no protection needed.',
                    'el' => 'Χαμηλός κίνδυνος έκθεσης σε UV — δεν απαιτείται προστασία.',
                ],
                'warning' => [
                    'en' => 'Moderate UV exposure — wear sunscreen during peak hours.',
                    'el' => 'Μέτριος κίνδυνος UV — χρησιμοποιήστε αντηλιακό τις ώρες αιχμής.',
                ],
                'critical' => [
                    'en' => 'High UV exposure — limit time outside, use sunscreen and protective gear.',
                    'el' => 'Υψηλός κίνδυνος UV — περιορίστε τον χρόνο σε εξωτερικό χώρο, χρησιμοποιήστε αντηλιακό και προστασία.',
                ],
                'insufficient_data' => [
                    'en' => 'No UV/environmental sensor data is available for this location.',
                    'el' => 'Δεν υπάρχουν δεδομένα αισθητήρα UV / περιβάλλοντος για αυτή τη θέση.',
                ],
            ],
        ],

    ],
];
