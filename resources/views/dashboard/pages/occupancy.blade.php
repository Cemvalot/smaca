@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section" id="occupancy" data-section="occupancy">
          <div class="section-hero section-hero--occupancy">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                  <h2 class="section-hero__title">Occupancy</h2>
                </div>
                <p class="section-hero__subtitle">When is the space actually used? Is usage consistent or bursty?</p>
              </div>
              <div class="section-hero__stat"><div id="occupancy-current-count" class="section-hero__stat-value">7</div><div class="section-hero__stat-label">Recent movements</div></div>
            </div>
          </div>
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">Live</span><span class="last-updated-pill" title="Time since last data sync">Last updated: 2 min ago</span></div>
          
          <!-- Current Status -->
          <div class="card" style="margin-bottom: var(--space-6);">
            <div class="card__body">
              <div style="display: flex; align-items: center; gap: var(--space-6);">
                <div>
                  <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-1);">Current Activity</div>
                  <div style="font-size: 36px; font-weight: 600; color: var(--text);">7</div>
                  <div style="font-size: 11px; color: var(--muted);">Cumulative Entries / Cumulative Exits</div>
                </div>
                <div style="flex: 1; border-left: 1px solid var(--border); padding-left: var(--space-6);">
                  <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">Does occupancy explain IAQ degradation?</div>
                  <div style="font-size: 12px; color: var(--text);">Correlation analysis available in Energy section</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Domain-Driven Visualizations -->
          <div class="grid occupancy-primary-grid" style="grid-template-columns: repeat(2, 1fr); gap: var(--space-6);">
            <div class="card occupancy-primary-card">
              <div class="card__header">
                <h3 class="card__title">Flow Over Time (In/Out)</h3>
                <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">Decision: When is space actually being used?</p>
              </div>
              <div class="card__body occupancy-primary-card__body">
                <div class="chart-placeholder occupancy-primary-chart" id="occupancy-flow-chart"></div>
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
            <div class="card occupancy-primary-card">
              <div class="card__header">
                <h3 class="card__title">Activity Over Time</h3>
                <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">Decision: When is traffic/movement highest? (entries + exits)</p>
              </div>
              <div class="card__body occupancy-primary-card__body">
                <div class="chart-placeholder occupancy-primary-chart" id="occupancy-density-timeline"></div>
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
@endsection
