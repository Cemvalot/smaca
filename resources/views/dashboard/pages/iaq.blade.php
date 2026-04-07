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
@endsection
