<?php

namespace App\Services\KPI;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Read-only alignment audit for energy KPI inputs (no DB writes).
 */
class EnergyKpiAuditReporter
{
    public function __construct(
        private readonly KPIInputAssembler $assembler = new KPIInputAssembler()
    ) {
    }

    /**
     * @param array{
     *   sensor_ids?: array<int>|null,
     *   sensor_uids?: array<string>|null,
     *   timeframe?: string|null
     * } $context
     */
    public function build(array $context = []): array
    {
        $timeframe = KPIInputAssembler::resolveTimeframe($context['timeframe'] ?? null);
        $inputs = $this->assembler->assembleSummaryInputs(array_merge($context, ['timeframe' => $timeframe]));

        $warnings = [];
        $meterRows = $this->sampleEnergyMeters($context, 20);

        foreach ($meterRows as $row) {
            if (!empty($row['delta_capped'])) {
                $warnings[] = 'Meter '.$row['sensor_key'].' hit per-window delta cap (possible reset/spike).';
            }
            if (!empty($row['negative_raw_delta'])) {
                $warnings[] = 'Meter '.$row['sensor_key'].' had negative raw delta (counter reset).';
            }
        }

        $totalKwh = $inputs['total_energy_kwh_window'] ?? null;
        $estimatedPresence = $inputs['estimated_presence'] ?? null;
        $neiDenominator = ($estimatedPresence !== null && $estimatedPresence > 0)
            ? max(1.0, (float) $estimatedPresence)
            : null;
        $neiIntensity = ($totalKwh !== null && $neiDenominator !== null)
            ? round((float) $totalKwh / $neiDenominator, 4)
            : null;

        $baselineKwh = $inputs['baseline_kwh_7d'] ?? null;
        $total7d = $inputs['total_energy_kwh_7d'] ?? null;
        $activeKwh = $inputs['active_hours_kwh_7d'] ?? null;
        $baseRatio = ($baselineKwh !== null && $total7d !== null && $total7d > 0)
            ? round((float) $baselineKwh / (float) $total7d, 4)
            : null;

        return [
            'timeframe' => $timeframe,
            'inputs_summary' => [
                'energy_consumption_kwh_window' => $totalKwh,
                'estimated_presence' => $estimatedPresence,
                'movement_entries' => $inputs['movement_entries'] ?? null,
                'movement_exits' => $inputs['movement_exits'] ?? null,
                'occupancy_context_confidence' => $inputs['occupancy_context_confidence'] ?? 'none',
                'nei_denominator_used' => $neiDenominator,
                'intensity_kwh_per_estimated_person' => $neiIntensity,
                'baseline_kwh_7d' => $baselineKwh,
                'total_energy_kwh_7d' => $total7d,
                'active_hours_kwh_7d' => $activeKwh,
                'base_load_ratio' => $baseRatio,
                'baseline_state' => $this->resolveBaselineState($baseRatio),
                'detected_baseline_windows' => $inputs['detected_baseline_windows'] ?? null,
            ],
            'energy_sensors_found' => count($meterRows),
            'meters_with_enough_readings' => count(array_filter($meterRows, fn ($r) => ($r['points'] ?? 0) >= 2)),
            'meters' => $meterRows,
            'occupancy_context_available' => ($inputs['occupancy_context_confidence'] ?? 'none') !== 'none',
            'insufficient_cases' => array_values(array_filter([
                $totalKwh === null ? 'missing_energy_consumption_window' : null,
                $estimatedPresence === null ? 'missing_estimated_presence_for_nei' : null,
                ($baselineKwh === null || $total7d === null) ? 'missing_baseline_window_data' : null,
            ])),
            'warnings' => array_values(array_unique($warnings)),
            'formulas' => [
                'consumption' => 'SUM per-sensor MAX(energy_kwh) - MIN(energy_kwh), negative clamped, per-meter cap',
                'normalized_energy_intensity' => 'total_energy_kwh_window / max(estimated_presence, 1)',
                'base_load_index' => 'baseline_kwh_7d / total_energy_kwh_7d (off-hours + low-movement windows, rolling 7d)',
            ],
        ];
    }

    private function resolveBaselineState(?float $ratio): ?string
    {
        if ($ratio === null) {
            return null;
        }
        if ($ratio <= 0.6) {
            return 'efficient_baseline';
        }
        if ($ratio <= 0.85) {
            return 'elevated_standby_load';
        }

        return 'excessive_overnight_load';
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function sampleEnergyMeters(array $context, int $limit): array
    {
        try {
            $schema = DB::getSchemaBuilder();
        } catch (\Throwable $e) {
            return [];
        }

        if (!$schema->hasTable('readings') || !$schema->hasColumn('readings', 'energy_kwh')) {
            return [];
        }

        $scopeCol = $schema->hasColumn('readings', 'sensor_uid') ? 'sensor_uid' : (
            $schema->hasColumn('readings', 'sensor_id') ? 'sensor_id' : null
        );
        if ($scopeCol === null) {
            return [];
        }

        $windowStart = KPIInputAssembler::timeframeStart(
            KPIInputAssembler::resolveTimeframe($context['timeframe'] ?? null)
        );

        $q = DB::table('readings')
            ->select([
                $scopeCol,
                DB::raw('COUNT(*) as points'),
                DB::raw('MAX(energy_kwh) as max_kwh'),
                DB::raw('MIN(energy_kwh) as min_kwh'),
            ])
            ->where('measured_at', '>=', $windowStart)
            ->whereNotNull('energy_kwh')
            ->groupBy($scopeCol)
            ->orderByDesc('points')
            ->limit($limit);

        $rows = $q->get();
        $out = [];
        foreach ($rows as $r) {
            $max = (float) ($r->max_kwh ?? 0);
            $min = (float) ($r->min_kwh ?? 0);
            $raw = $max - $min;
            $delta = max(0.0, min(500000.0, $raw));
            $out[] = [
                'sensor_key' => (string) ($r->{$scopeCol} ?? ''),
                'points' => (int) ($r->points ?? 0),
                'consumption_kwh_delta' => $delta,
                'negative_raw_delta' => $raw < 0,
                'delta_capped' => $raw > 500000.0,
            ];
        }

        return $out;
    }
}
