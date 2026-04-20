@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section" id="environmental" data-section="environmental">
          <div class="section-hero section-hero--environmental">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  <h2 class="section-hero__title">Environmental / UV</h2>
                </div>
                <p class="section-hero__subtitle">Monitor live UV exposure, daily peaks, and practical safety guidance for safer outdoor activity planning.</p>
              </div>
              <div class="section-hero__stat"><div id="environmental-uv-index" class="section-hero__stat-value">6.5</div><div class="section-hero__stat-label">UV Index</div></div>
            </div>
          </div>
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">Live</span><span class="last-updated-pill" title="Time since last data sync">Last updated: 2 min ago</span></div>
          <div class="grid grid--metrics grid--metrics-4" id="environmental-kpi-grid">
            <article class="stat-card" title="Current UV index at the latest measurement">
              <div class="stat-card__content">
                <div class="stat-card__label">Current UV Index</div>
                <div id="env-kpi-current-uv" class="stat-card__value">6.5</div>
                <div id="env-kpi-current-uv-meta" class="stat-card__meta">Live reading</div>
              </div>
            </article>
            <article class="stat-card" title="Current UV exposure category">
              <div class="stat-card__content">
                <div class="stat-card__label">Exposure Level</div>
                <div id="env-kpi-exposure" class="stat-card__value">High</div>
                <div id="env-kpi-exposure-meta" class="stat-card__meta">Protection advised</div>
              </div>
            </article>
            <article class="stat-card" title="Highest UV index reached today">
              <div class="stat-card__content">
                <div class="stat-card__label">Peak Today</div>
                <div id="env-kpi-peak" class="stat-card__value">8.2</div>
                <div id="env-kpi-peak-meta" class="stat-card__meta">Daily maximum</div>
              </div>
            </article>
            <article class="stat-card" title="Direction of UV change from the previous reading">
              <div class="stat-card__content">
                <div class="stat-card__label">Trend</div>
                <div id="env-kpi-trend" class="stat-card__value">Rising</div>
                <div id="env-kpi-trend-meta" class="stat-card__meta">vs previous reading</div>
              </div>
            </article>
          </div>

          <div class="environmental-main-grid">
            <section class="card environmental-chart-card">
              <div class="card__header">
                <h3 class="card__title">UV Trend</h3>
              </div>
              <div class="card__body">
                <div class="chart-placeholder environmental-chart-placeholder" id="uv-main-chart"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>What is this graph?</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p>This chart shows UV behavior across the selected monitoring window.</p>
                      <p>Colored background zones map UV risk bands from Low (0-2) to Extreme (11+).</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside class="card environmental-summary-card">
              <div class="card__header">
                <h3 class="card__title">UV Advisory</h3>
              </div>
              <div class="card__body">
                <div class="stat-row"><span class="stat-row__label">Current UV Level</span><span id="env-summary-current" class="stat-row__value">6.5 (High)</span></div>
                <div class="stat-row"><span class="stat-row__label">Peak in Window</span><span id="env-summary-peak" class="stat-row__value">8.2</span></div>
                <div class="stat-row"><span class="stat-row__label">Strongest Exposure Period</span><span id="env-summary-period" class="stat-row__value">11:00–14:00</span></div>
                <div class="prediction-insight">
                  <svg class="prediction-insight__icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z"></path></svg>
                  <p id="env-summary-guidance" class="prediction-insight__text">Limit direct sun exposure and use sunscreen, hat, and sunglasses during peak hours.</p>
                </div>
              </div>
            </aside>
          </div>

          <div class="environmental-bottom-grid">
            <section class="card">
              <div class="card__header">
                <h3 class="card__title">Hourly UV Pattern</h3>
              </div>
              <div class="card__body environmental-pattern-body">
                <div class="chart-placeholder" id="uv-pattern-chart"></div>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>What is this graph?</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content"></div>
                  </div>
                </div>
                <div class="environmental-zone-grid" aria-label="UV exposure zones">
                  <span class="environmental-zone environmental-zone--low">Low (0-2)</span>
                  <span class="environmental-zone environmental-zone--moderate">Moderate (3-5)</span>
                  <span class="environmental-zone environmental-zone--high">High (6-7)</span>
                  <span class="environmental-zone environmental-zone--very-high">Very High (8-10)</span>
                  <span class="environmental-zone environmental-zone--extreme">Extreme (11+)</span>
                </div>
              </div>
            </section>

            <section class="card environmental-meaning-card">
              <div class="card__header">
                <h3 class="card__title">Daily UV Comparison</h3>
              </div>
              <div class="card__body">
                <div class="chart-placeholder" id="uv-daily-comparison-chart"></div>
                <p id="env-meaning-level" class="environmental-meaning-level">Current interpretation: High UV exposure</p>
                <p id="env-meaning-copy" class="info-block__content">Daily peak UV highlights the highest exposure pressure each day so risk windows are easier to compare.</p>
                <div class="smaca-accordion smaca-accordion--collapsed">
                  <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
                    <span>How to read daily comparison</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  <div class="smaca-accordion__body" hidden>
                    <div class="accordion-content">
                      <p>Each bar shows that day's highest UV index. Taller bars mean stronger protection is needed that day.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
@endsection
