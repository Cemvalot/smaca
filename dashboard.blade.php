<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="base-url" content="{{ url('/') }}">
  <title>SMACA Dashboard - Unified IoT Monitoring</title>
  <link rel="stylesheet" href="{{ asset('assets/css/base.css') }}?v={{ time() }}">
  <link rel="stylesheet" href="{{ asset('assets/css/dashboard.css') }}?v={{ time() }}">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-dashboard.css') }}?v={{ time() }}">
</head>
<body>
  <div class="app">
    <!-- Left Sidebar -->
    <aside class="sidebar">
      <div class="sidebar__header">
        <div class="sidebar__logo">SMACA</div>
        <div class="sidebar__subtitle">IoT & AI Platform</div>
      </div>
      <nav class="sidebar__nav">
        <a href="{{ url('/dashboard') }}" class="nav-link nav-link--section is-active" data-section="overview">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
          </svg>
          <span class="nav-link__text">Dashboard Overview</span>
        </a>
        <a href="{{ url('/dashboard/iaq') }}" class="nav-link nav-link--section" data-section="iaq">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="nav-link__text">Indoor Air Quality</span>
        </a>
        <a href="{{ url('/dashboard/occupancy') }}" class="nav-link nav-link--section" data-section="occupancy">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          <span class="nav-link__text">Occupancy</span>
        </a>
        <a href="{{ url('/dashboard/energy') }}" class="nav-link nav-link--section" data-section="energy">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          <span class="nav-link__text">Energy</span>
        </a>
        <a href="{{ url('/dashboard/connectivity') }}" class="nav-link nav-link--section" data-section="connectivity">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
          </svg>
          <span class="nav-link__text">Connectivity</span>
        </a>
        <a href="{{ url('/dashboard/environmental') }}" class="nav-link nav-link--section" data-section="environmental">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
          </svg>
          <span class="nav-link__text">Environmental / UV</span>
        </a>
        <a href="{{ url('/dashboard/ai-insights') }}" class="nav-link nav-link--section" data-section="ai-insights">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
          <span class="nav-link__text">AI Insights</span>
        </a>
        <a href="{{ url('/dashboard/management') }}" class="nav-link nav-link--section nav-link--admin-only" data-section="management" data-admin-only title="Admin only">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          <span class="nav-link__text">Management</span>
          <svg class="nav-link__lock" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </a>
      </nav>
      <div class="sidebar__footer">
          <a href="{{ url('/logout') }}" class="btn btn--ghost btn--sm">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1">
                  </path>
              </svg>
              <span>Logout</span>
          </a>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main">
      <!-- Topbar -->
      <div class="topbar">
        <div class="topbar__title">
          <h1 class="topbar__heading">SMACA Dashboard</h1>
          <p class="topbar__subtitle">Unified IoT monitoring platform</p>
        </div>
        <div class="topbar__actions">
          <!-- Role Badge -->
          <span id="role-badge" class="role-badge role-badge--user" aria-label="Current role" title="Your access level: User or Admin">User</span>
          <!-- System Health Badge -->
          <div id="system-health-badge" class="system-health-badge" title="Overall system and sensor connectivity status">
            <span class="system-health-badge__indicator"></span>
            <span class="system-health-badge__text">Operational</span>
          </div>
          <!-- Time Range Selector -->
          <div class="time-range-selector">
            <button class="time-range-btn active" data-timeframe="24h" title="Filter data for last 24 hours">24h</button>
            <button class="time-range-btn" data-timeframe="7d" title="Filter data for last 7 days">7d</button>
            <button class="time-range-btn" data-timeframe="30d" title="Filter data for last 30 days">30d</button>
          </div>
          <!-- Export Button -->
          <button id="export-btn" class="btn btn--secondary btn--sm export-btn" title="Export dashboard data">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Export
          </button>
          
          <button class="btn btn--ghost btn--sm" id="sidebar-toggle" aria-label="Toggle sidebar" title="Collapse or expand sidebar">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- Dashboard Overview Section -->
        <div class="dashboard-section" id="overview" data-section="overview">
          <div class="section-hero section-hero--overview">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row">
                  <svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                  </svg>
                  <h2 class="section-hero__title">Dashboard Overview</h2>
                </div>
                <p class="section-hero__subtitle">Select a section from the sidebar to view detailed monitoring data</p>
              </div>
              <div class="section-hero__stat">
                <div id="overview-total-sensors" class="section-hero__stat-value">24</div>
                <div class="section-hero__stat-label">Total sensors</div>
              </div>
            </div>
          </div>
          <div class="section-meta">
            <span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">Live</span>
            <span class="last-updated-pill" title="Time since last data sync">Last updated: 2 min ago</span>
          </div>
          <!-- Quick Stats Grid -->
          <div class="grid grid--metrics grid--metrics-4">
            <div class="stat-card" title="Number of active sensors across all systems">
              <div class="stat-card__content">
                <div class="stat-card__label">Total Sensors</div>
                <div class="stat-card__value">24</div>
                <div class="stat-card__unit">active</div>
                <div class="stat-card__meta">Across all systems</div>
              </div>
            </div>

            <div class="stat-card" title="Percentage of sensors reporting healthy status">
              <div class="stat-card__content">
                <div class="stat-card__label">System Health</div>
                <div class="stat-card__value">98%</div>
                <div class="stat-card__unit"></div>
                <div style="display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2);">
                  <span class="badge badge--success badge--sm">Optimal</span>
                </div>
              </div>
            </div>

            <div class="stat-card" title="Total data points collected today across all sensors">
              <div class="stat-card__content">
                <div class="stat-card__label">Data Points Today</div>
                <div class="stat-card__value">12.4K</div>
                <div class="stat-card__unit"></div>
                <div class="stat-card__meta">Real-time collection</div>
              </div>
            </div>

            <div class="stat-card" title="Time since last data refresh from sensors">
              <div class="stat-card__content">
                <div class="stat-card__label">Last Update</div>
                <div class="stat-card__value">2</div>
                <div class="stat-card__unit">min ago</div>
                <div class="stat-card__meta">All systems synchronized</div>
              </div>
            </div>
          </div>

          <!-- General Information Section -->
          <div class="grid grid-2-1">
            <div class="card">
              <div class="card__header">
                <div class="card__header-icon">
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <h3 class="card__title">About SMACA</h3>
                </div>
              </div>
              <div class="card__body">
                <div class="info-block">
                  <h4 class="info-block__title">What is SMACA?</h4>
                  <p class="info-block__content">SMACA (Smart Campus) is an integrated IoT platform for monitoring air quality, occupancy, energy consumption, and environmental conditions in smart buildings and campus facilities.</p>
                </div>
                <div class="info-block">
                  <h4 class="info-block__title">Features</h4>
                  <ul class="info-block__list">
                    <li>Real-time air quality monitoring</li>
                    <li>Occupancy and people flow analysis</li>
                    <li>Energy consumption metrics</li>
                    <li>Environmental indicators (UV, temperature)</li>
                    <li>AI-powered predictions and recommendations</li>
                    <li>Sensor management</li>
                  </ul>
                </div>
                <div class="info-block">
                  <h4 class="info-block__title">Quick tips</h4>
                  <p class="info-block__content"><strong>Time Range:</strong> Use 24h / 7d / 30d in the topbar to filter data. <strong>Export:</strong> Click Export for CSV download. <strong>Alerts:</strong> Shown automatically when issues occur (high CO₂, low battery, weak signal).</p>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card__header">
                <div class="card__header-icon">
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <h3 class="card__title">System Status</h3>
                </div>
              </div>
              <div class="card__body">
                <div class="stat-row"><span class="stat-row__label">Connected sensors</span><span id="overview-connected-sensors" class="stat-row__value">24</span></div>
                <div class="stat-row"><span class="stat-row__label">Active</span><span id="overview-active-sensors" class="stat-row__value" style="color: var(--success);">23</span></div>
                <div class="stat-row"><span class="stat-row__label">Maintenance</span><span id="overview-maintenance-sensors" class="stat-row__value" style="color: var(--warning);">1</span></div>
                <div class="stat-row"><span class="stat-row__label">AI Events (24h)</span><span id="overview-ai-events" class="stat-row__value" style="color: var(--accent);">47</span></div>
                <div style="border-top: 1px solid var(--border); padding-top: var(--space-4); margin-top: var(--space-4);">
                  <h4 class="info-block__title" style="text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-3);">Quick tips</h4>
                  <div class="quick-tips">
                    <div class="quick-tip">
                      <svg class="quick-tip__icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <div><div class="quick-tip__title">CO₂ Levels</div><div class="quick-tip__desc">Good: &lt;800 ppm, Warning: 800-1000 ppm, Danger: &gt;1000 ppm</div></div>
                    </div>
                    <div class="quick-tip">
                      <svg class="quick-tip__icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <div><div class="quick-tip__title">Battery</div><div class="quick-tip__desc">&lt;20% = replacement needed</div></div>
                    </div>
                    <div class="quick-tip">
                      <svg class="quick-tip__icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <div><div class="quick-tip__title">Signal (RSSI)</div><div class="quick-tip__desc">&gt;-70 dBm strong, -70 to -90 good, &lt;-90 weak</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-single">
            <div class="card">
              <div class="card__header">
                <h3 class="card__title">Quick Access</h3>
              </div>
              <div class="card__body">
                <div class="quick-links-grid">
                  <a href="{{ url('/dashboard/iaq') }}" class="btn btn--secondary quick-link" data-section="iaq">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Indoor Air Quality
                  </a>
                  <a href="{{ url('/dashboard/occupancy') }}" class="btn btn--secondary quick-link" data-section="occupancy">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    Occupancy
                  </a>
                  <a href="{{ url('/dashboard/energy') }}" class="btn btn--secondary quick-link" data-section="energy">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    Energy
                  </a>
                  <a href="{{ url('/dashboard/connectivity') }}" class="btn btn--secondary quick-link" data-section="connectivity">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
                    </svg>
                    Connectivity
                  </a>
                  <a href="{{ url('/dashboard/environmental') }}" class="btn btn--secondary quick-link" data-section="environmental">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                    </svg>
                    Environmental / UV
                  </a>
                  <a href="{{ url('/dashboard/ai-insights') }}" class="btn btn--secondary quick-link" data-section="ai-insights">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                    AI Insights
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Indoor Air Quality Section -->
        <div class="dashboard-section" id="iaq" data-section="iaq" style="display: none;">
          <div class="section-hero section-hero--iaq">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row">
                  <svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <h2 class="section-hero__title">Indoor Air Quality</h2>
                </div>
                <p class="section-hero__subtitle">Is the space currently healthy? Is air quality degrading or improving?</p>
              </div>
              <div class="section-hero__stat"><div id="iaq-active-sensors" class="section-hero__stat-value">8</div><div class="section-hero__stat-label">Active sensors</div></div>
            </div>
          </div>
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">Live</span><span class="last-updated-pill" title="Time since last data sync">Last updated: 2 min ago</span></div>
          
          <!-- KPI Cards with Metric Definitions -->
          <div id="iaq-kpi-cards" class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);">
            <!-- KPI cards will be rendered here by JavaScript -->
          </div>
          
          <!-- Sensor Health & Data Source -->
          <div class="grid" style="grid-template-columns: 2fr 1fr; gap: var(--space-6); margin-bottom: var(--space-6);">
            <div id="sensor-health-panel"></div>
            <div id="data-source-panel"></div>
          </div>
          
          <!-- Active Alerts Panel -->
          <div class="card" style="margin-bottom: var(--space-6);">
            <div class="card__header">
              <h3 class="card__title">Active Alerts</h3>
            </div>
            <div class="card__body">
              <div id="alerts-panel">
                <div class="alerts-empty-state" style="text-align: center; padding: var(--space-8); color: var(--muted);">
                  <p>No active alerts</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Domain-Driven Visualizations -->
          <div class="grid" style="grid-template-columns: 1fr; gap: var(--space-6); margin-bottom: var(--space-6);">
            <div class="card">
              <div class="card__header">
                <h3 class="card__title">CO₂ Concentration with Threshold Zones</h3>
                <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">Decision: When to ventilate or adjust HVAC</p>
              </div>
              <div class="card__body">
                <div class="chart-placeholder" id="iaq-co2-band-chart"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>What is this graph?</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p><strong>Y-axis (Vertical):</strong></p>
                      <ul>
                        <li><strong>Values (ppm):</strong> Carbon dioxide concentration in parts per million</li>
                        <li><strong>Green zone:</strong> &lt;800 ppm — good air quality, no action needed</li>
                        <li><strong>Amber zone:</strong> 800–1000 ppm — consider ventilation</li>
                        <li><strong>Red zone:</strong> &gt;1000 ppm — ventilate or adjust HVAC</li>
                      </ul>
                      <p><strong>X-axis (Horizontal):</strong> Time — each point represents a measurement moment. Range follows selected timeframe (24h, 7d, 30d).</p>
                      <p><strong>How to read:</strong> The line shows CO₂ levels over time. When it enters the amber or red zone, increase ventilation. Sustained high levels indicate poor air exchange.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Occupancy Section -->
        <div class="dashboard-section" id="occupancy" data-section="occupancy" style="display: none;">
          <div class="section-hero section-hero--occupancy">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                  <h2 class="section-hero__title">Occupancy</h2>
                </div>
                <p class="section-hero__subtitle">When is the space actually used? Is usage consistent or bursty?</p>
              </div>
              <div class="section-hero__stat"><div id="occupancy-current-count" class="section-hero__stat-value">7</div><div class="section-hero__stat-label">People present</div></div>
            </div>
          </div>
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">Live</span><span class="last-updated-pill" title="Time since last data sync">Last updated: 2 min ago</span></div>
          
          <!-- Current Status -->
          <div class="card" style="margin-bottom: var(--space-6);">
            <div class="card__body">
              <div style="display: flex; align-items: center; gap: var(--space-6);">
                <div>
                  <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-1);">Current Occupancy</div>
                  <div style="font-size: 36px; font-weight: 600; color: var(--text);">7</div>
                  <div style="font-size: 11px; color: var(--muted);">people present</div>
                </div>
                <div style="flex: 1; border-left: 1px solid var(--border); padding-left: var(--space-6);">
                  <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">Does occupancy explain IAQ degradation?</div>
                  <div style="font-size: 12px; color: var(--text);">Correlation analysis available in Energy section</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Domain-Driven Visualizations -->
          <div class="grid" style="grid-template-columns: repeat(2, 1fr); gap: var(--space-6);">
            <div class="card">
              <div class="card__header">
                <h3 class="card__title">Flow-based Movement (In/Out)</h3>
                <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">Decision: When is space actually being used?</p>
              </div>
              <div class="card__body">
                <div class="chart-placeholder" id="occupancy-flow-chart"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>What is this graph?</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p><strong>Y-axis (Vertical):</strong></p>
                      <ul>
                        <li><strong>Center line (0):</strong> Baseline — no movement</li>
                        <li><strong>Upward (green bars):</strong> People entering the space</li>
                        <li><strong>Downward (red bars):</strong> People leaving the space</li>
                        <li><strong>Bar height:</strong> Number of people (scaled to max value)</li>
                      </ul>
                      <p><strong>X-axis (Horizontal):</strong></p>
                      <ul>
                        <li><strong>Time periods:</strong> Each bar represents one time interval (e.g., hourly)</li>
                        <li><strong>Range:</strong> Typically 24 hours (00:00 to 23:00)</li>
                        <li><strong>Pattern:</strong> Shows when people enter vs. exit throughout the day</li>
                      </ul>
                      <p><strong>How to read:</strong> <span class="legend-dot" style="background:#10b981;"></span> <strong>Green bars (↑):</strong> People entering — shows arrival patterns. <span class="legend-dot" style="background:#ef4444;"></span> <strong>Red bars (↓):</strong> People leaving — shows departure patterns. Example: If a green bar reaches 5 units upward, it means 5 people entered during that time period.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card__header">
                <h3 class="card__title">Occupancy Density Timeline</h3>
                <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">Decision: When is space actually occupied? (Discrete presence)</p>
              </div>
              <div class="card__body">
                <div class="chart-placeholder" id="occupancy-density-timeline"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>What is this graph?</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p><strong>Y-axis (Vertical):</strong></p>
                      <ul>
                        <li><strong>Values (0 to max):</strong> Total number of people present in the space</li>
                        <li><strong>Each number:</strong> Represents the occupancy count at that moment</li>
                        <li><strong>Blue area:</strong> Filled area below the line shows occupancy density</li>
                        <li><strong>Step pattern:</strong> Values change in discrete steps (not smooth curves)</li>
                      </ul>
                      <p><strong>X-axis (Horizontal):</strong></p>
                      <ul>
                        <li><strong>Time periods:</strong> Each step represents one time interval (e.g., hourly)</li>
                        <li><strong>Range:</strong> Typically 24 hours (00:00 to 23:00)</li>
                        <li><strong>Step chart:</strong> Values remain constant within each interval, then jump to next value</li>
                      </ul>
                      <p><strong>How to read:</strong> Higher blue area = more people present. Flat sections = occupancy stayed constant. Vertical jumps = sudden changes (people entering or leaving). Example: If the line is at Y=7, it means 7 people were present during that entire time period.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Energy Section -->
        <div class="dashboard-section" id="energy" data-section="energy" style="display: none;">
          <div class="section-hero section-hero--energy">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  <h2 class="section-hero__title">Energy</h2>
                </div>
                <p class="section-hero__subtitle">Is energy use proportional to space usage? Are we wasting energy during low occupancy?</p>
              </div>
              <div class="section-hero__stat"><div id="energy-daily-consumption" class="section-hero__stat-value">1688</div><div class="section-hero__stat-label">kWh today</div></div>
            </div>
          </div>
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">Live</span><span class="last-updated-pill" title="Time since last data sync">Last updated: 2 min ago</span></div>
          
          <!-- Current Status -->
          <div class="card" style="margin-bottom: var(--space-6);">
            <div class="card__body">
              <div style="display: flex; align-items: center; gap: var(--space-6);">
                <div>
                  <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-1);">Daily Consumption</div>
                  <div style="font-size: 36px; font-weight: 600; color: var(--text);">1688.2</div>
                  <div style="font-size: 11px; color: var(--muted);">kWh today</div>
                </div>
                <div style="flex: 1; border-left: 1px solid var(--border); padding-left: var(--space-6);">
                  <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">Idle energy periods highlighted below</div>
                  <div style="font-size: 12px; color: #f59e0b;">Low occupancy + high energy = waste</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Domain-Driven Visualization -->
          <div class="card">
            <div class="card__header">
              <h3 class="card__title">Occupancy vs Energy Correlation</h3>
              <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">Decision: Are we wasting energy during low occupancy? (Red zones = idle waste)</p>
            </div>
            <div class="card__body">
              <div class="chart-placeholder" id="energy-correlation-chart"></div>
              <div class="smaca-accordion smaca-accordion--collapsed">
                <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                  <span>What is this graph?</span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <div class="smaca-accordion__body" hidden>
                  <div class="accordion-content">
                    <p><strong>Y-axis Left (Blue):</strong></p>
                    <ul>
                      <li><strong>Values (0 to max):</strong> Number of people present (occupancy)</li>
                      <li><strong>Blue line:</strong> Occupancy trend over time</li>
                      <li><strong>Scale:</strong> Adjusted to show occupancy range (e.g., 0–25 people)</li>
                    </ul>
                    <p><strong>Y-axis Right (Orange):</strong></p>
                    <ul>
                      <li><strong>Values (0 to max):</strong> Energy consumption (kWh or similar unit)</li>
                      <li><strong>Orange line:</strong> Energy consumption trend over time</li>
                      <li><strong>Scale:</strong> Adjusted to show energy range (e.g., 0–200 kWh)</li>
                    </ul>
                    <p><strong>X-axis (Horizontal):</strong> Time periods — each point represents one interval (e.g., hourly). Both lines share the same X-axis to compare trends.</p>
                    <p><strong>How to read:</strong> <span class="legend-dot" style="background:#3b82f6;"></span> Blue line = Occupancy (people). <span class="legend-dot" style="background:#f59e0b;"></span> Orange line = Energy (kWh). <strong>Parallel movement</strong> = energy use proportional to occupancy (efficient). <strong>Divergence</strong> = energy stays high while occupancy drops = waste. <strong>Red highlighted areas</strong> = low occupancy (&lt;20%) but high energy (&gt;30% of max) — potential waste.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Connectivity Section -->
        <div class="dashboard-section" id="connectivity" data-section="connectivity" style="display: none;">
          <div class="section-hero section-hero--connectivity">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path></svg>
                  <h2 class="section-hero__title">Connectivity</h2>
                </div>
                <p class="section-hero__subtitle">Can I trust this data? Which sensors are degrading?</p>
              </div>
              <div class="section-hero__stat"><div id="connectivity-connected-sensors" class="section-hero__stat-value">24</div><div class="section-hero__stat-label">Connected</div></div>
            </div>
          </div>
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">Live</span><span class="last-updated-pill" title="Time since last data sync">Last updated: 2 min ago</span></div>
          
          <!-- Domain-Driven Visualization (Admin: full details; User: summary only) -->
          <div class="card connectivity-admin-detail" data-connectivity-admin-detail>
            <div class="card__header">
              <h3 class="card__title">Sensor Health Status</h3>
              <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">Decision: Which sensors need attention? (Battery decay, signal strength, data freshness)</p>
            </div>
            <div class="card__body">
              <div id="sensor-health-table"></div>
            </div>
          </div>
        </div>

        <!-- Environmental / UV Section -->
        <div class="dashboard-section" id="environmental" data-section="environmental" style="display: none;">
          <div class="section-hero section-hero--environmental">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  <h2 class="section-hero__title">Environmental / UV</h2>
                </div>
                <p class="section-hero__subtitle">UV index and environmental conditions</p>
              </div>
              <div class="section-hero__stat"><div id="environmental-uv-index" class="section-hero__stat-value">6.5</div><div class="section-hero__stat-label">UV Index</div></div>
            </div>
          </div>
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">Live</span><span class="last-updated-pill" title="Time since last data sync">Last updated: 2 min ago</span></div>
          <div class="grid grid--metrics grid--metrics-4">
            <div class="stat-card" title="UV Index: 0–2 Low, 3–5 Moderate, 6–7 High, 8+ Very High — use sun protection accordingly">
              <div class="stat-card__content">
                <div class="stat-card__label">UV Index</div>
                <div class="stat-card__value">6.5</div>
                <div class="stat-card__unit"></div>
                <div class="stat-card__meta">Moderate</div>
              </div>
            </div>
          </div>
          
          <!-- Environmental Charts -->
          <div class="grid" style="grid-template-columns: repeat(2, 1fr); gap: var(--space-6); margin-top: var(--space-6);">
            <div class="card">
              <div class="card__header">
                <h3 class="card__title">UV Index Gauge</h3>
              </div>
              <div class="card__body card__body--flex-center">
                <div id="uv-gauge-chart"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>What is this gauge?</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p><strong>UV Index Scale:</strong></p>
                      <ul>
                        <li><strong>Range:</strong> 0 to 11+ (maximum UV index scale)</li>
                        <li><strong>Current value:</strong> Displayed in the center (e.g., 6.5)</li>
                        <li><strong>Gauge arc:</strong> Semi-circular gauge showing current UV level</li>
                        <li><strong>Color coding:</strong> Green (low), Orange (moderate), Red (high)</li>
                      </ul>
                      <p><strong>UV Index Levels:</strong></p>
                      <ul>
                        <li><strong>0–2:</strong> Low</li>
                        <li><strong>3–5:</strong> Moderate</li>
                        <li><strong>6–7:</strong> High</li>
                        <li><strong>8–11+:</strong> Very High</li>
                      </ul>
                      <p>The gauge arc fills based on the current UV index value. Higher values indicate stronger UV radiation requiring more protection.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card__header">
                <h3 class="card__title">Hourly UV Index</h3>
              </div>
              <div class="card__body">
                <div class="chart-placeholder" id="uv-hourly-chart"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>What is this graph?</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p><strong>Y-axis (Vertical):</strong></p>
                      <ul>
                        <li><strong>Values (0 to 11+):</strong> UV Index scale</li>
                        <li><strong>Each number:</strong> Represents UV intensity at that time</li>
                        <li><strong>Orange line:</strong> UV Index measurements over time</li>
                      </ul>
                      <p><strong>X-axis (Horizontal):</strong></p>
                      <ul>
                        <li><strong>Time periods:</strong> Each point represents one hour</li>
                        <li><strong>Range:</strong> Typically 24 hours (00:00 to 23:00)</li>
                        <li><strong>Peak hours:</strong> Usually midday (10:00–16:00)</li>
                      </ul>
                      <p><strong>How to read:</strong> Low (0–2) = minimal UV exposure, safe for extended activity. Moderate (3–5) = some protection needed. High (6–7) = protection required, avoid sun during peak hours. Very high (8–11+) = extra protection needed, minimize sun exposure.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Insights Section -->
        <div class="dashboard-section" id="ai-insights" data-section="ai-insights" style="display: none;">
          <div class="section-hero section-hero--ai-insights">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                  <h2 class="section-hero__title">AI Insights & Predictions</h2>
                </div>
                <p class="section-hero__subtitle">Machine Learning for smart building management</p>
              </div>
              <div class="section-hero__stat"><div id="active-events-count" class="section-hero__stat-value">5</div><div class="section-hero__stat-label">Active events</div></div>
            </div>
          </div>
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">Live</span><span class="last-updated-pill" title="Time since last data sync">Last updated: 2 min ago</span></div>

          <!-- Ollama Model Card -->
          <div style="margin-bottom: var(--space-6);">
            <div class="card" id="ollama-model-card">
              <!-- Will be rendered by JavaScript -->
            </div>
          </div>

          <!-- CO₂ Prediction Chart & Active Alerts -->
          <div class="grid" style="grid-template-columns: 2fr 1fr; gap: var(--space-6); margin-bottom: var(--space-6);">
            <!-- CO₂ Prediction Chart -->
            <div class="card">
              <div class="card__header">
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #3b82f6;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                  </svg>
                  <h3 class="card__title">CO₂ Prediction - Next 12 Hours</h3>
                </div>
              </div>
              <div class="card__body">
                <div class="chart-placeholder" id="co2-prediction-chart"></div>
                <div id="co2-prediction-insight" class="prediction-insight">
                  <svg class="prediction-insight__icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                  <p class="prediction-insight__text" id="co2-prediction-text">The model predicts an 18% increase in CO₂ in the next 3 hours</p>
                </div>
              </div>
            </div>

            <!-- Active Alerts -->
            <div class="card">
              <div class="card__header">
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--danger);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                  <h3 class="card__title">Active Alerts</h3>
                </div>
              </div>
              <div class="card__body">
                <div id="ai-alerts-list">
                  <!-- Alerts will be loaded here via JavaScript -->
                </div>
              </div>
            </div>
          </div>
          
        </div>

        <!-- Management Section (Admin only) -->
        <div class="dashboard-section" id="management" data-section="management" data-admin-only style="display: none;">
          <div class="section-hero section-hero--management">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  <h2 class="section-hero__title">Management Dashboard</h2>
                </div>
                <p class="section-hero__subtitle">Sensor, user and system settings</p>
              </div>
              <div class="section-hero__stat"><div id="management-total-sensors" class="section-hero__stat-value">{{ $sensors->count() }}</div><div class="section-hero__stat-label">Total sensors</div></div>
            </div>
          </div>

          <!-- Summary Cards -->
          <div class="grid grid--metrics grid--metrics-4" style="margin-bottom: var(--space-6);">
            <div class="stat-card" title="Total number of sensors in the system">
              <div class="stat-card__content">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
                  <div class="stat-card__label">Total Sensors</div>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
                  </svg>
                </div>
                <div class="stat-card__value" id="total-sensors">{{ $sensors->count() }}</div>
                <div class="stat-card__unit"></div>
              </div>
            </div>
            <div class="stat-card" title="Sensors currently online and reporting data">
              <div class="stat-card__content">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
                  <div class="stat-card__label">Active</div>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
                  </svg>
                </div>
                <div class="stat-card__value" id="active-sensors">{{ $sensors->where('is_active', 1)->count() }}</div>
                <div class="stat-card__unit"></div>
              </div>
            </div>
            <div class="stat-card" title="Sensors requiring maintenance (low battery, errors, etc.)">
              <div class="stat-card__content">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
                  <div class="stat-card__label">Maintenance</div>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                </div>
                <div class="stat-card__value" id="maintenance-sensors">{{ $sensors->where('is_active', 0)->count() }}</div>
                <div class="stat-card__unit"></div>
              </div>
            </div>
            <div class="stat-card" title="Active AI-generated insights and alerts">
              <div class="stat-card__content">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
                  <div class="stat-card__label">AI Events</div>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                  </svg>
                </div>
                <div class="stat-card__value" id="ai-events-count">5</div>
                <div class="stat-card__unit"></div>
              </div>
            </div>
          </div>

          <!-- Search room or sensor (Management only) -->
          <div class="management-search-bar">
            <input type="search" id="management-search" class="input" placeholder="Search room or sensor..." aria-label="Search room or sensor">
            <button type="button" id="management-search-btn" class="btn btn--primary">Search</button>
          </div>

          <!-- Tabs Navigation -->
          <div class="management-tabs-bar">
            <button class="management-tab active" data-tab="sensors" style="padding: var(--space-3) var(--space-4); border: none; background: transparent; color: var(--text); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); cursor: pointer; border-bottom: 2px solid var(--accent); margin-bottom: -1px;">Sensors</button>
            <button class="management-tab" data-tab="ai-events" style="padding: var(--space-3) var(--space-4); border: none; background: transparent; color: var(--muted); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;">AI Events</button>
            <button class="management-tab" data-tab="users" style="padding: var(--space-3) var(--space-4); border: none; background: transparent; color: var(--muted); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;">Users</button>
            <button class="management-tab" data-tab="settings" style="padding: var(--space-3) var(--space-4); border: none; background: transparent; color: var(--muted); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;">Settings</button>
          </div>

          <!-- Sensors Management Tab -->
          <div id="management-sensors-tab" class="management-tab-content">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
              <h3 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); color: var(--text); margin: 0;">Sensor Management</h3>
              <button id="add-sensor-btn" class="btn btn--primary" style="display: flex; align-items: center; gap: var(--space-2);">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add Sensor
              </button>
            </div>
            
            <!-- Sensors Table -->
            <div class="card" style="overflow-x: auto;">
              <div class="card__body" style="padding: 0;">
                <table id="sensors-management-table" style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: var(--surface-2); border-bottom: 2px solid var(--border);">
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Device ID</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Name</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Type</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Location</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Status</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Battery</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Signal</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="sensors-management-table-body">
                    @foreach($sensors as $sensor)
                      @php
                        $latest = $sensor_latest->firstWhere('sensor_id', $sensor->id);
                        $site = $sites->firstWhere('id', $sensor->site_id);
                        $deviceId = $sensor->external_id ?? $sensor->id;
                        $batteryPct = $latest->battery_pct ?? null;
                      @endphp
                      <tr style="border-bottom: 1px solid var(--border); transition: background 0.2s;">
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text); font-family: monospace;">
                          {{ $deviceId }}
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
                          {{ $sensor->name }}
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
                          {{ $sensor->device_type ?? 'N/A' }}
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
                          {{ $site->name ?? '—' }}
                        </td>
                        <td style="padding: var(--space-3) var(--space-4);">
                          @if($sensor->is_active)
                            <span class="badge badge--success badge--sm">Live</span>
                          @else
                            <span class="badge badge--muted badge--sm">Inactive</span>
                          @endif
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
                          @if(!is_null($batteryPct))
                            <div style="display: flex; align-items: center; gap: var(--space-2);">
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              </svg>
                              <span>{{ $batteryPct }}%</span>
                            </div>
                          @else
                            —
                          @endif
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
                          —
                        </td>
                        <td style="padding: var(--space-3) var(--space-4);">
                          <div style="display: flex; gap: var(--space-2);">
                            <button class="btn btn--ghost btn--sm edit-sensor-btn" style="padding: var(--space-1); min-width: auto;" title="Edit" data-sensor-id="{{ $deviceId }}">
                              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                              </svg>
                            </button>
                            <button class="btn btn--ghost btn--sm delete-sensor-btn" style="padding: var(--space-1); min-width: auto; color: var(--danger);" title="Delete" data-sensor-id="{{ $deviceId }}">
                              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    @endforeach
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- AI Events Management Tab -->
          <div id="management-ai-events-tab" class="management-tab-content" style="display: none;">
            <h3 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); color: var(--text); margin: 0 0 var(--space-4) 0;">AI Events Management</h3>
            <div class="card" style="overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
              <div class="card__body" style="padding: 0;">
                <table class="ai-events-table" style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: var(--surface-2); border-bottom: 2px solid var(--border);">
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Type</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Title</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Location</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Severity</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Status</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">prediction</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Expected occupancy</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Central Library</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--info">low</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">open</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">alert</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Low sensor battery</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Conference Room</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--danger">critical</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">acknowledged</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">recommendation</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Ventilation optimization</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Amphitheater A</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--warning">medium</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">open</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">prediction</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Expected consumption increase</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Building A</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--info">low</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">acknowledged</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">alert</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">High temperature</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">IT Lab</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--high">high</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">open</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">anomaly</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Abnormally high CO₂ levels</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Room B2</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--danger">critical</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">acknowledged</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <!-- Users Management Tab -->
          <div id="management-users-tab" class="management-tab-content" style="display: none;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
              <h3 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); color: var(--text); margin: 0;">Users Management</h3>
              <button id="add-user-btn" class="btn btn--primary" style="display: flex; align-items: center; gap: var(--space-2);">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add User
              </button>
            </div>
            <div class="card" style="overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
              <div class="card__body" style="padding: 0;">
                <table id="users-management-table" style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: var(--surface-2); border-bottom: 2px solid var(--border);">
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Name</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Email</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Role</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Status</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Last Login</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="users-management-table-body">
                    <!-- Users loaded from API/database via loadUsers() -->
                  </tbody>
                </table>
                <div id="users-empty-state" class="users-empty-state" style="display: none; padding: var(--space-8); text-align: center; color: var(--muted);">
                  <p style="margin: 0;">No users yet. Users will appear here when the database is connected.</p>
                </div>
              </div>
            </div>
          </div>
          <div id="management-settings-tab" class="management-tab-content" style="display: none;">
            <div class="card">
              <div class="card__body">
                <p style="color: var(--muted);">System settings coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- Add/Edit Sensor Modal -->
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

  <!-- Add/Edit User Modal -->
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

  <!-- Scripts -->
  <script>
    window.SMACA_BASE_URL = "{{ rtrim(url('/'), '/') }}";
    window.SMACA_SENSORS = @json($sensors);
  </script>
  <script src="{{ asset('assets/js/rbac.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/ui.js') }}?v={{ time() }}"></script>
  
  <script src="{{ asset('assets/js/app.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/smaca-state-manager.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/smaca-trend-calculator.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/smaca-alerts-engine.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/smaca-csv-export.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/smaca-api.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/smaca-data-normalizer.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/smaca-accurate-charts.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/smaca-accurate-dashboard.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/advanced-visualizations.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/smaca-dashboard.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/smaca-production-features.js') }}?v={{ time() }}"></script>
  <script src="{{ asset('assets/js/smaca-ai-insights.js') }}?v={{ time() }}"></script>
</body>
</html>
