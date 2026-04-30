@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section" id="energy" data-section="energy">
  <div class="section-hero section-hero--energy">
    <div class="section-hero__inner">
      <div>
        <div class="section-hero__title-row">
          <svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          <h2 class="section-hero__title">{{ __('messages.nav.energy') }}</h2>
        </div>
        <p class="section-hero__subtitle">{{ __('messages.dashboard_i18n.energy_hero_subtitle') }}</p>
      </div>
      <div class="section-hero__stat">
        <div id="energy-daily-consumption" class="section-hero__stat-value">1688</div>
        <div class="section-hero__stat-label">{{ __('messages.dashboard_i18n.kwh_today') }}</div>
      </div>
    </div>
  </div>
  <div class="section-meta">
    <span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">{{ __('messages.dashboard.live') }}</span>
    <span class="last-updated-pill" title="Time since last data sync">{{ __('messages.dashboard.last_update') }}: 2 min ago</span>
  </div>

  <!-- KPI row -->
  <div class="grid grid--metrics grid--metrics-4" id="energy-kpi-grid" style="margin-top: var(--space-6);">
    <article class="stat-card" title="Total energy used in the selected timeframe">
      <div class="stat-card__content">
        <div class="stat-card__label">{{ __('messages.dashboard_i18n.total_energy_used') }}</div>
        <div id="energy-kpi-total" class="stat-card__value">--</div>
        <div id="energy-kpi-total-meta" class="stat-card__meta">--</div>
      </div>
    </article>
    <article class="stat-card" title="Peak energy bucket in the selected timeframe">
      <div class="stat-card__content">
        <div class="stat-card__label">{{ __('messages.dashboard_i18n.peak_bucket') }}</div>
        <div id="energy-kpi-peak" class="stat-card__value">--</div>
        <div id="energy-kpi-peak-meta" class="stat-card__meta">--</div>
      </div>
    </article>
    <article class="stat-card" title="Average energy usage per bucket">
      <div class="stat-card__content">
        <div class="stat-card__label">{{ __('messages.dashboard_i18n.avg_per_bucket') }}</div>
        <div id="energy-kpi-avg" class="stat-card__value">--</div>
        <div id="energy-kpi-avg-meta" class="stat-card__meta">--</div>
      </div>
    </article>
    <article class="stat-card" title="Top energy-contributing location in the selected timeframe">
      <div class="stat-card__content">
        <div class="stat-card__label">{{ __('messages.dashboard_i18n.top_contributor') }}</div>
        <div id="energy-kpi-top-location" class="stat-card__value">--</div>
        <div id="energy-kpi-top-location-meta" class="stat-card__meta">--</div>
      </div>
    </article>
  </div>

  <!-- Main chart -->
  <div class="card" style="margin-top: var(--space-6);">
    <div class="card__header">
      <h3 class="card__title">{{ __('messages.dashboard_i18n.energy_usage_kwh') }}</h3>
      <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.columns_spline_energy') }}</p>
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
            <p><strong>Columns:</strong> energy usage aggregated into the selected bucket size.</p>
            <p><strong>Spline:</strong> cumulative running total across the buckets.</p>
            <p><strong>Dashed plotLine:</strong> average bucket usage for the selected timeframe.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Secondary row -->
  <div class="grid" style="grid-template-columns: repeat(2, 1fr); gap: var(--space-6); margin-top: var(--space-6);">
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">{{ __('messages.dashboard_i18n.demand_trend') }}</h3>
        <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.operational_demand_intensity') }}</p>
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
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">{{ __('messages.dashboard_i18n.usage_pattern_by_hour') }}</h3>
        <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.recurring_hour_energy_pattern') }}</p>
      </div>
      <div class="card__body">
        <div class="chart-placeholder" id="energy-usage-pattern-hour-chart" style="min-height: 300px;"></div>
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

  <!-- Third row -->
  <div class="grid" style="grid-template-columns: repeat(2, 1fr); gap: var(--space-6); margin-top: var(--space-6);">
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">{{ __('messages.dashboard_i18n.energy_distribution_by_location') }}</h3>
        <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.top_locations_energy_usage') }}</p>
      </div>
      <div class="card__body">
        <div class="chart-placeholder" id="energy-distribution-location-chart" style="min-height: 320px;"></div>
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
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">{{ __('messages.dashboard_i18n.energy_share') }}</h3>
        <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.relative_contribution_donut') }}</p>
      </div>
      <div class="card__body">
        <div class="chart-placeholder" id="energy-share-donut-chart" style="min-height: 320px;"></div>
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
@endsection
