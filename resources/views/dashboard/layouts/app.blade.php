@php
  $smacaAssetVersion = static function (string $relativePath): string {
    static $versionCache = [];

    if (isset($versionCache[$relativePath])) {
      return $versionCache[$relativePath];
    }

    $absolutePath = public_path($relativePath);
    $version = is_file($absolutePath)
      ? (string) filemtime($absolutePath)
      : (string) config('app.version', '1');

    $versionCache[$relativePath] = $version;
    return $version;
  };
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="base-url" content="{{ url('/') }}">
  <title>{{ __('messages.app.title') }}</title>
  <link rel="icon" type="image/x-icon" href="{{ asset('assets/brand/favicon.ico') }}">
  <link rel="icon" type="image/png" sizes="32x32" href="{{ asset('assets/brand/smaca-favicon-32.png') }}">
  <link rel="icon" type="image/svg+xml" href="{{ asset('assets/brand/smaca-favicon.svg') }}">
  <link rel="shortcut icon" href="{{ asset('assets/brand/favicon.ico') }}">
  <link rel="apple-touch-icon" sizes="180x180" href="{{ asset('assets/brand/smaca-favicon-180.png') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/base.css') }}?v={{ $smacaAssetVersion('assets/css/base.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-logo.css') }}?v={{ $smacaAssetVersion('assets/css/smaca-logo.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/dashboard.css') }}?v={{ $smacaAssetVersion('assets/css/dashboard.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-dashboard.css') }}?v={{ $smacaAssetVersion('assets/css/smaca-dashboard.css') }}">
</head>
<body>
  <div class="app">
    @include('dashboard.partials.sidebar')
    <main class="main">
      @include('dashboard.partials.topbar')
      <div class="content">
        @if (session('error'))
          <div class="auth-error" role="alert" style="margin-bottom: 12px;">
            {{ session('error') }}
          </div>
        @endif
        @if (session('success'))
          <div class="auth-success" role="status" style="margin-bottom: 12px;">
            {{ session('success') }}
          </div>
        @endif
        <div id="smaca-page-loading-overlay" class="smaca-page-loading-overlay" aria-live="polite" aria-hidden="true">
          <div class="smaca-page-loading-overlay__panel">
            <div class="smaca-page-loading-overlay__spinner" aria-hidden="true"></div>
            <div id="smaca-page-loading-message" class="smaca-page-loading-overlay__message">{{ __('messages.app.loading_data') }}</div>
          </div>
        </div>
        @yield('dashboard-content')
      </div>
    </main>
  </div>

  @if(($smacaPage ?? 'overview') === 'management')
  <!-- Add/{{ __('messages.dashboard.edit') }} Sensor Modal (management page only) -->
  <div id="sensor-modal" class="user-modal" style="display: none;" role="dialog" aria-labelledby="sensor-modal-title" aria-modal="true">
    <div class="user-modal__backdrop"></div>
    <div class="user-modal__dialog">
      <div class="user-modal__header">
        <h3 id="sensor-modal-title" class="user-modal__title">{{ __('messages.dashboard.save') }} Sensor</h3>
        <button type="button" class="user-modal__close" aria-label="{{ __('messages.dashboard.cancel') }}">&times;</button>
      </div>
      <form id="sensor-form" class="user-modal__body" method="post" action="#" onsubmit="return false;">
        <input type="hidden" id="sensor-form-id" name="id" value="">
        <div class="user-form-field">
          <label for="sensor-form-device-id" class="user-form-label">Device ID</label>
          <input type="text" id="sensor-form-device-id" name="deviceId" class="input" placeholder="e.g. am300-01" required>
        </div>
        <div class="user-form-field">
          <label for="sensor-form-name" class="user-form-label">Name</label>
          <input type="text" id="sensor-form-name" name="name" class="input" placeholder="Sensor display name" required>
        </div>
        <div class="user-form-field">
          <label for="sensor-form-type" class="user-form-label">Type</label>
          <select id="sensor-form-type" name="type" class="input">
            <option value="AM300">AM300</option>
            <option value="UC50x">UC50x</option>
            <option value="SDM630MCT">SDM630MCT</option>
            <option value="VS350">VS350</option>
          </select>
        </div>
        <div class="user-form-field">
          <label for="sensor-form-location" class="user-form-label">Location</label>
          <input type="text" id="sensor-form-location" name="location" class="input" placeholder="e.g. Room 101" required>
        </div>
        <div class="user-form-field">
          <label for="sensor-form-status" class="user-form-label">{{ __('messages.dashboard.status') }}</label>
          <select id="sensor-form-status" name="status" class="input">
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div class="user-form-field">
          <label for="sensor-form-battery" class="user-form-label">Battery % (optional)</label>
          <input type="number" id="sensor-form-battery" name="battery" class="input" placeholder="Leave empty if N/A" min="0" max="100" step="1">
        </div>
        <div class="user-form-field">
          <label for="sensor-form-rssi" class="user-form-label">Signal RSSI dBm (optional)</label>
          <input type="number" id="sensor-form-rssi" name="rssi" class="input" placeholder="e.g. -75" min="-120" max="0" step="1">
        </div>
      </form>
      <div class="user-modal__footer">
        <button type="button" class="btn btn--ghost user-modal__cancel">{{ __('messages.dashboard.cancel') }}</button>
        <button type="submit" form="sensor-form" class="btn btn--primary">{{ __('messages.dashboard.save') }} Sensor</button>
      </div>
    </div>
  </div>

  <!-- Add/{{ __('messages.dashboard.edit') }} User Modal (management page only) -->
  <div id="user-modal" class="user-modal" style="display: none;" role="dialog" aria-labelledby="user-modal-title" aria-modal="true">
    <div class="user-modal__backdrop"></div>
    <div class="user-modal__dialog">
      <div class="user-modal__header">
        <h3 id="user-modal-title" class="user-modal__title">{{ __('messages.dashboard.save') }} User</h3>
        <button type="button" class="user-modal__close" aria-label="{{ __('messages.dashboard.cancel') }}">&times;</button>
      </div>
      <form id="user-form" class="user-modal__body" method="post" action="#" onsubmit="return false;">
        <input type="hidden" id="user-form-id" name="id" value="">
        <div class="user-form-field">
          <label for="user-form-name" class="user-form-label">Name</label>
          <input type="text" id="user-form-name" name="name" class="input" placeholder="Full name" required>
        </div>
        <div class="user-form-field">
          <label for="user-form-email" class="user-form-label">Email</label>
          <input type="email" id="user-form-email" name="email" class="input" placeholder="user@example.com" required>
        </div>
        <div class="user-form-field">
          <label for="user-form-role" class="user-form-label">Role</label>
          <select id="user-form-role" name="role" class="input">
            <option value="user">user</option>
            <option value="admin">admin</option>
            <option value="viewer">viewer</option>
          </select>
        </div>
        <div class="user-form-field">
          <label for="user-form-status" class="user-form-label">{{ __('messages.dashboard.status') }}</label>
          <select id="user-form-status" name="status" class="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </form>
      <div class="user-modal__footer">
        <button type="button" class="btn btn--ghost user-modal__cancel">{{ __('messages.dashboard.cancel') }}</button>
        <button type="submit" form="user-form" class="btn btn--primary">{{ __('messages.dashboard.save') }} User</button>
      </div>
    </div>
  </div>
  @endif

  <!-- Scripts -->
  <script>
    window.SMACA_BASE_URL = "{{ rtrim(url('/'), '/') }}";
    window.SMACA_CURRENT_PAGE = "{{ $smacaPage ?? 'overview' }}";
    window.SMACA_SENSORS = @json($sensors ?? []);
    window.SMACA_HIGHCHARTS_SRC = "https://code.highcharts.com/12.2.0/highcharts.js";
    window.SMACA_HIGHCHARTS_MODULES = [
      "https://code.highcharts.com/12.2.0/modules/heatmap.js"
    ];
    window.SMACA_TRANSLATIONS = {
      loading_data: "{{ __('messages.app.loading_data') }}",
      no_data_available: "{{ __('messages.dashboard.no_data_available') }}",
      moderate: "{{ __('messages.status.moderate') }}",
      good: "{{ __('messages.status.good') }}",
      poor: "{{ __('messages.status.poor') }}",
      high: "{{ __('messages.status.high') }}",
      low: "{{ __('messages.public.low') }}",
      health: "{{ __('messages.common.health') }}",
      connectivity: "{{ __('messages.nav.connectivity') }}",
      energy: "{{ __('messages.nav.energy') }}",
      occupancy: "{{ __('messages.nav.occupancy') }}",
      environmental: "{{ __('messages.nav.environmental') }}",
      ai_insights: "{{ __('messages.nav.ai_insights') }}",
      management: "{{ __('messages.nav.management') }}",
      status: "{{ __('messages.dashboard.status') }}",
      online: "{{ __('messages.common.online') }}",
      offline: "{{ __('messages.common.offline') }}",
      last_update: "{{ __('messages.dashboard.last_update') }}",
      export: "{{ __('messages.dashboard.export') }}",
      download_csv: "{{ __('messages.export.download_csv') }}",
      download_excel: "{{ __('messages.export.download_excel') }}",
      not_available: "{{ __('messages.common.not_available') }}",
      active: "{{ __('messages.common.active') }}",
      inactive: "{{ __('messages.common.inactive') }}",
      acknowledged: "{{ __('messages.status.acknowledged') }}",
      resolved: "{{ __('messages.status.resolved') }}",
      open: "{{ __('messages.status.open') }}",
      extreme: "{{ __('messages.status.extreme') }}",
      trend: "{{ __('messages.status.trend') }}",
      usage: "{{ __('messages.status.usage') }}",
      activity: "{{ __('messages.status.activity') }}",
      what_is_this_graph: "{{ __('messages.status.what_is_this_graph') }}",
      warning: "{{ __('messages.status.warning') }}",
      action: "{{ __('messages.status.action') }}",
      time_24h: "{{ __('messages.dashboard_i18n.time_24h') }}",
      time_7d: "{{ __('messages.dashboard_i18n.time_7d') }}",
      time_30d: "{{ __('messages.dashboard_i18n.time_30d') }}",
      active_now: "{{ __('messages.dashboard_i18n.active_now') }}",
      uptime: "{{ __('messages.dashboard_i18n.uptime') }}",
      live_streams: "{{ __('messages.dashboard_i18n.live_streams') }}",
      system_operating_normally: "{{ __('messages.dashboard_i18n.system_operating_normally') }}",
      modules_stable_operational: "{{ __('messages.dashboard_i18n.modules_stable_operational') }}",
      system_monitoring_active: "{{ __('messages.dashboard_i18n.system_monitoring_active') }}",
      waiting_for_telemetry: "{{ __('messages.dashboard_i18n.waiting_for_telemetry') }}",
      data_reliability: "{{ __('messages.dashboard_i18n.data_reliability') }}",
      active_iaq_sensors: "{{ __('messages.dashboard_i18n.active_iaq_sensors') }}",
      metric_coverage: "{{ __('messages.dashboard_i18n.metric_coverage') }}",
      medium_caution: "{{ __('messages.dashboard_i18n.medium_caution') }}",
      high_elevated: "{{ __('messages.dashboard_i18n.high_elevated') }}",
      latest_aggregated_iaq_sample: "{{ __('messages.dashboard_i18n.latest_aggregated_iaq_sample') }}",
      overall_iaq_summary: "{{ __('messages.dashboard_i18n.overall_iaq_summary') }}",
      driver: "{{ __('messages.dashboard_i18n.driver') }}",
      latest_timestamp: "{{ __('messages.dashboard_i18n.latest_timestamp') }}",
      freshness: "{{ __('messages.dashboard_i18n.freshness') }}",
      active_sensors: "{{ __('messages.dashboard.active_sensors') }}",
      unavailable: "{{ __('messages.dashboard_i18n.unavailable') }}",
      no_connectivity_data: "{{ __('messages.dashboard_i18n.no_connectivity_data') }}",
      no_iaq_data: "{{ __('messages.dashboard_i18n.no_iaq_data') }}",
      no_occupancy_data: "{{ __('messages.dashboard_i18n.no_occupancy_data') }}",
      top_traffic_locations: "{{ __('messages.dashboard_i18n.top_traffic_locations') }}",
      what_is_this_pattern: "{{ __('messages.dashboard_i18n.what_is_this_pattern') }}",
      temperature_label: "{{ __('messages.dashboard_i18n.temperature_label') }}",
      humidity_label: "{{ __('messages.dashboard_i18n.humidity_label') }}",
      relative_humidity_percent: "{{ __('messages.dashboard_i18n.relative_humidity_percent') }}",
      thermal_comfort_zone: "{{ __('messages.dashboard_i18n.thermal_comfort_zone') }}",
      comfortable: "{{ __('messages.dashboard_i18n.comfortable') }}",
      slightly_off: "{{ __('messages.dashboard_i18n.slightly_off') }}",
      excellent: "{{ __('messages.dashboard_i18n.excellent') }}",
      humidity_slightly_off_text: "{{ __('messages.dashboard_i18n.humidity_slightly_off_text') }}",
      stable_watch_upper: "{{ __('messages.dashboard_i18n.stable_watch_upper') }}",
      operational_upper: "{{ __('messages.dashboard_i18n.operational_upper') }}",
      active_upper: "{{ __('messages.dashboard_i18n.active_upper') }}",
      stable_upper: "{{ __('messages.dashboard_i18n.stable_upper') }}",
      occupancy_patterns_balanced: "{{ __('messages.dashboard_i18n.occupancy_patterns_balanced') }}",
      air_quality_operating_normally: "{{ __('messages.dashboard_i18n.air_quality_operating_normally') }}",
      connectivity_fully_operational: "{{ __('messages.dashboard_i18n.connectivity_fully_operational') }}",
      environmental_module_normal: "{{ __('messages.dashboard_i18n.environmental_module_normal') }}",
      footfall_moderate_no_spikes: "{{ __('messages.dashboard_i18n.footfall_moderate_no_spikes') }}",
      current_iaq_behavior_healthy: "{{ __('messages.dashboard_i18n.current_iaq_behavior_healthy') }}",
      live_sensor_transport_stable: "{{ __('messages.dashboard_i18n.live_sensor_transport_stable') }}",
      environmental_uv_streams_healthy: "{{ __('messages.dashboard_i18n.environmental_uv_streams_healthy') }}",
      air_quality_stable_light_variance: "{{ __('messages.dashboard_i18n.air_quality_stable_light_variance') }}",
      readings_within_acceptable_limits: "{{ __('messages.dashboard_i18n.readings_within_acceptable_limits') }}",
      connectivity_mostly_stable: "{{ __('messages.dashboard_i18n.connectivity_mostly_stable') }}",
      minor_instability_present: "{{ __('messages.dashboard_i18n.minor_instability_present') }}",
      occupancy_flow_normal: "{{ __('messages.dashboard_i18n.occupancy_flow_normal') }}",
      space_utilization_light_consistent: "{{ __('messages.dashboard_i18n.space_utilization_light_consistent') }}",
      environmental_conditions_moderate: "{{ __('messages.dashboard_i18n.environmental_conditions_moderate') }}",
      environmental_conditions_controlled: "{{ __('messages.dashboard_i18n.environmental_conditions_controlled') }}",
      extreme_uv_summary: "{{ __('messages.dashboard_i18n.extreme_uv_summary') }}",
      extreme_uv_interpretation: "{{ __('messages.dashboard_i18n.extreme_uv_interpretation') }}",
      what_it_shows: "{{ __('messages.dashboard_i18n.what_it_shows') }}",
      timeframe_insight: "{{ __('messages.dashboard_i18n.timeframe_insight') }}",
      how_to_read_chart: "{{ __('messages.dashboard_i18n.how_to_read_chart') }}",
      why_it_matters: "{{ __('messages.dashboard_i18n.why_it_matters') }}",
      explain_timeframe_24h: "{{ __('messages.dashboard_i18n.explain_timeframe_24h') }}",
      explain_timeframe_7d: "{{ __('messages.dashboard_i18n.explain_timeframe_7d') }}",
      explain_timeframe_30d: "{{ __('messages.dashboard_i18n.explain_timeframe_30d') }}",
      explain_metric_occupancy: "{{ __('messages.dashboard_i18n.explain_metric_occupancy') }}",
      explain_metric_temperature: "{{ __('messages.dashboard_i18n.explain_metric_temperature') }}",
      explain_metric_humidity: "{{ __('messages.dashboard_i18n.explain_metric_humidity') }}",
      explain_metric_co2: "{{ __('messages.dashboard_i18n.explain_metric_co2') }}",
      explain_metric_pm25: "{{ __('messages.dashboard_i18n.explain_metric_pm25') }}",
      explain_metric_pm10: "{{ __('messages.dashboard_i18n.explain_metric_pm10') }}",
      explain_metric_tvoc: "{{ __('messages.dashboard_i18n.explain_metric_tvoc') }}",
      explain_metric_uv: "{{ __('messages.dashboard_i18n.explain_metric_uv') }}",
      explain_metric_energy: "{{ __('messages.dashboard_i18n.explain_metric_energy') }}",
      top_locations_cumulative_entries: "{{ __('messages.dashboard_i18n.top_locations_cumulative_entries') }}",
      longer_bars_more_inbound: "{{ __('messages.dashboard_i18n.longer_bars_more_inbound') }}",
      co2_hourly_avg_selected_timeframe: "{{ __('messages.dashboard_i18n.co2_hourly_avg_selected_timeframe') }}",
      hotter_colors_higher_co2: "{{ __('messages.dashboard_i18n.hotter_colors_higher_co2') }}",
      use_peak_hours_ventilation: "{{ __('messages.dashboard_i18n.use_peak_hours_ventilation') }}",
      rising: "{{ __('messages.status.rising') }}",
      falling: "{{ __('messages.status.falling') }}",
      stable_feminine: "{{ __('messages.dashboard_i18n.stable_feminine') }}",
      is_label: "{{ __('messages.dashboard_i18n.is_label') }}",
      iaq_metrics_expected_ranges: "{{ __('messages.dashboard_i18n.iaq_metrics_expected_ranges') }}",
      vs_previous_reading: "{{ __('messages.dashboard_i18n.vs_previous_reading') }}",
      data_freshness_label: "{{ __('messages.common.data_freshness') }}",
      last_updated_label: "{{ __('messages.dashboard.last_update') }}",
      last_sync_label: "{{ __('messages.common.last_sync') }}",
      not_available_label: "{{ __('messages.common.not_available') }}",
      daily_maximum: "{{ __('messages.dashboard_i18n.daily_maximum') }}",
      direction_uv_change_previous: "{{ __('messages.dashboard_i18n.direction_uv_change_previous') }}"
    };
  </script>
  <script defer src="{{ asset('assets/js/rbac.js') }}?v={{ $smacaAssetVersion('assets/js/rbac.js') }}"></script>
  <script defer src="{{ asset('assets/js/ui.js') }}?v={{ $smacaAssetVersion('assets/js/ui.js') }}"></script>
  <script defer src="{{ asset('assets/js/app.js') }}?v={{ $smacaAssetVersion('assets/js/app.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-state-manager.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-state-manager.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-trend-calculator.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-trend-calculator.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-alerts-engine.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-alerts-engine.js') }}"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"></script>
  <script defer src="{{ asset('assets/js/smaca-csv-export.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-csv-export.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-api.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-api.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-data-normalizer.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-data-normalizer.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-highcharts-loader.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-highcharts-loader.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-highcharts-adapter.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-highcharts-adapter.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-accurate-charts.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-accurate-charts.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-accurate-dashboard.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-accurate-dashboard.js') }}"></script>
  <script defer src="{{ asset('assets/js/advanced-visualizations.js') }}?v={{ $smacaAssetVersion('assets/js/advanced-visualizations.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-dashboard.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-dashboard.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-production-features.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-production-features.js') }}"></script>
  @if(($smacaPage ?? 'overview') === 'ai-insights')
    <script defer src="{{ asset('assets/js/smaca-ai-insights.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-ai-insights.js') }}"></script>
  @endif
</body>
</html>
