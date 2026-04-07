@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section" id="energy" data-section="energy">
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
@endsection
