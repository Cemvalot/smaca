@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section" id="iaq" data-section="iaq">
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
          
          <!-- Domain-Driven Visualizations -->
          <div class="grid" style="grid-template-columns: 1fr; gap: var(--space-6); margin-bottom: var(--space-6);">
            <div class="card">
              <div class="card__header">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap;">
                  <div>
                    <h3 id="iaq-main-chart-title" class="card__title">IAQ Trend - CO₂</h3>
                    <p id="iaq-main-chart-subtitle" style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">Aggregated across all IAQ sensors</p>
                  </div>
                  <div id="iaq-metric-toggle" class="time-range-selector" role="tablist" aria-label="Select IAQ metric">
                    <button type="button" class="time-range-btn active" data-iaq-metric="co2">CO₂</button>
                    <button type="button" class="time-range-btn" data-iaq-metric="temperature">Temperature</button>
                    <button type="button" class="time-range-btn" data-iaq-metric="humidity">Humidity</button>
                    <button type="button" class="time-range-btn" data-iaq-metric="pm2_5">PM2.5</button>
                    <button type="button" class="time-range-btn" data-iaq-metric="pm10">PM10</button>
                    <button type="button" class="time-range-btn" data-iaq-metric="tvoc">TVOC</button>
                  </div>
                </div>
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
            <div id="iaq-hourly-heatstrip-panel"></div>
          </div>
        </div>
@endsection
