@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section" id="ai-insights" data-section="ai-insights">
          <div class="section-hero section-hero--ai-insights">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                  <h2 class="section-hero__title">{{ __('messages.nav.ai_insights') }} & Predictions</h2>
                </div>
                <p class="section-hero__subtitle">Machine Learning for smart building management</p>
              </div>
              <div class="section-hero__stat"><div id="active-events-count" class="section-hero__stat-value">5</div><div class="section-hero__stat-label">{{ __('messages.common.active') }}</div></div>
            </div>
          </div>
          <div class="section-meta"><span class="data-status-pill data-status-pill--live" title="Data is being updated in real time">{{ __('messages.dashboard.live') }}</span><span class="last-updated-pill" title="Time since last data sync">{{ __('messages.dashboard.last_update') }}: 2 min ago</span></div>

          <!-- Ollama Model Card -->
          <div style="margin-bottom: var(--space-6);">
            <div class="card" id="ollama-model-card">
              <!-- Will be rendered by JavaScript -->
            </div>
          </div>

          <!-- CO₂ Prediction Chart & {{ __('messages.dashboard.alerts') }} -->
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

            <!-- {{ __('messages.dashboard.alerts') }} -->
            <div class="card">
              <div class="card__header">
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--danger);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                  <h3 class="card__title">{{ __('messages.dashboard.alerts') }}</h3>
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
@endsection
