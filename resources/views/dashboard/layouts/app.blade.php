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
  @include('partials.favicons')
  <link rel="stylesheet" href="{{ asset('assets/css/base.css') }}?v={{ $smacaAssetVersion('assets/css/base.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-logo.css') }}?v={{ $smacaAssetVersion('assets/css/smaca-logo.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/dashboard.css') }}?v={{ $smacaAssetVersion('assets/css/dashboard.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-dashboard.css') }}?v={{ $smacaAssetVersion('assets/css/smaca-dashboard.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-enterprise-ui.css') }}?v={{ $smacaAssetVersion('assets/css/smaca-enterprise-ui.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-institutional-tone.css') }}?v={{ $smacaAssetVersion('assets/css/smaca-institutional-tone.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-visual-clay.css') }}?v={{ $smacaAssetVersion('assets/css/smaca-visual-clay.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-performance.css') }}?v={{ $smacaAssetVersion('assets/css/smaca-performance.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-icon-chips.css') }}?v={{ $smacaAssetVersion('assets/css/smaca-icon-chips.css') }}">
</head>
<body>
  <div class="app">
    @include('dashboard.partials.sidebar')
    <div class="sidebar-backdrop" id="sidebar-backdrop" hidden aria-hidden="true"></div>
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
  @php
      $smacaRole = session('role', 'user');
      $smacaUser = [
          'role' => $smacaRole,
          'isAdmin' => $smacaRole === 'admin',
      ];
      $smacaPageForSpatial = $smacaPage ?? 'overview';
      try {
          $smacaSpatialService = new \App\Services\Spatial\SpatialService();
          $smacaSpatial = $smacaSpatialService->getLocationsForModule($smacaPageForSpatial, $smacaRole);
          // Full topology (admin-aware), used by code→label resolvers (management
          // table, alerts cards) so raw codes always render with human labels
          // regardless of which page module is active.
          $smacaSpatialAll = $smacaSpatialService->getLocationsForModule(null, 'admin');
      } catch (\Throwable $e) {
          $smacaSpatial = ['groups' => []];
          $smacaSpatialAll = ['groups' => []];
      }
      $smacaLocaleCode = strtolower(substr((string) (function_exists('app') ? app()->getLocale() : 'en'), 0, 2));

      // Clarity layer — bootstrap KPI + chart metadata so the renderer
      // and chart explainer can resolve "How to read this" without an extra
      // round-trip on first paint. Both are public-safe configs, but we wrap
      // resolution in try/catch so a misconfiguration never blocks the page.
      try {
          $smacaKpiMetadataService = new \App\Services\KPI\KPIMetadataService($smacaLocaleCode);
          $smacaKpiMetadata = $smacaKpiMetadataService->getAllKpis();
          $smacaChartMetadata = $smacaKpiMetadataService->getAllCharts();
      } catch (\Throwable $e) {
          $smacaKpiMetadata = ['version' => '0.0.0', 'kpis' => new \stdClass()];
          $smacaChartMetadata = ['version' => '0.0.0', 'charts' => new \stdClass()];
      }
      // IAQ semantics for window.SMACA_IAQ_SEMANTICS — prefer values passed from
      // smacaDashboardViewData(); fall back to config so partial Blade deploys
      // never reference undefined $smacaIaqTvocMode / $smacaIaqLightMode.
      $smacaIaqSemDefaults = config('smaca_sensor_semantics.defaults', []);
      $smacaIaqTvocMode = $smacaIaqTvocMode ?? ($smacaIaqSemDefaults['tvoc_semantic_mode'] ?? 'iaq_rating_level');
      $smacaIaqLightMode = $smacaIaqLightMode ?? ($smacaIaqSemDefaults['light_semantic_mode'] ?? 'normalized_level_0_5');
      $smacaIaqTvocModeLabel = $smacaIaqTvocModeLabel ?? ($smacaIaqTvocMode === 'raw_tvoc_ugm3'
          ? __('messages.iaq_semantic_mode.tvoc_raw_tvoc_ugm3')
          : __('messages.iaq_semantic_mode.tvoc_iaq_rating_level'));
      $smacaIaqLightModeLabel = $smacaIaqLightModeLabel ?? ($smacaIaqLightMode === 'raw_lux'
          ? __('messages.iaq_semantic_mode.light_raw_lux')
          : __('messages.iaq_semantic_mode.light_normalized_level_0_5'));
      $smacaIaqSemanticsForJs = [
          'tvoc_semantic_mode' => $smacaIaqTvocMode,
          'light_semantic_mode' => $smacaIaqLightMode,
          'tvoc_mode_label' => $smacaIaqTvocModeLabel,
          'light_mode_label' => $smacaIaqLightModeLabel,
      ];
  @endphp
  <script>
    window.SMACA_BASE_URL = "{{ rtrim(url('/'), '/') }}";
    window.SMACA_CURRENT_PAGE = "{{ $smacaPage ?? 'overview' }}";
    window.SMACA_USER = @json($smacaUser);
    window.SMACA_SPATIAL = @json($smacaSpatial);
    window.SMACA_SPATIAL_ALL = @json($smacaSpatialAll ?? ['groups' => []]);
    window.SMACA_LOCALE = @json($smacaLocaleCode ?? 'en');
    window.SMACA_KPI_METADATA = @json($smacaKpiMetadata ?? ['version' => '0.0.0', 'kpis' => (object) []]);
    window.SMACA_CHART_METADATA = @json($smacaChartMetadata ?? ['version' => '0.0.0', 'charts' => (object) []]);
    (function () {
      try {
        var stored = localStorage.getItem('smaca_location_v1') || '';
        var ok = /^[A-Z0-9][A-Z0-9-]{0,31}$/.test(stored.toUpperCase());
        window.SMACA_LOCATION = ok ? stored.toUpperCase() : null;
      } catch (e) { window.SMACA_LOCATION = null; }
    })();
    window.SMACA_TIMEFRAME = '24h';
    window.addEventListener('smaca:timeframe-changed', function (ev) {
      try {
        var tf = (ev && ev.detail && ev.detail.timeframe) || '24h';
        if (['24h', '7d', '30d'].indexOf(String(tf)) !== -1) {
          window.SMACA_TIMEFRAME = String(tf);
        }
      } catch (e) {}
    });
    window.SMACA_SENSORS = @json($sensors ?? []);
    window.SMACA_HIGHCHARTS_SRC = "{{ asset('assets/vendor/highcharts/highcharts.js') }}";
    window.SMACA_HIGHCHARTS_MODULES = [
      "{{ asset('assets/vendor/highcharts/heatmap.js') }}"
    ];
    window.SMACA_TRANSLATIONS = {
      loading_data: "{{ __('messages.app.loading_data') }}",
      no_data_available: "{{ __('messages.dashboard.no_data_available') }}",
      moderate: "{{ __('messages.status.moderate') }}",
      good: "{{ __('messages.status.good') }}",
      normal: "{{ __('messages.status.normal') }}",
      poor: "{{ __('messages.status.poor') }}",
      high: "{{ __('messages.status.high') }}",
      low: "{{ __('messages.public.low') }}",
      critical: "{{ __('messages.status.poor') }}",
      crowded: "{{ __('messages.status.high') }}",
      health: "{{ __('messages.common.health') }}",
      connectivity: "{{ __('messages.nav.connectivity') }}",
      energy: "{{ __('messages.nav.energy') }}",
      water: "{{ __('messages.nav.water') }}",
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
      notice: "{{ __('messages.status.notice') }}",
      action: "{{ __('messages.status.action') }}",
      time_24h: "{{ __('messages.dashboard_i18n.time_24h') }}",
      time_7d: "{{ __('messages.dashboard_i18n.time_7d') }}",
      time_30d: "{{ __('messages.dashboard_i18n.time_30d') }}",
      energy_usage_24h_subtitle: "{{ __('messages.dashboard_i18n.energy_usage_24h_subtitle') }}",
      energy_demand_24h_subtitle: "{{ __('messages.dashboard_i18n.energy_demand_24h_subtitle') }}",
      energy_operational_day_meta: "{{ __('messages.dashboard_i18n.energy_operational_day_meta') }}",
      energy_no_data_yet: "{{ __('messages.dashboard_i18n.energy_no_data_yet') }}",
      energy_meter_breakdown_title: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_title') }}",
      energy_meter_breakdown_subtitle: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_subtitle') }}",
      energy_meter_breakdown_meter_count: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_meter_count') }}",
      energy_meter_breakdown_consumption_timeframe: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_consumption_timeframe') }}",
      energy_meter_breakdown_latest_cumulative: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_latest_cumulative') }}",
      energy_meter_breakdown_meter_delta: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_meter_delta') }}",
      energy_meter_breakdown_first_reading: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_first_reading') }}",
      energy_meter_breakdown_last_reading: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_last_reading') }}",
      energy_meter_breakdown_min_reading: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_min_reading') }}",
      energy_meter_breakdown_max_reading: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_max_reading') }}",
      energy_meter_breakdown_readings_count: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_readings_count') }}",
      energy_meter_breakdown_delta_method: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_delta_method') }}",
      energy_meter_breakdown_calculated_max_min: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_calculated_max_min') }}",
      energy_meter_breakdown_peak_bucket: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_peak_bucket') }}",
      energy_meter_breakdown_freshness: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_freshness') }}",
      energy_meter_breakdown_last_update: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_last_update') }}",
      energy_meter_breakdown_last_measured: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_last_measured') }}",
      energy_meter_breakdown_details_title: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_details_title') }}",
      energy_meter_breakdown_sensor_uid: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_sensor_uid') }}",
      energy_meter_breakdown_location: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_location') }}",
      energy_meter_breakdown_ok: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_ok') }}",
      energy_meter_breakdown_stale_meter: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_stale_meter') }}",
      energy_meter_breakdown_insufficient_readings: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_insufficient_readings') }}",
      energy_meter_breakdown_possible_reset: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_possible_reset') }}",
      energy_meter_breakdown_spike_capped: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_spike_capped') }}",
      energy_meter_breakdown_no_meters: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_no_meters') }}",
      energy_meter_breakdown_unknown_location: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_unknown_location') }}",
      energy_meter_breakdown_expand_to_load: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_expand_to_load') }}",
      energy_meter_breakdown_peak_hour: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_peak_hour') }}",
      energy_meter_breakdown_peak_day: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_peak_day') }}",
      energy_meter_breakdown_tip_consumption: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_tip_consumption') }}",
      energy_meter_breakdown_tip_latest_cumulative: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_tip_latest_cumulative') }}",
      energy_meter_breakdown_tip_freshness: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_tip_freshness') }}",
      energy_meter_breakdown_tip_peak: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_tip_peak') }}",
      energy_meter_breakdown_tip_calculation: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_tip_calculation') }}",
      energy_meter_breakdown_calculated_consumption: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_calculated_consumption') }}",
      energy_meter_breakdown_methodology: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_methodology') }}",
      energy_meter_breakdown_methodology_hint: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_methodology_hint') }}",
      energy_meter_breakdown_section_meter: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_section_meter') }}",
      energy_meter_breakdown_section_consumption: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_section_consumption') }}",
      energy_meter_breakdown_section_readings: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_section_readings') }}",
      energy_meter_breakdown_section_validation: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_section_validation') }}",
      energy_meter_breakdown_meters_on_floor: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_meters_on_floor') }}",
      energy_meter_breakdown_meter_type: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_meter_type') }}",
      energy_meter_default_name: "{{ __('messages.dashboard_i18n.energy_meter_default_name') }}",
      energy_meter_breakdown_validation_status: "{{ __('messages.dashboard_i18n.energy_meter_breakdown_validation_status') }}",
      energy_load_profile_hour: "{{ __('messages.dashboard_i18n.energy_load_profile_hour') }}",
      energy_load_profile_consumption: "{{ __('messages.dashboard_i18n.energy_load_profile_consumption') }}",
      energy_load_profile_kwh_axis: "{{ __('messages.dashboard_i18n.energy_load_profile_kwh_axis') }}",
      columns_spline_energy: "{{ __('messages.dashboard_i18n.columns_spline_energy') }}",
      operational_demand_intensity: "{{ __('messages.dashboard_i18n.operational_demand_intensity') }}",
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
      environmental_data_unavailable: "{{ __('messages.dashboard_i18n.environmental_data_unavailable') }}",
      environmental_telemetry_missing: "{{ __('messages.dashboard_i18n.environmental_telemetry_missing') }}",
      environmental_exposure_elevated: "{{ __('messages.dashboard_i18n.environmental_exposure_elevated') }}",
      environmental_exposure_elevated_detail: "{{ __('messages.dashboard_i18n.environmental_exposure_elevated_detail') }}",
      extreme_uv_summary: "{{ __('messages.dashboard_i18n.extreme_uv_summary') }}",
      extreme_uv_interpretation: "{{ __('messages.dashboard_i18n.extreme_uv_interpretation') }}",
      very_high_uv_summary: "{{ __('messages.dashboard_i18n.very_high_uv_summary') }}",
      very_high_uv_interpretation: "{{ __('messages.dashboard_i18n.very_high_uv_interpretation') }}",
      high_uv_summary: "{{ __('messages.dashboard_i18n.high_uv_summary') }}",
      high_uv_interpretation: "{{ __('messages.dashboard_i18n.high_uv_interpretation') }}",
      uv_hero_stale: "{{ __('messages.dashboard_i18n.uv_hero_stale') }}",
      uv_no_data_yet: "{{ __('messages.dashboard_i18n.uv_no_data_yet') }}",
      uv_index: "{{ __('messages.dashboard_i18n.uv_index') }}",
      uv_band_low: "{{ __('messages.dashboard_i18n.uv_band_low') }}",
      uv_band_moderate: "{{ __('messages.dashboard_i18n.uv_band_moderate') }}",
      uv_band_high: "{{ __('messages.dashboard_i18n.uv_band_high') }}",
      uv_band_very_high: "{{ __('messages.dashboard_i18n.uv_band_very_high') }}",
      uv_band_extreme: "{{ __('messages.dashboard_i18n.uv_band_extreme') }}",
      uv_advisory_low: "{{ __('messages.dashboard_i18n.uv_advisory_low') }}",
      uv_advisory_moderate: "{{ __('messages.dashboard_i18n.uv_advisory_moderate') }}",
      uv_advisory_high: "{{ __('messages.dashboard_i18n.uv_advisory_high') }}",
      uv_advisory_very_high: "{{ __('messages.dashboard_i18n.uv_advisory_very_high') }}",
      uv_advisory_extreme: "{{ __('messages.dashboard_i18n.uv_advisory_extreme') }}",
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
      explain_metric_tvoc_iaq_rating: "{{ __('messages.dashboard_i18n.explain_metric_tvoc_iaq_rating') }}",
      explain_metric_tvoc_raw: "{{ __('messages.dashboard_i18n.explain_metric_tvoc_raw') }}",
      explain_metric_light_normalized: "{{ __('messages.dashboard_i18n.explain_metric_light_normalized') }}",
      explain_metric_light_lux: "{{ __('messages.dashboard_i18n.explain_metric_light_lux') }}",
      how_to_tvoc_iaq_rating: "{{ __('messages.dashboard_i18n.how_to_tvoc_iaq_rating') }}",
      how_to_tvoc_raw: "{{ __('messages.dashboard_i18n.how_to_tvoc_raw') }}",
      iaq_pollutant_subtitle_tvoc_semantic: "{{ __('messages.dashboard_i18n.iaq_pollutant_subtitle_tvoc_semantic') }}",
      iaq_kpi_semantic_info_strip: "{{ __('messages.dashboard_i18n.iaq_kpi_semantic_info_strip') }}",
      iaq_live_snapshot_badge: "{{ __('messages.dashboard_i18n.iaq_live_snapshot_badge') }}",
      iaq_chart_meta_timeframe: "{{ __('messages.dashboard_i18n.iaq_chart_meta_timeframe') }}",
      iaq_chart_mode_direct: "{{ __('messages.dashboard_i18n.iaq_chart_mode_direct') }}",
      iaq_chart_mode_tvoc_semantic: "{{ __('messages.dashboard_i18n.iaq_chart_mode_tvoc_semantic') }}",
      iaq_chart_co2_heat_sub: "{{ __('messages.dashboard_i18n.iaq_chart_co2_heat_sub') }}",
      iaq_chart_snapshot_mode_mix: "{{ __('messages.dashboard_i18n.iaq_chart_snapshot_mode_mix') }}",
      iaq_threshold_rank_subtitle: @json(__('messages.dashboard_i18n.iaq_threshold_rank_subtitle')),
      iaq_pollutant_compare_subtitle: @json(__('messages.dashboard_i18n.iaq_pollutant_compare_subtitle')),
      iaq_hourly_heat_subtitle: @json(__('messages.dashboard_i18n.iaq_hourly_heat_subtitle')),
      iaq_hourly_heat_subtitle_daily: @json(__('messages.dashboard_i18n.iaq_hourly_heat_subtitle_daily')),
      iaq_semantic_row_tvoc: "{{ __('messages.dashboard_i18n.iaq_semantic_row_tvoc') }}",
      iaq_semantic_row_light: "{{ __('messages.dashboard_i18n.iaq_semantic_row_light') }}",
      iaq_semantic_row_light_level: "{{ __('messages.dashboard_i18n.iaq_semantic_row_light_level') }}",
      iaq_lighting_level_of: "{{ __('messages.dashboard_i18n.iaq_lighting_level_of') }}",
      iaq_semantic_row_direct: "{{ __('messages.dashboard_i18n.iaq_semantic_row_direct') }}",
      iaq_env_safety_good: "{{ __('messages.iaq_kpi.environmental_safety.healthy') }}",
      iaq_env_safety_moderate: "{{ __('messages.iaq_kpi.environmental_safety.medium') }}",
      iaq_env_safety_high: "{{ __('messages.iaq_kpi.environmental_safety.unhealthy') }}",
      labels_co2: "{{ __('messages.labels.co2') }}",
      labels_pm25: "{{ __('messages.labels.pm25') }}",
      labels_pm10: "{{ __('messages.labels.pm10') }}",
      iaq_sensor_breakdown_title: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_title') }}",
      iaq_sensor_breakdown_subtitle: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_subtitle') }}",
      iaq_sensor_breakdown_avg_co2: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_avg_co2') }}",
      iaq_sensor_breakdown_avg_temperature: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_avg_temperature') }}",
      iaq_sensor_breakdown_avg_humidity: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_avg_humidity') }}",
      iaq_sensor_breakdown_top_concern: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_top_concern') }}",
      iaq_sensor_breakdown_last_update: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_last_update') }}",
      iaq_sensor_breakdown_tvoc_iaq_rating_label: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_tvoc_iaq_rating_label') }}",
      iaq_sensor_breakdown_tvoc_raw_label: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_tvoc_raw_label') }}",
      iaq_sensor_breakdown_light_level_label: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_light_level_label') }}",
      iaq_sensor_breakdown_lux_label: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_lux_label') }}",
      iaq_sensor_breakdown_lighting_condition: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_lighting_condition') }}",
      iaq_sensor_breakdown_thermal_comfort: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_thermal_comfort') }}",
      iaq_sensor_breakdown_environmental_safety: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_environmental_safety') }}",
      iaq_sensor_breakdown_ventilation_quality: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_ventilation_quality') }}",
      iaq_sensor_breakdown_no_sensors: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_no_sensors') }}",
      iaq_sensor_breakdown_sensor_count: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_sensor_count') }}",
      iaq_sensor_breakdown_ok: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_ok') }}",
      iaq_sensor_breakdown_details_title: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_details_title') }}",
      iaq_sensor_breakdown_sensor_key: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_sensor_key') }}",
      iaq_sensor_breakdown_location: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_location') }}",
      iaq_sensor_breakdown_floor: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_floor') }}",
      iaq_sensor_breakdown_latest_readings: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_latest_readings') }}",
      iaq_sensor_breakdown_semantic_title: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_semantic_title') }}",
      iaq_sensor_breakdown_warnings: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_warnings') }}",
      iaq_sensor_breakdown_thermal_comfortable: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_thermal_comfortable') }}",
      iaq_sensor_breakdown_thermal_uncomfortable: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_thermal_uncomfortable') }}",
      iaq_sensor_breakdown_env_elevated: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_env_elevated') }}",
      iaq_sensor_breakdown_env_acceptable: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_env_acceptable') }}",
      iaq_sensor_breakdown_warn_co2_high: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_warn_co2_high') }}",
      iaq_sensor_breakdown_warn_co2_critical: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_warn_co2_critical') }}",
      iaq_sensor_breakdown_warn_pm25: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_warn_pm25') }}",
      iaq_sensor_breakdown_warn_pm10: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_warn_pm10') }}",
      iaq_sensor_breakdown_warn_tvoc: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_warn_tvoc') }}",
      iaq_sensor_breakdown_warn_tvoc_critical: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_warn_tvoc_critical') }}",
      iaq_sensor_breakdown_warn_thermal: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_warn_thermal') }}",
      iaq_sensor_breakdown_warn_lighting: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_warn_lighting') }}",
      iaq_warn_light_minimal: "{{ __('messages.dashboard_i18n.iaq_warn_light_minimal') }}",
      iaq_warn_light_intense: "{{ __('messages.dashboard_i18n.iaq_warn_light_intense') }}",
      iaq_warn_tvoc_poor: "{{ __('messages.dashboard_i18n.iaq_warn_tvoc_poor') }}",
      iaq_sensor_breakdown_unknown_location: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_unknown_location') }}",
      iaq_sensor_breakdown_status_critical: "{{ __('messages.dashboard_i18n.iaq_sensor_breakdown_status_critical') }}",
      iaq_metric_na: "{{ __('messages.dashboard_i18n.iaq_metric_na') }}",
      iaq_readings_fallback_badge: "{{ __('messages.dashboard_i18n.iaq_readings_fallback_badge') }}",
      iaq_readings_fallback_badge_hint: "{{ __('messages.dashboard_i18n.iaq_readings_fallback_badge_hint') }}",
      iaq_light_fallback_level_instead_of_lux: "{{ __('messages.dashboard_i18n.iaq_light_fallback_level_instead_of_lux') }}",
      iaq_light_fallback_lux_instead_of_level: "{{ __('messages.dashboard_i18n.iaq_light_fallback_lux_instead_of_level') }}",
      iaq_warn_temp_low: "{{ __('messages.dashboard_i18n.iaq_warn_temp_low') }}",
      iaq_warn_temp_high: "{{ __('messages.dashboard_i18n.iaq_warn_temp_high') }}",
      iaq_warn_rh_low: "{{ __('messages.dashboard_i18n.iaq_warn_rh_low') }}",
      iaq_warn_rh_high: "{{ __('messages.dashboard_i18n.iaq_warn_rh_high') }}",
      iaq_health_stale: "{{ __('messages.dashboard_i18n.iaq_health_stale') }}",
      iaq_health_healthy: "{{ __('messages.dashboard_i18n.iaq_health_healthy') }}",
      iaq_health_partial: "{{ __('messages.dashboard_i18n.iaq_health_partial') }}",
      iaq_health_missing_metrics: "{{ __('messages.dashboard_i18n.iaq_health_missing_metrics') }}",
      iaq_health_limited_telemetry: "{{ __('messages.dashboard_i18n.iaq_health_limited_telemetry') }}",
      connectivity_quality_title: "{{ __('messages.connectivity_quality.title') }}",
      connectivity_band_excellent: "{{ __('messages.connectivity_quality.excellent') }}",
      connectivity_band_very_good: "{{ __('messages.connectivity_quality.very_good') }}",
      connectivity_band_good_usable: "{{ __('messages.connectivity_quality.good_usable') }}",
      connectivity_band_weak_unstable: "{{ __('messages.connectivity_quality.weak_unstable') }}",
      connectivity_band_bad: "{{ __('messages.connectivity_quality.bad') }}",
      connectivity_signal_strength: "{{ __('messages.connectivity_quality.signal_strength') }}",
      connectivity_signal_to_noise: "{{ __('messages.connectivity_quality.signal_to_noise') }}",
      connectivity_client_connection_quality: "{{ __('messages.connectivity_quality.client_connection_quality') }}",
      connectivity_transmission_rate: "{{ __('messages.connectivity_quality.transmission_rate') }}",
      connectivity_limiting_metric: "{{ __('messages.connectivity_quality.limiting_metric') }}",
      connectivity_last_update: "{{ __('messages.connectivity_quality.last_update') }}",
      connectivity_no_data: "{{ __('messages.connectivity_quality.no_data') }}",
      connectivity_breakdown_overall: "{{ __('messages.connectivity_kpi.breakdown.overall') }}",
      connectivity_breakdown_no_devices: "{{ __('messages.connectivity_kpi.breakdown.no_devices') }}",
      connectivity_breakdown_device_count: "{{ __('messages.connectivity_kpi.breakdown.device_count') }}",
      connectivity_no_timeseries: "{{ __('messages.dashboard_i18n.connectivity_no_timeseries') }}",
      connectivity_online_devices: "{{ __('messages.dashboard_i18n.connectivity_online_devices') }}",
      connectivity_kpi_overall: "{{ __('messages.dashboard_i18n.connectivity_kpi_overall') }}",
      connectivity_limiting_caption: "{{ __('messages.dashboard_i18n.connectivity_limiting_caption') }}",
      connectivity_col_device: "{{ __('messages.dashboard_i18n.connectivity_col_device') }}",
      connectivity_col_location: "{{ __('messages.dashboard_i18n.connectivity_col_location') }}",
      connectivity_col_quality: "{{ __('messages.dashboard_i18n.connectivity_col_quality') }}",
      connectivity_col_status: "{{ __('messages.dashboard_i18n.connectivity_col_status') }}",
      connectivity_status_stale: "{{ __('messages.dashboard_i18n.connectivity_status_stale') }}",
      connectivity_attention_none: "{{ __('messages.dashboard_i18n.connectivity_attention_none') }}",
      connectivity_unknown_device: "{{ __('messages.dashboard_i18n.connectivity_unknown_device') }}",
      connectivity_health_title: "{{ __('messages.dashboard_i18n.connectivity_health_title') }}",
      connectivity_health_subtitle: "{{ __('messages.dashboard_i18n.connectivity_health_subtitle') }}",
      connectivity_table_search: "{{ __('messages.dashboard_i18n.connectivity_table_search') }}",
      connectivity_composite_with_limit: "{{ __('messages.dashboard_i18n.connectivity_composite_with_limit') }}",
      connectivity_alert_tx_rate: "{{ __('messages.dashboard_i18n.connectivity_alert_tx_rate') }}",
      connectivity_alert_weak_ccq: "{{ __('messages.dashboard_i18n.connectivity_alert_weak_ccq') }}",
      connectivity_alert_stale_devices: "{{ __('messages.dashboard_i18n.connectivity_alert_stale_devices') }}",
      connectivity_alert_signal_instability: "{{ __('messages.dashboard_i18n.connectivity_alert_signal_instability') }}",
      connectivity_health_weak: "{{ __('messages.dashboard_i18n.connectivity_health_weak') }}",
      connectivity_health_problem: "{{ __('messages.dashboard_i18n.connectivity_health_problem') }}",
      connectivity_quality_unstable: "{{ __('messages.dashboard_i18n.connectivity_quality_unstable') }}",
      water_no_active_alarms: "{{ __('messages.dashboard_i18n.water_no_active_alarms') }}",
      water_active_alarms_count: "{{ __('messages.dashboard_i18n.water_active_alarms_count') }}",
      water_no_active_alarms_message: "{{ __('messages.dashboard_i18n.water_no_active_alarms_message') }}",
      water_status_normal: "{{ __('messages.dashboard_i18n.water_status_normal') }}",
      water_status_warning: "{{ __('messages.dashboard_i18n.water_status_warning') }}",
      water_status_critical: "{{ __('messages.dashboard_i18n.water_status_critical') }}",
      water_status_no_data: "{{ __('messages.dashboard_i18n.water_status_no_data') }}",
      water_chart_yaxis: "{{ __('messages.dashboard_i18n.water_chart_yaxis') }}",
      water_chart_series: "{{ __('messages.dashboard_i18n.water_chart_series') }}",
      water_chart_no_points: "{{ __('messages.dashboard_i18n.water_chart_no_points') }}",
      water_chart_unavailable: "{{ __('messages.dashboard_i18n.water_chart_unavailable') }}",
      water_detail_sensor: "{{ __('messages.dashboard_i18n.water_detail_sensor') }}",
      water_detail_volume_l: "{{ __('messages.dashboard_i18n.water_detail_volume_l') }}",
      water_detail_volume_m3: "{{ __('messages.dashboard_i18n.water_detail_volume_m3') }}",
      water_detail_battery: "{{ __('messages.dashboard_i18n.water_detail_battery') }}",
      water_detail_status: "{{ __('messages.dashboard_i18n.water_detail_status') }}",
      water_detail_measured: "{{ __('messages.dashboard_i18n.water_detail_measured') }}",
      water_card_battery_unit: "{{ __('messages.dashboard_i18n.water_card_battery_unit') }}",
      water_alarm_leakage: "{{ __('messages.dashboard_i18n.water_alarm_leakage') }}",
      water_alarm_burst: "{{ __('messages.dashboard_i18n.water_alarm_burst') }}",
      water_alarm_backflow: "{{ __('messages.dashboard_i18n.water_alarm_backflow') }}",
      water_alarm_low_battery: "{{ __('messages.dashboard_i18n.water_alarm_low_battery') }}",
      water_alarm_firmware_changed: "{{ __('messages.dashboard_i18n.water_alarm_firmware_changed') }}",
      water_alarm_meter_tamper: "{{ __('messages.dashboard_i18n.water_alarm_meter_tamper') }}",
      water_alarm_magnetic_field: "{{ __('messages.dashboard_i18n.water_alarm_magnetic_field') }}",
      water_alarm_dry: "{{ __('messages.dashboard_i18n.water_alarm_dry') }}",
      water_alarm_clock_invalid: "{{ __('messages.dashboard_i18n.water_alarm_clock_invalid') }}",
      water_alarm_hardware_fault: "{{ __('messages.dashboard_i18n.water_alarm_hardware_fault') }}",
      water_alarm_low_temperature: "{{ __('messages.dashboard_i18n.water_alarm_low_temperature') }}",
      iaq_semantic_coverage_full: "{{ __('messages.dashboard_i18n.iaq_semantic_coverage_full') }}",
      iaq_semantic_coverage_partial: "{{ __('messages.dashboard_i18n.iaq_semantic_coverage_partial') }}",
      iaq_semantic_coverage_limited: "{{ __('messages.dashboard_i18n.iaq_semantic_coverage_limited') }}",
      iaq_co2_band_outdoor_normal: "{{ __('messages.iaq_co2_band.outdoor_normal') }}",
      iaq_co2_band_good_ventilation: "{{ __('messages.iaq_co2_band.good_ventilation') }}",
      iaq_co2_band_poor_ventilation: "{{ __('messages.iaq_co2_band.poor_ventilation') }}",
      iaq_co2_band_high_discomfort: "{{ __('messages.iaq_co2_band.high_discomfort') }}",
      iaq_co2_band_workplace_limit: "{{ __('messages.iaq_co2_band.workplace_limit') }}",
      iaq_co2_band_dangerous: "{{ __('messages.iaq_co2_band.dangerous') }}",
      iaq_tvoc_rating_very_good: "{{ __('messages.iaq_tvoc_rating.very_good') }}",
      iaq_tvoc_rating_good: "{{ __('messages.iaq_tvoc_rating.good') }}",
      iaq_tvoc_rating_medium: "{{ __('messages.iaq_tvoc_rating.medium') }}",
      iaq_tvoc_rating_poor: "{{ __('messages.iaq_tvoc_rating.poor') }}",
      iaq_tvoc_rating_bad: "{{ __('messages.iaq_tvoc_rating.bad') }}",
      iaq_lighting_level_minimal: "{{ __('messages.iaq_lighting_level.minimal') }}",
      iaq_lighting_level_dim_indoor: "{{ __('messages.iaq_lighting_level.dim_indoor') }}",
      iaq_lighting_level_residential: "{{ __('messages.iaq_lighting_level.residential') }}",
      iaq_lighting_level_office: "{{ __('messages.iaq_lighting_level.office') }}",
      iaq_lighting_level_detailed_work: "{{ __('messages.iaq_lighting_level.detailed_work') }}",
      iaq_lighting_level_intense: "{{ __('messages.iaq_lighting_level.intense') }}",
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
      ,
      normalized_energy_intensity: "{{ __('messages.labels.normalized_energy_intensity') }}",
      base_load_index: "{{ __('messages.labels.base_load_index') }}",
      thermal_comfort_index: "{{ __('messages.labels.thermal_comfort_index') }}",
      visual_comfort_kpi: "{{ __('messages.labels.visual_comfort_kpi') }}",
      iaq_health_index: "{{ __('messages.labels.iaq_health_index') }}",
      environmental_safety_index: "{{ __('messages.labels.environmental_safety_index') }}",
      iaq_thermal_comfort: "{{ __('messages.labels.iaq_thermal_comfort') }}",
      ventilation_quality_index: "{{ __('messages.labels.ventilation_quality_index') }}",
      visual_lighting_condition: "{{ __('messages.labels.visual_lighting_condition') }}",
      crowd_density_level: "{{ __('messages.labels.crowd_density_level') }}",
      movement_activity_index: "{{ __('messages.labels.movement_activity_index') }}",
      uv_exposure_risk: "{{ __('messages.labels.uv_exposure_risk') }}",
      insufficient_data: "{{ __('messages.labels.insufficient_data') }}",
      estimated: "{{ __('messages.labels.estimated') }}",
      estimated_limited: "{{ __('messages.labels.estimated_limited') }}",
      partial: "{{ __('messages.labels.partial') }}",
      recommended_action: "{{ __('messages.labels.recommended_action') }}",
      spatial_label: "{{ __('messages.spatial.label') }}",
      spatial_all_campus: "{{ __('messages.spatial.all_campus') }}",
      spatial_group_floors: "{{ __('messages.spatial.group_floors') }}",
      spatial_group_basements: "{{ __('messages.spatial.group_basements') }}",
      spatial_group_special_spaces: "{{ __('messages.spatial.group_special_spaces') }}",
      spatial_group_passages: "{{ __('messages.spatial.group_passages') }}",
      spatial_section_floors: "{{ __('messages.spatial.section_floors') }}",
      spatial_section_basements: "{{ __('messages.spatial.section_basements') }}",
      spatial_section_special_spaces: "{{ __('messages.spatial.section_special_spaces') }}",
      spatial_scope_summary: "{{ __('messages.spatial.scope_summary') }}",
      spatial_scope_summary_campus: "{{ __('messages.spatial.scope_summary_campus') }}",
      flow_estimate_note: "{{ __('messages.dashboard_i18n.flow_estimate_note') }}",
      occupancy_metric_people_in: "{{ __('messages.dashboard_i18n.occupancy_metric_people_in') }}",
      occupancy_metric_people_out: "{{ __('messages.dashboard_i18n.occupancy_metric_people_out') }}",
      occupancy_metric_remaining_inside: "{{ __('messages.dashboard_i18n.occupancy_metric_remaining_inside') }}",
      occupancy_metric_crowd_density: "{{ __('messages.dashboard_i18n.occupancy_metric_crowd_density') }}",
      occupancy_metric_peak: "{{ __('messages.dashboard_i18n.occupancy_metric_peak') }}",
      occupancy_group_auditorium: "{{ __('messages.dashboard_i18n.occupancy_group_auditorium') }}",
      occupancy_group_basement_1: "{{ __('messages.dashboard_i18n.occupancy_group_basement_1') }}",
      occupancy_group_basement_2: "{{ __('messages.dashboard_i18n.occupancy_group_basement_2') }}",
      occupancy_group_ground_floor: "{{ __('messages.dashboard_i18n.occupancy_group_ground_floor') }}",
      occupancy_group_first_floor: "{{ __('messages.dashboard_i18n.occupancy_group_first_floor') }}",
      occupancy_tooltip_people_in: "{{ __('messages.dashboard_i18n.occupancy_tooltip_people_in') }}",
      occupancy_tooltip_people_out: "{{ __('messages.dashboard_i18n.occupancy_tooltip_people_out') }}",
      occupancy_tooltip_remaining_inside: "{{ __('messages.dashboard_i18n.occupancy_tooltip_remaining_inside') }}",
      occupancy_tooltip_crowd_density: "{{ __('messages.dashboard_i18n.occupancy_tooltip_crowd_density') }}",
      occupancy_tooltip_peak: "{{ __('messages.dashboard_i18n.occupancy_tooltip_peak') }}",
      occupancy_metric_subtitle_people_in: "{{ __('messages.dashboard_i18n.occupancy_metric_subtitle_people_in') }}",
      occupancy_metric_subtitle_people_out: "{{ __('messages.dashboard_i18n.occupancy_metric_subtitle_people_out') }}",
      occupancy_metric_subtitle_remaining_inside: "{{ __('messages.dashboard_i18n.occupancy_metric_subtitle_remaining_inside') }}",
      occupancy_metric_subtitle_crowd_density: "{{ __('messages.dashboard_i18n.occupancy_metric_subtitle_crowd_density') }}",
      occupancy_metric_subtitle_peak: "{{ __('messages.dashboard_i18n.occupancy_metric_subtitle_peak') }}",
      occupancy_group_auditorium: "{{ __('messages.dashboard_i18n.occupancy_group_auditorium') }}",
      occupancy_badge_auditorium_sensor: "{{ __('messages.dashboard_i18n.occupancy_badge_auditorium_sensor') }}",
      occupancy_sensor_breakdown_title: "{{ __('messages.dashboard_i18n.occupancy_sensor_breakdown_title') }}",
      occupancy_sensor_table_sensor: "{{ __('messages.dashboard_i18n.occupancy_sensor_table_sensor') }}",
      occupancy_metrics_daily_window: "{{ __('messages.dashboard_i18n.occupancy_metrics_daily_window') }}",
      occupancy_kpi_footer_window: "{{ __('messages.dashboard_i18n.occupancy_kpi_footer_window') }}",
      occupancy_scope_daily_note: "{{ __('messages.dashboard_i18n.occupancy_scope_daily_note') }}",
      occupancy_scope_timeframe_note: "{{ __('messages.dashboard_i18n.occupancy_scope_timeframe_note') }}",
      occupancy_chart_in_out_top_title: "{{ __('messages.dashboard_i18n.occupancy_chart_in_out_top_title') }}",
      occupancy_chart_in_out_top_subtitle: "{{ __('messages.dashboard_i18n.occupancy_chart_in_out_top_subtitle') }}",
      occupancy_chart_busiest_title: "{{ __('messages.dashboard_i18n.occupancy_chart_busiest_title') }}",
      occupancy_chart_busiest_subtitle: "{{ __('messages.dashboard_i18n.occupancy_chart_busiest_subtitle') }}",
      occupancy_chart_hourly_title: "{{ __('messages.dashboard_i18n.occupancy_chart_hourly_title') }}",
      occupancy_chart_hourly_subtitle: "{{ __('messages.dashboard_i18n.occupancy_chart_hourly_subtitle') }}",
      occupancy_chart_hourly_help: "{{ __('messages.dashboard_i18n.occupancy_chart_hourly_help') }}",
      occupancy_chart_share_title: "{{ __('messages.dashboard_i18n.occupancy_chart_share_title') }}",
      occupancy_chart_share_subtitle: "{{ __('messages.dashboard_i18n.occupancy_chart_share_subtitle') }}",
      occupancy_chart_share_explainer: "{{ __('messages.dashboard_i18n.occupancy_chart_share_explainer') }}",
      occupancy_chart_flow_subtitle: "{{ __('messages.dashboard_i18n.occupancy_chart_flow_subtitle') }}",
      occupancy_chart_flow_remaining_tooltip: "{{ __('messages.dashboard_i18n.occupancy_chart_flow_remaining_tooltip') }}",
      occupancy_chart_explainer_hourly: "{{ __('messages.dashboard_i18n.occupancy_chart_explainer_hourly') }}",
      occupancy_chart_explainer_flow: "{{ __('messages.dashboard_i18n.occupancy_chart_explainer_flow') }}",
      occupancy_chart_explainer_top_traffic: "{{ __('messages.dashboard_i18n.occupancy_chart_explainer_top_traffic') }}",
      occupancy_sensor_balance_label: "{{ __('messages.dashboard_i18n.occupancy_sensor_balance_label') }}",
      occupancy_sensor_floor_summary: "{{ __('messages.dashboard_i18n.occupancy_sensor_floor_summary') }}",
      occupancy_sensor_details_title: "{{ __('messages.dashboard_i18n.occupancy_sensor_details_title') }}",
      occupancy_sensor_details_key: "{{ __('messages.dashboard_i18n.occupancy_sensor_details_key') }}",
      occupancy_sensor_details_location: "{{ __('messages.dashboard_i18n.occupancy_sensor_details_location') }}",
      occupancy_sensor_details_floor: "{{ __('messages.dashboard_i18n.occupancy_sensor_details_floor') }}",
      occupancy_sensor_details_auditorium: "{{ __('messages.dashboard_i18n.occupancy_sensor_details_auditorium') }}",
      occupancy_sensor_details_window: "{{ __('messages.dashboard_i18n.occupancy_sensor_details_window') }}",
      occupancy_sensor_imbalance_warning: "{{ __('messages.dashboard_i18n.occupancy_sensor_imbalance_warning') }}",
      occupancy_sensor_ok: "{{ __('messages.dashboard_i18n.occupancy_sensor_ok') }}",
      occupancy_details_yes: "{{ __('messages.dashboard_i18n.occupancy_details_yes') }}",
      occupancy_details_no: "{{ __('messages.dashboard_i18n.occupancy_details_no') }}",
      occupancy_chart_top_traffic_subtitle: "{{ __('messages.dashboard_i18n.occupancy_chart_top_traffic_subtitle') }}",
      occupancy_tile_total_movement_title: "{{ __('messages.dashboard_i18n.occupancy_tile_total_movement_title') }}",
      occupancy_tile_total_movement_subtitle: "{{ __('messages.dashboard_i18n.occupancy_tile_total_movement_subtitle') }}",
      occupancy_tile_total_movement_tooltip: "{{ __('messages.dashboard_i18n.occupancy_tile_total_movement_tooltip') }}",
      occupancy_tile_peak_hour_title: "{{ __('messages.dashboard_i18n.occupancy_tile_peak_hour_title') }}",
      occupancy_tile_peak_hour_subtitle: "{{ __('messages.dashboard_i18n.occupancy_tile_peak_hour_subtitle') }}",
      occupancy_tile_peak_hour_meta: "{{ __('messages.dashboard_i18n.occupancy_tile_peak_hour_meta') }}",
      occupancy_tile_daily_remaining_title: "{{ __('messages.dashboard_i18n.occupancy_tile_daily_remaining_title') }}",
      occupancy_tile_daily_remaining_subtitle: "{{ __('messages.dashboard_i18n.occupancy_tile_daily_remaining_subtitle') }}",
      occupancy_tile_daily_remaining_meta: "{{ __('messages.dashboard_i18n.occupancy_tile_daily_remaining_meta') }}",
      occupancy_operational_latest_sample_title: "{{ __('messages.dashboard_i18n.occupancy_operational_latest_sample_title') }}",
      occupancy_operational_latest_sample_helper: "{{ __('messages.dashboard_i18n.occupancy_operational_latest_sample_helper') }}",
      occupancy_operational_latest_entries: "{{ __('messages.dashboard_i18n.occupancy_operational_latest_entries') }}",
      occupancy_operational_latest_exits: "{{ __('messages.dashboard_i18n.occupancy_operational_latest_exits') }}",
      occupancy_operational_latest_freshness: "{{ __('messages.dashboard_i18n.occupancy_operational_latest_freshness') }}",
      occupancy_tile_latest_passage_update_title: "{{ __('messages.dashboard_i18n.occupancy_tile_latest_passage_update_title') }}",
      occupancy_tile_latest_passage_update_subtitle: "{{ __('messages.dashboard_i18n.occupancy_tile_latest_passage_update_subtitle') }}",
      occupancy_tile_latest_passage_update_meta: "{{ __('messages.dashboard_i18n.occupancy_tile_latest_passage_update_meta') }}",
      occupancy_chart_in_out_top_meta_top5: "{{ __('messages.dashboard_i18n.occupancy_chart_in_out_top_meta_top5') }}",
      occupancy_chart_share_scope_note: "{{ __('messages.dashboard_i18n.occupancy_chart_share_scope_note') }}",
      occupancy_chart_hourly_scope_meta: "{{ __('messages.dashboard_i18n.occupancy_chart_hourly_scope_meta') }}",
      simple_normalized_energy_intensity: "{{ __('messages.simple.normalized_energy_intensity') }}",
      simple_base_load_index: "{{ __('messages.simple.base_load_index') }}",
      simple_crowd_density_level: "{{ __('messages.simple.crowd_density_level') }}",
      simple_movement_activity_index: "{{ __('messages.simple.movement_activity_index') }}",
      simple_uv_exposure_risk: "{{ __('messages.simple.uv_exposure_risk') }}",
      simple_iaq_health_index: "{{ __('messages.simple.iaq_health_index') }}",
      simple_environmental_safety_index: "{{ __('messages.simple.environmental_safety_index') }}",
      simple_iaq_thermal_comfort: "{{ __('messages.simple.iaq_thermal_comfort') }}",
      simple_ventilation_quality_index: "{{ __('messages.simple.ventilation_quality_index') }}",
      simple_visual_lighting_condition: "{{ __('messages.simple.visual_lighting_condition') }}",
      simple_thermal_comfort_index: "{{ __('messages.simple.thermal_comfort_index') }}",
      simple_visual_comfort_kpi: "{{ __('messages.simple.visual_comfort_kpi') }}",
      simple_data_freshness: "{{ __('messages.simple.data_freshness') }}",
      simple_operational: "{{ __('messages.simple.operational') }}",
      kpi_empty_iaq: "{{ __('messages.kpi_empty.iaq') }}",
      kpi_empty_energy: "{{ __('messages.kpi_empty.energy') }}",
      kpi_empty_occupancy: "{{ __('messages.kpi_empty.occupancy') }}",
      kpi_empty_environmental: "{{ __('messages.kpi_empty.environmental') }}",
      kpi_empty_overview: "{{ __('messages.kpi_empty.overview') }}",
      // Clarity layer — KPI card "How to read this" labels
      kpi_what_is_this_metric: "{{ __('messages.kpi_help.what_is_this_metric') }}",
      kpi_help_how_to_read: "{{ __('messages.kpi_help.how_to_read') }}",
      kpi_note_occupancy_estimate: "{{ __('messages.dashboard_i18n.kpi_note_occupancy_estimate') }}",
      kpi_help_hint: "{{ __('messages.kpi_help.hint') }}",
      kpi_help_unit: "{{ __('messages.kpi_help.unit') }}",
      kpi_help_measurement_units: "{{ __('messages.kpi_help.measurement_units') }}",
      kpi_help_environmental_units: "{{ __('messages.kpi_help.environmental_units') }}",
      kpi_help_environmental_unit_tvoc_ugm3: "{{ __('messages.kpi_help.environmental_unit_tvoc_ugm3') }}",
      kpi_help_environmental_unit_tvoc_rating: "{{ __('messages.kpi_help.environmental_unit_tvoc_rating') }}",
      kpi_help_current_status: "{{ __('messages.kpi_help.current_status') }}",
      kpi_help_technical: "{{ __('messages.kpi_help.technical') }}",
      kpi_help_formula: "{{ __('messages.kpi_help.formula') }}",
      kpi_help_sensors: "{{ __('messages.kpi_help.sensors') }}",
      kpi_help_confidence: "{{ __('messages.kpi_help.confidence') }}",
      kpi_help_limitations: "{{ __('messages.kpi_help.limitations') }}",
      kpi_companion_status: "{{ __('messages.kpi_help.companion_status') }}",
      // Chart explanation panel labels
      chart_help_how_to_read: "{{ __('messages.chart_help.how_to_read') }}",
      chart_help_hint: "{{ __('messages.chart_help.hint') }}",
      chart_help_what: "{{ __('messages.chart_help.what') }}",
      chart_help_data_source: "{{ __('messages.chart_help.data_source') }}",
      chart_help_read: "{{ __('messages.chart_help.read') }}",
      chart_help_timeframe: "{{ __('messages.chart_help.timeframe') }}",
      chart_help_actions: "{{ __('messages.chart_help.actions') }}",
      chart_help_limitations: "{{ __('messages.chart_help.limitations') }}",
      // Source-type pills
      source_type_measured: "{{ __('messages.source_type.measured') }}",
      source_type_estimated: "{{ __('messages.source_type.estimated') }}",
      source_type_proxy: "{{ __('messages.source_type.proxy') }}",
      // Timeframe explanation tooltip (topbar)
      timeframe_help_title: "{{ __('messages.timeframe_help.title') }}",
      timeframe_help_24h: "{{ __('messages.timeframe_help.h24') }}",
      timeframe_help_7d: "{{ __('messages.timeframe_help.d7') }}",
      timeframe_help_30d: "{{ __('messages.timeframe_help.d30') }}",
      timeframe_help_export_only: "{{ __('messages.timeframe_help.export_only') }}",
      overview_movement_activity_tooltip: "{{ __('messages.dashboard_i18n.overview_movement_activity_tooltip') }}",
      overview_daily_calculated_balance: "{{ __('messages.dashboard_i18n.overview_daily_calculated_balance') }}",
      overview_module_iaq: "{{ __('messages.dashboard_i18n.overview_module_iaq') }}",
      overview_module_energy: "{{ __('messages.dashboard_i18n.overview_module_energy') }}",
      overview_module_occupancy: "{{ __('messages.dashboard_i18n.overview_module_occupancy') }}",
      overview_module_environmental: "{{ __('messages.dashboard_i18n.overview_module_environmental') }}",
      overview_top_module_to_watch: "{{ __('messages.dashboard_i18n.overview_top_module_to_watch') }}",
      overview_chart_movement_balance: "{{ __('messages.dashboard_i18n.overview_chart_movement_balance') }}",
      overview_iaq_score_subtitle: "{{ __('messages.dashboard_i18n.overview_iaq_score_subtitle') }}",
      overview_nav_iaq_desc: "{{ __('messages.dashboard_i18n.overview_nav_iaq_desc') }}",
      overview_nav_energy_desc: "{{ __('messages.dashboard_i18n.overview_nav_energy_desc') }}",
      overview_nav_occupancy_desc: "{{ __('messages.dashboard_i18n.overview_nav_occupancy_desc') }}",
      overview_nav_environmental_desc: "{{ __('messages.dashboard_i18n.overview_nav_environmental_desc') }}",
      overview_reporting_sensors: "{{ __('messages.dashboard_i18n.overview_reporting_sensors') }}",
      awaiting_live_iaq_data: "{{ __('messages.dashboard_i18n.awaiting_live_iaq_data') }}",
      iaq_index: "{{ __('messages.dashboard_i18n.iaq_index') }}",
      overview_all_modules_stable: "{{ __('messages.dashboard_i18n.overview_all_modules_stable') }}",
      overview_all_modules_stable_hint: "{{ __('messages.dashboard_i18n.overview_all_modules_stable_hint') }}",
      overview_sensor_online: "{{ __('messages.dashboard_i18n.overview_sensor_online') }}",
      overview_sensor_warning_stale: "{{ __('messages.dashboard_i18n.overview_sensor_warning_stale') }}",
      overview_sensor_offline: "{{ __('messages.dashboard_i18n.overview_sensor_offline') }}",
      overview_sensor_donut_subtitle: "{{ __('messages.dashboard_i18n.overview_sensor_donut_subtitle') }}",
      overview_reporting_short: "{{ __('messages.dashboard_i18n.overview_reporting_short') }}",
      overview_module_health_subtitle: "{{ __('messages.dashboard_i18n.overview_module_health_subtitle') }}",
      overview_module_health_meta: "{{ __('messages.dashboard_i18n.overview_module_health_meta') }}",
      overview_status_normal: "{{ __('messages.dashboard_i18n.overview_status_normal') }}",
      overview_status_warning: "{{ __('messages.dashboard_i18n.overview_status_warning') }}",
      overview_view_module: "{{ __('messages.dashboard_i18n.overview_view_module') }}",
      overview_scope_label: "{{ __('messages.dashboard_i18n.overview_scope_label') }}",
      overview_scope_readonly: "{{ __('messages.dashboard_i18n.overview_scope_readonly') }}",
      overview_scope_limited_access: "{{ __('messages.dashboard_i18n.overview_scope_limited_access') }}",
      overview_chart_subtitle: "{{ __('messages.dashboard_i18n.overview_chart_subtitle') }}",
      overview_reporting_label: "{{ __('messages.dashboard_i18n.overview_reporting_label') }}",
      overview_status_label: "{{ __('messages.dashboard_i18n.overview_status_label') }}",
      overview_status_critical: "{{ __('messages.dashboard_i18n.overview_status_critical') }}",
      overview_kpi_status_label: "{{ __('messages.dashboard_i18n.overview_kpi_status_label') }}",
      overview_status_attention_needed: "{{ __('messages.dashboard_i18n.overview_status_attention_needed') }}",
      overview_reason_label: "{{ __('messages.dashboard_i18n.overview_reason_label') }}",
      overview_estimated_balance_unit: "{{ __('messages.dashboard_i18n.overview_estimated_balance_unit') }}",
      overview_balance_not_headcount: "{{ __('messages.dashboard_i18n.overview_balance_not_headcount') }}",
      overview_uv_high_exposure: "{{ __('messages.dashboard_i18n.overview_uv_high_exposure') }}",
      overview_uv_moderate_exposure: "{{ __('messages.dashboard_i18n.overview_uv_moderate_exposure') }}",
      overview_uv_low_exposure: "{{ __('messages.dashboard_i18n.overview_uv_low_exposure') }}",
      overview_chart_legend_co2: "{{ __('messages.dashboard_i18n.overview_chart_legend_co2') }}",
      overview_chart_legend_connectivity: "{{ __('messages.dashboard_i18n.overview_chart_legend_connectivity') }}",
      overview_sensors_online_ratio: "{{ __('messages.dashboard_i18n.overview_sensors_online_ratio') }}",
      overview_connectivity_quality: "{{ __('messages.dashboard_i18n.overview_connectivity_quality') }}",
      overview_chart_legend_uv: "{{ __('messages.dashboard_i18n.overview_chart_legend_uv') }}",
      overview_watch_thermal_comfort: "{{ __('messages.dashboard_i18n.overview_watch_thermal_comfort') }}",
      overview_watch_iaq_health: "{{ __('messages.dashboard_i18n.overview_watch_iaq_health') }}",
      overview_watch_ventilation: "{{ __('messages.dashboard_i18n.overview_watch_ventilation') }}",
      overview_watch_energy_intensity: "{{ __('messages.dashboard_i18n.overview_watch_energy_intensity') }}",
      overview_watch_base_load: "{{ __('messages.dashboard_i18n.overview_watch_base_load') }}",
      overview_watch_movement: "{{ __('messages.dashboard_i18n.overview_watch_movement') }}",
      overview_watch_uv: "{{ __('messages.dashboard_i18n.overview_watch_uv') }}",
      overview_watch_environmental: "{{ __('messages.dashboard_i18n.overview_watch_environmental') }}",
      overview_watch_generic: "{{ __('messages.dashboard_i18n.overview_watch_generic') }}",
      overview_nav_connectivity_desc: "{{ __('messages.dashboard_i18n.overview_nav_connectivity_desc') }}",
      overview_nav_management_desc: "{{ __('messages.dashboard_i18n.overview_nav_management_desc') }}",
      overview_nav_ai_desc: "{{ __('messages.dashboard_i18n.overview_nav_ai_desc') }}",
      overview_coming_soon: "{{ __('messages.dashboard_i18n.overview_coming_soon') }}",
      alerts_indicator_label: "{{ __('messages.dashboard_i18n.alerts_indicator_label') }}",
      alerts_indicator_active: "{{ __('messages.dashboard_i18n.alerts_indicator_active') }}",
      alerts_indicator_resolved_today: "{{ __('messages.dashboard_i18n.alerts_indicator_resolved_today') }}",
      alerts_indicator_rules_enabled: "{{ __('messages.dashboard_i18n.alerts_indicator_rules_enabled') }}",
      alerts_indicator_rules_total: "{{ __('messages.dashboard_i18n.alerts_indicator_rules_total') }}",
      alerts_indicator_degraded: "{{ __('messages.dashboard_i18n.alerts_indicator_degraded') }}",
      ai_alerts_stat_active: "{{ __('messages.dashboard_i18n.ai_alerts_stat_active') }}",
      ai_alerts_stat_resolved_today: "{{ __('messages.dashboard_i18n.ai_alerts_stat_resolved_today') }}",
      ai_alerts_stat_rules_enabled: "{{ __('messages.dashboard_i18n.ai_alerts_stat_rules_enabled') }}",
      ai_alerts_stat_rules_total: "{{ __('messages.dashboard_i18n.ai_alerts_stat_rules_total') }}"
    };
    window.SMACA_IAQ_SEMANTICS = @json($smacaIaqSemanticsForJs);
  </script>
  <script defer src="{{ asset('assets/js/rbac.js') }}?v={{ $smacaAssetVersion('assets/js/rbac.js') }}"></script>
  <script defer src="{{ asset('assets/js/ui.js') }}?v={{ $smacaAssetVersion('assets/js/ui.js') }}"></script>
  <script defer src="{{ asset('assets/js/app.js') }}?v={{ $smacaAssetVersion('assets/js/app.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-state-manager.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-state-manager.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-trend-calculator.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-trend-calculator.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-alerts-engine.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-alerts-engine.js') }}"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"></script>
  <script defer src="{{ asset('assets/js/smaca-csv-export.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-csv-export.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-telemetry-metric-normalize.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-telemetry-metric-normalize.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-api.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-api.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-alerts-indicator.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-alerts-indicator.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-spatial.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-spatial.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-role.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-role.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-icons.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-icons.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-kpi-renderer.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-kpi-renderer.js') }}"></script>
  @if(($smacaPage ?? 'overview') === 'overview')
  <script defer src="{{ asset('assets/js/smaca-overview-scope.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-overview-scope.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-overview-kpi.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-overview-kpi.js') }}"></script>
  @endif
  <script defer src="{{ asset('assets/js/smaca-iaq-sensor-breakdown.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-iaq-sensor-breakdown.js') }}"></script>
  @if(($smacaPage ?? 'overview') === 'energy')
  <script defer src="{{ asset('assets/js/smaca-energy-meter-breakdown.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-energy-meter-breakdown.js') }}"></script>
  @endif
  <script defer src="{{ asset('assets/js/smaca-connectivity-quality.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-connectivity-quality.js') }}"></script>
  @if(($smacaPage ?? 'overview') === 'connectivity')
  <script defer src="{{ asset('assets/js/smaca-connectivity-dashboard.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-connectivity-dashboard.js') }}"></script>
  @endif
  @if(($smacaPage ?? 'overview') === 'water')
  <script defer src="{{ asset('assets/js/smaca-water-dashboard.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-water-dashboard.js') }}"></script>
  @endif
  <script defer src="{{ asset('assets/js/smaca-chart-explainer.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-chart-explainer.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-card-help.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-card-help.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-data-normalizer.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-data-normalizer.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-highcharts-loader.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-highcharts-loader.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-highcharts-adapter.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-highcharts-adapter.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-telemetry-scheduler.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-telemetry-scheduler.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-list-virtual.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-list-virtual.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-telemetry.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-telemetry.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-chart-visibility.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-chart-visibility.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-telemetry-bootstrap.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-telemetry-bootstrap.js') }}"></script>
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
