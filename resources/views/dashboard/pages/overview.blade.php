@extends('dashboard.layouts.app')

@section('dashboard-content')
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
@endsection
