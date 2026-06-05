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
          <div class="time-range-selector">
            <button class="time-range-btn active" data-timeframe="24h" title="{{ __('messages.topbar.filter_24h') }}">{{ __('messages.dashboard_i18n.time_24h') }}</button>
            <button class="time-range-btn" data-timeframe="7d" title="{{ __('messages.topbar.filter_7d') }}">{{ __('messages.dashboard_i18n.time_7d') }}</button>
            <button class="time-range-btn" data-timeframe="30d" title="{{ __('messages.topbar.filter_30d') }}">{{ __('messages.dashboard_i18n.time_30d') }}</button>
            <details id="smaca-timeframe-help" class="smaca-timeframe-help">
              <summary aria-label="{{ __('messages.timeframe_help.title') }}" title="{{ __('messages.timeframe_help.title') }}">i</summary>
              <div class="smaca-timeframe-help__panel" role="dialog" aria-label="{{ __('messages.timeframe_help.title') }}">
                <p class="smaca-timeframe-help__title">{{ __('messages.timeframe_help.title') }}</p>
                <p><strong>24h:</strong> {{ __('messages.timeframe_help.h24') }}</p>
                <p><strong>7d:</strong> {{ __('messages.timeframe_help.d7') }}</p>
                <p><strong>30d:</strong> {{ __('messages.timeframe_help.d30') }}</p>
                <p class="smaca-timeframe-help__note">{{ __('messages.timeframe_help.export_only') }}</p>
              </div>
            </details>
          </div>
          <div class="language-switcher" aria-label="{{ __('messages.language.label') }}">
            <a href="{{ url('/language/en') }}" class="btn btn--ghost btn--sm {{ app()->getLocale() === 'en' ? 'is-active' : '' }}">{{ __('messages.language.english') }}</a>
            <a href="{{ url('/language/el') }}" class="btn btn--ghost btn--sm {{ app()->getLocale() === 'el' ? 'is-active' : '' }}">{{ __('messages.language.greek') }}</a>
          </div>
        </div>
      </div>
