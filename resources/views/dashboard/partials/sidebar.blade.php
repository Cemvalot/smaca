@php
  $smacaRole = session('role', 'user');
  $smacaIsAdmin = $smacaRole === 'admin';
  $smacaPageId = $smacaPage ?? 'overview';
@endphp
<aside class="sidebar" id="app-sidebar" aria-label="{{ __('messages.dashboard_i18n.nav_primary_label') }}">
  <div class="sidebar__header">
    <button type="button" class="sidebar__close" id="sidebar-close" aria-label="{{ __('messages.topbar.close_menu') }}">
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
    <div class="smaca-logo smaca-logo--sidebar smaca-logo--sidebar-dark" aria-label="SMACA">
      <div class="smaca-logo__row">
        <img
          src="{{ asset('assets/brand/smaca-icon-dark.svg') }}"
          alt="SMACA icon"
          class="smaca-logo__icon"
          width="48"
          height="48"
        >
        <span class="smaca-logo__wordmark">SMACA</span>
      </div>
      <span class="smaca-logo__caption">{{ __('messages.dashboard_i18n.iot_ai_platform') }}</span>
    </div>
  </div>
  <nav class="sidebar__nav" aria-label="{{ __('messages.dashboard_i18n.nav_primary_label') }}">
    <div class="sidebar__group sidebar__group--primary">
      <span class="sidebar__group-label">{{ __('messages.dashboard_i18n.nav_group_primary') }}</span>
      <a href="{{ url('/dashboard') }}" class="nav-link nav-link--section {{ $smacaPageId === 'overview' ? 'is-active' : '' }}" data-section="overview">
        @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'overview', 'size' => 'sm'])
        <span class="nav-link__text">{{ __('messages.nav.dashboard') }}</span>
      </a>
      <a href="{{ url('/dashboard/iaq') }}" class="nav-link nav-link--section {{ $smacaPageId === 'iaq' ? 'is-active' : '' }}" data-section="iaq">
        @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'iaq', 'size' => 'sm'])
        <span class="nav-link__text">{{ __('messages.nav.iaq') }}</span>
      </a>
      <a href="{{ url('/dashboard/occupancy') }}" class="nav-link nav-link--section {{ $smacaPageId === 'occupancy' ? 'is-active' : '' }}" data-section="occupancy">
        @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'occupancy', 'size' => 'sm'])
        <span class="nav-link__text">{{ __('messages.nav.occupancy') }}</span>
      </a>
      <a href="{{ url('/dashboard/environmental') }}" class="nav-link nav-link--section {{ $smacaPageId === 'environmental' ? 'is-active' : '' }}" data-section="environmental">
        @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'environmental', 'size' => 'sm'])
        <span class="nav-link__text">{{ __('messages.nav.environmental') }}</span>
      </a>
    </div>

    @if($smacaIsAdmin)
    <div class="sidebar__group sidebar__group--secondary" data-admin-only>
      <span class="sidebar__group-label">{{ __('messages.dashboard_i18n.nav_group_secondary') }}</span>
      <a href="{{ url('/dashboard/connectivity') }}" class="nav-link nav-link--section {{ $smacaPageId === 'connectivity' ? 'is-active' : '' }}" data-section="connectivity" data-admin-only>
        @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'connectivity', 'size' => 'sm'])
        <span class="nav-link__text">{{ __('messages.nav.connectivity') }}</span>
      </a>
      <a href="{{ url('/dashboard/energy') }}" class="nav-link nav-link--section {{ $smacaPageId === 'energy' ? 'is-active' : '' }}" data-section="energy" data-admin-only>
        @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'energy', 'size' => 'sm'])
        <span class="nav-link__text">{{ __('messages.nav.energy') }}</span>
      </a>
      <a href="{{ url('/dashboard/water') }}" class="nav-link nav-link--section {{ $smacaPageId === 'water' ? 'is-active' : '' }}" data-section="water" data-admin-only>
        @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'water', 'size' => 'sm'])
        <span class="nav-link__text">{{ __('messages.nav.water') }}</span>
      </a>
    </div>

    <div class="sidebar__group sidebar__group--admin" data-admin-only>
      <span class="sidebar__group-label">{{ __('messages.dashboard_i18n.nav_group_admin') }}</span>
      <a href="{{ url('/dashboard/management') }}" class="nav-link nav-link--section nav-link--admin-only {{ $smacaPageId === 'management' ? 'is-active' : '' }}" data-section="management" data-admin-only title="{{ __('messages.dashboard_i18n.nav_admin_only') }}">
        @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'management', 'size' => 'sm'])
        <span class="nav-link__text">{{ __('messages.nav.management') }}</span>
        <svg class="nav-link__lock" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
      </a>
      <a href="{{ url('/dashboard/ai-insights') }}" class="nav-link nav-link--section {{ $smacaPageId === 'ai-insights' ? 'is-active' : '' }}" data-section="ai-insights" data-admin-only>
        @include('dashboard.partials.pillar-icon-chip', ['pillar' => 'ai', 'size' => 'sm'])
        <span class="nav-link__text">{{ __('messages.nav.ai_insights') }}</span>
      </a>
    </div>
    @endif
  </nav>
  <div class="sidebar__footer">
    <a href="{{ url('/logout') }}" class="btn btn--ghost btn--sm">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1">
        </path>
      </svg>
      <span>{{ __('messages.nav.logout') }}</span>
    </a>
  </div>
</aside>
