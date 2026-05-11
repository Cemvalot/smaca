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
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  <h2 class="section-hero__title">{{ __('messages.nav.environmental') }}</h2>
                </div>
                <p class="section-hero__subtitle">{{ __('messages.dashboard_i18n.environmental_hero_subtitle') }}</p>
              </div>
              <div class="section-hero__stat"><div id="environmental-uv-index" class="section-hero__stat-value">{{ __('messages.common.loading') }}...</div><div class="section-hero__stat-label">{{ __('messages.dashboard_i18n.uv_index') }}</div></div>
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
              <p class="card__subtitle">{{ __('messages.dashboard_i18n.overview_realtime_snapshot') }}</p>
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
          {{-- Legacy `#environmental-kpi-grid` removed: it held hardcoded
               UV placeholder values (6.5 / High / 8.2 / Rising) that were
               misleading before live data loaded. The new top telemetry
               section already covers all of these:
                 · Current UV index   → uv-bands radial
                 · Status / advisory  → advisory tile
                 · Peak today         → peak-window tile
                 · Trend              → uv-trend tile
               Inert spans retained so legacy JS that writes to these
               IDs does not throw. --}}
          <div data-smaca-legacy-env-anchors hidden aria-hidden="true">
            <span id="env-kpi-current-uv"></span><span id="env-kpi-current-uv-meta"></span>
            <span id="env-kpi-exposure"></span><span id="env-kpi-exposure-meta"></span>
            <span id="env-kpi-peak"></span><span id="env-kpi-peak-meta"></span>
            <span id="env-kpi-trend"></span><span id="env-kpi-trend-meta"></span>
          </div>

          {{-- Removed two duplicates already covered by the top telemetry:
                 · UV advisory aside        → advisory + peak-window + uv-trend tiles
                 · Hourly UV pattern card   → uv-strip heat-strip tile
               Kept the multi-bucket UV trend chart (timeseries) and the
               daily UV comparison chart (cross-day comparison) — both
               unique angles. --}}
          <div class="grid" style="grid-template-columns: repeat(2, 1fr); gap: var(--space-6);">
            <section class="card environmental-chart-card">
              <div class="card__header">
                <h3 class="card__title">{{ __('messages.dashboard_i18n.uv_trend') }}</h3>
                <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ app()->getLocale() === 'el' ? 'Πορεία UV στο επιλεγμένο διάστημα, με ζώνες κινδύνου στο φόντο.' : 'UV behaviour across the selected window, with risk bands in the background.' }}</p>
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
                      <p>This chart shows UV behavior across the selected monitoring window.</p>
                      <p>Colored background zones map UV risk bands from Low (0-2) to Extreme (11+).</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="card environmental-meaning-card">
              <div class="card__header">
                <h3 class="card__title">{{ __('messages.dashboard_i18n.daily_uv_comparison') }}</h3>
                <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ app()->getLocale() === 'el' ? 'Μέγιστη ημερήσια UV — σύγκριση ανά ημέρα.' : 'Daily peak UV — compare exposure across days.' }}</p>
              </div>
              <div class="card__body">
                <div class="chart-placeholder" id="uv-daily-comparison-chart"></div>
                <p id="env-meaning-level" class="environmental-meaning-level">{{ __('messages.dashboard_i18n.current_interpretation') }}: {{ __('messages.status.high') }} {{ __('messages.dashboard_i18n.uv_exposure') }}</p>
                <p id="env-meaning-copy" class="info-block__content">Daily peak UV highlights the highest exposure pressure each day so risk windows are easier to compare.</p>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>{{ __('messages.dashboard_i18n.how_to_read_daily_comparison') }}</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p>Each bar shows that day's highest UV index. Taller bars mean stronger protection is needed that day.</p>
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
