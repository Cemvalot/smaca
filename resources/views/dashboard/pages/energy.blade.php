@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section" id="energy" data-section="energy">
  <div class="section-hero section-hero--energy">
    <div class="section-hero__inner">
      <div>
        <div class="section-hero__title-row">
          @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'energy', 'size' => 'hero', 'class' => 'section-hero__icon'])
          <h2 class="section-hero__title">{{ __('messages.nav.energy') }}</h2>
        </div>
        <p class="section-hero__subtitle">{{ __('messages.dashboard_i18n.energy_hero_subtitle') }}</p>
      </div>
      <div class="section-hero__stat">
        <div id="energy-daily-consumption" class="section-hero__stat-value">{{ __('messages.common.loading') }}...</div>
        <div class="section-hero__stat-label">{{ __('messages.dashboard_i18n.kwh_today') }}</div>
      </div>
    </div>
  </div>
  <div class="section-meta">
    <span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">{{ __('messages.dashboard.live') }}</span>
    <span class="last-updated-pill" title="Time since last data sync">{{ __('messages.dashboard.last_update') }}: {{ __('messages.common.loading') }}...</span>
  </div>
  <section class="card" style="margin-top: var(--space-6);">
    <div class="card__header">
      <h3 class="card__title">{{ __('messages.dashboard_i18n.kpi_title_energy') }}</h3>
    </div>
    <div class="card__body">
      <p class="overview-live-note" style="margin-bottom: var(--space-2);">{{ __('messages.dashboard_i18n.kpi_intro_energy') }}</p>
      <p class="overview-live-note" style="margin-bottom: var(--space-3); font-size: 11px;">{{ __('messages.dashboard_i18n.kpi_note_occupancy_estimate') }}</p>
      <div id="energy-kpi-summary-cards" data-kpi-module="energy" class="grid grid--metrics grid--metrics-2">
        <article class="stat-card overview-kpi-card"><div class="stat-card__content"><div class="stat-card__label">KPI</div><div class="stat-card__value">--</div></div></article>
      </div>
    </div>
  </section>

  <section class="card smaca-telemetry-card">
    <div class="card__header">
      <h3 class="card__title">{{ __('messages.nav.energy') }} · {{ __('messages.dashboard.live') }}</h3>
      <p class="card__subtitle">{{ __('messages.dashboard_i18n.overview_realtime_snapshot') }}</p>
    </div>
    <div class="card__body">
      <div class="smaca-tg smaca-tg--rich" data-smaca-telemetry="energy">
        <div data-tile="energy-by-area"  class="smaca-tile--w6"></div>
        <div data-tile="load-profile"    class="smaca-tile--w6"></div>
        <div data-tile="energy-share"    class="smaca-tile--w4"></div>
        <div data-tile="base-load"       class="smaca-tile--w4"></div>
        <div data-tile="peak-hour"       class="smaca-tile--w4"></div>
      </div>
    </div>
  </section>

  {{-- Legacy `#energy-kpi-grid` (Total / Peak / Avg / Top Contributor)
       removed from the rendered DOM: the new top telemetry section
       already shows the same information more clearly via the
       energy-by-area ranked bar (top contributors), the load-profile
       heat strip (peaks) and the energy-share donut (totals).
       Inert anchors retained so legacy bootstrap JS that still tries
       to write to these IDs does not throw. --}}
  <div data-smaca-legacy-energy-anchors hidden aria-hidden="true">
    <span id="energy-kpi-total"></span><span id="energy-kpi-total-meta"></span>
    <span id="energy-kpi-peak"></span><span id="energy-kpi-peak-meta"></span>
    <span id="energy-kpi-avg"></span><span id="energy-kpi-avg-meta"></span>
    <span id="energy-kpi-top-location"></span><span id="energy-kpi-top-location-meta"></span>
  </div>

  <!-- Main chart -->
  <div class="card" style="margin-top: var(--space-6);">
    <div class="card__header">
      <h3 class="card__title">{{ __('messages.dashboard_i18n.energy_usage_kwh') }}</h3>
      <p data-energy-chart-subtitle="usage" style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.columns_spline_energy') }}</p>
    </div>
    <div class="card__body">
      <div class="chart-placeholder" id="energy-main-combined-chart" style="min-height: 360px;"></div>
      <div class="smaca-accordion smaca-accordion--collapsed">
        <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
          <span>{{ __('messages.status.what_is_this_graph') }}</span>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
        <div class="smaca-accordion__body" hidden>
          <div class="accordion-content">
            <p><strong>Columns:</strong> kWh consumed per bucket (cumulative meter MAX−MIN deltas, selected timeframe).</p>
            <p><strong>Spline:</strong> running total of consumed kWh across buckets — not the latest meter reading.</p>
            <p><strong>Dashed plotLine:</strong> average bucket consumption for the selected timeframe.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  {{-- Removed three duplicates that the new top telemetry section
       already covers more clearly:
         · usage-pattern-by-hour  → covered by load-profile heat strip
         · distribution-by-location → covered by energy-by-area ranked bar
         · energy-share-donut       → covered by energy-share donut tile
       Demand-trend stays full-width — it's a unique demand-intensity
       view that the snapshot tiles do not replicate. --}}
  <div class="grid" style="grid-template-columns: 1fr; gap: var(--space-6); margin-top: var(--space-6);">
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">{{ __('messages.dashboard_i18n.demand_trend') }}</h3>
        <p data-energy-chart-subtitle="demand" style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.operational_demand_intensity') }}</p>
      </div>
      <div class="card__body">
        <div class="chart-placeholder" id="energy-demand-trend-chart" style="min-height: 300px;"></div>
        <div class="smaca-accordion smaca-accordion--collapsed">
          <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
            <span>{{ __('messages.status.what_is_this_graph') }}</span>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          <div class="smaca-accordion__body" hidden>
            <div class="accordion-content"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Optional technical admin row -->
  <div class="grid" id="energy-tech-admin-row" style="grid-template-columns: repeat(3, 1fr); gap: var(--space-6); margin-top: var(--space-6); display:none;">
    <article class="stat-card">
      <div class="stat-card__content">
        <div class="stat-card__label">Current (A)</div>
        <div id="energy-tech-kpi-current-a" class="stat-card__value">--</div>
        <div class="stat-card__meta">--</div>
      </div>
    </article>
    <article class="stat-card">
      <div class="stat-card__content">
        <div class="stat-card__label">Power Factor</div>
        <div id="energy-tech-kpi-power-factor" class="stat-card__value">--</div>
        <div class="stat-card__meta">--</div>
      </div>
    </article>
    <article class="stat-card">
      <div class="stat-card__content">
        <div class="stat-card__label">Frequency (Hz)</div>
        <div id="energy-tech-kpi-frequency-hz" class="stat-card__value">--</div>
        <div class="stat-card__meta">--</div>
      </div>
    </article>
  </div>

  <section class="card smaca-energy-zone smaca-energy-zone--meter-breakdown" style="margin: var(--space-6) 0;" aria-labelledby="energy-meter-breakdown-title">
    <div class="card__header">
      <h3 id="energy-meter-breakdown-title" class="card__title">{{ __('messages.dashboard_i18n.energy_meter_breakdown_title') }}</h3>
      <p class="card__subtitle">{{ __('messages.dashboard_i18n.energy_meter_breakdown_subtitle') }}</p>
    </div>
    <div class="card__body">
      <div id="energy-meter-groups" class="iaq-sensor-groups energy-meter-groups" hidden></div>
    </div>
  </section>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.SMACAApi || typeof window.SMACAApi.fetchKpiSummary !== 'function') return;
    if (!window.SMACAKPIRenderer || typeof window.SMACAKPIRenderer.render !== 'function') return;

    function loadEnergyKpis() {
      window.SMACAApi.fetchKpiSummary('energy')
        .then(function (payload) {
          window.SMACAKPIRenderer.render('energy-kpi-summary-cards', payload);
        })
        .catch(function () {
          window.SMACAKPIRenderer.render('energy-kpi-summary-cards', { kpis: [] });
        });
    }

    loadEnergyKpis();
    window.addEventListener('smaca:scope-change', loadEnergyKpis);
    window.addEventListener('smaca:timeframe-changed', loadEnergyKpis);

    function loadEnergyMeterBreakdown() {
      if (window.SMACAEnergyMeterBreakdown && typeof window.SMACAEnergyMeterBreakdown.refresh === 'function') {
        window.SMACAEnergyMeterBreakdown.refresh();
      }
    }
    loadEnergyMeterBreakdown();
    window.addEventListener('smaca:scope-changed', loadEnergyMeterBreakdown);
    window.addEventListener('smaca:timeframe-changed', loadEnergyMeterBreakdown);
  });
</script>
@endsection
