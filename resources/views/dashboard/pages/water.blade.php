@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section dashboard-section--water" id="water" data-section="water">
  <div class="section-hero section-hero--water">
    <div class="section-hero__inner">
      <div>
        <div class="section-hero__title-row">
          @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'water', 'size' => 'hero', 'class' => 'section-hero__icon'])
          <h2 class="section-hero__title">{{ __('messages.nav.water') }}</h2>
        </div>
        <p class="section-hero__subtitle">{{ __('messages.dashboard_i18n.water_hero_subtitle') }}</p>
      </div>
      <div class="section-hero__stat">
        <div id="water-hero-volume" class="section-hero__stat-value" aria-live="polite">—</div>
        <div class="section-hero__stat-label">{{ __('messages.dashboard_i18n.water_hero_volume_label') }}</div>
      </div>
    </div>
  </div>
  <div class="section-meta">
    <span class="data-status-pill data-status-pill--live">{{ __('messages.dashboard.live') }}</span>
    <span id="water-last-updated" class="last-updated-pill" aria-live="polite">{{ __('messages.dashboard.last_update') }}: {{ __('messages.common.loading') }}...</span>
  </div>

  <div id="water-empty-state" class="card water-empty-state" style="margin-top: var(--space-6); display: none;" role="status">
    <div class="card__body">
      <p class="water-empty-state__text">{{ __('messages.dashboard_i18n.water_no_data') }}</p>
    </div>
  </div>

  <div id="water-dashboard-main" hidden>
    <section class="card" style="margin-top: var(--space-6);" aria-labelledby="water-kpi-title">
      <div class="card__header">
        <h3 id="water-kpi-title" class="card__title">{{ __('messages.dashboard_i18n.water_kpi_title') }}</h3>
        <p class="card__subtitle">{{ __('messages.dashboard_i18n.water_kpi_subtitle') }}</p>
      </div>
      <div class="card__body">
        <div id="water-kpi-grid" class="grid grid--metrics grid--metrics-4" aria-live="polite">
          <article class="stat-card overview-kpi-card" data-water-kpi="consumption">
            <div class="stat-card__content">
              <div class="stat-card__label">{{ __('messages.dashboard_i18n.water_card_consumption') }}</div>
              <div class="stat-card__value" data-water-value="consumption">—</div>
              <div class="stat-card__meta" data-water-meta="consumption-m3">—</div>
            </div>
          </article>
          <article class="stat-card overview-kpi-card" data-water-kpi="battery">
            <div class="stat-card__content">
              <div class="stat-card__label">{{ __('messages.dashboard_i18n.water_card_battery') }}</div>
              <div class="stat-card__value" data-water-value="battery">—</div>
              <div class="stat-card__meta">{{ __('messages.dashboard_i18n.water_card_battery_unit') }}</div>
            </div>
          </article>
          <article class="stat-card overview-kpi-card" data-water-kpi="alarms">
            <div class="stat-card__content">
              <div class="stat-card__label">{{ __('messages.dashboard_i18n.water_card_alarms') }}</div>
              <div class="stat-card__value" data-water-value="alarms">—</div>
              <div class="stat-card__meta" data-water-meta="alarms-caption">—</div>
            </div>
          </article>
          <article class="stat-card overview-kpi-card" data-water-kpi="last-reading">
            <div class="stat-card__content">
              <div class="stat-card__label">{{ __('messages.dashboard_i18n.water_card_last_reading') }}</div>
              <div class="stat-card__value stat-card__value--sm" data-water-value="last-reading">—</div>
              <div class="stat-card__meta" data-water-meta="sensor-uid">—</div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <div class="card" style="margin-top: var(--space-6);">
      <div class="card__header">
        <h3 class="card__title">{{ __('messages.dashboard_i18n.water_chart_title') }}</h3>
        <p class="card__subtitle">{{ __('messages.dashboard_i18n.water_chart_subtitle') }}</p>
      </div>
      <div class="card__body">
        <div class="chart-placeholder" id="water-consumption-chart" style="min-height: 360px;"></div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; gap: var(--space-6); margin-top: var(--space-6);">
      <section class="card" aria-labelledby="water-alarms-panel-title">
        <div class="card__header">
          <h3 id="water-alarms-panel-title" class="card__title">{{ __('messages.dashboard_i18n.water_alarms_panel_title') }}</h3>
        </div>
        <div class="card__body">
          <div id="water-alarms-panel" class="water-alarms-panel" aria-live="polite"></div>
        </div>
      </section>
      <section class="card" aria-labelledby="water-details-title">
        <div class="card__header">
          <h3 id="water-details-title" class="card__title">{{ __('messages.dashboard_i18n.water_details_title') }}</h3>
          <p class="card__subtitle">{{ __('messages.dashboard_i18n.water_details_subtitle') }}</p>
        </div>
        <div class="card__body">
          <dl id="water-details-list" class="water-details-list"></dl>
        </div>
      </section>
    </div>
  </div>
</div>
@endsection
