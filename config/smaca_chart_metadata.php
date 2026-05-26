<?php

/**
 * SMACA Chart Metadata — explanation layer for every dashboard chart panel.
 *
 * The frontend module `smaca-chart-explainer.js` reads this dictionary (via the
 * `window.SMACA_CHART_METADATA` bootstrap in app.blade.php) and injects an
 * expandable "How to read this chart" panel directly under each chart's
 * container. The panel contains:
 *
 *   - what               : what the chart shows
 *   - data_source        : which sensors / measurements feed the chart
 *   - how_to_read        : how to interpret peaks / trends
 *   - timeframe_note     : how the selected dashboard timeframe applies
 *   - actions            : what actions this chart can trigger
 *   - limitations        : caveats (especially for proxy / partial-data charts)
 *
 * Strings are bilingual (EN / EL); the active locale is resolved at runtime.
 *
 * NOTE: keep public-safe — exposed via /api/config/charts (read-only).
 */

return [

    'version' => '1.0.0',

    'charts' => [

        // ============================================================ Overview
        'overview-campus-trend-chart' => [
            'category' => 'Overview',
            'title' => [
                'en' => 'Campus trend',
                'el' => 'Τάση Campus',
            ],
            'what' => [
                'en' => 'Combined trend of CO₂, occupancy proxy and connectivity for the whole campus over the selected timeframe.',
                'el' => 'Συνδυαστική τάση CO₂, υποκατάστατου πληρότητας και συνδεσιμότητας για όλο το campus στο επιλεγμένο διάστημα.',
            ],
            'data_source' => [
                'en' => 'IAQ sensors + people counters + sensor heartbeat status, aggregated campus-wide.',
                'el' => 'Αισθητήρες IAQ + μετρητές ατόμων + ένδειξη παλμού αισθητήρων, αθροιστικά σε όλο το campus.',
            ],
            'how_to_read' => [
                'en' => 'Look for sustained spikes in CO₂ or sudden drops in connectivity. Compare overlapping lines to spot correlations.',
                'el' => 'Αναζητήστε επίμονες κορυφές CO₂ ή απότομες πτώσεις συνδεσιμότητας. Συγκρίνετε γραμμές για συσχετίσεις.',
            ],
            'timeframe_note' => [
                'en' => 'Buckets follow the selected timeframe (24h → hourly, 7d / 30d → daily).',
                'el' => 'Τα κάδοι ακολουθούν το επιλεγμένο διάστημα (24h → ωριαία, 7d / 30d → ημερήσια).',
            ],
            'actions' => [
                'en' => 'If air quality drops at the same time as occupancy spikes, plan ventilation.',
                'el' => 'Αν η ποιότητα αέρα πέφτει όταν αυξάνεται η πληρότητα, προγραμματίστε αερισμό.',
            ],
            'limitations' => [
                'en' => 'Aggregated campus view smooths out per-zone peaks — drill into IAQ / Occupancy pages for detail.',
                'el' => 'Η συγκεντρωτική εικόνα ομαλοποιεί κορυφές ανά ζώνη — δείτε τις σελίδες IAQ / Πληρότητας για λεπτομέρειες.',
            ],
        ],

        // ================================================================= IAQ
        'iaq-co2-band-chart' => [
            'category' => 'IAQ',
            'title' => [
                'en' => 'IAQ trend',
                'el' => 'Τάση IAQ',
            ],
            'what' => [
                'en' => 'Time-series of the selected IAQ metric (CO₂ by default) for the selected location.',
                'el' => 'Χρονοσειρά του επιλεγμένου δείκτη IAQ (CO₂ προεπιλογή) για την επιλεγμένη τοποθεσία.',
            ],
            'data_source' => [
                'en' => 'IAQ trend uses available air-quality measurements (CO₂, TVOC, PM2.5, PM10) for the selected location and timeframe.',
                'el' => 'Η τάση IAQ χρησιμοποιεί τις διαθέσιμες μετρήσεις ποιότητας αέρα (CO₂, TVOC, PM2.5, PM10) για την επιλεγμένη τοποθεσία και διάστημα.',
            ],
            'how_to_read' => [
                'en' => 'Bands shade good / warning / critical zones. Sustained values inside warning or critical bands need ventilation action.',
                'el' => 'Οι ζώνες χρωματίζουν καλή / προειδοποίηση / κρίσιμη ζώνη. Επίμονες τιμές σε προειδοποίηση ή κρίσιμη ζώνη απαιτούν δράση αερισμού.',
            ],
            'timeframe_note' => [
                'en' => 'Granularity: 24h → minute / hourly, 7d → hourly, 30d → daily.',
                'el' => 'Ανάλυση: 24h → λεπτό / ωριαία, 7d → ωριαία, 30d → ημερήσια.',
            ],
            'actions' => [
                'en' => 'Increase ventilation during sustained warning / critical bands; investigate sources during repeated spikes.',
                'el' => 'Αυξήστε τον αερισμό σε επίμονες προειδοποιήσεις / κρίσιμα διαστήματα· διερευνήστε πηγές σε επαναλαμβανόμενες κορυφές.',
            ],
            'limitations' => [
                'en' => 'If the selected location has no IAQ sensor, the chart shows an empty state — switch zones in the location picker.',
                'el' => 'Αν η επιλεγμένη τοποθεσία δεν έχει αισθητήρα IAQ, το γράφημα είναι κενό — αλλάξτε ζώνη.',
            ],
        ],

        'iaq-hourly-heatstrip-panel' => [
            'category' => 'IAQ',
            'title' => [
                'en' => 'Hourly IAQ heat-strip',
                'el' => 'Ωριαία λωρίδα θερμότητας IAQ',
            ],
            'what' => [
                'en' => 'Heat-strip showing hourly intensity of the selected IAQ metric across the timeframe.',
                'el' => 'Λωρίδα έντασης ανά ώρα του επιλεγμένου δείκτη IAQ για το διάστημα.',
            ],
            'data_source' => [
                'en' => 'Same IAQ measurements as the trend chart, bucketed per hour.',
                'el' => 'Ίδιες μετρήσεις IAQ με το γράφημα τάσης, ομαδοποιημένες ανά ώρα.',
            ],
            'how_to_read' => [
                'en' => 'Darker / warmer cells = higher IAQ stress in that hour. Vertical patterns reveal recurring time-of-day issues.',
                'el' => 'Σκουρότερα / πιο θερμά κελιά = μεγαλύτερη επιβάρυνση IAQ. Κατακόρυφα μοτίβα δείχνουν επαναλαμβανόμενα προβλήματα ώρας.',
            ],
            'timeframe_note' => [
                'en' => 'Always uses the selected timeframe (24h, 7d, or 30d).',
                'el' => 'Χρησιμοποιεί πάντα το επιλεγμένο διάστημα (24h, 7d ή 30d).',
            ],
            'actions' => [
                'en' => 'Use the recurring hot hours to plan scheduled ventilation.',
                'el' => 'Χρησιμοποιήστε τις επαναλαμβανόμενες θερμές ώρες για προγραμματισμένο αερισμό.',
            ],
            'limitations' => [
                'en' => 'Empty cells indicate hours with no readings, not necessarily good IAQ.',
                'el' => 'Τα κενά κελιά υποδεικνύουν ώρες χωρίς μετρήσεις, όχι απαραίτητα καλή IAQ.',
            ],
        ],

        // =========================================================== Occupancy
        'occupancy-flow-chart' => [
            'category' => 'Occupancy',
            'title' => [
                'en' => 'Entry/Exit Flow Over Time',
                'el' => 'Ροή Εισόδων/Εξόδων στον Χρόνο',
            ],
            'what' => [
                'en' => 'Entry and exit movement events per bucket, plus remaining inside derived from those counters across the selected timeframe.',
                'el' => 'Γεγονότα εισόδου/εξόδου ανά κάδο, συν παραμένοντες εντός από τους ίδιους μετρητές στο επιλεγμένο διάστημα.',
            ],
            'data_source' => [
                'en' => 'Passage counters (people_in / people_out). The remaining-inside line is max(0, cumulative entries − exits) for the selected timeframe, derived from entry/exit counters, not live headcount.',
                'el' => 'Μετρητές περάσματος (people_in / people_out). Η γραμμή παραμένοντες εντός είναι max(0, αθροιστικές είσοδοι − έξοδοι) για το επιλεγμένο διάστημα, από μετρητές εισόδου/εξόδου, όχι ζωντανό headcount.',
            ],
            'how_to_read' => [
                'en' => 'Compare entries and exits to see movement bursts. The remaining-inside line shows how many people are estimated inside based on those counters for the selected timeframe.',
                'el' => 'Συγκρίνετε εισόδους και εξόδους για κύματα κίνησης. Η γραμμή παραμένοντες εντός δείχνει πόσοι εκτιμώνται εντός από τους μετρητές στο επιλεγμένο διάστημα.',
            ],
            'timeframe_note' => [
                'en' => 'Buckets follow the selected timeframe (24h → 1h buckets, 7d / 30d → 1d buckets).',
                'el' => 'Οι κάδοι ακολουθούν το επιλεγμένο διάστημα (24h → ώρα, 7d / 30d → ημέρα).',
            ],
            'actions' => [
                'en' => 'Identify recurring peak hours and align building services / cleaning to them.',
                'el' => 'Εντοπίστε επαναλαμβανόμενες ώρες αιχμής και προσαρμόστε υπηρεσίες κτιρίου / καθαριότητα.',
            ],
            'limitations' => [
                'en' => 'Same person walking back and forth produces multiple events. This chart shows movement, not headcount.',
                'el' => 'Το ίδιο άτομο που πηγαινοέρχεται παράγει πολλαπλές διελεύσεις. Δείχνει κίνηση, όχι πραγματικό αριθμό ατόμων.',
            ],
        ],

        'occupancy-density-timeline' => [
            'category' => 'Occupancy',
            'title' => [
                'en' => 'Occupancy activity timeline',
                'el' => 'Χρονοδιάγραμμα δραστηριότητας πληρότητας',
            ],
            'what' => [
                'en' => 'Events-per-hour timeline aggregated across all in-scope passages.',
                'el' => 'Χρονοδιάγραμμα διελεύσεων ανά ώρα από όλα τα περάσματα της εμβέλειας.',
            ],
            'data_source' => [
                'en' => 'Per-passage counters summed and normalised to events/h. Same primitive as the Crowd Density / Movement Activity KPI.',
                'el' => 'Μετρητές ανά πέρασμα αθροισμένοι και κανονικοποιημένοι σε διελεύσεις/ώρα. Ίδια πρωτογενή δεδομένα με το KPI Πυκνότητας / Κίνησης.',
            ],
            'how_to_read' => [
                'en' => 'Sustained high values indicate prolonged busy periods rather than instantaneous spikes.',
                'el' => 'Επίμονες υψηλές τιμές υποδηλώνουν παρατεταμένες περιόδους κίνησης παρά στιγμιαίες κορυφές.',
            ],
            'timeframe_note' => [
                'en' => 'Always reflects the selected dashboard timeframe.',
                'el' => 'Αντικατοπτρίζει πάντα το επιλεγμένο διάστημα του dashboard.',
            ],
            'actions' => [
                'en' => 'Sustained heavy flow → consider crowd-flow controls or alternative routing.',
                'el' => 'Επίμονη έντονη ροή → εξετάστε ελέγχους ροής ή εναλλακτικές διαδρομές.',
            ],
            'limitations' => [
                'en' => 'Movement counters do not equal room occupancy.',
                'el' => 'Οι μετρητές κίνησης δεν ισοδυναμούν με πληρότητα χώρου.',
            ],
        ],

        // ============================================================== Energy
        'energy-main-combined-chart' => [
            'category' => 'Energy',
            'title' => [
                'en' => 'Energy usage',
                'el' => 'Κατανάλωση ενέργειας',
            ],
            'what' => [
                'en' => 'kWh consumed per bucket (columns) and cumulative consumed kWh (spline) for the selected timeframe — from cumulative meter deltas (MAX−MIN), not the latest reading.',
                'el' => 'kWh ανά κάδο (στήλες) και αθροιστική κατανάλωση kWh (καμπύλη) στο επιλεγμένο διάστημα — από deltas μετρητών (MAX−MIN), όχι την τελευταία ένδειξη.',
            ],
            'data_source' => [
                'en' => 'kWh per bucket from cumulative meter deltas (MAX−MIN energy_kwh per sensor), summed across meters — not the latest meter reading.',
                'el' => 'kWh ανά κάδο από deltas αθροιστικών μετρητών (MAX−MIN energy_kwh ανά αισθητήρα), αθροισμένα — όχι η τελευταία ένδειξη μετρητή.',
            ],
            'how_to_read' => [
                'en' => 'Tall columns = energy-heavy buckets. The spline shows cumulative usage — its slope is the average rate.',
                'el' => 'Ψηλές στήλες = κάδοι υψηλής κατανάλωσης. Η καμπύλη δείχνει αθροιστική κατανάλωση — η κλίση της είναι ο μέσος ρυθμός.',
            ],
            'timeframe_note' => [
                'en' => 'Bucket size: 24h → 1h, 7d → 1d, 30d → 1d.',
                'el' => 'Μέγεθος κάδου: 24h → 1h, 7d → 1d, 30d → 1d.',
            ],
            'actions' => [
                'en' => 'Line up high columns with occupancy peaks to spot inefficient use.',
                'el' => 'Συσχετίστε ψηλές στήλες με κορυφές πληρότητας για να εντοπίσετε ανεπαρκή χρήση.',
            ],
            'limitations' => [
                'en' => 'Sensors with no readings in the timeframe are excluded automatically; the chart shows only metered locations.',
                'el' => 'Αισθητήρες χωρίς μετρήσεις εξαιρούνται αυτόματα· το γράφημα δείχνει μόνο μετρούμενες τοποθεσίες.',
            ],
        ],

        'energy-demand-trend-chart' => [
            'category' => 'Energy',
            'title' => [
                'en' => 'Demand trend',
                'el' => 'Τάση ζήτησης',
            ],
            'what' => [
                'en' => 'Peak demand (kW) and/or current (A) when reported by meters, over the selected timeframe (not cumulative kWh reading).',
                'el' => 'Αιχμή ζήτησης (kW) ή/και ρεύμα (A) όταν αναφέρεται από μετρητές, στο επιλεγμένο διάστημα (όχι αθροιστική ένδειξη kWh).',
            ],
            'data_source' => [
                'en' => 'Energy meter `max_demand_kw` and `current_a` fields when reported by the meter.',
                'el' => 'Πεδία μετρητή `max_demand_kw` και `current_a` όταν διαθέσιμα.',
            ],
            'how_to_read' => [
                'en' => 'Sharp upward deflections indicate sudden loads being switched on. A flat ceiling suggests demand-limit clipping.',
                'el' => 'Απότομες ανοδικές μεταβολές υποδεικνύουν ξαφνικά φορτία. Επίπεδη οροφή υποδηλώνει περιορισμό αιχμής.',
            ],
            'timeframe_note' => [
                'en' => 'Aligned with the dashboard timeframe selector.',
                'el' => 'Ευθυγραμμισμένο με τον επιλογέα διαστήματος.',
            ],
            'actions' => [
                'en' => 'Recurring peaks → schedule loads, consider load-shedding rules.',
                'el' => 'Επαναλαμβανόμενες κορυφές → προγραμματίστε φορτία, εξετάστε κανόνες απομείωσης φορτίου.',
            ],
            'limitations' => [
                'en' => 'Some meters do not report `max_demand_kw`; the panel may show only current draw.',
                'el' => 'Ορισμένοι μετρητές δεν αναφέρουν `max_demand_kw`· το γράφημα μπορεί να δείχνει μόνο ρεύμα.',
            ],
        ],

        'energy-usage-pattern-hour-chart' => [
            'category' => 'Energy',
            'title' => [
                'en' => 'Usage pattern by hour',
                'el' => 'Πρότυπο χρήσης ανά ώρα',
            ],
            'what' => [
                'en' => 'Average energy usage per hour-of-day, coloured by intensity.',
                'el' => 'Μέση κατανάλωση ενέργειας ανά ώρα της ημέρας, χρωματισμένη βάσει έντασης.',
            ],
            'data_source' => [
                'en' => 'Same meters as the main energy chart, re-bucketed by hour-of-day.',
                'el' => 'Ίδιοι μετρητές με το κύριο γράφημα ενέργειας, ομαδοποιημένοι ανά ώρα της ημέρας.',
            ],
            'how_to_read' => [
                'en' => 'High columns at off-hours indicate always-on equipment. Compare with Base Load Index.',
                'el' => 'Ψηλές στήλες σε ώρες εκτός λειτουργίας υποδεικνύουν εξοπλισμό σε συνεχή λειτουργία. Συγκρίνετε με Base Load Index.',
            ],
            'timeframe_note' => [
                'en' => 'Aggregated over the selected timeframe; hour-of-day stays consistent.',
                'el' => 'Αθροιστικά στο επιλεγμένο διάστημα· οι ώρες της ημέρας μένουν σταθερές.',
            ],
            'actions' => [
                'en' => 'Match peak hours to building schedule; investigate off-hours peaks.',
                'el' => 'Συσχετίστε τις ώρες αιχμής με το πρόγραμμα του κτιρίου· διερευνήστε αιχμές εκτός ωρών.',
            ],
            'limitations' => [
                'en' => 'Pattern smooths out one-off events; use Demand Trend for those.',
                'el' => 'Το μοτίβο εξομαλύνει μεμονωμένα συμβάντα· χρησιμοποιήστε την τάση ζήτησης γι\' αυτά.',
            ],
        ],

        'energy-distribution-location-chart' => [
            'category' => 'Energy',
            'title' => [
                'en' => 'Energy distribution by location',
                'el' => 'Κατανομή ενέργειας ανά τοποθεσία',
            ],
            'what' => [
                'en' => 'Total kWh per location for the selected timeframe.',
                'el' => 'Συνολικά kWh ανά τοποθεσία για το επιλεγμένο διάστημα.',
            ],
            'data_source' => [
                'en' => 'Per-meter delta (last − first reading per timeframe), grouped by `sensor_location`. Locations are rendered as human-readable names.',
                'el' => 'Διαφορά ανά μετρητή (τελευταία − πρώτη ένδειξη), ομαδοποιημένη ανά `sensor_location`. Οι τοποθεσίες εμφανίζονται με ονόματα.',
            ],
            'how_to_read' => [
                'en' => 'Top columns identify the highest-consumption locations of the campus.',
                'el' => 'Οι ψηλές στήλες αναδεικνύουν τις τοποθεσίες με την υψηλότερη κατανάλωση.',
            ],
            'timeframe_note' => [
                'en' => 'Reflects the selected timeframe; absolute values scale with longer windows.',
                'el' => 'Αντικατοπτρίζει το επιλεγμένο διάστημα· οι τιμές κλιμακώνονται σε μεγαλύτερα παράθυρα.',
            ],
            'actions' => [
                'en' => 'Top consumers usually hold the largest savings potential.',
                'el' => 'Οι κορυφαίοι καταναλωτές συνήθως έχουν τη μεγαλύτερη δυνατότητα εξοικονόμησης.',
            ],
            'limitations' => [
                'en' => 'Only locations with at least one valid energy meter are shown.',
                'el' => 'Εμφανίζονται μόνο τοποθεσίες με τουλάχιστον έναν έγκυρο μετρητή.',
            ],
        ],

        'energy-share-donut-chart' => [
            'category' => 'Energy',
            'title' => [
                'en' => 'Energy share',
                'el' => 'Μερίδιο ενέργειας',
            ],
            'what' => [
                'en' => 'Same data as the distribution chart, shown as % shares.',
                'el' => 'Ίδια δεδομένα με το γράφημα κατανομής, ως ποσοστιαία μερίδια.',
            ],
            'data_source' => [
                'en' => 'Per-location kWh delta, normalised to a percentage of total.',
                'el' => 'Διαφορά kWh ανά τοποθεσία, κανονικοποιημένη σε ποσοστό του συνόλου.',
            ],
            'how_to_read' => [
                'en' => 'Large slices = locations dominating overall consumption.',
                'el' => 'Μεγάλα τμήματα = τοποθεσίες που κυριαρχούν στη συνολική κατανάλωση.',
            ],
            'timeframe_note' => [
                'en' => 'Same timeframe as the parent dashboard.',
                'el' => 'Ίδιο διάστημα με το dashboard.',
            ],
            'actions' => [
                'en' => 'Focus optimisation on the largest slices first.',
                'el' => 'Εστιάστε τη βελτιστοποίηση στα μεγαλύτερα τμήματα πρώτα.',
            ],
            'limitations' => [
                'en' => 'Shares hide absolute scale — pair with the distribution chart.',
                'el' => 'Τα μερίδια κρύβουν την απόλυτη κλίμακα — συνδυάστε με το γράφημα κατανομής.',
            ],
        ],

        // ======================================================= Solar Exposure (UV)
        'uv-main-chart' => [
            'category' => 'Solar Exposure (UV)',
            'title' => [
                'en' => 'UV index trend',
                'el' => 'Τάση δείκτη UV',
            ],
            'what' => [
                'en' => 'UV index measured at the Gate House sensor over the selected timeframe.',
                'el' => 'Δείκτης UV στο Φυλάκιο Εισόδου στο επιλεγμένο διάστημα.',
            ],
            'data_source' => [
                'en' => 'UV risk reflects outdoor exposure at the Gate House sensor location.',
                'el' => 'Ο κίνδυνος UV αντικατοπτρίζει την εξωτερική έκθεση στη θέση αισθητήρα του Φυλακίου.',
            ],
            'how_to_read' => [
                'en' => 'Values 0–2 are low risk, 3–5 moderate, 6+ high. Daily peaks usually align with solar noon.',
                'el' => 'Τιμές 0–2 χαμηλός κίνδυνος, 3–5 μέτριος, 6+ υψηλός. Οι κορυφές συνήθως γύρω από το μεσημέρι.',
            ],
            'timeframe_note' => [
                'en' => 'Reflects the selected timeframe; longer windows show more day-to-day variation.',
                'el' => 'Αντικατοπτρίζει το επιλεγμένο διάστημα· μεγαλύτερα παράθυρα δείχνουν διακυμάνσεις ημερών.',
            ],
            'actions' => [
                'en' => 'When sustained values are ≥ 6, advise sunscreen and protective gear for outdoor staff.',
                'el' => 'Με επίμονες τιμές ≥ 6, συστήστε αντηλιακό και προστασία για το προσωπικό σε εξωτερικό χώρο.',
            ],
            'limitations' => [
                'en' => 'Single-sensor reading at the Gate House — not representative of every outdoor area.',
                'el' => 'Ένδειξη ενός αισθητήρα στο Φυλάκιο — δεν αντιπροσωπεύει κάθε εξωτερικό χώρο.',
            ],
        ],

        'uv-pattern-chart' => [
            'category' => 'Solar Exposure (UV)',
            'title' => [
                'en' => 'Hourly UV pattern',
                'el' => 'Ωριαίο μοτίβο UV',
            ],
            'what' => [
                'en' => 'Average UV index by hour-of-day across the selected timeframe.',
                'el' => 'Μέσος δείκτης UV ανά ώρα της ημέρας στο επιλεγμένο διάστημα.',
            ],
            'data_source' => [
                'en' => 'Same Gate House sensor as the main chart, re-bucketed by hour-of-day.',
                'el' => 'Ίδιος αισθητήρας Φυλακίου, ομαδοποιημένος ανά ώρα της ημέρας.',
            ],
            'how_to_read' => [
                'en' => 'Tall columns near solar noon are normal; off-peak peaks suggest reflective surfaces or partial cloud bursts.',
                'el' => 'Ψηλές στήλες κοντά στο μεσημέρι είναι φυσιολογικές· κορυφές εκτός υποδηλώνουν αντανακλάσεις ή μερική νέφωση.',
            ],
            'timeframe_note' => [
                'en' => 'Pattern is averaged over the selected timeframe.',
                'el' => 'Το μοτίβο είναι μέσος όρος στο επιλεγμένο διάστημα.',
            ],
            'actions' => [
                'en' => 'Use peak-hour pattern to schedule outdoor activities.',
                'el' => 'Χρησιμοποιήστε το μοτίβο αιχμής για προγραμματισμό εξωτερικών δραστηριοτήτων.',
            ],
            'limitations' => [
                'en' => 'Single sensor; weather variability is averaged out.',
                'el' => 'Ένας αισθητήρας· η μεταβλητότητα καιρού εξομαλύνεται.',
            ],
        ],

        'uv-daily-comparison-chart' => [
            'category' => 'Solar Exposure (UV)',
            'title' => [
                'en' => 'Daily UV comparison',
                'el' => 'Ημερήσια σύγκριση UV',
            ],
            'what' => [
                'en' => 'Day-by-day UV peaks and averages over the selected timeframe.',
                'el' => 'Ημερήσιες κορυφές και μέσοι όροι UV στο επιλεγμένο διάστημα.',
            ],
            'data_source' => [
                'en' => 'Gate House UV index, aggregated per day.',
                'el' => 'Δείκτης UV Φυλακίου, αθροιστικά ανά ημέρα.',
            ],
            'how_to_read' => [
                'en' => 'Compare consecutive days to spot weather-related shifts vs steady seasonal trend.',
                'el' => 'Συγκρίνετε διαδοχικές ημέρες για μεταβολές καιρού έναντι σταθερής εποχιακής τάσης.',
            ],
            'timeframe_note' => [
                'en' => 'Most useful at 7d / 30d; collapses to a single point at 24h.',
                'el' => 'Πιο χρήσιμο σε 7d / 30d· συμπτύσσεται σε ένα σημείο στο 24h.',
            ],
            'actions' => [
                'en' => 'Plan outdoor activities for the lowest-risk days.',
                'el' => 'Προγραμματίστε εξωτερικές δραστηριότητες σε ημέρες με τη χαμηλότερη επικινδυνότητα.',
            ],
            'limitations' => [
                'en' => 'Aggregation hides intra-day spikes — pair with the trend chart.',
                'el' => 'Η συγκέντρωση κρύβει ενδοημερήσιες κορυφές — συνδυάστε με το γράφημα τάσης.',
            ],
        ],

    ],
];
