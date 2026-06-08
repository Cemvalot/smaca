<?php

namespace App\Services\Public;

use App\Services\KPI\KPIInputAssembler;
use App\Services\KPI\KPIService;
use App\Services\Spatial\SpatialService;
use App\Services\Thresholds\ThresholdService;
use App\Support\SensorFreshnessClassifier;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PublicCampusSnapshotService
{
    private const CORE_MODULES = 4;

    public function build(): array
    {
        $totals = $this->buildTotals();
        $kpis = $this->loadModuleSummaries();
        $hero = $this->buildHero($kpis);
        $showcase = $this->buildShowcase($kpis, $hero);
        $chart = $this->buildChartSeries();

        return [
            'totals' => $totals,
            'hero' => $hero,
            'showcase' => $showcase,
            'chart' => $chart,
            'latest_update_at' => $this->latestUpdateAt(),
            'degraded' => false,
        ];
    }

    /**
     * @return array<string, int|string|null>
     */
    private function buildTotals(): array
    {
        $sensorsTotal = (int) DB::table('sensors')->count();
        $sensorsActive = (int) DB::table('sensors')->where('is_active', 1)->count();
        $freshness = $this->countFreshnessBuckets();

        return [
            'sensors' => $sensorsTotal,
            'sensors_active' => $sensorsActive,
            'sensors_reporting' => $freshness['online'],
            'sensors_delayed' => $freshness['delayed'],
            'sensors_offline' => $freshness['offline'],
            'modules' => self::CORE_MODULES,
            'active_alert_events' => (int) DB::table('alert_events')->where('status', 'active')->count(),
            'resolved_alerts_today' => (int) DB::table('alert_events')
                ->where('status', 'resolved')
                ->whereNotNull('resolved_at')
                ->whereDate('resolved_at', Carbon::today())
                ->count(),
            'enabled_alert_rules' => (int) DB::table('alerts')->where('is_enabled', 1)->count(),
        ];
    }

    /**
     * @return array{online:int,delayed:int,offline:int}
     */
    private function countFreshnessBuckets(): array
    {
        $classifier = new SensorFreshnessClassifier();
        $buckets = ['online' => 0, 'delayed' => 0, 'offline' => 0];

        $rows = DB::table('sensors as s')
            ->leftJoin('sensor_latest as sl', 'sl.sensor_id', '=', 's.id')
            ->select([
                's.id',
                's.name',
                's.device_type',
                's.is_active',
                's.last_seen_at',
                'sl.measured_at',
            ])
            ->get();

        foreach ($rows as $row) {
            $bucket = $classifier->classify($row);
            if (!isset($buckets[$bucket])) {
                $buckets['offline']++;
                continue;
            }
            $buckets[$bucket]++;
        }

        return $buckets;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function loadModuleSummaries(): array
    {
        try {
            $spatial = new SpatialService();
            $service = new KPIService(new KPIInputAssembler(), new ThresholdService(), $spatial);
            $timeframe = '24h';

            return [
                'iaq' => $service->getSummary('iaq', null, $timeframe),
                'energy' => $service->getSummary('energy', null, $timeframe),
                'occupancy' => $service->getSummary('occupancy', null, $timeframe),
                'environmental' => $service->getSummary('environmental', null, $timeframe),
            ];
        } catch (\Throwable $e) {
            Log::warning('PublicCampusSnapshotService: KPI summaries unavailable', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);

            return [
                'iaq' => ['kpis' => [], 'occupancy_metrics' => []],
                'energy' => ['kpis' => []],
                'occupancy' => ['kpis' => [], 'occupancy_metrics' => []],
                'environmental' => ['kpis' => []],
            ];
        }
    }

    /**
     * @param array<string, array<string, mixed>> $kpis
     * @return array<string, mixed>
     */
    private function buildHero(array $kpis): array
    {
        $co2 = $this->resolveCampusCo2Ppm($kpis['iaq'] ?? []);
        $occupancyBalance = $this->toFloat($kpis['occupancy']['occupancy_metrics']['remaining_inside'] ?? null);
        $energyIntensity = $this->findKpiValue($kpis['energy'] ?? [], 'normalized_energy_intensity');
        $uvIndex = $this->findKpiValue($kpis['environmental'] ?? [], 'uv_exposure_risk');

        return [
            'co2_ppm' => $co2,
            'co2_label' => $co2 !== null ? $this->formatNumber($co2, 0) . ' ppm' : null,
            'occupancy_balance' => $occupancyBalance,
            'occupancy_label' => $occupancyBalance !== null
                ? $this->formatNumber($occupancyBalance, 0) . ' ' . __('messages.dashboard_i18n.overview_estimated_balance_unit')
                : null,
            'energy_intensity' => $energyIntensity,
            'energy_label' => $energyIntensity !== null
                ? $this->formatNumber($energyIntensity, 2) . ' kWh/person'
                : null,
            'uv_index' => $uvIndex,
            'uv_label' => $uvIndex !== null ? $this->formatNumber($uvIndex, 1) . ' UV' : null,
        ];
    }

    /**
     * @param array<string, array<string, mixed>> $kpis
     * @param array<string, mixed> $hero
     * @return array<string, mixed>
     */
    private function buildShowcase(array $kpis, array $hero): array
    {
        $avgCo2 = $hero['co2_ppm'];
        $peak = $this->toFloat($kpis['occupancy']['occupancy_metrics']['peak'] ?? null);
        $energyIntensity = $hero['energy_intensity'];
        $movement = $this->findKpiValue($kpis['occupancy'] ?? [], 'movement_activity_index');

        return [
            'avg_co2_ppm' => $avgCo2,
            'avg_co2_label' => $avgCo2 !== null ? $this->formatNumber($avgCo2, 0) . ' ppm' : null,
            'occupancy_peak' => $peak,
            'occupancy_peak_label' => $peak !== null
                ? $this->formatNumber($peak, 0) . ' ' . __('messages.public.occupancy_peak_entries')
                : ($movement !== null ? $this->formatNumber($movement, 1) . ' events/h' : null),
            'energy_intensity' => $energyIntensity,
            'energy_label' => $energyIntensity !== null
                ? $this->formatNumber($energyIntensity, 2) . ' kWh/person'
                : null,
        ];
    }

    /**
     * @return array{categories: array<int, string>, co2: array<int, float>, occupancy: array<int, float>}
     */
    private function buildChartSeries(): array
    {
        $hours = 8;
        $categories = [];
        $co2 = [];
        $occupancy = [];

        for ($i = $hours - 1; $i >= 0; $i--) {
            $start = Carbon::now()->startOfHour()->subHours($i);
            $end = $start->copy()->addHour();
            $categories[] = $start->format('H:i');

            $avgCo2 = DB::table('readings')
                ->where('measured_at', '>=', $start)
                ->where('measured_at', '<', $end)
                ->whereNotNull('co2_ppm')
                ->avg('co2_ppm');
            $co2[] = $avgCo2 !== null ? round((float) $avgCo2, 1) : null;

            $peopleIn = DB::table('readings')
                ->where('measured_at', '>=', $start)
                ->where('measured_at', '<', $end)
                ->whereNotNull('people_in')
                ->sum('people_in');
            $occupancy[] = $peopleIn !== null ? round((float) $peopleIn, 1) : 0.0;
        }

        $co2 = $this->fillNullsWithLastKnown($co2);
        $occupancy = array_map(static fn ($value) => $value ?? 0.0, $occupancy);

        return [
            'categories' => $categories,
            'co2' => $co2,
            'occupancy' => $occupancy,
        ];
    }

    /**
     * @param array<string, mixed> $modulePayload
     */
    private function resolveCampusCo2Ppm(array $modulePayload): ?float
    {
        try {
            $inputs = (new KPIInputAssembler())->assembleSummaryInputs(['timeframe' => '24h']);
            $fromWindow = $this->toFloat($inputs['avg_co2_ppm'] ?? null);
            if ($fromWindow !== null) {
                return round($fromWindow, 1);
            }
        } catch (\Throwable $e) {
            Log::warning('PublicCampusSnapshotService: CO₂ assembler fallback', [
                'message' => $e->getMessage(),
            ]);
        }

        $avg = DB::table('sensor_latest')->whereNotNull('co2_ppm')->avg('co2_ppm');
        if ($avg !== null) {
            return round((float) $avg, 1);
        }

        $max = DB::table('sensor_latest')->whereNotNull('co2_ppm')->max('co2_ppm');
        return $max !== null ? round((float) $max, 1) : null;
    }

    /**
     * @param array<string, mixed> $modulePayload
     */
    private function findKpiValue(array $modulePayload, string $key): ?float
    {
        foreach ($modulePayload['kpis'] ?? [] as $kpi) {
            if (!is_array($kpi) || ($kpi['key'] ?? null) !== $key) {
                continue;
            }
            return $this->toFloat($kpi['value'] ?? null);
        }

        return null;
    }

    private function latestUpdateAt(): ?string
    {
        $latest = DB::table('sensor_latest')->max('measured_at');
        if ($latest === null) {
            return null;
        }

        try {
            return Carbon::parse((string) $latest)->toIso8601String();
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * @param array<int, float|null> $values
     * @return array<int, float>
     */
    private function fillNullsWithLastKnown(array $values): array
    {
        $lastKnown = null;
        $filled = [];

        foreach ($values as $value) {
            if ($value !== null) {
                $lastKnown = (float) $value;
            }
            $filled[] = $lastKnown ?? 0.0;
        }

        return $filled;
    }

    private function toFloat($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (!is_numeric($value)) {
            return null;
        }

        return (float) $value;
    }

    private function formatNumber(float $value, int $decimals): string
    {
        return number_format($value, $decimals, '.', '');
    }
}
