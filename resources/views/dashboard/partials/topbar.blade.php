<div class="topbar">
        <div class="topbar__title">
          <h1 class="topbar__heading">{{ __('messages.topbar.heading') }}</h1>
          <p class="topbar__subtitle">{{ __('messages.topbar.subtitle') }}</p>
        </div>
        <div class="topbar__actions">
          <!-- Time Range Selector -->
          <div class="time-range-selector">
            <button class="time-range-btn active" data-timeframe="24h" title="{{ __('messages.topbar.filter_24h') }}">{{ __('messages.dashboard_i18n.time_24h') }}</button>
            <button class="time-range-btn" data-timeframe="7d" title="{{ __('messages.topbar.filter_7d') }}">{{ __('messages.dashboard_i18n.time_7d') }}</button>
            <button class="time-range-btn" data-timeframe="30d" title="{{ __('messages.topbar.filter_30d') }}">{{ __('messages.dashboard_i18n.time_30d') }}</button>
          </div>
          <div class="language-switcher" aria-label="{{ __('messages.language.label') }}">
            <a href="{{ url('/language/en') }}" class="btn btn--ghost btn--sm {{ app()->getLocale() === 'en' ? 'is-active' : '' }}">{{ __('messages.language.english') }}</a>
            <a href="{{ url('/language/el') }}" class="btn btn--ghost btn--sm {{ app()->getLocale() === 'el' ? 'is-active' : '' }}">{{ __('messages.language.greek') }}</a>
          </div>
          <button class="btn btn--ghost btn--sm" id="sidebar-toggle" aria-label="{{ __('messages.topbar.toggle_sidebar') }}" title="{{ __('messages.topbar.collapse_sidebar') }}">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
        </div>
      </div>
