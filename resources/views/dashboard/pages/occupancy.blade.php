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
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                  <h2 class="section-hero__title">{{ __('messages.nav.occupancy') }}</h2>
                </div>
                <p class="section-hero__subtitle">{{ __('messages.dashboard_i18n.occupancy_hero_subtitle') }}</p>
              </div>
              @if($smacaIsAdmin)
              <div class="section-hero__stat"><div id="occupancy-current-count" class="section-hero__stat-value">{{ __('messages.common.loading') }}...</div><div class="section-hero__stat-label">{{ __('messages.dashboard_i18n.recent_movements') }}</div></div>
              @endif
            </div>
          </div>
          @if($smacaIsAdmin)
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">{{ __('messages.dashboard.live') }}</span><span class="last-updated-pill" title="Time since last data sync">{{ __('messages.dashboard.last_update') }}: {{ __('messages.common.loading') }}...</span></div>
          @endif
          <section class="card" style="margin: var(--space-6) 0;">
            <div class="card__header">
              <h3 class="card__title">{{ __('messages.dashboard_i18n.kpi_title_occupancy') }}</h3>
            </div>
            <div class="card__body">
              <p class="overview-live-note" style="margin-bottom: var(--space-2);">{{ __('messages.dashboard_i18n.kpi_intro_occupancy') }}</p>
              <p class="overview-live-note" style="margin-bottom: var(--space-3); font-style: italic; color: var(--muted);">{{ __('messages.dashboard_i18n.flow_estimate_note') }}</p>
              <div id="occupancy-kpi-summary-cards" data-kpi-module="occupancy" class="grid grid--metrics grid--metrics-2">
                <p class="overview-live-note">{{ __('messages.common.loading') }}...</p>
              </div>
            </div>
          </section>
          
          @if($smacaIsAdmin)
          <!-- Operational movement summary (admin only — raw counters) -->
          <div class="card" style="margin-bottom: var(--space-6);">
            <div class="card__body">
              <div style="display: flex; align-items: center; gap: var(--space-6);">
                <div>
                  <div id="occupancy-operational-summary-label" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-1);">{{ __('messages.dashboard_i18n.operational_card_current_activity_title') }}</div>
                  <div id="occupancy-operational-summary-helper" style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">{{ __('messages.dashboard_i18n.operational_card_current_activity_helper') }}</div>
                  <div id="occupancy-operational-summary-value" style="font-size: 36px; font-weight: 600; color: var(--text);">{{ __('messages.common.loading') }}...</div>
                  <div id="occupancy-operational-summary-sub" style="font-size: 11px; color: var(--muted);">{{ __('messages.dashboard_i18n.cumulative_entries_exits') }}</div>
                </div>
                <div style="flex: 1; border-left: 1px solid var(--border); padding-left: var(--space-6);">
                  <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">{{ __('messages.dashboard_i18n.occupancy_explain_iaq') }}</div>
                  <div style="font-size: 12px; color: var(--text);">{{ __('messages.dashboard_i18n.correlation_analysis_enterprise') }}</div>
                </div>
              </div>
            </div>
          </div>
          @endif
          
          <!-- Domain-Driven Visualizations -->
          <div class="grid occupancy-primary-grid" style="grid-template-columns: repeat(2, 1fr); gap: var(--space-6);">
            <div class="card occupancy-primary-card">
              <div class="card__header">
                <h3 class="card__title">{{ __('messages.dashboard_i18n.flow_over_time') }}</h3>
                  <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.decision_traffic_highest') }}</p>
              </div>
              <div class="card__body occupancy-primary-card__body">
                <div class="chart-placeholder occupancy-primary-chart" id="occupancy-flow-chart"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>{{ __('messages.status.what_is_this_graph') }}</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p><strong>Y-axis (Vertical):</strong></p>
                      <ul>
                        <li><strong>Green columns:</strong> People entering</li>
                        <li><strong>Orange columns:</strong> People leaving</li>
                        <li><strong>Blue activity line:</strong> Overall activity (in + out)</li>
                        <li><strong>Column height:</strong> Number of people in the bucket</li>
                      </ul>
                      <p><strong>X-axis (Horizontal):</strong></p>
                      <ul>
                        <li><strong>Time periods:</strong> Each bucket represents one time interval</li>
                        <li><strong>Interpretation:</strong> Use column heights + activity line to spot bursts</li>
                      </ul>
                      <p><strong>How to read:</strong> Compare the green and orange columns to see whether the building is dominated by arrivals or departures. The blue line highlights when overall movement is strongest.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="card occupancy-primary-card">
              <div class="card__header">
                <h3 class="card__title">{{ __('messages.dashboard_i18n.activity_over_time') }}</h3>
                  <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">{{ __('messages.dashboard_i18n.decision_occupancy_highest') }}</p>
              </div>
              <div class="card__body occupancy-primary-card__body">
                <div class="chart-placeholder occupancy-primary-chart" id="occupancy-density-timeline"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>{{ __('messages.status.what_is_this_graph') }}</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p><strong>Y-axis (Vertical):</strong></p>
                      <ul>
                        <li><strong>Blue area:</strong> Estimated people present in the bucket</li>
                        <li><strong>Peak regions:</strong> Indicate higher occupancy density over time</li>
                      </ul>
                      <p><strong>Pattern heatmap (below the area):</strong> Recurring activity by hour-of-day. Hover a cell to see the aggregated activity for that hour.</p>
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

    function loadOccupancyKpis() {
      // Accept BOTH `crowd_density_level` (floor / area scope) and
      // `movement_activity_index` (passage scope). The KPI engine emits
      // exactly one of them depending on the selected location.
      var allowedKeys = ['crowd_density_level', 'movement_activity_index'];
      window.SMACAApi.fetchKpiSummary('occupancy')
        .then(function (payload) {
          window.SMACAKPIRenderer.render('occupancy-kpi-summary-cards', payload, {
            compact: false,
            maxItems: 1,
            allowedKeys: allowedKeys,
            withStatusCompanion: true
          });
        })
        .catch(function () {
          window.SMACAKPIRenderer.render('occupancy-kpi-summary-cards', { kpis: [] }, {
            compact: false,
            maxItems: 1,
            allowedKeys: allowedKeys,
            withStatusCompanion: true
          });
        });
    }

    loadOccupancyKpis();
    window.addEventListener('smaca:scope-change', loadOccupancyKpis);
    window.addEventListener('smaca:timeframe-changed', loadOccupancyKpis);
  });
</script>
@endsection
