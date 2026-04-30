<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ __('messages.public.landing_title') }}</title>
  <link rel="icon" type="image/x-icon" href="{{ asset('assets/brand/favicon.ico') }}">
  <link rel="icon" type="image/png" sizes="32x32" href="{{ asset('assets/brand/smaca-favicon-32.png') }}">
  <link rel="icon" type="image/svg+xml" href="{{ asset('assets/brand/smaca-favicon.svg') }}">
  <link rel="shortcut icon" href="{{ asset('assets/brand/favicon.ico') }}">
  <link rel="apple-touch-icon" sizes="180x180" href="{{ asset('assets/brand/smaca-favicon-180.png') }}">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="{{ asset('assets/css/base.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-logo.css?v=' . time()) }}">
  <link rel="stylesheet" href="{{ asset('assets/css/landing.css?v=' . time()) }}">
</head>
<body class="landing-page">
  <nav class="navbar navbar-expand-lg smaca-nav sticky-top">
    <div class="container">
      <a class="navbar-brand nav__logo smaca-logo" href="{{ url('/landing') }}" aria-label="SMACA">
        <img src="{{ asset('assets/brand/smaca-logo-dark.svg') }}" alt="SMACA logo" class="smaca-logo__mark" width="220" height="48">
      </a>
      <div class="d-flex gap-2 align-items-center">
        <a href="{{ url('/language/en') }}" class="btn btn-sm btn-soft">{{ __('messages.language.english') }}</a>
        <a href="{{ url('/language/el') }}" class="btn btn-sm btn-soft">{{ __('messages.language.greek') }}</a>
        <a href="{{ url('/dashboard') }}" class="btn btn-sm btn-soft">{{ __('messages.public.view_platform') }}</a>
        <a href="{{ url('/login') }}" class="btn btn-sm btn-primary">{{ __('messages.public.sign_in') }}</a>
      </div>
    </div>
  </nav>

  <section class="hero scroll-reveal">
    <div class="container">
      <div class="row align-items-center g-4 g-xl-5">
        <div class="col-lg-6">
          <p class="eyebrow mb-2">SMACA</p>
          <h1 class="hero__headline">{{ __('messages.public.hero_title') }}</h1>
          <p class="hero__subheadline">{{ __('messages.public.hero_subtitle') }}</p>
          <div class="d-flex flex-wrap gap-3 mb-3">
            <a href="{{ url('/dashboard') }}" class="btn btn-dark btn-lg">{{ __('messages.public.view_platform') }}</a>
          </div>
          <div class="hero__badges">
            <span class="badge badge--smaca">{{ __('messages.public.universities') }}</span>
            <span class="badge badge--smaca">{{ __('messages.public.public_buildings') }}</span>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="hero-preview">
            <div class="metric-head d-flex justify-content-between align-items-center mb-2">
              <strong class="small">{{ __('messages.public.operations_overview') }}</strong>
              <span class="chip">{{ __('messages.dashboard.live') }}</span>
            </div>
            <div class="row g-2 mb-2">
              <div class="col-4">
                <div class="kpi-mini">
                  <span class="kpi-mini__label">CO₂</span>
                  <strong id="kpiCo2">632 ppm</strong>
                </div>
              </div>
              <div class="col-4">
                <div class="kpi-mini">
                  <span class="kpi-mini__label">{{ __('messages.nav.occupancy') }}</span>
                  <strong id="kpiOccupancy">71%</strong>
                </div>
              </div>
              <div class="col-4">
                <div class="kpi-mini">
                  <span class="kpi-mini__label">{{ __('messages.nav.energy') }}</span>
                  <strong id="kpiEnergy">324 kW</strong>
                </div>
              </div>
            </div>
            <div id="heroChart" class="hero-chart" aria-label="{{ __('messages.public.live_monitoring_chart') }}"></div>
            <div class="alerts-list mt-2">
              <div class="alert-item">
                <span class="alert-tag alert-tag--medium">{{ __('messages.public.alert') }}</span>
                <p>{{ __('messages.public.hero_alert_1') }}</p>
              </div>
              <div class="alert-item">
                <span class="alert-tag alert-tag--low">{{ __('messages.public.info') }}</span>
                <p>{{ __('messages.public.hero_alert_2') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section section--tight scroll-reveal">
    <div class="container">
      <div class="row g-3">
        <div class="col-6 col-md-3"><div class="trust-card"><strong>31</strong><span>{{ __('messages.public.sensors') }}</span></div></div>
        <div class="col-6 col-md-3"><div class="trust-card"><strong>4</strong><span>{{ __('messages.public.modules') }}</span></div></div>
        <div class="col-6 col-md-3"><div class="trust-card"><strong>24/7</strong><span>{{ __('messages.public.monitoring') }}</span></div></div>
        <div class="col-6 col-md-3"><div class="trust-card"><strong>{{ __('messages.dashboard.live') }}</strong><span>{{ __('messages.dashboard.alerts') }}</span></div></div>
      </div>
    </div>
  </section>

  <section class="section scroll-reveal" id="modules">
    <div class="container">
      <div class="section-head mb-4">
        <h2 class="section__title mb-2">{{ __('messages.public.core_modules') }}</h2>
        <p class="section__text mb-0">{{ __('messages.public.core_modules_subtitle') }}</p>
      </div>
      <div class="row g-4">
        <div class="col-md-6 col-xl-3">
          <a class="module-card module-card-link" href="{{ url('/dashboard/iaq') }}">
            <img src="{{ asset('assets/indoorairquality.png') }}" alt="{{ __('messages.public.air_quality') }}" class="card__icon" style="width: 32px; height: 32px; object-fit: contain;">
            <h3 class="card__title">{{ __('messages.public.air_quality') }}</h3>
            <p class="card__desc">{{ __('messages.public.air_quality_desc') }}</p>
          </a>
        </div>
        <div class="col-md-6 col-xl-3">
          <a class="module-card module-card-link" href="{{ url('/dashboard/occupancy') }}">
            <img src="{{ asset('assets/occupancy.png') }}" alt="{{ __('messages.nav.occupancy') }}" class="card__icon" style="width: 32px; height: 32px; object-fit: contain;">
            <h3 class="card__title">{{ __('messages.public.module_occupancy_title') }}</h3>
            <p class="card__desc">{{ __('messages.public.occupancy_desc') }}</p>
          </a>
        </div>
        <div class="col-md-6 col-xl-3">
          <a class="module-card module-card-link" href="{{ url('/dashboard/energy') }}">
            <img src="{{ asset('assets/energy.png') }}" alt="{{ __('messages.nav.energy') }}" class="card__icon" style="width: 32px; height: 32px; object-fit: contain;">
            <h3 class="card__title">{{ __('messages.public.module_energy_title') }}</h3>
            <p class="card__desc">{{ __('messages.public.energy_desc') }}</p>
          </a>
        </div>
        <div class="col-md-6 col-xl-3">
          <a class="module-card module-card-link" href="{{ url('/dashboard/environmental') }}">
            <img src="{{ asset('assets/uv.png') }}" alt="{{ __('messages.public.environment') }} UV" class="card__icon" style="width: 32px; height: 32px; object-fit: contain;">
            <h3 class="card__title">{{ __('messages.public.environment') }}</h3>
            <p class="card__desc">{{ __('messages.public.environment_desc') }}</p>
          </a>
        </div>
      </div>
    </div>
  </section>

  <section class="section scroll-reveal">
    <div class="container">
      <div class="row g-4 align-items-stretch">
        <div class="col-lg-5">
          <p class="eyebrow mb-2">{{ __('messages.public.platform_showcase') }}</p>
          <h2 class="section__title">{{ __('messages.public.operators_title') }}</h2>
          <p class="section__text mb-3">{{ __('messages.public.operators_subtitle') }}</p>
          <ul class="platform-bullets">
            <li>{{ __('messages.public.live_metrics') }}</li>
            <li>{{ __('messages.public.trend_charts') }}</li>
            <li>{{ __('messages.public.alerts') }}</li>
            <li>{{ __('messages.public.multi_building') }}</li>
          </ul>
        </div>
        <div class="col-lg-7">
          <div class="platform-preview">
            <div class="preview-toolbar">
              <span class="tag">{{ __('messages.public.campus_group_a') }}</span>
              <span class="tag">{{ __('messages.public.today') }}</span>
              <span class="tag tag--live">{{ __('messages.public.synced') }}</span>
            </div>
            <div class="row g-2 mb-3">
              <div class="col-sm-4"><div class="summary-box"><span>{{ __('messages.public.avg_co2') }}</span><strong>618 ppm</strong></div></div>
              <div class="col-sm-4"><div class="summary-box"><span>{{ __('messages.public.occupancy_peak') }}</span><strong>182 users</strong></div></div>
              <div class="col-sm-4"><div class="summary-box"><span>{{ __('messages.public.energy_drift') }}</span><strong>+3.2%</strong></div></div>
            </div>
            <div id="platformChart" class="platform-chart mb-3" aria-label="{{ __('messages.public.platform_showcase') }}"></div>
            <div class="alerts-list">
              <div class="alert-item">
                <span class="alert-tag alert-tag--medium">{{ __('messages.public.medium') }}</span>
                <p>{{ __('messages.public.showcase_alert_1') }}</p>
              </div>
              <div class="alert-item">
                <span class="alert-tag alert-tag--low">{{ __('messages.public.low') }}</span>
                <p>{{ __('messages.public.showcase_alert_2') }}</p>
              </div>
              <div class="alert-item">
                <span class="alert-tag alert-tag--high">{{ __('messages.public.high') }}</span>
                <p>{{ __('messages.public.showcase_alert_3') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section cta-section scroll-reveal">
    <div class="container">
      <div class="text-center mb-4">
        <h2 class="section__title mb-2">{{ __('messages.public.predictive_intelligence') }}</h2>
        <p class="section__text mb-0">{{ __('messages.public.predictive_subtitle') }}</p>
      </div>
      <div class="predictive-panel">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h3 class="h6 mb-0">{{ __('messages.public.ai_insight_feed') }}</h3>
          <span id="confidenceLabel" class="chip chip--accent">{{ __('messages.public.confidence') }}: 91%</span>
        </div>
        <div class="progress smaca-progress mb-3" role="progressbar" aria-label="{{ __('messages.public.model_confidence') }}">
          <div id="confidenceBar" class="progress-bar" style="width: 91%">91%</div>
        </div>
        <div class="row g-3">
          <div class="col-md-4"><div class="insight-card"><h4>{{ __('messages.public.detect_anomalies') }}</h4><p>{{ __('messages.public.detect_anomalies_desc') }}</p></div></div>
          <div class="col-md-4"><div class="insight-card"><h4>{{ __('messages.public.recommend_actions') }}</h4><p>{{ __('messages.public.recommend_actions_desc') }}</p></div></div>
          <div class="col-md-4"><div class="insight-card"><h4>{{ __('messages.public.forecast_impact') }}</h4><p>{{ __('messages.public.forecast_impact_desc') }}</p></div></div>
        </div>
        <div id="logStream" class="log-stream mt-3" aria-live="polite"></div>
      </div>
    </div>
  </section>

  <section class="section cta-section scroll-reveal">
    <div class="container text-center">
      <h2 class="cta__headline">{{ __('messages.public.ready_modernize') }}</h2>
      <div class="d-flex justify-content-center flex-wrap gap-3">
        <a href="{{ url('/login') }}" class="btn btn-outline-dark btn-lg">{{ __('messages.public.sign_in') }}</a>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container d-flex flex-column flex-lg-row justify-content-between gap-3">
      <div class="footer__brand">
        <img src="{{ asset('assets/brand/smaca-logo-dark.svg') }}" alt="SMACA logo" class="smaca-logo__mark" width="220" height="48">
        <span>{{ __('messages.public.footer_brand') }}</span>
      </div>
      <nav class="footer__links d-flex flex-wrap gap-3">
        <a href="#">{{ __('messages.public.platform') }}</a>
        <a href="#">{{ __('messages.public.documentation') }}</a>
        <a href="#">{{ __('messages.public.privacy') }}</a>
        <a href="#">{{ __('messages.public.terms') }}</a>
        <a href="{{ url('/login') }}">{{ __('messages.public.contact') }}</a>
      </nav>
    </div>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://code.highcharts.com/highcharts.js"></script>
  <script src="{{ asset('assets/js/landing.js') }}"></script>
</body>
</html>
