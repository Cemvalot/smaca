@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section dashboard-section--connectivity" id="connectivity" data-section="connectivity">

  {{-- Hero --}}
  <div class="section-hero section-hero--connectivity conn-hero">
    <div class="conn-hero__glow" aria-hidden="true"></div>
    <div class="section-hero__inner">
      <div>
        <div class="section-hero__title-row">
          @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'connectivity', 'size' => 'hero', 'class' => 'section-hero__icon conn-hero__icon'])
          <h2 class="section-hero__title">{{ __('messages.nav.connectivity') }}</h2>
        </div>
        <p class="section-hero__subtitle">{{ __('messages.dashboard_i18n.connectivity_hero_subtitle') }}</p>
      </div>
      <div class="section-hero__stat conn-hero__stat">
        <div id="connectivity-online-count" class="section-hero__stat-value">{{ __('messages.common.loading') }}...</div>
        <div class="section-hero__stat-label">{{ __('messages.dashboard_i18n.connectivity_online_devices') }}</div>
      </div>
    </div>
  </div>
  <div class="section-meta">
    <span class="data-status-pill data-status-pill--live">{{ __('messages.dashboard.live') }}</span>
    <span class="last-updated-pill" id="connectivity-last-updated">{{ __('messages.dashboard.last_update') }}: {{ __('messages.common.loading') }}...</span>
  </div>

  {{-- §1 Quality overview KPIs --}}
  <section class="card conn-zone conn-zone--kpis" aria-labelledby="conn-kpis-title">
    <div class="card__header">
      <h3 id="conn-kpis-title" class="card__title">{{ __('messages.dashboard_i18n.kpi_title_connectivity') }}</h3>
      <p id="connectivity-limiting-factor" class="card__subtitle conn-limiting-factor" hidden></p>
    </div>
    <div class="card__body">
      <div id="connectivity-kpi-grid" class="conn-kpi-grid" aria-live="polite">
        <div class="conn-kpi-skeleton"></div>
      </div>
    </div>
  </section>

  {{-- §2 Wireless telemetry table --}}
  <section class="card conn-zone conn-zone--table" style="margin-top: var(--space-6);" aria-labelledby="conn-table-title">
    <div class="card__header">
      <h3 id="conn-table-title" class="card__title">{{ __('messages.dashboard_i18n.connectivity_wireless_table_title') }}</h3>
      <p class="card__subtitle">{{ __('messages.dashboard_i18n.connectivity_wireless_table_subtitle') }}</p>
    </div>
    <div class="card__body conn-table-wrap">
      <div id="connectivity-wireless-table-root"></div>
    </div>
  </section>

  {{-- §3 Live analytics --}}
  <section class="card conn-zone conn-zone--analytics" style="margin-top: var(--space-6);" aria-labelledby="conn-analytics-title">
    <div class="card__header">
      <h3 id="conn-analytics-title" class="card__title">{{ __('messages.dashboard_i18n.connectivity_analytics_title') }}</h3>
      <p class="card__subtitle">{{ __('messages.dashboard_i18n.connectivity_analytics_subtitle') }}</p>
    </div>
    <div class="card__body">
      <div class="conn-analytics-grid">
        <div class="conn-analytics-tile" data-conn-chart="rssi-dist">
          <div class="conn-analytics-tile__head">
            <span class="conn-analytics-tile__label">{{ __('messages.connectivity_quality.signal_strength') }}</span>
            <span class="conn-analytics-tile__accent conn-analytics-tile__accent--cyan"></span>
          </div>
          <div class="conn-analytics-tile__chart" id="conn-chart-rssi-dist"></div>
        </div>
        <div class="conn-analytics-tile" data-conn-chart="snr-dist">
          <div class="conn-analytics-tile__head">
            <span class="conn-analytics-tile__label">{{ __('messages.connectivity_quality.signal_to_noise') }}</span>
            <span class="conn-analytics-tile__accent conn-analytics-tile__accent--green"></span>
          </div>
          <div class="conn-analytics-tile__chart" id="conn-chart-snr-dist"></div>
        </div>
        <div class="conn-analytics-tile" data-conn-chart="tx-ccq-donut">
          <div class="conn-analytics-tile__head">
            <span class="conn-analytics-tile__label">{{ __('messages.connectivity_quality.client_connection_quality') }}</span>
            <span class="conn-analytics-tile__accent conn-analytics-tile__accent--amber"></span>
          </div>
          <div class="conn-analytics-tile__chart" id="conn-chart-tx-ccq-donut"></div>
        </div>
        <div class="conn-analytics-tile" data-conn-chart="tx-rate-bars">
          <div class="conn-analytics-tile__head">
            <span class="conn-analytics-tile__label">{{ __('messages.connectivity_quality.transmission_rate') }}</span>
            <span class="conn-analytics-tile__accent conn-analytics-tile__accent--indigo"></span>
          </div>
          <div class="conn-analytics-tile__chart" id="conn-chart-tx-rate-bars"></div>
        </div>
      </div>
    </div>
  </section>

  {{-- §4 Attention panel + §5 device grid --}}
  <div class="conn-split" style="margin-top: var(--space-6);">
    <section class="card conn-zone conn-zone--attention" aria-labelledby="conn-attention-title">
      <div class="card__header">
        <h3 id="conn-attention-title" class="card__title">{{ __('messages.dashboard_i18n.connectivity_attention_title') }}</h3>
      </div>
      <div class="card__body">
        <div id="connectivity-attention-panel" class="conn-attention-list"></div>
      </div>
    </section>
    <section class="card conn-zone conn-zone--devices" aria-labelledby="conn-devices-title">
      <div class="card__header">
        <h3 id="conn-devices-title" class="card__title">{{ __('messages.dashboard_i18n.connectivity_device_grid_title') }}</h3>
      </div>
      <div class="card__body">
        <div id="connectivity-device-grid" class="conn-device-grid"></div>
      </div>
    </section>
  </div>

</div>
@endsection
