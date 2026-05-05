@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section" id="environmental" data-section="environmental">
          <div class="section-hero section-hero--environmental">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  <h2 class="section-hero__title">{{ __('messages.nav.environmental') }}</h2>
                </div>
                <p class="section-hero__subtitle">{{ __('messages.dashboard_i18n.environmental_hero_subtitle') }}</p>
              </div>
              <div class="section-hero__stat"><div id="environmental-uv-index" class="section-hero__stat-value">6.5</div><div class="section-hero__stat-label">{{ __('messages.dashboard_i18n.uv_index') }}</div></div>
            </div>
          </div>
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">{{ __('messages.dashboard.live') }}</span><span class="last-updated-pill" title="Time since last data sync">{{ __('messages.dashboard.last_update') }}: 2 min ago</span></div>
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
          <div class="grid grid--metrics grid--metrics-4" id="environmental-kpi-grid">
            <article class="stat-card" title="Current UV index at the latest measurement">
              <div class="stat-card__content">
                <div class="stat-card__label">{{ __('messages.dashboard_i18n.current_uv_index') }}</div>
                <div id="env-kpi-current-uv" class="stat-card__value">6.5</div>
                <div id="env-kpi-current-uv-meta" class="stat-card__meta">{{ __('messages.dashboard.live') }} reading</div>
              </div>
            </article>
            <article class="stat-card" title="Current UV exposure category">
              <div class="stat-card__content">
                <div class="stat-card__label">{{ __('messages.dashboard.status') }}</div>
                <div id="env-kpi-exposure" class="stat-card__value">{{ __('messages.status.high') }}</div>
                <div id="env-kpi-exposure-meta" class="stat-card__meta">Protection advised</div>
              </div>
            </article>
            <article class="stat-card" title="{{ __('messages.dashboard.uv_peak_today') }}">
              <div class="stat-card__content">
                <div class="stat-card__label">{{ __('messages.dashboard_i18n.peak_today') }}</div>
                <div id="env-kpi-peak" class="stat-card__value">8.2</div>
                <div id="env-kpi-peak-meta" class="stat-card__meta">{{ __('messages.dashboard_i18n.daily_maximum') }}</div>
              </div>
            </article>
            <article class="stat-card" title="{{ __('messages.dashboard_i18n.direction_uv_change_previous') }}">
              <div class="stat-card__content">
                <div class="stat-card__label">{{ __('messages.status.trend') }}</div>
                <div id="env-kpi-trend" class="stat-card__value">{{ __('messages.status.rising') }}</div>
                <div id="env-kpi-trend-meta" class="stat-card__meta">{{ __('messages.dashboard_i18n.vs_previous_reading') }}</div>
              </div>
            </article>
          </div>

          <div class="environmental-main-grid">
            <section class="card environmental-chart-card">
              <div class="card__header">
                <h3 class="card__title">{{ __('messages.dashboard_i18n.uv_trend') }}</h3>
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

            <aside class="card environmental-summary-card">
              <div class="card__header">
                <h3 class="card__title">{{ __('messages.dashboard_i18n.uv_advisory') }}</h3>
              </div>
              <div class="card__body">
                <div class="stat-row"><span class="stat-row__label">{{ __('messages.dashboard_i18n.current_uv_level') }}</span><span id="env-summary-current" class="stat-row__value">6.5 ({{ __('messages.status.high') }})</span></div>
                <div class="stat-row"><span class="stat-row__label">{{ __('messages.dashboard_i18n.peak_in_window') }}</span><span id="env-summary-peak" class="stat-row__value">8.2</span></div>
                <div class="stat-row"><span class="stat-row__label">{{ __('messages.dashboard_i18n.strongest_exposure_period') }}</span><span id="env-summary-period" class="stat-row__value">11:00–14:00</span></div>
                <div class="prediction-insight">
                  <svg class="prediction-insight__icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z"></path></svg>
                  <p id="env-summary-guidance" class="prediction-insight__text">Limit direct sun exposure and use sunscreen, hat, and sunglasses during peak hours.</p>
                </div>
              </div>
            </aside>
          </div>

          <div class="environmental-bottom-grid">
            <section class="card">
              <div class="card__header">
                <h3 class="card__title">{{ __('messages.dashboard_i18n.hourly_uv_pattern') }}</h3>
              </div>
              <div class="card__body environmental-pattern-body">
                <div class="chart-placeholder" id="uv-pattern-chart"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>{{ __('messages.status.what_is_this_graph') }}</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content"></div>
                  </div>
                </div>
                <div class="environmental-zone-grid" aria-label="UV exposure zones">
                  <span class="environmental-zone environmental-zone--low">{{ __('messages.dashboard_i18n.low_0_2') }}</span>
                  <span class="environmental-zone environmental-zone--moderate">{{ __('messages.status.moderate') }} (3-5)</span>
                  <span class="environmental-zone environmental-zone--high">{{ __('messages.status.high') }} (6-7)</span>
                  <span class="environmental-zone environmental-zone--very-high">{{ __('messages.dashboard_i18n.very_high_8_10') }}</span>
                  <span class="environmental-zone environmental-zone--extreme">{{ __('messages.dashboard_i18n.extreme_11_plus') }}</span>
                </div>
              </div>
            </section>

            <section class="card environmental-meaning-card">
              <div class="card__header">
                <h3 class="card__title">{{ __('messages.dashboard_i18n.daily_uv_comparison') }}</h3>
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

    window.SMACAApi.fetchKpiSummary('environmental')
      .then(function (payload) {
        window.SMACAKPIRenderer.render('environmental-kpi-summary-cards', payload, { compact: false });
      })
      .catch(function () {
        window.SMACAKPIRenderer.render('environmental-kpi-summary-cards', { kpis: [] }, { compact: false });
      });
  });
</script>
@endsection
