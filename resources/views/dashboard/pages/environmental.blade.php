@extends('dashboard.layouts.app')

@section('dashboard-content')
@php
  $smacaRole = session('role', 'user');
  $smacaIsAdmin = $smacaRole === 'admin';
@endphp
<div class="dashboard-section" id="environmental" data-section="environmental">
          <div class="section-hero section-hero--environmental">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row">@include('dashboard.partials.pillar-icon-chip', ['pillar' => 'environmental', 'size' => 'hero', 'class' => 'section-hero__icon'])
                  <h2 class="section-hero__title">{{ __('messages.nav.environmental') }}</h2>
                </div>
                <p class="section-hero__subtitle">{{ __('messages.dashboard_i18n.environmental_hero_subtitle') }}</p>
              </div>
              <div class="section-hero__stat"><div id="environmental-uv-index" class="section-hero__stat-value">{{ __('messages.common.loading') }}...</div><div class="section-hero__stat-label">{{ __('messages.dashboard_i18n.uv_index_latest') }}</div><div id="environmental-uv-stale" class="section-hero__stat-meta" style="display:none;font-size:11px;color:var(--muted);margin-top:4px;"></div></div>
            </div>
          </div>
          @if($smacaIsAdmin)
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">{{ __('messages.dashboard.live') }}</span><span class="last-updated-pill" title="Time since last data sync">{{ __('messages.dashboard.last_update') }}: {{ __('messages.common.loading') }}...</span></div>
          @endif
          <section class="card" style="margin: var(--space-6) 0;">
            <div class="card__header">
              <h3 class="card__title">{{ __('messages.dashboard_i18n.kpi_title_environmental') }}</h3>
            </div>
            <div class="card__body">
              <p class="overview-live-note" style="margin-bottom: var(--space-3);">{{ __('messages.dashboard_i18n.kpi_intro_environmental') }}</p>
              <div id="environmental-kpi-summary-cards" class="grid grid--metrics grid--metrics-2">
                <article class="stat-card overview-kpi-card"><div class="stat-card__content"><div class="stat-card__label">KPI</div><div class="stat-card__value">--</div></div></article>
              </div>
            </div>
          </section>

          <section class="card smaca-telemetry-card">
            <div class="card__header">
              <h3 class="card__title">{{ __('messages.nav.environmental') }} · {{ __('messages.dashboard.live') }}</h3>
              <p class="card__subtitle">{{ __('messages.dashboard_i18n.uv_live_snapshot_subtitle') }}</p>
            </div>
            <div class="card__body">
              <div class="smaca-tg smaca-tg--rich" data-smaca-telemetry="environmental">
                <div data-tile="uv-bands"      class="smaca-tile--w4"></div>
                <div data-tile="uv-strip"      class="smaca-tile--w8"></div>
                <div data-tile="peak-window"   class="smaca-tile--w3"></div>
                <div data-tile="exposure-risk" class="smaca-tile--w3"></div>
                <div data-tile="uv-trend"      class="smaca-tile--w3"></div>
                <div data-tile="advisory"      class="smaca-tile--w3"></div>
              </div>
            </div>
          </section>
          <div data-smaca-legacy-env-anchors hidden aria-hidden="true">
            <span id="env-kpi-current-uv"></span><span id="env-kpi-current-uv-meta"></span>
            <span id="env-kpi-exposure"></span><span id="env-kpi-exposure-meta"></span>
            <span id="env-kpi-peak"></span><span id="env-kpi-peak-meta"></span>
            <span id="env-kpi-trend"></span><span id="env-kpi-trend-meta"></span>
          </div>

          <div class="grid" style="grid-template-columns: repeat(2, 1fr); gap: var(--space-6);">
            <section class="card environmental-chart-card">
              <div class="card__header">
                <h3 class="card__title">{{ __('messages.dashboard_i18n.uv_trend') }}</h3>
                <p data-env-chart-subtitle="trend" style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.uv_trend_subtitle') }}</p>
              </div>
              <div class="card__body">
                <div class="chart-placeholder environmental-chart-placeholder" id="uv-main-chart"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>{{ __('messages.status.what_is_this_graph') }}</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p>{{ __('messages.dashboard_i18n.uv_trend_explainer') }}</p>
                      <p>{{ __('messages.dashboard_i18n.low_0_2') }} · {{ __('messages.dashboard_i18n.uv_band_moderate') }} (3–5) · {{ __('messages.dashboard_i18n.uv_band_high') }} (6–7) · {{ __('messages.dashboard_i18n.uv_band_very_high') }} (8–10) · {{ __('messages.dashboard_i18n.extreme_11_plus') }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="card environmental-meaning-card">
              <div class="card__header">
                <h3 class="card__title">{{ __('messages.dashboard_i18n.daily_uv_comparison') }}</h3>
                <p data-env-chart-subtitle="daily" style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.uv_daily_comparison_subtitle') }}</p>
              </div>
              <div class="card__body">
                <div class="chart-placeholder" id="uv-daily-comparison-chart"></div>
                <p id="env-meaning-level" class="environmental-meaning-level">{{ __('messages.dashboard_i18n.current_interpretation') }}: {{ __('messages.status.high') }} {{ __('messages.dashboard_i18n.uv_exposure') }}</p>
                <p id="env-meaning-copy" class="info-block__content">{{ __('messages.dashboard_i18n.uv_daily_comparison_explainer') }}</p>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>{{ __('messages.dashboard_i18n.how_to_read_daily_comparison') }}</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p>{{ __('messages.dashboard_i18n.uv_daily_comparison_explainer') }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.SMACAApi || typeof window.SMACAApi.fetchKpiSummary !== 'function') return;
    if (!window.SMACAKPIRenderer || typeof window.SMACAKPIRenderer.render !== 'function') return;

    function loadEnvironmentalKpis() {
      window.SMACAApi.fetchKpiSummary('environmental')
        .then(function (payload) {
          window.SMACAKPIRenderer.render('environmental-kpi-summary-cards', payload, { compact: false, withStatusCompanion: true });
        })
        .catch(function () {
          window.SMACAKPIRenderer.render('environmental-kpi-summary-cards', { kpis: [] }, { compact: false, withStatusCompanion: true });
        });
    }

    loadEnvironmentalKpis();
    window.addEventListener('smaca:scope-change', loadEnvironmentalKpis);
    window.addEventListener('smaca:timeframe-changed', loadEnvironmentalKpis);
  });
</script>
@endsection
