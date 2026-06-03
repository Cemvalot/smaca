@extends('dashboard.layouts.app')

@section('dashboard-content')
<div
  class="dashboard-section ai-alerts-page"
  id="ai-insights"
  data-section="ai-insights"
  data-i18n-unavailable="{{ __('messages.dashboard_i18n.ai_alerts_unavailable') }}"
  data-i18n-no-events="{{ __('messages.dashboard_i18n.ai_alerts_no_events') }}"
  data-i18n-action-pending="{{ __('messages.dashboard_i18n.ai_alerts_action_api_pending') }}"
  data-i18n-acknowledge="{{ __('messages.dashboard_i18n.ai_alerts_acknowledge') }}"
  data-i18n-resolve="{{ __('messages.dashboard_i18n.ai_alerts_resolve') }}"
  data-i18n-sensor-id="{{ __('messages.dashboard_i18n.ai_alerts_sensor_id') }}"
  data-i18n-not-available="{{ __('messages.common.not_available') }}"
  data-i18n-ai-summary-unavailable="{{ __('messages.dashboard_i18n.ai_alerts_ai_summary_unavailable') }}"
  data-i18n-ai-summary-not-generated="{{ __('messages.dashboard_i18n.ai_alerts_ai_summary_not_generated') }}"
  data-i18n-ai-summary-generate="{{ __('messages.dashboard_i18n.ai_alerts_ai_summary_generate') }}"
  data-i18n-ai-summary-generating="{{ __('messages.dashboard_i18n.ai_alerts_ai_summary_generating') }}"
  data-i18n-ai-summary-fallback="{{ __('messages.dashboard_i18n.ai_alerts_ai_summary_fallback_note') }}"
>
  <div class="section-hero section-hero--ai-insights">
    <div class="section-hero__inner">
      <div>
        <div class="section-hero__title-row">
          @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'ai', 'size' => 'hero', 'class' => 'section-hero__icon'])
          <h2 class="section-hero__title">{{ __('messages.nav.ai_insights') }}</h2>
        </div>
        <p class="section-hero__subtitle">{{ __('messages.dashboard_i18n.ai_alerts_page_subtitle') }}</p>
      </div>
      <div class="section-hero__stat">
        <div id="active-events-count" class="section-hero__stat-value" aria-live="polite">—</div>
        <div class="section-hero__stat-label">{{ __('messages.dashboard_i18n.ai_alerts_stat_active') }}</div>
      </div>
    </div>
  </div>

  <div class="section-meta">
    <span class="data-status-pill data-status-pill--live" title="{{ __('messages.dashboard.live') }}">{{ __('messages.dashboard.live') }}</span>
    <span id="ai-alerts-last-updated" class="last-updated-pill" aria-live="polite"></span>
  </div>

  <section class="card ai-alerts-summary-card" aria-labelledby="ai-alerts-summary-title">
    <div class="card__header">
      <h3 class="card__title" id="ai-alerts-summary-title">{{ __('messages.dashboard_i18n.ai_alerts_summary_title') }}</h3>
    </div>
    <div class="card__body">
      <div id="ai-alerts-summary-grid" class="grid grid--metrics grid--metrics-4" aria-live="polite" aria-busy="true">
        <article class="stat-card overview-kpi-card overview-kpi-card--skeleton" aria-hidden="true"><div class="stat-card__content"><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--label"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--value"></div></div></article>
        <article class="stat-card overview-kpi-card overview-kpi-card--skeleton" aria-hidden="true"><div class="stat-card__content"><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--label"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--value"></div></div></article>
        <article class="stat-card overview-kpi-card overview-kpi-card--skeleton" aria-hidden="true"><div class="stat-card__content"><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--label"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--value"></div></div></article>
        <article class="stat-card overview-kpi-card overview-kpi-card--skeleton" aria-hidden="true"><div class="stat-card__content"><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--label"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--value"></div></div></article>
      </div>
      <p id="ai-alerts-summary-notice" class="ai-alerts-page__notice" role="status" hidden></p>
    </div>
  </section>

  <section class="card ai-alerts-events-card" aria-labelledby="ai-alerts-events-title">
    <div class="card__header">
      <h3 class="card__title" id="ai-alerts-events-title">{{ __('messages.dashboard_i18n.ai_alerts_events_title') }}</h3>
    </div>
    <div class="card__body ai-alerts-events-card__body">
      <div class="ai-alerts-table-wrap">
        <table class="ai-events-table ai-alerts-events-table" aria-describedby="ai-alerts-events-title">
          <thead>
            <tr>
              <th scope="col">{{ __('messages.dashboard_i18n.ai_alerts_col_status') }}</th>
              <th scope="col">{{ __('messages.dashboard_i18n.ai_alerts_col_alert') }}</th>
              <th scope="col">{{ __('messages.dashboard_i18n.ai_alerts_col_metric') }}</th>
              <th scope="col">{{ __('messages.dashboard_i18n.ai_alerts_col_sensor') }}</th>
              <th scope="col">{{ __('messages.dashboard_i18n.ai_alerts_col_value') }}</th>
              <th scope="col">{{ __('messages.dashboard_i18n.ai_alerts_col_condition') }}</th>
              <th scope="col">{{ __('messages.dashboard_i18n.ai_alerts_col_triggered') }}</th>
              <th scope="col">{{ __('messages.dashboard_i18n.ai_alerts_col_resolved') }}</th>
              <th scope="col">{{ __('messages.dashboard_i18n.ai_alerts_col_details') }}</th>
              <th scope="col">{{ __('messages.dashboard_i18n.ai_alerts_col_actions') }}</th>
            </tr>
          </thead>
          <tbody id="ai-alerts-events-body">
            <tr>
              <td colspan="10" class="ai-alerts-events-table__loading">{{ __('messages.common.loading') }}…</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="ai-alerts-page__action-note">{{ __('messages.dashboard_i18n.ai_alerts_action_api_pending') }}</p>
    </div>
  </section>

  <section class="card ai-alerts-analysis-card" aria-labelledby="ai-alerts-analysis-title">
    <div class="card__header ai-alerts-analysis-card__header">
      <h3 class="card__title" id="ai-alerts-analysis-title">{{ __('messages.dashboard_i18n.ai_alerts_future_ai_title') }}</h3>
      <button type="button" id="ai-alerts-generate-summary-btn" class="btn btn--secondary btn--sm" hidden>
        {{ __('messages.dashboard_i18n.ai_alerts_ai_summary_generate') }}
      </button>
    </div>
    <div class="card__body">
      <p id="ai-alerts-ai-summary-text" class="ai-alerts-analysis-card__text" aria-live="polite">
        {{ __('messages.common.loading') }}…
      </p>
      <p id="ai-alerts-ai-summary-meta" class="ai-alerts-analysis-card__meta" hidden></p>
      <p id="ai-alerts-ai-summary-notice" class="ai-alerts-page__notice" role="status" hidden></p>
    </div>
  </section>
</div>
@endsection
