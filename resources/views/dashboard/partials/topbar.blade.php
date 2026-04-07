<div class="topbar">
        <div class="topbar__title">
          <h1 class="topbar__heading">SMACA Dashboard</h1>
          <p class="topbar__subtitle">Unified IoT monitoring platform</p>
        </div>
        <div class="topbar__actions">
          <!-- Role Badge -->
          <span id="role-badge" class="role-badge role-badge--user" aria-label="Current role" title="Your access level: User or Admin">User</span>
          <!-- System Health Badge -->
          <div id="system-health-badge" class="system-health-badge" title="Overall system and sensor connectivity status">
            <span class="system-health-badge__indicator"></span>
            <span class="system-health-badge__text">Operational</span>
          </div>
          <!-- Time Range Selector -->
          <div class="time-range-selector">
            <button class="time-range-btn active" data-timeframe="24h" title="Filter data for last 24 hours">24h</button>
            <button class="time-range-btn" data-timeframe="7d" title="Filter data for last 7 days">7d</button>
            <button class="time-range-btn" data-timeframe="30d" title="Filter data for last 30 days">30d</button>
          </div>
          <!-- Export Button -->
          <button id="export-btn" class="btn btn--secondary btn--sm export-btn" title="Export dashboard data">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Export
          </button>
          
          <button class="btn btn--ghost btn--sm" id="sidebar-toggle" aria-label="Toggle sidebar" title="Collapse or expand sidebar">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
        </div>
      </div>
