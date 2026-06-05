@extends('dashboard.layouts.app')

@section('dashboard-content')
@php
  $smacaRole = session('role', 'user');
  $smacaIsAdmin = $smacaRole === 'admin';
@endphp
<div class="dashboard-section" id="occupancy" data-section="occupancy">
          <div class="section-hero section-hero--occupancy">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row">@include('dashboard.partials.pillar-icon-chip', ['pillar' => 'occupancy', 'size' => 'hero', 'class' => 'section-hero__icon'])
                  <h2 class="section-hero__title">{{ __('messages.nav.occupancy') }}</h2>
                </div>
                <p class="section-hero__subtitle">{{ __('messages.dashboard_i18n.occupancy_hero_subtitle') }}</p>
              </div>
            </div>
          </div>
          @if($smacaIsAdmin)
          <div class="section-meta smaca-occupancy-meta">
            <span class="data-status-pill data-status-pill--live smaca-occupancy-live-pill" title="Data is being updated in real time">{{ __('messages.dashboard.live') }}</span>
            <span class="last-updated-pill" title="Time since last data sync">{{ __('messages.dashboard.last_update') }}: {{ __('messages.common.loading') }}...</span>
          </div>
          @endif
          <section class="smaca-occupancy-panel" aria-labelledby="smaca-occupancy-panel-title">
            <header class="smaca-occupancy-panel__header smaca-occupancy-panel__header--premium">
              <div class="smaca-occupancy-panel__header-copy">
                <div class="smaca-occupancy-panel__title-row">
                  @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'occupancy', 'size' => 'lg', 'class' => 'smaca-occupancy-panel__badge'])
                  <h3 id="smaca-occupancy-panel-title" class="smaca-occupancy-panel__title">{{ __('messages.dashboard_i18n.kpi_title_occupancy') }}</h3>
                </div>
                <p class="smaca-occupancy-panel__subtitle">{{ __('messages.dashboard_i18n.occupancy_scope_daily_note') }}</p>
                <p class="smaca-occupancy-panel__subtitle smaca-occupancy-panel__subtitle--secondary">{{ __('messages.dashboard_i18n.kpi_intro_occupancy') }}</p>
              </div>
              <div class="smaca-occupancy-panel__illustration" aria-hidden="true">
                <svg class="smaca-occupancy-panel__illustration-svg" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="occ-portal-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="rgba(96, 165, 250, 0.55)"/>
                      <stop offset="100%" stop-color="rgba(59, 130, 246, 0.12)"/>
                    </linearGradient>
                    <filter id="occ-portal-glow" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur stdDeviation="6" result="blur"/>
                      <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <ellipse cx="120" cy="138" rx="72" ry="10" fill="rgba(59, 130, 246, 0.12)"/>
                  <path d="M72 42 L168 42 L188 128 L52 128 Z" fill="url(#occ-portal-grad)" stroke="rgba(96, 165, 250, 0.55)" stroke-width="1.5" filter="url(#occ-portal-glow)"/>
                  <path d="M88 52 L152 52 L166 118 L74 118 Z" fill="rgba(15, 23, 42, 0.45)" stroke="rgba(147, 197, 253, 0.35)" stroke-width="1"/>
                  <circle cx="98" cy="92" r="9" fill="rgba(96, 165, 250, 0.35)" stroke="rgba(147, 197, 253, 0.7)" stroke-width="1.2"/>
                  <path d="M98 101v8M94 105h8" stroke="rgba(191, 219, 254, 0.9)" stroke-width="1.4" stroke-linecap="round"/>
                  <circle cx="120" cy="86" r="10" fill="rgba(129, 140, 248, 0.38)" stroke="rgba(165, 180, 252, 0.75)" stroke-width="1.2"/>
                  <path d="M120 96v9M116 100h8" stroke="rgba(224, 231, 255, 0.92)" stroke-width="1.4" stroke-linecap="round"/>
                  <circle cx="142" cy="92" r="9" fill="rgba(96, 165, 250, 0.35)" stroke="rgba(147, 197, 253, 0.7)" stroke-width="1.2"/>
                  <path d="M142 101v8M138 105h8" stroke="rgba(191, 219, 254, 0.9)" stroke-width="1.4" stroke-linecap="round"/>
                  <path d="M34 98c10-6 18-4 26 2M180 98c-10-6-18-4-26 2" stroke="rgba(148, 163, 184, 0.35)" stroke-width="1.5" stroke-linecap="round"/>
                  <path d="M46 78 L72 92 M194 78 L168 92" stroke="rgba(96, 165, 250, 0.45)" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
            </header>
            <div class="smaca-occupancy-panel__body">
              <div id="occupancy-kpi-summary-cards" data-kpi-module="occupancy" class="smaca-occupancy-kpi-grid">
                <p class="smaca-occupancy-kpi-grid__loading">{{ __('messages.common.loading') }}...</p>
              </div>
            </div>
            <footer class="smaca-occupancy-panel__footer" id="occupancy-kpi-footer" hidden>
              <div class="smaca-occupancy-panel__footer-window">
                <span class="smaca-occupancy-panel__footer-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                </span>
                <span id="occupancy-kpi-footer-window-text" class="smaca-occupancy-panel__footer-window-text"></span>
              </div>
              <span id="occupancy-kpi-footer-tz" class="smaca-occupancy-panel__footer-tz">
                <span class="smaca-occupancy-panel__footer-tz-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7v5l3 2"/>
                  </svg>
                </span>
                <span id="occupancy-kpi-footer-tz-text"></span>
              </span>
            </footer>
          </section>

          <section class="card smaca-telemetry-card smaca-occupancy-telemetry-card">
            <div class="card__header">
              <h3 class="card__title">{{ __('messages.nav.occupancy') }} · {{ __('messages.dashboard.live') }}</h3>
              <p class="card__subtitle">{{ __('messages.dashboard_i18n.occupancy_scope_timeframe_note') }}</p>
            </div>
            <div class="card__body">
              <p class="occupancy-tile-guide__intro">{{ __('messages.dashboard_i18n.occupancy_movement_tiles_intro') }}</p>
              <div class="smaca-tg smaca-tg--rich" data-smaca-telemetry="occupancy">
                <div data-tile="in-out-stacked"    class="smaca-tile--w6"></div>
                <div data-tile="busiest-rank"      class="smaca-tile--w6"></div>
                <div data-tile="hourly-activity"   class="smaca-tile--w8"></div>
                <div data-tile="flow-donut"        class="smaca-tile--w4"></div>
                <div data-tile="peak-hour"         class="smaca-tile--w3"></div>
                <div data-tile="net-balance"       class="smaca-tile--w3"></div>
                <div data-tile="total-events"      class="smaca-tile--w3"></div>
                <div data-tile="freshness"         class="smaca-tile--w3"></div>
              </div>
            </div>
          </section>

          <section class="card occupancy-chart-guide">
            <div class="card__body">
              <div class="smaca-accordion smaca-accordion--collapsed">
                <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                  <span>{{ __('messages.status.what_is_this_graph') }} · {{ __('messages.dashboard_i18n.occupancy_chart_hourly_title') }}</span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <div class="smaca-accordion__body" hidden>
                  <div class="accordion-content">
                    <p>{{ __('messages.dashboard_i18n.occupancy_chart_explainer_hourly') }}</p>
                  </div>
                </div>
              </div>
              <div class="smaca-accordion smaca-accordion--collapsed">
                <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                  <span>{{ __('messages.status.what_is_this_graph') }} · {{ __('messages.dashboard_i18n.occupancy_tile_total_movement_title') }}</span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <div class="smaca-accordion__body" hidden>
                  <div class="accordion-content">
                    <p>{{ __('messages.dashboard_i18n.occupancy_chart_explainer_total_movement') }}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          
          @if($smacaIsAdmin)
          <!-- Operational movement summary (admin only — raw counters) -->
          <div class="card" style="margin-bottom: var(--space-6);">
            <div class="card__body">
              <div style="display: flex; align-items: center; gap: var(--space-6);">
                <div>
                  <div id="occupancy-operational-summary-label" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-1);">{{ __('messages.dashboard_i18n.occupancy_operational_latest_sample_title') }}</div>
                  <div id="occupancy-operational-summary-helper" style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">{{ __('messages.dashboard_i18n.occupancy_operational_latest_sample_helper') }}</div>
                  <div id="occupancy-operational-summary-value" style="font-size: 36px; font-weight: 600; color: var(--text);">{{ __('messages.common.loading') }}...</div>
                  <div id="occupancy-operational-summary-sub" style="font-size: 11px; color: var(--muted);"></div>
                </div>
                <div style="flex: 1; border-left: 1px solid var(--border); padding-left: var(--space-6);">
                  <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">{{ __('messages.dashboard_i18n.occupancy_explain_iaq') }}</div>
                  <div style="font-size: 12px; color: var(--text);">{{ __('messages.dashboard_i18n.correlation_analysis_enterprise') }}</div>
                </div>
              </div>
            </div>
          </div>
          @endif
          
          {{-- Removed `occupancy-density-timeline` card: its hour-of-day
               heatmap duplicated the hourly-activity heat-strip in the new
               top telemetry section, and its area chart largely repeated
               the activity line of the flow-over-time chart kept below.
               Flow-over-time chart is unique (multi-bucket in/out columns
               + activity line) and stays full-width. --}}
          <div class="grid" style="grid-template-columns: 1fr; gap: var(--space-6);">
            <div class="card">
              <div class="card__header">
                <h3 class="card__title">{{ __('messages.dashboard_i18n.flow_over_time') }}</h3>
                <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.occupancy_chart_flow_subtitle') }}</p>
              </div>
              <div class="card__body">
                <div class="chart-placeholder" id="occupancy-flow-chart" style="min-height: 320px;"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>{{ __('messages.status.what_is_this_graph') }}</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                    <p>{{ __('messages.dashboard_i18n.occupancy_chart_explainer_flow') }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section class="card smaca-occupancy-zone smaca-occupancy-zone--sensor-breakdown" style="margin: var(--space-6) 0;" aria-labelledby="occupancy-sensor-breakdown-title">
            <div class="card__header">
              <h3 id="occupancy-sensor-breakdown-title" class="card__title">{{ __('messages.dashboard_i18n.occupancy_sensor_breakdown_title') }}</h3>
            </div>
            <div class="card__body">
              <div id="occupancy-sensor-groups" class="occupancy-sensor-groups" hidden></div>
            </div>
          </section>
        </div>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.SMACAApi || typeof window.SMACAApi.fetchKpiSummary !== 'function') return;
    if (!window.SMACAKPIRenderer || typeof window.SMACAKPIRenderer.render !== 'function') return;

    function loadOccupancyKpis() {
      window.SMACAApi.fetchKpiSummary('occupancy')
        .then(function (payload) {
          if (window.SMACAKPIRenderer && typeof window.SMACAKPIRenderer.renderOccupancyMetrics === 'function') {
            window.SMACAKPIRenderer.renderOccupancyMetrics('occupancy-kpi-summary-cards', payload);
          }
          if (window.SMACAKPIRenderer && typeof window.SMACAKPIRenderer.renderOccupancySensorGroups === 'function') {
            window.SMACAKPIRenderer.renderOccupancySensorGroups('occupancy-sensor-groups', payload);
          }
        })
        .catch(function () {
          if (window.SMACAKPIRenderer && typeof window.SMACAKPIRenderer.renderOccupancyMetrics === 'function') {
            window.SMACAKPIRenderer.renderOccupancyMetrics('occupancy-kpi-summary-cards', { occupancy_metrics: null });
          }
          if (window.SMACAKPIRenderer && typeof window.SMACAKPIRenderer.renderOccupancySensorGroups === 'function') {
            window.SMACAKPIRenderer.renderOccupancySensorGroups('occupancy-sensor-groups', { occupancy_metrics: { sensors: [] } });
          }
        });
    }

    loadOccupancyKpis();
    /* Scope: spatial dispatches both events; listen once — breakdown render is fingerprint-guarded in JS. */
    window.addEventListener('smaca:scope-changed', loadOccupancyKpis);
    window.addEventListener('smaca:timeframe-changed', loadOccupancyKpis);
  });
</script>
@endsection
