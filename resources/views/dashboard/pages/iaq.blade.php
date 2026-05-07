@extends('dashboard.layouts.app')

@section('dashboard-content')
@php
  $smacaRole = session('role', 'user');
  $smacaIsAdmin = $smacaRole === 'admin';
@endphp
<div class="dashboard-section" id="iaq" data-section="iaq">
          <div class="section-hero section-hero--iaq">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row">
                  <svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
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
          <section class="card" style="margin: var(--space-6) 0;">
            <div class="card__header">
              <h3 class="card__title">{{ __('messages.dashboard_i18n.kpi_title_iaq') }}</h3>
            </div>
            <div class="card__body">
              <p class="overview-live-note" style="margin-bottom: var(--space-3);">{{ __('messages.dashboard_i18n.kpi_intro_iaq') }}</p>
              <div id="iaq-kpi-summary-cards" class="grid grid--metrics grid--metrics-1">
                <article class="stat-card overview-kpi-card"><div class="stat-card__content"><div class="stat-card__label">KPI</div><div class="stat-card__value">--</div></div></article>
              </div>
            </div>
          </section>
          
          <!-- KPI Cards with Metric Definitions -->
          <div id="iaq-kpi-cards" class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);">
            <!-- KPI cards will be rendered here by JavaScript -->
          </div>
          
          @if($smacaIsAdmin)
          <!-- Sensor Health & Data Source (admin only) -->
          <div class="grid" style="grid-template-columns: 2fr 1fr; gap: var(--space-6); margin-bottom: var(--space-6);">
            <div id="sensor-health-panel"></div>
            <div id="data-source-panel"></div>
          </div>
          @endif
          
          <!-- Domain-Driven Visualizations -->
          <div class="grid" style="grid-template-columns: 1fr; gap: var(--space-6); margin-bottom: var(--space-6);">
            <div class="card">
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
            <div id="iaq-hourly-heatstrip-panel"></div>
          </div>
        </div>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.SMACAApi || typeof window.SMACAApi.fetchKpiSummary !== 'function') return;
    if (!window.SMACAKPIRenderer || typeof window.SMACAKPIRenderer.render !== 'function') return;

    function loadIaqKpis() {
      window.SMACAApi.fetchKpiSummary('iaq')
        .then(function (payload) {
          window.SMACAKPIRenderer.render('iaq-kpi-summary-cards', payload, { compact: false });
        })
        .catch(function () {
          window.SMACAKPIRenderer.render('iaq-kpi-summary-cards', { kpis: [] }, { compact: false });
        });
    }

    loadIaqKpis();
    window.addEventListener('smaca:scope-change', loadIaqKpis);
    window.addEventListener('smaca:timeframe-changed', loadIaqKpis);
  });
</script>
@endsection
