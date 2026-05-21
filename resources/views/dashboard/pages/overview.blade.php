@extends('dashboard.layouts.app')

@section('dashboard-content')
@php
  $smacaRole = session('role', 'user');
  $smacaIsAdmin = $smacaRole === 'admin';
@endphp
<div class="dashboard-section overview-page" id="overview" data-section="overview">
  <section class="card overview-snapshot-section" style="margin-bottom: var(--space-5);">
    <div class="card__header">
      <h3 class="card__title">{{ __('messages.dashboard_i18n.kpi_title_overview') }}</h3>
    </div>
    <div class="card__body">
      <p class="overview-live-note" style="margin-bottom: var(--space-3);">{{ __('messages.dashboard_i18n.kpi_intro_overview') }}</p>
      <div id="overview-spatial-zones" class="overview-scope-host" data-smaca-overview-scope aria-live="polite"></div>
      <div id="overview-scope-summary" class="overview-spatial-summary" style="margin-bottom: var(--space-3); font-size: 12px; color: var(--muted);"></div>
      <div id="overview-kpi-summary-cards" class="grid grid--metrics grid--metrics-2 overview-kpi-grid--loading" aria-busy="true">
        <article class="stat-card overview-kpi-card overview-kpi-card--skeleton" aria-hidden="true"><div class="stat-card__content"><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--label"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--value"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--meta"></div></div></article>
        <article class="stat-card overview-kpi-card overview-kpi-card--skeleton" aria-hidden="true"><div class="stat-card__content"><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--label"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--value"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--meta"></div></div></article>
        <article class="stat-card overview-kpi-card overview-kpi-card--skeleton" aria-hidden="true"><div class="stat-card__content"><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--label"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--value"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--meta"></div></div></article>
        <article class="stat-card overview-kpi-card overview-kpi-card--skeleton" aria-hidden="true"><div class="stat-card__content"><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--label"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--value"></div><div class="overview-kpi-skeleton-line overview-kpi-skeleton-line--meta"></div></div></article>
      </div>
    </div>
  </section>

  {{-- Legacy `.overview-kpi-grid` removed: it duplicated the new top
       telemetry tiles below (module-health bars + sensor-status donut +
       worst-module / alerts / top-CO₂ / stalest tiles cover the same
       information) and held hardcoded placeholder values that
       legacy JS was overwriting on load. Hidden DOM IDs are retained as
       inert spans below so any pre-existing legacy bootstrap that still
       references them via `getElementById` does not throw. --}}
  <div data-smaca-legacy-overview-anchors hidden aria-hidden="true">
    <span id="overview-active-sensors"></span>
    <span id="overview-active-sensors-trend"></span>
    <span id="overview-air-quality-status"></span>
    <span id="overview-air-quality-trend"></span>
    <span id="overview-occupancy-load"></span>
    <span id="overview-occupancy-trend"></span>
    <span id="overview-connectivity-health"></span>
    <span id="overview-connectivity-trend"></span>
  </div>

  <section class="card smaca-telemetry-card overview-live-panel">
    <div class="card__header">
      <h3 class="card__title">{{ __('messages.dashboard_i18n.campus_live_status') }}</h3>
      <p class="card__subtitle">{{ __('messages.dashboard_i18n.overview_realtime_snapshot') }}</p>
    </div>
    <div class="card__body">
      <div class="smaca-tg smaca-tg--rich" data-smaca-telemetry="overview">
        <div data-tile="module-health"   class="smaca-tile--w6"></div>
        <div data-tile="status-donut"    class="smaca-tile--w6"></div>
        <div data-tile="worst-module"    class="smaca-tile--w3"></div>
        <div data-tile="alerts"          class="smaca-tile--w3"></div>
        <div data-tile="top-co2"         class="smaca-tile--w3"></div>
        <div data-tile="stalest"         class="smaca-tile--w3"></div>
      </div>
    </div>
  </section>

  {{-- Campus trend chart (timeseries view, complementary to snapshot tiles above). --}}
  <div class="overview-middle-grid overview-middle-grid--single">
    <section class="card overview-trend-card">
      <div class="card__header">
        <div class="card__header-icon">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 3.055A9.005 9.005 0 0120.945 11H13V3.055z"></path>
          </svg>
          <h3 class="card__title">{{ __('messages.nav.dashboard') }}</h3>
        </div>
        <p class="card__subtitle">{{ __('messages.dashboard_i18n.overview_chart_subtitle') }}</p>
      </div>
      <div class="card__body">
        <div class="overview-chart-shell" aria-label="{{ __('messages.nav.dashboard') }} chart">
          <div class="overview-chart-shell__legend" id="overview-chart-legend">
            <span data-series="co2"><i class="overview-dot overview-dot--accent"></i> {{ __('messages.dashboard_i18n.overview_chart_legend_co2') }}</span>
            <span data-series="occupancy"><i class="overview-dot overview-dot--success"></i> {{ __('messages.dashboard_i18n.overview_chart_movement_balance') }} · {{ __('messages.dashboard_i18n.overview_module_occupancy') }}</span>
            <span data-series="connectivity"><i class="overview-dot overview-dot--info"></i> {{ __('messages.dashboard_i18n.overview_chart_legend_connectivity') }}</span>
            <span data-series="uv"><i class="overview-dot overview-dot--warning"></i> {{ __('messages.dashboard_i18n.overview_chart_legend_uv') }}</span>
          </div>
          <div id="overview-campus-trend-chart" class="overview-chart-shell__plot overview-live-chart" role="img" aria-label="Campus trend line chart"></div>
          <p class="overview-chart-shell__helper">{{ __('messages.dashboard_i18n.overview_chart_subtitle') }}</p>
        </div>
      </div>
    </section>
  </div>

  <section class="card overview-quick-access">
    <div class="card__header">
      <h3 class="card__title">{{ __('messages.dashboard_i18n.overview_nav_section_title') }}</h3>
    </div>
    <div class="card__body">
      <div class="overview-module-grid">
        <a href="{{ url('/dashboard/iaq') }}" class="overview-module-card" data-section="iaq">
          @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'iaq', 'size' => 'lg', 'class' => 'overview-module-card__icon'])
          <span class="overview-module-card__title">{{ __('messages.nav.iaq') }}</span>
          <span class="overview-module-card__desc">{{ __('messages.dashboard_i18n.overview_nav_iaq_desc') }}</span>
          <span class="overview-module-card__indicator" aria-live="polite"></span>
          <span class="overview-module-card__action">{{ __('messages.dashboard_i18n.overview_view_module') }}</span>
        </a>
        <a href="{{ url('/dashboard/environmental') }}" class="overview-module-card" data-section="environmental">
          @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'environmental', 'size' => 'lg', 'class' => 'overview-module-card__icon'])
          <span class="overview-module-card__title">{{ __('messages.nav.environmental') }}</span>
          <span class="overview-module-card__desc">{{ __('messages.dashboard_i18n.overview_nav_environmental_desc') }}</span>
          <span class="overview-module-card__indicator" aria-live="polite"></span>
          <span class="overview-module-card__action">{{ __('messages.dashboard_i18n.overview_view_module') }}</span>
        </a>
        <a href="{{ url('/dashboard/occupancy') }}" class="overview-module-card" data-section="occupancy">
          @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'occupancy', 'size' => 'lg', 'class' => 'overview-module-card__icon'])
          <span class="overview-module-card__title">{{ __('messages.nav.occupancy') }}</span>
          <span class="overview-module-card__desc">{{ __('messages.dashboard_i18n.overview_nav_occupancy_desc') }}</span>
          <span class="overview-module-card__indicator" aria-live="polite"></span>
          <span class="overview-module-card__action">{{ __('messages.dashboard_i18n.overview_view_module') }}</span>
        </a>
        @if($smacaIsAdmin)
        <a href="{{ url('/dashboard/connectivity') }}" class="overview-module-card" data-section="connectivity">
          @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'connectivity', 'size' => 'lg', 'class' => 'overview-module-card__icon'])
          <span class="overview-module-card__title">{{ __('messages.nav.connectivity') }}</span>
          <span class="overview-module-card__desc">{{ __('messages.dashboard_i18n.overview_nav_connectivity_desc') }}</span>
          <span class="overview-module-card__indicator" aria-live="polite"></span>
          <span class="overview-module-card__action">{{ __('messages.dashboard_i18n.overview_view_module') }}</span>
        </a>
        @endif
        @if($smacaIsAdmin)
          <a href="{{ url('/dashboard/energy') }}" class="overview-module-card overview-module-card--admin" data-section="energy">
            @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'energy', 'size' => 'lg', 'class' => 'overview-module-card__icon'])
            <span class="overview-module-card__title">{{ __('messages.nav.energy') }}</span>
            <span class="overview-module-card__desc">{{ __('messages.dashboard_i18n.overview_nav_energy_desc') }}</span>
            <span class="overview-module-card__indicator" aria-live="polite"></span>
          <span class="overview-module-card__action">{{ __('messages.dashboard_i18n.overview_view_module') }}</span>
          </a>
          <a href="{{ url('/dashboard/management') }}" class="overview-module-card overview-module-card--admin overview-module-card--muted" data-section="management">
            @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'management', 'size' => 'lg', 'class' => 'overview-module-card__icon'])
            <span class="overview-module-card__title">{{ __('messages.nav.management') }}</span>
            <span class="overview-module-card__desc">{{ __('messages.dashboard_i18n.overview_nav_management_desc') }}</span>
            <span class="overview-module-card__indicator" aria-live="polite"></span>
          <span class="overview-module-card__action">{{ __('messages.dashboard_i18n.overview_view_module') }}</span>
          </a>
          <a href="{{ url('/dashboard/ai-insights') }}" class="overview-module-card overview-module-card--admin overview-module-card--muted" data-section="ai-insights">
            @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'ai', 'size' => 'lg', 'class' => 'overview-module-card__icon'])
            <span class="overview-module-card__title">{{ __('messages.nav.ai_insights') }}</span>
            <span class="overview-module-card__desc">{{ __('messages.dashboard_i18n.overview_nav_ai_desc') }}</span>
            <span class="overview-module-card__indicator" aria-live="polite"></span>
          <span class="overview-module-card__action">{{ __('messages.dashboard_i18n.overview_view_module') }}</span>
          </a>
        @endif
      </div>
    </div>
  </section>
</div>

<script>
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.SMACAApi || typeof window.SMACAApi.fetchKpiSummary !== 'function') return;
    if (!window.SMACAKPIRenderer || typeof window.SMACAKPIRenderer.render !== 'function') return;
    if (!window.SMACAOverviewKpi || typeof window.SMACAOverviewKpi.load !== 'function') return;

    function escapeAttr(value) {
      return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escapeText(value) {
      return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function tr(key, fb) {
      var d = window.SMACA_TRANSLATIONS || {};
      return (d[key] && String(d[key]).trim()) ? d[key] : (fb || key);
    }

    function initOverviewScope() {
      if (window.SMACAOverviewScope && typeof window.SMACAOverviewScope.init === 'function') {
        window.SMACAOverviewScope.init();
      }
    }

    function refreshOverviewScope() {
      var host = document.getElementById('overview-spatial-zones');
      if (host && window.SMACAOverviewScope && typeof window.SMACAOverviewScope.render === 'function') {
        window.SMACAOverviewScope.render(host);
      }
    }

    function loadOverviewKpis() {
      window.SMACAOverviewKpi.load();
    }

    initOverviewScope();
    loadOverviewKpis();
    window.addEventListener('smaca:scope-change', function () {
      refreshOverviewScope();
      loadOverviewKpis();
    });
    window.addEventListener('smaca:timeframe-changed', loadOverviewKpis);

    function findOverviewKpi(bundles, moduleKey, keys) {
      var bundle = bundles && bundles[moduleKey];
      if (!bundle || !Array.isArray(bundle.kpis)) return null;
      for (var i = 0; i < keys.length; i++) {
        var hit = bundle.kpis.find(function (k) { return k && k.key === keys[i]; });
        if (hit) return hit;
      }
      return null;
    }

    function indicatorLabelForKpi(kpi) {
      if (!kpi) return '';
      if (kpi.interpretation_label) return String(kpi.interpretation_label);
      if (kpi.value !== null && kpi.value !== undefined && kpi.unit_label) {
        return String(kpi.value) + ' ' + String(kpi.unit_label);
      }
      if (kpi.value !== null && kpi.value !== undefined) return String(kpi.value);
      return tr('overview_status_normal', 'Normal');
    }

    function hydrateNavIndicators(bundles) {
      var map = {
        iaq: findOverviewKpi(bundles, 'iaq', ['environmental_safety_index', 'ventilation_quality_index', 'iaq_thermal_comfort']),
        energy: findOverviewKpi(bundles, 'energy', ['normalized_energy_intensity']),
        occupancy: findOverviewKpi(bundles, 'occupancy', ['movement_activity_index', 'crowd_density_level']),
        environmental: findOverviewKpi(bundles, 'environmental', ['uv_exposure_risk'])
      };
      document.querySelectorAll('.overview-module-card[data-section]').forEach(function (card) {
        var section = card.getAttribute('data-section');
        var ind = card.querySelector('.overview-module-card__indicator');
        if (!ind) return;
        var kpi = map[section];
        if (!kpi) {
          ind.textContent = '';
          ind.setAttribute('data-status', 'muted');
          return;
        }
        var status = String(kpi.status || '').toLowerCase();
        if (kpi.key === 'uv_exposure_risk') {
          ind.textContent = tr('overview_uv_high_exposure', 'High exposure');
        } else if (kpi.interpretation_label && status !== 'poor' && status !== 'good') {
          ind.textContent = String(kpi.interpretation_label);
        } else if (kpi.value !== null && kpi.value !== undefined) {
          ind.textContent = indicatorLabelForKpi(kpi);
        } else {
          ind.textContent = tr('overview_status_normal', 'Normal');
        }
        ind.setAttribute('data-status', kpi.status ? String(kpi.status) : 'muted');
      });
    }

    function clearOverviewKpiLoading() {
      var grid = document.getElementById('overview-kpi-summary-cards');
      if (!grid) return;
      grid.classList.remove('overview-kpi-grid--loading');
      grid.removeAttribute('aria-busy');
    }

    window.addEventListener('smaca:overview-kpis-ready', function (ev) {
      var bundles = (ev && ev.detail) || window.__smacaOverviewKpiBundles || {};
      clearOverviewKpiLoading();
      hydrateNavIndicators(bundles);
    });
  });
</script>
@endsection
