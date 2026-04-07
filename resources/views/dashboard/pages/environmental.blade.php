@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section" id="environmental" data-section="environmental">
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
@endsection
