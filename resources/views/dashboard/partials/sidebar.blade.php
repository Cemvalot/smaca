@php
  $smacaRole = session('role', 'user');
  $smacaIsAdmin = $smacaRole === 'admin';
@endphp
<aside class="sidebar">
      <div class="sidebar__header">
        <div class="sidebar__logo">SMACA</div>
        <div class="sidebar__subtitle">IoT & AI Platform</div>
      </div>
      <nav class="sidebar__nav">
        <a href="{{ url('/dashboard') }}" class="nav-link nav-link--section {{ ($smacaPage ?? 'overview') === 'overview' ? 'is-active' : '' }}" data-section="overview">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
          </svg>
          <span class="nav-link__text">Dashboard Overview</span>
        </a>
        <a href="{{ url('/dashboard/iaq') }}" class="nav-link nav-link--section {{ ($smacaPage ?? 'overview') === 'iaq' ? 'is-active' : '' }}" data-section="iaq">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="nav-link__text">Indoor Air Quality</span>
        </a>
        <a href="{{ url('/dashboard/occupancy') }}" class="nav-link nav-link--section {{ ($smacaPage ?? 'overview') === 'occupancy' ? 'is-active' : '' }}" data-section="occupancy">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          <span class="nav-link__text">Occupancy</span>
        </a>
        @if($smacaIsAdmin)
        <a href="{{ url('/dashboard/energy') }}" class="nav-link nav-link--section {{ ($smacaPage ?? 'overview') === 'energy' ? 'is-active' : '' }}" data-section="energy">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          <span class="nav-link__text">Energy</span>
        </a>
        @endif
        @if($smacaIsAdmin)
        <a href="{{ url('/dashboard/connectivity') }}" class="nav-link nav-link--section {{ ($smacaPage ?? 'overview') === 'connectivity' ? 'is-active' : '' }}" data-section="connectivity">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
          </svg>
          <span class="nav-link__text">Connectivity</span>
        </a>
        @endif
        <a href="{{ url('/dashboard/environmental') }}" class="nav-link nav-link--section {{ ($smacaPage ?? 'overview') === 'environmental' ? 'is-active' : '' }}" data-section="environmental">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
          </svg>
          <span class="nav-link__text">Environmental / UV</span>
        </a>
        @if($smacaIsAdmin)
        <a href="{{ url('/dashboard/ai-insights') }}" class="nav-link nav-link--section {{ ($smacaPage ?? 'overview') === 'ai-insights' ? 'is-active' : '' }}" data-section="ai-insights">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
          <span class="nav-link__text">AI Insights</span>
        </a>
        <a href="{{ url('/dashboard/management') }}" class="nav-link nav-link--section nav-link--admin-only {{ ($smacaPage ?? 'overview') === 'management' ? 'is-active' : '' }}" data-section="management" data-admin-only title="Admin only">
          <svg class="nav-link__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          <span class="nav-link__text">Management</span>
          <svg class="nav-link__lock" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </a>
        @endif
      </nav>
      <div class="sidebar__footer">
          <a href="{{ url('/logout') }}" class="btn btn--ghost btn--sm">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1">
                  </path>
              </svg>
              <span>Logout</span>
          </a>
      </div>
    </aside>
