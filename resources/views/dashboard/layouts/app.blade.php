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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="base-url" content="{{ url('/') }}">
  <title>SMACA Dashboard - Unified IoT Monitoring</title>
  <link rel="stylesheet" href="{{ asset('assets/css/base.css') }}?v={{ $smacaAssetVersion('assets/css/base.css') }}">
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
            <div id="smaca-page-loading-message" class="smaca-page-loading-overlay__message">Loading data...</div>
          </div>
        </div>
        @yield('dashboard-content')
      </div>
    </main>
  </div>

  @if(($smacaPage ?? 'overview') === 'management')
  <!-- Add/Edit Sensor Modal (management page only) -->
  <div id="sensor-modal" class="user-modal" style="display: none;" role="dialog" aria-labelledby="sensor-modal-title" aria-modal="true">
    <div class="user-modal__backdrop"></div>
    <div class="user-modal__dialog">
      <div class="user-modal__header">
        <h3 id="sensor-modal-title" class="user-modal__title">Add Sensor</h3>
        <button type="button" class="user-modal__close" aria-label="Close">&times;</button>
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
          <label for="sensor-form-status" class="user-form-label">Status</label>
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
        <button type="button" class="btn btn--ghost user-modal__cancel">Cancel</button>
        <button type="submit" form="sensor-form" class="btn btn--primary">Save Sensor</button>
      </div>
    </div>
  </div>

  <!-- Add/Edit User Modal (management page only) -->
  <div id="user-modal" class="user-modal" style="display: none;" role="dialog" aria-labelledby="user-modal-title" aria-modal="true">
    <div class="user-modal__backdrop"></div>
    <div class="user-modal__dialog">
      <div class="user-modal__header">
        <h3 id="user-modal-title" class="user-modal__title">Add User</h3>
        <button type="button" class="user-modal__close" aria-label="Close">&times;</button>
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
          <label for="user-form-status" class="user-form-label">Status</label>
          <select id="user-form-status" name="status" class="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </form>
      <div class="user-modal__footer">
        <button type="button" class="btn btn--ghost user-modal__cancel">Cancel</button>
        <button type="submit" form="user-form" class="btn btn--primary">Save User</button>
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
  </script>
  <script defer src="{{ asset('assets/js/rbac.js') }}?v={{ $smacaAssetVersion('assets/js/rbac.js') }}"></script>
  <script defer src="{{ asset('assets/js/ui.js') }}?v={{ $smacaAssetVersion('assets/js/ui.js') }}"></script>
  <script defer src="{{ asset('assets/js/app.js') }}?v={{ $smacaAssetVersion('assets/js/app.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-state-manager.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-state-manager.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-trend-calculator.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-trend-calculator.js') }}"></script>
  <script defer src="{{ asset('assets/js/smaca-alerts-engine.js') }}?v={{ $smacaAssetVersion('assets/js/smaca-alerts-engine.js') }}"></script>
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
