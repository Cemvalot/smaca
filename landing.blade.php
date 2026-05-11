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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="{{ asset('assets/css/base.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-logo.css?v=' . time()) }}">
  <link rel="stylesheet" href="{{ asset('assets/css/landing.css?v=' . time()) }}">
</head>
<body class="landing-page">
  <div class="landing-telemetry" aria-hidden="true">
    <div class="landing-telemetry__grid"></div>
    <span class="landing-telemetry__node landing-telemetry__node--a"></span>
    <span class="landing-telemetry__node landing-telemetry__node--b"></span>
    <span class="landing-telemetry__node landing-telemetry__node--c"></span>
  </div>

  <header class="landing-header">
    <nav class="navbar navbar-expand-lg smaca-nav sticky-top" aria-label="SMACA">
      <div class="container">
        <a class="navbar-brand nav__logo smaca-logo" href="{{ url('/landing') }}" aria-label="SMACA">
          <img src="{{ asset('assets/brand/smaca-logo-dark.svg') }}" alt="SMACA logo" class="smaca-logo__mark" width="220" height="48">
        </a>
        <button
          class="navbar-toggler smaca-nav__toggle"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#landingNav"
          aria-controls="landingNav"
          aria-expanded="false"
          aria-label="Menu"
        >
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="landingNav">
          <div class="navbar-actions ms-lg-auto">
            <div class="navbar-actions__group navbar-actions__group--locale">
              <a href="{{ url('/language/en') }}" class="btn btn-sm btn-soft">{{ __('messages.language.english') }}</a>
              <a href="{{ url('/language/el') }}" class="btn btn-sm btn-soft">{{ __('messages.language.greek') }}</a>
            </div>
            <div class="navbar-actions__group">
              <a href="{{ url('/dashboard') }}" class="btn btn-sm btn-soft">{{ __('messages.public.view_platform') }}</a>
              <a href="{{ url('/login') }}" class="btn btn-sm btn-primary">{{ __('messages.public.sign_in') }}</a>
            </div>
          </div>
        </div>
      </div>
    </nav>
  </header>

  <main id="main-content">
    <section class="hero scroll-reveal" aria-labelledby="hero-title">
      <div class="hero__backdrop" aria-hidden="true"></div>
      <div class="container position-relative">
        <div class="row align-items-center g-4 g-xl-5">
          <div class="col-lg-6 hero__copy">
            <p class="eyebrow mb-2">SMACA</p>
            <h1 id="hero-title" class="hero__headline">{{ __('messages.public.hero_title') }}</h1>
            <p class="hero__subheadline">{{ __('messages.public.hero_subtitle') }}</p>
            <div class="hero__actions">
              <a href="{{ url('/dashboard') }}" class="btn btn-primary btn-lg">{{ __('messages.public.view_platform') }}</a>
            </div>
            <div class="hero__badges">
              <span class="badge badge--smaca">{{ __('messages.public.universities') }}</span>
              <span class="badge badge--smaca">{{ __('messages.public.public_buildings') }}</span>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="hero-preview surface-panel">
              <div class="metric-head">
                <strong class="small">{{ __('messages.public.operations_overview') }}</strong>
                <span class="chip chip--live">{{ __('messages.dashboard.live') }}</span>
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

    <div class="section-divider section-divider--parallax" aria-hidden="true">
      <span class="section-divider__glow section-divider__glow--a"></span>
      <span class="section-divider__glow section-divider__glow--b"></span>
      <span class="section-divider__line"></span>
    </div>

    <section class="section section--stats scroll-reveal" aria-label="{{ __('messages.public.monitoring') }}">
      <div class="container">
        <div class="stats-grid">
          <div class="trust-card">
            <strong>31</strong>
            <span>{{ __('messages.public.sensors') }}</span>
          </div>
          <div class="trust-card">
            <strong>4</strong>
            <span>{{ __('messages.public.modules') }}</span>
          </div>
          <div class="trust-card">
            <strong>24/7</strong>
            <span>{{ __('messages.public.monitoring') }}</span>
          </div>
          <div class="trust-card">
            <strong>{{ __('messages.dashboard.live') }}</strong>
            <span>{{ __('messages.dashboard.alerts') }}</span>
          </div>
        </div>
      </div>
    </section>


    <div class="section-divider section-divider--parallax" aria-hidden="true">
      <span class="section-divider__glow section-divider__glow--a"></span>
      <span class="section-divider__glow section-divider__glow--b"></span>
      <span class="section-divider__line"></span>
    </div>

    <section class="section section--modules scroll-reveal" id="modules" aria-labelledby="modules-title">
      <div class="container">
        <div class="section-head section-head--modules">
          <p class="eyebrow mb-2">{{ __('messages.public.modules') }}</p>
          <h2 id="modules-title" class="section__title">{{ __('messages.public.core_modules') }}</h2>
          <p class="section__text">{{ __('messages.public.core_modules_subtitle') }}</p>
          <ul class="capability-ribbon">
            <li class="capability-ribbon__item">{{ __('messages.public.live_metrics') }}</li>
            <li class="capability-ribbon__item">{{ __('messages.public.trend_charts') }}</li>
            <li class="capability-ribbon__item">{{ __('messages.public.alerts') }}</li>
            <li class="capability-ribbon__item">{{ __('messages.public.multi_building') }}</li>
          </ul>
        </div>
        <div class="row g-4">
          <div class="col-md-6 col-xl-3">
            <a class="module-card module-card-link" href="{{ url('/dashboard/iaq') }}">
              <span class="module-card__icon-wrap">
                <img src="{{ asset('assets/indoorairquality.png') }}" alt="" class="card__icon" width="32" height="32">
              </span>
              <h3 class="card__title">{{ __('messages.public.air_quality') }}</h3>
              <p class="card__desc">{{ __('messages.public.air_quality_desc') }}</p>
            </a>
          </div>
          <div class="col-md-6 col-xl-3">
            <a class="module-card module-card-link" href="{{ url('/dashboard/occupancy') }}">
              <span class="module-card__icon-wrap">
                <img src="{{ asset('assets/occupancy.png') }}" alt="" class="card__icon" width="32" height="32">
              </span>
              <h3 class="card__title">{{ __('messages.public.module_occupancy_title') }}</h3>
              <p class="card__desc">{{ __('messages.public.occupancy_desc') }}</p>
            </a>
          </div>
          <div class="col-md-6 col-xl-3">
            <a class="module-card module-card-link" href="{{ url('/dashboard/energy') }}">
              <span class="module-card__icon-wrap">
                <img src="{{ asset('assets/energy.png') }}" alt="" class="card__icon" width="32" height="32">
              </span>
              <h3 class="card__title">{{ __('messages.public.module_energy_title') }}</h3>
              <p class="card__desc">{{ __('messages.public.energy_desc') }}</p>
            </a>
          </div>
          <div class="col-md-6 col-xl-3">
            <a class="module-card module-card-link" href="{{ url('/dashboard/environmental') }}">
              <span class="module-card__icon-wrap">
                <img src="{{ asset('assets/uv.png') }}" alt="" class="card__icon" width="32" height="32">
              </span>
              <h3 class="card__title">{{ __('messages.public.environment') }}</h3>
              <p class="card__desc">{{ __('messages.public.environment_desc') }}</p>
            </a>
          </div>
        </div>
      </div>
    </section>


    <div class="section-divider section-divider--parallax" aria-hidden="true">
      <span class="section-divider__glow section-divider__glow--a"></span>
      <span class="section-divider__glow section-divider__glow--b"></span>
      <span class="section-divider__line"></span>
    </div>

    <section class="section section--showcase scroll-reveal" aria-labelledby="showcase-title">
      <div class="container">
        <div class="row g-4 g-xl-5 align-items-stretch">
          <div class="col-lg-5">
            <p class="eyebrow mb-2">{{ __('messages.public.platform_showcase') }}</p>
            <h2 id="showcase-title" class="section__title">{{ __('messages.public.operators_title') }}</h2>
            <p class="section__text">{{ __('messages.public.operators_subtitle') }}</p>
            <ul class="platform-bullets">
              <li>{{ __('messages.public.live_metrics') }}</li>
              <li>{{ __('messages.public.trend_charts') }}</li>
              <li>{{ __('messages.public.alerts') }}</li>
              <li>{{ __('messages.public.multi_building') }}</li>
            </ul>
          </div>
          <div class="col-lg-7">
            <div class="platform-preview surface-panel">
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


    <div class="section-divider section-divider--parallax" aria-hidden="true">
      <span class="section-divider__glow section-divider__glow--a"></span>
      <span class="section-divider__glow section-divider__glow--b"></span>
      <span class="section-divider__line"></span>
    </div>

    <section class="section section--predictive scroll-reveal" aria-labelledby="predictive-title">
      <div class="container">
        <div class="section-head section-head--center">
          <h2 id="predictive-title" class="section__title">{{ __('messages.public.predictive_intelligence') }}</h2>
          <p class="section__text">{{ __('messages.public.predictive_subtitle') }}</p>
        </div>
        <div class="predictive-panel surface-panel">
          <div class="predictive-panel__header">
            <h3 class="predictive-panel__title">{{ __('messages.public.ai_insight_feed') }}</h3>
            <span
              id="confidenceLabel"
              class="chip chip--accent"
              data-confidence-template="{{ __('messages.public.confidence') }}: :value%"
            >{{ __('messages.public.confidence') }}: 91%</span>
          </div>
          <div class="progress smaca-progress mb-3" role="progressbar" aria-label="{{ __('messages.public.model_confidence') }}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="91">
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


    <div class="section-divider section-divider--parallax" aria-hidden="true">
      <span class="section-divider__glow section-divider__glow--a"></span>
      <span class="section-divider__glow section-divider__glow--b"></span>
      <span class="section-divider__line"></span>
    </div>

    <section class="section section--cta scroll-reveal" aria-labelledby="cta-title">
      <div class="container">
        <div class="cta-panel">
          <h2 id="cta-title" class="cta__headline">{{ __('messages.public.ready_modernize') }}</h2>
          <div class="cta-panel__actions">
            <a href="{{ url('/login') }}" class="btn btn-outline-dark btn-lg">{{ __('messages.public.sign_in') }}</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer__inner">
        <div class="footer__brand">
          <img src="{{ asset('assets/brand/smaca-logo-dark.svg') }}" alt="SMACA logo" class="smaca-logo__mark" width="220" height="48">
          <span>{{ __('messages.public.footer_brand') }}</span>
        </div>
        <nav class="footer__links" aria-label="{{ __('messages.public.platform') }}">
          <a href="#">{{ __('messages.public.platform') }}</a>
          <a href="#">{{ __('messages.public.documentation') }}</a>
          <a href="#">{{ __('messages.public.privacy') }}</a>
          <a href="#">{{ __('messages.public.terms') }}</a>
          <a href="{{ url('/login') }}">{{ __('messages.public.contact') }}</a>
        </nav>
      </div>
    </div>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://code.highcharts.com/highcharts.js"></script>
  <script src="{{ asset('assets/js/landing.js') }}"></script>
</body>
</html>
