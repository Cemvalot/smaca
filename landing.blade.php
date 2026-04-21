<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMACA - Smart Building Intelligence Platform</title>
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
      <div class="d-flex gap-2">
        <a href="{{ url('/dashboard') }}" class="btn btn-sm btn-soft">View Platform</a>
        <a href="{{ url('/login') }}" class="btn btn-sm btn-primary">Sign In</a>
      </div>
    </div>
  </nav>

  <section class="hero scroll-reveal">
    <div class="container">
      <div class="row align-items-center g-4 g-xl-5">
        <div class="col-lg-6">
          <p class="eyebrow mb-2">SMACA</p>
          <h1 class="hero__headline">Smart Building Intelligence for Modern Campuses</h1>
          <p class="hero__subheadline">Monitor air quality, occupancy, energy and environmental conditions in real time from one intelligent platform.</p>
          <div class="d-flex flex-wrap gap-3 mb-3">
            <a href="{{ url('/dashboard') }}" class="btn btn-dark btn-lg">View Platform</a>
          </div>
          <div class="hero__badges">
            <span class="badge badge--smaca">Universities</span>
            <span class="badge badge--smaca">Public Buildings</span>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="hero-preview">
            <div class="metric-head d-flex justify-content-between align-items-center mb-2">
              <strong class="small">Operations Overview</strong>
              <span class="chip">Live</span>
            </div>
            <div class="row g-2 mb-2">
              <div class="col-4">
                <div class="kpi-mini">
                  <span class="kpi-mini__label">CO2</span>
                  <strong id="kpiCo2">632 ppm</strong>
                </div>
              </div>
              <div class="col-4">
                <div class="kpi-mini">
                  <span class="kpi-mini__label">Occupancy</span>
                  <strong id="kpiOccupancy">71%</strong>
                </div>
              </div>
              <div class="col-4">
                <div class="kpi-mini">
                  <span class="kpi-mini__label">Energy</span>
                  <strong id="kpiEnergy">324 kW</strong>
                </div>
              </div>
            </div>
            <div id="heroChart" class="hero-chart" aria-label="Live monitoring chart"></div>
            <div class="alerts-list mt-2">
              <div class="alert-item">
                <span class="alert-tag alert-tag--medium">Alert</span>
                <p>Lecture Hall A exceeded comfort threshold for 12 minutes.</p>
              </div>
              <div class="alert-item">
                <span class="alert-tag alert-tag--low">Info</span>
                <p>Energy profile remains 3% below weekly baseline.</p>
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
        <div class="col-6 col-md-3"><div class="trust-card"><strong>31</strong><span>Sensors</span></div></div>
        <div class="col-6 col-md-3"><div class="trust-card"><strong>4</strong><span>Modules</span></div></div>
        <div class="col-6 col-md-3"><div class="trust-card"><strong>24/7</strong><span>Monitoring</span></div></div>
        <div class="col-6 col-md-3"><div class="trust-card"><strong>Live</strong><span>Alerts</span></div></div>
      </div>
    </div>
  </section>

  <section class="section scroll-reveal" id="modules">
    <div class="container">
      <div class="section-head mb-4">
        <h2 class="section__title mb-2">Core Modules</h2>
        <p class="section__text mb-0">A focused toolkit for real-time operational visibility.</p>
      </div>
      <div class="row g-4">
        <div class="col-md-6 col-xl-3">
          <a class="module-card module-card-link" href="{{ url('/dashboard/iaq') }}">
            <img src="{{ asset('assets/indoorairquality.png') }}" alt="Air Quality" class="card__icon" style="width: 32px; height: 32px; object-fit: contain;">
            <h3 class="card__title">Air Quality</h3>
            <p class="card__desc">Track CO2, temperature, humidity, and comfort trends in every monitored zone.</p>
          </a>
        </div>
        <div class="col-md-6 col-xl-3">
          <a class="module-card module-card-link" href="{{ url('/dashboard/occupancy') }}">
            <img src="{{ asset('assets/occupancy.png') }}" alt="Occupancy" class="card__icon" style="width: 32px; height: 32px; object-fit: contain;">
            <h3 class="card__title">Occupancy</h3>
            <p class="card__desc">Understand movement patterns, room utilization, and peak crowding periods.</p>
          </a>
        </div>
        <div class="col-md-6 col-xl-3">
          <a class="module-card module-card-link" href="{{ url('/dashboard/energy') }}">
            <img src="{{ asset('assets/energy.png') }}" alt="Energy" class="card__icon" style="width: 32px; height: 32px; object-fit: contain;">
            <h3 class="card__title">Energy</h3>
            <p class="card__desc">Monitor demand, identify inefficiencies, and balance usage across schedules.</p>
          </a>
        </div>
        <div class="col-md-6 col-xl-3">
          <a class="module-card module-card-link" href="{{ url('/dashboard/environmental') }}">
            <img src="{{ asset('assets/uv.png') }}" alt="Environment UV" class="card__icon" style="width: 32px; height: 32px; object-fit: contain;">
            <h3 class="card__title">Environment</h3>
            <p class="card__desc">Follow ambient conditions, UV exposure, and environmental comfort indicators.</p>
          </a>
        </div>
      </div>
    </div>
  </section>

  <section class="section scroll-reveal">
    <div class="container">
      <div class="row g-4 align-items-stretch">
        <div class="col-lg-5">
          <p class="eyebrow mb-2">Platform Showcase</p>
          <h2 class="section__title">See what operators monitor every day</h2>
          <p class="section__text mb-3">A clear, unified interface for teams managing campuses and public facilities.</p>
          <ul class="platform-bullets">
            <li>Live metrics</li>
            <li>Trend charts</li>
            <li>Alerts</li>
            <li>Multi-building visibility</li>
          </ul>
        </div>
        <div class="col-lg-7">
          <div class="platform-preview">
            <div class="preview-toolbar">
              <span class="tag">Campus Group A</span>
              <span class="tag">Today</span>
              <span class="tag tag--live">Synced</span>
            </div>
            <div class="row g-2 mb-3">
              <div class="col-sm-4"><div class="summary-box"><span>Avg CO2</span><strong>618 ppm</strong></div></div>
              <div class="col-sm-4"><div class="summary-box"><span>Occupancy Peak</span><strong>182 users</strong></div></div>
              <div class="col-sm-4"><div class="summary-box"><span>Energy Drift</span><strong>+3.2%</strong></div></div>
            </div>
            <div id="platformChart" class="platform-chart mb-3" aria-label="Platform trend chart"></div>
            <div class="alerts-list">
              <div class="alert-item">
                <span class="alert-tag alert-tag--medium">Medium</span>
                <p>Building A floor 2 reached CO2 threshold during peak class hours.</p>
              </div>
              <div class="alert-item">
                <span class="alert-tag alert-tag--low">Low</span>
                <p>Energy draw in administration block remains above baseline by 3.8%.</p>
              </div>
              <div class="alert-item">
                <span class="alert-tag alert-tag--high">High</span>
                <p>Occupancy spike detected in main auditorium above configured capacity.</p>
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
        <h2 class="section__title mb-2">Predictive Intelligence</h2>
        <p class="section__text mb-0">Actionable intelligence to move from reactive response to proactive operations.</p>
      </div>
      <div class="predictive-panel">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h3 class="h6 mb-0">AI Insight Feed</h3>
          <span id="confidenceLabel" class="chip chip--accent">Confidence: 91%</span>
        </div>
        <div class="progress smaca-progress mb-3" role="progressbar" aria-label="Model confidence">
          <div id="confidenceBar" class="progress-bar" style="width: 91%">91%</div>
        </div>
        <div class="row g-3">
          <div class="col-md-4"><div class="insight-card"><h4>Detect anomalies early</h4><p>Identify unusual conditions before they escalate operationally.</p></div></div>
          <div class="col-md-4"><div class="insight-card"><h4>Recommend actions</h4><p>Receive practical next-step guidance for facility teams.</p></div></div>
          <div class="col-md-4"><div class="insight-card"><h4>Forecast operational impact</h4><p>Estimate comfort and energy outcomes before decisions are made.</p></div></div>
        </div>
        <div id="logStream" class="log-stream mt-3" aria-live="polite"></div>
      </div>
    </div>
  </section>

  <section class="section cta-section scroll-reveal">
    <div class="container text-center">
      <h2 class="cta__headline">Ready to modernize your building operations?</h2>
      <div class="d-flex justify-content-center flex-wrap gap-3">
        <a href="{{ url('/login') }}" class="btn btn-outline-dark btn-lg">Sign In</a>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container d-flex flex-column flex-lg-row justify-content-between gap-3">
      <div class="footer__brand">
        <img src="{{ asset('assets/brand/smaca-logo-dark.svg') }}" alt="SMACA logo" class="smaca-logo__mark" width="220" height="48">
        <span>Smart Building Intelligence Platform</span>
      </div>
      <nav class="footer__links d-flex flex-wrap gap-3">
        <a href="#">Platform</a>
        <a href="#">Documentation</a>
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
        <a href="{{ url('/login') }}">Contact</a>
      </nav>
    </div>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://code.highcharts.com/highcharts.js"></script>
  <script src="{{ asset('assets/js/landing.js') }}"></script>
</body>
</html>
