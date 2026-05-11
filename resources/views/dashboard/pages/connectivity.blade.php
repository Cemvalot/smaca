@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section" id="connectivity" data-section="connectivity">
          <div class="section-hero section-hero--connectivity">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path></svg>
                  <h2 class="section-hero__title">{{ __('messages.nav.connectivity') }}</h2>
                </div>
                <p class="section-hero__subtitle">Can I trust this data? Which sensors are degrading?</p>
              </div>
              <div class="section-hero__stat"><div id="connectivity-connected-sensors" class="section-hero__stat-value">{{ __('messages.common.loading') }}...</div><div class="section-hero__stat-label">{{ __('messages.common.online') }}</div></div>
            </div>
          </div>
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">{{ __('messages.dashboard.live') }}</span><span class="last-updated-pill" title="Time since last data sync">{{ __('messages.dashboard.last_update') }}: {{ __('messages.common.loading') }}...</span></div>

          <section class="card smaca-telemetry-card">
            <div class="card__header">
              <h3 class="card__title">{{ __('messages.nav.connectivity') }} · {{ __('messages.dashboard.live') }}</h3>
              <p class="card__subtitle">{{ __('messages.dashboard_i18n.overview_realtime_snapshot') }}</p>
            </div>
            <div class="card__body">
              <div class="smaca-tg smaca-tg--rich" data-smaca-telemetry="connectivity">
                <div data-tile="status-donut"    class="smaca-tile--w6"></div>
                <div data-tile="battery-dist"    class="smaca-tile--w6"></div>
                <div data-tile="device-mix"      class="smaca-tile--w6"></div>
                <div data-tile="freshness-hist"  class="smaca-tile--w6"></div>
                <div data-tile="stale"           class="smaca-tile--w3"></div>
                <div data-tile="lowest-battery"  class="smaca-tile--w3"></div>
                <div data-tile="oldest-seen"     class="smaca-tile--w3"></div>
                <div data-tile="uptime-pct"      class="smaca-tile--w3"></div>
              </div>
            </div>
          </section>

          <!-- Domain-Driven Visualization (Admin: full details; User: summary only) -->
          <div class="card connectivity-admin-detail" data-connectivity-admin-detail>
            <div class="card__header">
              <h3 class="card__title">{{ __('messages.dashboard.sensors') }} {{ __('messages.common.health') }} {{ __('messages.dashboard.status') }}</h3>
              <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">Decision: Which sensors need attention? (Battery decay, signal strength, data freshness)</p>
            </div>
            <div class="card__body">
              <div id="sensor-health-table"></div>
            </div>
          </div>
        </div>
@endsection
