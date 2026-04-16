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
                  <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">Executive view of energy usage</div>
                  <div style="font-size: 12px; color: #38bdf8;">Columns show bucket usage; spline shows cumulative trend</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Domain-Driven Visualization -->
          <div class="card">
            <div class="card__header">
              <h3 class="card__title">Energy Usage Over Time</h3>
              <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">Decision: How does energy consumption trend during the selected timeframe?</p>
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
                    <p><strong>Columns (Energy usage):</strong> Energy consumption aggregated into the selected bucket size.</p>
                    <p><strong>Spline (Cumulative trend):</strong> Running total across the buckets for quick executive trend reading.</p>
                    <p><strong>X-axis:</strong> 24h uses hourly buckets; 7d/30d uses daily buckets.</p>
                    <p><strong>How to read:</strong> Use the column peaks to spot consumption bursts, and follow the spline to see whether overall usage is trending up or down.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
@endsection
