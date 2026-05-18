@extends('dashboard.layouts.app')

@section('dashboard-content')
@php
  $smacaRole = session('role', 'user');
  $smacaIsAdmin = $smacaRole === 'admin';
@endphp
<div class="dashboard-section" id="overview" data-section="overview">
  <section class="card" style="margin-bottom: var(--space-5);">
    <div class="card__header">
      <h3 class="card__title">{{ __('messages.dashboard_i18n.kpi_title_overview') }}</h3>
    </div>
    <div class="card__body">
      <p class="overview-live-note" style="margin-bottom: var(--space-3);">{{ __('messages.dashboard_i18n.kpi_intro_overview') }}</p>
      <div id="overview-spatial-zones" class="overview-spatial-zones" data-smaca-spatial-zones aria-live="polite" style="margin-bottom: var(--space-3);"></div>
      <div id="overview-scope-summary" class="overview-spatial-summary" style="margin-bottom: var(--space-3); font-size: 12px; color: var(--muted);"></div>
      <div id="overview-kpi-summary-cards" class="grid grid--metrics grid--metrics-2">
        <article class="stat-card overview-kpi-card"><div class="stat-card__content"><div class="stat-card__label">KPI</div><div class="stat-card__value">--</div></div></article>
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

  <section class="card smaca-telemetry-card">
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

  {{-- The legacy "Campus live status" + status groups + Health card +
       Module activity sidebar all duplicated information that is now
       answered more clearly by the new top telemetry section
       (module-health bars, sensor-status donut, alerts/stalest/top-CO₂ tiles).
       Kept the IAQ Score gauge (still unique) and the campus trend chart
       (timeseries view, complementary to the snapshot tiles above). --}}
  <div class="overview-middle-grid {{ $smacaIsAdmin ? '' : 'overview-middle-grid--single' }}">
    <section class="card overview-trend-card">
      <div class="card__header">
        <div class="card__header-icon">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 3.055A9.005 9.005 0 0120.945 11H13V3.055z"></path>
          </svg>
          <h3 class="card__title">{{ __('messages.nav.dashboard') }}</h3>
        </div>
        <p class="card__subtitle">{{ app()->getLocale() === 'el' ? 'Συνολική πορεία CO₂, κίνησης, σύνδεσης και UV στο επιλεγμένο διάστημα.' : 'Combined CO₂, movement, connectivity and UV across the selected timeframe.' }}</p>
      </div>
      <div class="card__body">
        <div class="overview-chart-shell" aria-label="{{ __('messages.nav.dashboard') }} chart">
          <div class="overview-chart-shell__legend">
            <span><i class="overview-dot overview-dot--accent"></i> CO₂ (ppm)</span>
            <span><i class="overview-dot overview-dot--success"></i> {{ __('messages.dashboard_i18n.overview_chart_movement_balance') }}</span>
            <span><i class="overview-dot overview-dot--info"></i> {{ __('messages.nav.connectivity') }} (% uptime)</span>
            <span><i class="overview-dot overview-dot--warning"></i> UV Index</span>
          </div>
          <div id="overview-campus-trend-chart" class="overview-chart-shell__plot overview-live-chart" role="img" aria-label="Campus trend line chart showing CO₂, occupancy, and connectivity over time"></div>
          <p class="overview-chart-shell__helper">{{ app()->getLocale() === 'el' ? 'Οι τάσεις υπολογίζονται ωριαίως από τη ζωντανή τηλεμετρία στο επιλεγμένο διάστημα.' : 'Trends are aggregated hourly from live campus telemetry in the selected time range.' }}</p>
        </div>
      </div>
    </section>

    <aside class="card overview-air-score-card">
      <div class="card__header">
        <h3 class="card__title">{{ __('messages.nav.iaq') }} {{ __('messages.dashboard_i18n.score') }}</h3>
        <p class="card__subtitle">{{ __('messages.dashboard_i18n.overview_iaq_score_subtitle') }}</p>
      </div>
      <div class="card__body overview-air-score-body">
        <div class="overview-gauge">
          <div class="overview-gauge__ring">
            <svg class="overview-gauge__svg" viewBox="0 0 132 132" aria-hidden="true">
              <circle class="overview-gauge__track" cx="66" cy="66" r="52"></circle>
              <circle id="overview-air-score-progress" class="overview-gauge__progress" cx="66" cy="66" r="52"></circle>
            </svg>
            <div class="overview-gauge__center">
              <div id="overview-air-score-value" class="overview-gauge__value">--</div>
              <div class="overview-gauge__label">{{ __('messages.dashboard_i18n.iaq_index') }}</div>
            </div>
          </div>
        </div>
        <p id="overview-air-score-meta" class="overview-air-score-meta">{{ __('messages.dashboard_i18n.awaiting_live_iaq_data') }}</p>
      </div>
    </aside>
  </div>

  <section class="card overview-quick-access">
    <div class="card__header">
      <h3 class="card__title">{{ __('messages.nav.dashboard') }}</h3>
    </div>
    <div class="card__body">
      <div class="overview-module-grid">
        <a href="{{ url('/dashboard/iaq') }}" class="overview-module-card" data-section="iaq">
          <span class="overview-module-card__icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </span>
          <span class="overview-module-card__title">{{ __('messages.nav.iaq') }}</span>
          <span class="overview-module-card__desc">{{ __('messages.dashboard_i18n.overview_nav_iaq_desc') }}</span>
          <span class="overview-module-card__action">{{ __('messages.dashboard.view') }}</span>
        </a>
        <a href="{{ url('/dashboard/environmental') }}" class="overview-module-card" data-section="environmental">
          <span class="overview-module-card__icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </span>
          <span class="overview-module-card__title">{{ __('messages.nav.environmental') }}</span>
          <span class="overview-module-card__desc">{{ __('messages.dashboard_i18n.overview_nav_environmental_desc') }}</span>
          <span class="overview-module-card__action">{{ __('messages.dashboard.view') }}</span>
        </a>
        <a href="{{ url('/dashboard/occupancy') }}" class="overview-module-card" data-section="occupancy">
          <span class="overview-module-card__icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          </span>
          <span class="overview-module-card__title">{{ __('messages.nav.occupancy') }}</span>
          <span class="overview-module-card__desc">{{ __('messages.dashboard_i18n.overview_nav_occupancy_desc') }}</span>
          <span class="overview-module-card__action">{{ __('messages.dashboard.view') }}</span>
        </a>
        @if($smacaIsAdmin)
        <a href="{{ url('/dashboard/connectivity') }}" class="overview-module-card" data-section="connectivity">
          <span class="overview-module-card__icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path></svg>
          </span>
          <span class="overview-module-card__title">{{ __('messages.nav.connectivity') }}</span>
          <span class="overview-module-card__desc">{{ __('messages.common.connectivity') }}</span>
          <span class="overview-module-card__action">{{ __('messages.dashboard.view') }}</span>
        </a>
        @endif
        @if($smacaIsAdmin)
          <a href="{{ url('/dashboard/energy') }}" class="overview-module-card overview-module-card--admin" data-section="energy">
            <span class="overview-module-card__icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </span>
            <span class="overview-module-card__title">{{ __('messages.nav.energy') }}</span>
            <span class="overview-module-card__desc">{{ __('messages.dashboard_i18n.overview_nav_energy_desc') }}</span>
            <span class="overview-module-card__action">{{ __('messages.dashboard.view') }}</span>
          </a>
          <a href="{{ url('/dashboard/management') }}" class="overview-module-card overview-module-card--admin" data-section="management">
            <span class="overview-module-card__icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </span>
            <span class="overview-module-card__title">{{ __('messages.nav.management') }}</span>
            <span class="overview-module-card__desc">{{ __('messages.common.management') }}</span>
            <span class="overview-module-card__action">{{ __('messages.dashboard.view') }}</span>
          </a>
          <a href="{{ url('/dashboard/ai-insights') }}" class="overview-module-card overview-module-card--admin" data-section="ai-insights">
            <span class="overview-module-card__icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
            </span>
            <span class="overview-module-card__title">{{ __('messages.nav.ai_insights') }}</span>
            <span class="overview-module-card__desc">{{ __('messages.common.ai_insights') }}</span>
            <span class="overview-module-card__action">{{ __('messages.dashboard.view') }}</span>
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

    function renderSpatialZones() {
      var host = document.getElementById('overview-spatial-zones');
      if (!host) return;
      var data = (window.SMACA_SPATIAL && window.SMACA_SPATIAL.groups) || {};
      var sections = [
        { key: 'floors', label: tr('spatial_section_floors', 'Floors') },
        { key: 'basements', label: tr('spatial_section_basements', 'Basements') },
        { key: 'special_spaces', label: tr('spatial_section_special_spaces', 'Special spaces') }
      ];
      var html = '';
      var current = (window.SMACA_LOCATION || '').toUpperCase();

      html += '<div class="overview-spatial-zones__row">';
      html += '<button type="button" class="smaca-spatial-section-pill" data-spatial-pick="" '
        + 'aria-pressed="' + (!current ? 'true' : 'false') + '">'
        + escapeText(tr('spatial_all_campus', 'All campus')) + '</button>';
      html += '</div>';

      var role = (window.SMACA_USER && String(window.SMACA_USER.role || '').toLowerCase()) || 'user';
      var isAdminLikeRole = (role === 'admin' || role === 'researcher');

      sections.forEach(function (section) {
        var items = (data[section.key] && data[section.key].items) || [];
        if (!items.length) return;
        html += '<div class="overview-spatial-zones__row">';
        html += '<span class="overview-spatial-zones__heading">' + escapeText(section.label) + '</span>';
        items.forEach(function (item) {
          if (!item || !item.code) return;
          var pressed = (current === item.code) ? 'true' : 'false';
          // Tooltip exposes the raw code only to admin/researcher — normal
          // users see the human label only, no technical metadata on hover.
          var titleAttr = isAdminLikeRole
            ? ' title="' + escapeAttr(item.code) + '"'
            : '';
          html += '<button type="button" class="smaca-spatial-scope-pill" '
            + 'data-spatial-pick="' + escapeAttr(item.code) + '" aria-pressed="' + pressed + '"'
            + titleAttr + '>'
            + escapeText(item.label || item.code) + '</button>';
        });
        html += '</div>';
      });

      host.innerHTML = html;
      Array.prototype.forEach.call(host.querySelectorAll('[data-spatial-pick]'), function (btn) {
        btn.addEventListener('click', function () {
          var code = btn.getAttribute('data-spatial-pick') || '';
          if (window.SMACASpatial && typeof window.SMACASpatial.setLocation === 'function') {
            window.SMACASpatial.setLocation(code);
          } else {
            window.SMACA_LOCATION = code || null;
            try {
              window.dispatchEvent(new CustomEvent('smaca:scope-change', { detail: { location: code || null } }));
            } catch (e) {}
          }
        });
      });
    }

    function loadOverviewKpis() {
      window.SMACAOverviewKpi.load();
    }

    renderSpatialZones();
    loadOverviewKpis();
    window.addEventListener('smaca:scope-change', function () {
      renderSpatialZones();
      loadOverviewKpis();
    });
    window.addEventListener('smaca:timeframe-changed', loadOverviewKpis);
  });
</script>
@endsection
