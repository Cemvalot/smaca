<div class="topbar">
        <div class="topbar__start">
          <button type="button" class="topbar__menu-btn" id="sidebar-toggle" aria-controls="app-sidebar" aria-expanded="false" aria-label="{{ __('messages.topbar.open_menu') }}" title="{{ __('messages.topbar.open_menu') }}" data-label-open="{{ __('messages.topbar.open_menu') }}" data-label-close="{{ __('messages.topbar.close_menu') }}">
            <span class="topbar__menu-icon" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
          <div class="topbar__title">
            <h1 class="topbar__heading">{{ __('messages.topbar.heading') }}</h1>
            <p class="topbar__subtitle">{{ __('messages.topbar.subtitle') }}</p>
            <div class="topbar__badges">
              <span id="smaca-active-alerts-indicator" class="topbar__alert-indicator" aria-live="polite" hidden></span>
            </div>
          </div>
        </div>
        <div class="topbar__actions">
          <!-- Spatial scope selector (rendered by smaca-spatial.js) -->
          <div class="topbar__spatial" data-smaca-spatial-slot aria-label="{{ __('messages.spatial.label') }}"></div>
          <!-- Time Range Selector with timeframe explanation -->
          <div class="time-range-selector" style="position:relative;">
            <button class="time-range-btn active" data-timeframe="24h" title="{{ __('messages.topbar.filter_24h') }}">{{ __('messages.dashboard_i18n.time_24h') }}</button>
            <button class="time-range-btn" data-timeframe="7d" title="{{ __('messages.topbar.filter_7d') }}">{{ __('messages.dashboard_i18n.time_7d') }}</button>
            <button class="time-range-btn" data-timeframe="30d" title="{{ __('messages.topbar.filter_30d') }}">{{ __('messages.dashboard_i18n.time_30d') }}</button>
            <details id="smaca-timeframe-help" class="smaca-timeframe-help" style="display:inline-block;margin-left:var(--space-2);">
              <summary aria-label="{{ __('messages.timeframe_help.title') }}" title="{{ __('messages.timeframe_help.title') }}" style="list-style:none;cursor:pointer;font-size:11px;color:var(--muted);user-select:none;padding:2px 6px;border:1px solid rgba(148,163,184,0.25);border-radius:50%;line-height:1;">i</summary>
              <div role="dialog" aria-label="{{ __('messages.timeframe_help.title') }}" style="position:absolute;right:0;top:calc(100% + 6px);z-index:50;min-width:280px;max-width:320px;padding:var(--space-3);background:var(--bg-elev,#1a1f29);border:1px solid rgba(148,163,184,0.18);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.25);font-size:12px;line-height:1.5;color:var(--text);">
                <p style="margin:0 0 var(--space-2) 0;font-weight:600;">{{ __('messages.timeframe_help.title') }}</p>
                <p style="margin:0 0 var(--space-1) 0;"><strong>24h:</strong> {{ __('messages.timeframe_help.h24') }}</p>
                <p style="margin:0 0 var(--space-1) 0;"><strong>7d:</strong> {{ __('messages.timeframe_help.d7') }}</p>
                <p style="margin:0 0 var(--space-1) 0;"><strong>30d:</strong> {{ __('messages.timeframe_help.d30') }}</p>
                <p style="margin:0;color:var(--muted);">{{ __('messages.timeframe_help.export_only') }}</p>
              </div>
            </details>
          </div>
          <div class="language-switcher" aria-label="{{ __('messages.language.label') }}">
            <a href="{{ url('/language/en') }}" class="btn btn--ghost btn--sm {{ app()->getLocale() === 'en' ? 'is-active' : '' }}">{{ __('messages.language.english') }}</a>
            <a href="{{ url('/language/el') }}" class="btn btn--ghost btn--sm {{ app()->getLocale() === 'el' ? 'is-active' : '' }}">{{ __('messages.language.greek') }}</a>
          </div>
        </div>
      </div>
