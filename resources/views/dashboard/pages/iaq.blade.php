@extends('dashboard.layouts.app')

@section('dashboard-content')
@php
  $smacaRole = session('role', 'user');
  $smacaIsAdmin = $smacaRole === 'admin';
  // Ensure IAQ semantic globals exist for any inline script in this view (defence
  // in depth if layout @php and route data are out of sync on deploy).
  if (! isset($smacaIaqTvocMode)) {
      $_smacaIaqDef = config('smaca_sensor_semantics.defaults', []);
      $smacaIaqTvocMode = $_smacaIaqDef['tvoc_semantic_mode'] ?? 'iaq_rating_level';
      $smacaIaqLightMode = $_smacaIaqDef['light_semantic_mode'] ?? 'normalized_level_0_5';
      $smacaIaqTvocModeLabel = $smacaIaqTvocMode === 'raw_tvoc_ugm3'
          ? __('messages.iaq_semantic_mode.tvoc_raw_tvoc_ugm3')
          : __('messages.iaq_semantic_mode.tvoc_iaq_rating_level');
      $smacaIaqLightModeLabel = $smacaIaqLightMode === 'raw_lux'
          ? __('messages.iaq_semantic_mode.light_raw_lux')
          : __('messages.iaq_semantic_mode.light_normalized_level_0_5');
  }
@endphp
<div class="dashboard-section" id="iaq" data-section="iaq">
          <div class="section-hero section-hero--iaq">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row">
                  @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'iaq', 'size' => 'hero', 'class' => 'section-hero__icon'])
                  <h2 class="section-hero__title">{{ __('messages.nav.iaq') }}</h2>
                </div>
                <p class="section-hero__subtitle">{{ __('messages.dashboard_i18n.iaq_hero_subtitle') }}</p>
              </div>
              @if($smacaIsAdmin)
              <div class="section-hero__stat"><div id="iaq-active-sensors" class="section-hero__stat-value">{{ __('messages.common.loading') }}...</div><div class="section-hero__stat-label">{{ __('messages.dashboard.active_sensors') }}</div></div>
              @endif
            </div>
          </div>
          @if($smacaIsAdmin)
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">{{ __('messages.dashboard.live') }}</span><span class="last-updated-pill" title="Time since last data sync">{{ __('messages.dashboard.last_update') }}: {{ __('messages.common.loading') }}...</span></div>
          @endif
          <section class="card smaca-iaq-zone smaca-iaq-zone--comfort" style="margin: var(--space-6) 0;" data-iaq-zone="comfort-intelligence" aria-labelledby="iaq-zone-comfort-title">
            <div class="card__header">
              <h3 id="iaq-zone-comfort-title" class="card__title">{{ __('messages.dashboard_i18n.kpi_title_iaq') }}</h3>
            </div>
            <div class="card__body">
              <p class="smaca-iaq-info-strip" role="note">{{ __('messages.dashboard_i18n.iaq_kpi_semantic_info_strip') }}</p>
              <p class="overview-live-note" style="margin-bottom: var(--space-3);">{{ __('messages.dashboard_i18n.kpi_intro_iaq') }}</p>
              <div id="iaq-kpi-summary-cards" data-kpi-module="iaq" class="grid grid--metrics grid--metrics-2 smaca-iaq-kpi-grid">
                <article class="stat-card overview-kpi-card"><div class="stat-card__content"><div class="stat-card__label">KPI</div><div class="stat-card__value">--</div></div></article>
              </div>
            </div>
          </section>

          <section class="card smaca-iaq-zone smaca-iaq-zone--sensor-breakdown" style="margin: var(--space-6) 0;" aria-labelledby="iaq-sensor-breakdown-title">
            <div class="card__header">
              <h3 id="iaq-sensor-breakdown-title" class="card__title">{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_title') }}</h3>
              <p class="card__subtitle">{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_subtitle') }}</p>
            </div>
            <div class="card__body">
              <div id="iaq-sensor-groups" class="iaq-sensor-groups" hidden></div>
            </div>
          </section>

          <div class="smaca-iaq-zone-block" data-iaq-zone-group="live-measurements">
            <header class="smaca-iaq-zone-block__head">
              <h2 class="smaca-iaq-zone-block__title">{{ __('messages.dashboard_i18n.iaq_live_zone_title') }}</h2>
              <p class="smaca-iaq-zone-block__subtitle">{{ __('messages.dashboard_i18n.iaq_live_zone_subtitle') }}</p>
            </header>
          <section class="card smaca-telemetry-card smaca-iaq-zone smaca-iaq-zone--live" data-iaq-zone="measurements-trends">
            <div class="card__header smaca-iaq-live-card__header">
              <p class="smaca-iaq-snapshot-badge" role="status">{{ __('messages.dashboard_i18n.iaq_live_snapshot_badge') }}</p>
              <div class="smaca-iaq-live-card__titles">
                <h3 class="card__title">{{ __('messages.nav.iaq') }} · {{ __('messages.dashboard.live') }}</h3>
                <p class="card__subtitle">{{ __('messages.dashboard_i18n.iaq_live_card_subtitle') }}</p>
              </div>
            </div>
            <div class="card__body">
              <div class="smaca-tg smaca-tg--rich" data-smaca-telemetry="iaq">
                <div data-tile="pollutant-compare"  class="smaca-tile--w6"></div>
                <div data-tile="threshold-rank"     class="smaca-tile--w6"></div>
                <div data-tile="hourly-heat"        class="smaca-tile--w8"></div>
                <div data-tile="top-concern"        class="smaca-tile--w4"></div>
                <div data-tile="hot-location"       class="smaca-tile--w4"></div>
                <div data-tile="coverage"           class="smaca-tile--w4"></div>
                <div data-tile="freshness"          class="smaca-tile--w4"></div>
              </div>
            </div>
          </section>
          </div>
          
          @if($smacaIsAdmin)
          <!-- Sensor Health & Data Source (admin only) -->
          <div class="grid" style="grid-template-columns: 2fr 1fr; gap: var(--space-6); margin-bottom: var(--space-6);">
            <div id="sensor-health-panel"></div>
            <div id="data-source-panel"></div>
          </div>
          @endif
          
          {{-- Removed `#iaq-hourly-heatstrip-panel`: the new top
               telemetry section already shows the same hourly CO₂
               pattern via a banded heat strip with explanatory subtitle.
               Multi-metric trend chart kept (CO₂ / temperature / humidity
               / PM2.5 / PM10 / TVOC toggle) since it's a unique multi-bucket
               timeseries view. --}}
          <div class="smaca-iaq-zone-block" data-iaq-zone-group="trends-reliability">
            <header class="smaca-iaq-zone-block__head">
              <h2 class="smaca-iaq-zone-block__title">{{ __('messages.dashboard_i18n.iaq_trends_zone_title') }}</h2>
              <p class="smaca-iaq-zone-block__subtitle">{{ __('messages.dashboard_i18n.iaq_trends_zone_subtitle') }}</p>
            </header>
          <div class="grid" style="grid-template-columns: 1fr; gap: var(--space-6); margin-bottom: var(--space-6);" data-iaq-zone="trends-analytics">
            <div class="card smaca-iaq-zone smaca-iaq-zone--trends">
              <div class="card__header">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap;">
                  <div>
                    <h3 id="iaq-main-chart-title" class="card__title">{{ __('messages.dashboard_i18n.iaq_trend') }} - CO₂</h3>
                    <p id="iaq-main-chart-subtitle" style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.aggregated_all_iaq_sensors') }}</p>
                  </div>
                  <div id="iaq-metric-toggle" class="time-range-selector" role="tablist" aria-label="Select IAQ metric">
                    <button type="button" class="time-range-btn active" data-iaq-metric="co2">{{ __('messages.labels.co2') }}</button>
                    <button type="button" class="time-range-btn" data-iaq-metric="temperature">{{ __('messages.dashboard.temperature') }}</button>
                    <button type="button" class="time-range-btn" data-iaq-metric="humidity">{{ __('messages.dashboard.humidity') }}</button>
                    <button type="button" class="time-range-btn" data-iaq-metric="pm2_5">PM2.5</button>
                    <button type="button" class="time-range-btn" data-iaq-metric="pm10">PM10</button>
                    <button type="button" class="time-range-btn" data-iaq-metric="tvoc">TVOC</button>
                  </div>
                </div>
              </div>
              <div class="card__body">
                <div class="chart-placeholder" id="iaq-co2-band-chart"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>{{ __('messages.status.what_is_this_graph') }}</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p><strong>Y-axis (Vertical):</strong></p>
                      <ul>
                        <li><strong>Values (ppm):</strong> Aggregated CO₂ concentration from all IAQ sensors</li>
                        <li><strong>Green band:</strong> &lt;800 ppm — generally healthy</li>
                        <li><strong>Amber band:</strong> 800–1000 ppm — monitor and increase fresh air</li>
                        <li><strong>Red band:</strong> &gt;1000 ppm — ventilate or adjust HVAC promptly</li>
                      </ul>
                      <p><strong>X-axis (Horizontal):</strong> Time buckets (24h/7d/30d view), each point is the aggregated average for that bucket.</p>
                      <p><strong>How to act:</strong> If the line repeatedly enters amber/red ranges, schedule earlier ventilation and review occupancy peaks for those periods.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.SMACAApi || typeof window.SMACAApi.fetchKpiSummary !== 'function') return;
    if (!window.SMACAKPIRenderer || typeof window.SMACAKPIRenderer.render !== 'function') return;

    function loadIaqKpis() {
      window.SMACAApi.fetchKpiSummary('iaq')
        .then(function (payload) {
          window.SMACAKPIRenderer.render('iaq-kpi-summary-cards', payload, { compact: false, withStatusCompanion: true });
        })
        .catch(function () {
          window.SMACAKPIRenderer.render('iaq-kpi-summary-cards', { kpis: [] }, { compact: false, withStatusCompanion: true });
        });
    }

    loadIaqKpis();
    window.addEventListener('smaca:scope-change', loadIaqKpis);
    window.addEventListener('smaca:timeframe-changed', loadIaqKpis);

    function loadIaqSensorBreakdown() {
      if (window.SMACAIaqSensorBreakdown && typeof window.SMACAIaqSensorBreakdown.refresh === 'function') {
        window.SMACAIaqSensorBreakdown.refresh();
      }
    }
    loadIaqSensorBreakdown();
    /* Scope: spatial dispatches both `smaca:scope-change` and `smaca:scope-changed`; breakdown refresh is debounced in JS — listen once to avoid double scheduling. */
    window.addEventListener('smaca:scope-changed', loadIaqSensorBreakdown);
  });
</script>
@endsection
