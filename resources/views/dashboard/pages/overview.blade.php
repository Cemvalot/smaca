@extends('dashboard.layouts.app')

@section('dashboard-content')
@php
  $smacaRole = session('role', 'user');
  $smacaIsAdmin = $smacaRole === 'admin';
@endphp
<div class="dashboard-section" id="overview" data-section="overview">
  <div class="grid grid--metrics grid--metrics-4 overview-kpi-grid">
    <article class="stat-card overview-kpi-card">
      <div class="stat-card__content">
        <div class="stat-card__label">Active Sensors</div>
        <div id="overview-active-sensors" class="stat-card__value">24</div>
        <div class="stat-card__meta">
          <span id="overview-active-sensors-trend" class="overview-trend overview-trend--neutral">--</span>
          <span class="overview-kpi-signal overview-kpi-signal--stable"></span>
        </div>
      </div>
    </article>
    <article class="stat-card overview-kpi-card">
      <div class="stat-card__content">
        <div class="stat-card__label">Air Quality Status</div>
        <div id="overview-air-quality-status" class="stat-card__value">--</div>
        <div class="stat-card__meta">
          <span id="overview-air-quality-trend" class="overview-trend overview-trend--neutral">--</span>
          <span class="overview-kpi-signal overview-kpi-signal--success"></span>
        </div>
      </div>
    </article>
    <article class="stat-card overview-kpi-card">
      <div class="stat-card__content">
        <div class="stat-card__label">Occupancy Load</div>
        <div id="overview-occupancy-load" class="stat-card__value">23</div>
        <div class="stat-card__meta">
          <span id="overview-occupancy-trend" class="overview-trend overview-trend--neutral">--</span>
          <span class="overview-kpi-signal overview-kpi-signal--warning"></span>
        </div>
      </div>
    </article>
    @if($smacaIsAdmin)
    <article class="stat-card overview-kpi-card">
      <div class="stat-card__content">
        <div class="stat-card__label">Connectivity Health</div>
        <div id="overview-connectivity-health" class="stat-card__value">98%</div>
        <div class="stat-card__meta">
          <span id="overview-connectivity-trend" class="overview-trend overview-trend--neutral">--</span>
          <span class="overview-kpi-signal overview-kpi-signal--info"></span>
        </div>
      </div>
    </article>
    @endif
  </div>

  <div class="overview-top-grid">
    <section class="card overview-live-card">
      <div class="card__header">
        <div class="overview-live-header">
          <div class="card__header-icon">
            <div class="overview-live-icon-shell">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
            </div>
            <div class="overview-live-header-copy">
              <h3 class="card__title">Campus Live Status</h3>
              <p class="overview-live-subtitle">
                Real-time operations snapshot across air quality, occupancy, connectivity, and environmental exposure.
              </p>
            </div>
          </div>
          <div class="overview-live-health">
            <span class="overview-live-pulse" aria-hidden="true"></span>
            <div class="overview-live-health__copy">
              <span id="overview-live-overall-status" class="overview-live-health__label">System monitoring active</span>
              <span id="overview-live-overall-detail" class="overview-live-health__detail">Operational interpretation is updating from live telemetry.</span>
            </div>
          </div>
        </div>
      </div>
      <div class="card__body">
        <div class="overview-status-groups">
          <section id="overview-status-attention-group" class="overview-status-group overview-status-group--attention">
            <header class="overview-status-group__header">
              <h4 class="overview-status-group__title">Needs Attention</h4>
              <span id="overview-status-attention-count" class="overview-status-group__count">0 modules</span>
            </header>
            <div id="overview-status-attention-grid" class="overview-status-grid">
              <!-- Filled dynamically based on module state -->
            </div>
          </section>
          <section id="overview-status-operational-group" class="overview-status-group overview-status-group--operational">
            <header class="overview-status-group__header">
              <h4 class="overview-status-group__title">Operational</h4>
              <span id="overview-status-operational-count" class="overview-status-group__count">0 modules</span>
            </header>
            <div id="overview-status-operational-grid" class="overview-status-grid">
              <article class="overview-status-box overview-status-box--success" id="overview-status-tile-air-quality" data-tone="success">
                <div class="overview-status-box__topline">
                  <span class="overview-status-box__module">
                    <i class="overview-dot overview-dot--success"></i>Air Quality
                  </span>
                  <span class="overview-status-chip overview-status-chip--success">Healthy</span>
                </div>
                <span class="overview-status-box__value" id="overview-badge-air-quality">Monitoring</span>
                <p id="overview-insight-air-quality" class="overview-status-box__insight">Assessing room air patterns and alert thresholds.</p>
              </article>
              @if($smacaIsAdmin)
              <article class="overview-status-box overview-status-box--info" id="overview-status-tile-connectivity" data-tone="info">
                <div class="overview-status-box__topline">
                  <span class="overview-status-box__module">
                    <i class="overview-dot overview-dot--info"></i>Connectivity
                  </span>
                  <span class="overview-status-chip overview-status-chip--info">Stable</span>
                </div>
                <span class="overview-status-box__value" id="overview-badge-connectivity">Monitoring</span>
                <p id="overview-insight-connectivity" class="overview-status-box__insight">Validating gateway availability and stream continuity.</p>
              </article>
              @endif
              <article class="overview-status-box overview-status-box--warning" id="overview-status-tile-occupancy" data-tone="warning">
                <div class="overview-status-box__topline">
                  <span class="overview-status-box__module">
                    <i class="overview-dot overview-dot--warning"></i>Occupancy
                  </span>
                  <span class="overview-status-chip overview-status-chip--warning">Watch</span>
                </div>
                <span class="overview-status-box__value" id="overview-badge-occupancy">Monitoring</span>
                <p id="overview-insight-occupancy" class="overview-status-box__insight">Checking activity consistency across monitored zones.</p>
              </article>
              <article class="overview-status-box overview-status-box--accent" id="overview-status-tile-uv" data-tone="accent">
                <div class="overview-status-box__topline">
                  <span class="overview-status-box__module">
                    <i class="overview-dot overview-dot--accent"></i>Environmental/UV
                  </span>
                  <span class="overview-status-chip overview-status-chip--accent">Normal</span>
                </div>
                <span class="overview-status-box__value" id="overview-badge-uv">Monitoring</span>
                <p id="overview-insight-uv" class="overview-status-box__insight">Reviewing exposure trends and external condition changes.</p>
              </article>
            </div>
          </section>
        </div>
        @if($smacaIsAdmin)
          <div class="overview-live-telemetry">
            <div class="overview-live-telemetry__item">
              <span class="overview-live-telemetry__label">Live stream state</span>
              <span id="overview-live-streams-status" class="overview-live-telemetry__value data-status-pill data-status-pill--live">Live Streams: --</span>
            </div>
            <div class="overview-live-telemetry__item">
              <span class="overview-live-telemetry__label">Data freshness</span>
              <span id="overview-data-freshness" class="overview-live-telemetry__value overview-chip">Data freshness: --</span>
            </div>
            <div class="overview-live-telemetry__item">
              <span class="overview-live-telemetry__label">Last sync</span>
              <span id="overview-last-sync" class="overview-live-telemetry__value last-updated-pill">Last sync: --</span>
            </div>
          </div>
        @else
          <p class="overview-live-note">Campus conditions remain within normal monitoring thresholds across active zones.</p>
        @endif
      </div>
    </section>

    <aside class="overview-side-stack">
      <section class="card overview-air-score-card">
        <div class="card__header">
          <h3 class="card__title">Air Quality Score</h3>
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
                <div class="overview-gauge__label">IAQ Index</div>
              </div>
            </div>
          </div>
          <p id="overview-air-score-meta" class="overview-air-score-meta">Awaiting live IAQ data.</p>
        </div>
      </section>

      @if($smacaIsAdmin)
        <section class="card overview-stability-card">
          <div class="card__header">
            <h3 class="card__title">System Stability</h3>
          </div>
          <div class="card__body">
            <div class="stat-row"><span class="stat-row__label">Sensors Online</span><span id="overview-sensors-online" class="stat-row__value">--</span></div>
            <div class="stat-row"><span class="stat-row__label">Data Freshness</span><span id="overview-data-freshness-admin" class="stat-row__value">--</span></div>
            <div class="stat-row"><span class="stat-row__label">Alert Count (24h)</span><span id="overview-ai-events" class="stat-row__value">--</span></div>
          </div>
        </section>
      @endif
    </aside>
  </div>

  <div class="overview-middle-grid {{ $smacaIsAdmin ? '' : 'overview-middle-grid--single' }}">
    <section class="card overview-trend-card">
      <div class="card__header">
        <div class="card__header-icon">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 3.055A9.005 9.005 0 0120.945 11H13V3.055z"></path>
          </svg>
          <h3 class="card__title">Campus Trend Overview</h3>
        </div>
      </div>
      <div class="card__body">
        <div class="overview-chart-shell" aria-label="Campus Trend Overview chart">
          <div class="overview-chart-shell__legend">
            <span><i class="overview-dot overview-dot--accent"></i> CO2 (ppm)</span>
            <span><i class="overview-dot overview-dot--success"></i> Occupancy (count)</span>
            <span><i class="overview-dot overview-dot--info"></i> Connectivity (% uptime)</span>
            <span><i class="overview-dot overview-dot--warning"></i> UV Index</span>
          </div>
          <div id="overview-campus-trend-chart" class="overview-chart-shell__plot overview-live-chart" role="img" aria-label="Campus trend line chart showing CO2, occupancy, and connectivity over time"></div>
          <p class="overview-chart-shell__helper">Trends are aggregated hourly from live campus telemetry in the selected time range.</p>
        </div>
      </div>
    </section>

    @if($smacaIsAdmin)
      <aside class="card overview-module-activity-card">
        <div class="card__header">
          <div class="card__header-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v18m14-18v18M3 7h18M3 17h18"></path>
            </svg>
            <h3 class="card__title">Module Activity</h3>
          </div>
        </div>
        <div class="card__body">
          <div class="overview-module-activity-list">
            <div class="overview-module-activity-item">
              <span class="overview-module-activity-item__label">Air Quality</span>
              <span id="overview-module-status-iaq" class="overview-module-activity-item__status overview-module-activity-item__status--active">--</span>
            </div>
            <div class="overview-module-activity-item">
              <span class="overview-module-activity-item__label">Environmental / UV</span>
              <span id="overview-module-status-environmental" class="overview-module-activity-item__status overview-module-activity-item__status--stable">--</span>
            </div>
            <div class="overview-module-activity-item">
              <span class="overview-module-activity-item__label">Occupancy</span>
              <span id="overview-module-status-occupancy" class="overview-module-activity-item__status overview-module-activity-item__status--warning">--</span>
            </div>
            <div class="overview-module-activity-item">
              <span class="overview-module-activity-item__label">Connectivity</span>
              <span id="overview-module-status-connectivity" class="overview-module-activity-item__status overview-module-activity-item__status--stable">--</span>
            </div>
          </div>
        </div>
      </aside>
    @endif
  </div>

  <section class="card overview-quick-access">
    <div class="card__header">
      <h3 class="card__title">Quick Access Modules</h3>
    </div>
    <div class="card__body">
      <div class="overview-module-grid">
        <a href="{{ url('/dashboard/iaq') }}" class="overview-module-card" data-section="iaq">
          <span class="overview-module-card__icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </span>
          <span class="overview-module-card__title">Air Quality</span>
          <span class="overview-module-card__desc">View indoor air metrics and trend baselines.</span>
          <span class="overview-module-card__action">Open module</span>
        </a>
        <a href="{{ url('/dashboard/environmental') }}" class="overview-module-card" data-section="environmental">
          <span class="overview-module-card__icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </span>
          <span class="overview-module-card__title">Environmental / UV</span>
          <span class="overview-module-card__desc">Track ambient conditions and UV exposure patterns.</span>
          <span class="overview-module-card__action">Open module</span>
        </a>
        <a href="{{ url('/dashboard/occupancy') }}" class="overview-module-card" data-section="occupancy">
          <span class="overview-module-card__icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          </span>
          <span class="overview-module-card__title">Occupancy</span>
          <span class="overview-module-card__desc">Monitor utilization and movement across spaces.</span>
          <span class="overview-module-card__action">Open module</span>
        </a>
        @if($smacaIsAdmin)
        <a href="{{ url('/dashboard/connectivity') }}" class="overview-module-card" data-section="connectivity">
          <span class="overview-module-card__icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path></svg>
          </span>
          <span class="overview-module-card__title">Connectivity</span>
          <span class="overview-module-card__desc">Inspect network reliability and endpoint health.</span>
          <span class="overview-module-card__action">Open module</span>
        </a>
        @endif
        @if($smacaIsAdmin)
          <a href="{{ url('/dashboard/energy') }}" class="overview-module-card overview-module-card--admin" data-section="energy">
            <span class="overview-module-card__icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </span>
            <span class="overview-module-card__title">Energy</span>
            <span class="overview-module-card__desc">Review usage, peaks, and efficiency indicators.</span>
            <span class="overview-module-card__action">Open admin module</span>
          </a>
          <a href="{{ url('/dashboard/management') }}" class="overview-module-card overview-module-card--admin" data-section="management">
            <span class="overview-module-card__icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </span>
            <span class="overview-module-card__title">Management</span>
            <span class="overview-module-card__desc">Maintain sensors, users, and platform operations.</span>
            <span class="overview-module-card__action">Open admin module</span>
          </a>
          <a href="{{ url('/dashboard/ai-insights') }}" class="overview-module-card overview-module-card--admin" data-section="ai-insights">
            <span class="overview-module-card__icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
            </span>
            <span class="overview-module-card__title">AI Insights</span>
            <span class="overview-module-card__desc">Discover anomaly signals and predictive recommendations.</span>
            <span class="overview-module-card__action">Open admin module</span>
          </a>
        @endif
      </div>
    </div>
  </section>
</div>
@endsection
