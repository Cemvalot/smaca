@extends('dashboard.layouts.app')

@section('dashboard-content')
<div class="dashboard-section" id="management" data-section="management" data-admin-only>
          <div class="section-hero section-hero--management">
            <div class="section-hero__inner">
              <div>
                <div class="section-hero__title-row"><svg class="section-hero__icon" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  <h2 class="section-hero__title">Management Dashboard</h2>
                </div>
                <p class="section-hero__subtitle">Sensor, user and system settings</p>
              </div>
              <div class="section-hero__stat"><div id="management-total-sensors" class="section-hero__stat-value">{{ $sensors->count() }}</div><div class="section-hero__stat-label">Total sensors</div></div>
            </div>
          </div>

          <!-- Summary Cards -->
          <div class="grid grid--metrics grid--metrics-4" style="margin-bottom: var(--space-6);">
            <div class="stat-card" title="Total number of sensors in the system">
              <div class="stat-card__content">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
                  <div class="stat-card__label">Total Sensors</div>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
                  </svg>
                </div>
                <div class="stat-card__value" id="total-sensors">{{ $sensors->count() }}</div>
                <div class="stat-card__unit"></div>
              </div>
            </div>
            <div class="stat-card" title="Sensors currently online and reporting data">
              <div class="stat-card__content">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
                  <div class="stat-card__label">Active</div>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
                  </svg>
                </div>
                <div class="stat-card__value" id="active-sensors">{{ $sensors->where('is_active', 1)->count() }}</div>
                <div class="stat-card__unit"></div>
              </div>
            </div>
            <div class="stat-card" title="Sensors requiring maintenance (low battery, errors, etc.)">
              <div class="stat-card__content">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
                  <div class="stat-card__label">Maintenance</div>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                </div>
                <div class="stat-card__value" id="maintenance-sensors">{{ $sensors->where('is_active', 0)->count() }}</div>
                <div class="stat-card__unit"></div>
              </div>
            </div>
            <div class="stat-card" title="Active AI-generated insights and alerts">
              <div class="stat-card__content">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
                  <div class="stat-card__label">AI Events</div>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                  </svg>
                </div>
                <div class="stat-card__value" id="ai-events-count">5</div>
                <div class="stat-card__unit"></div>
              </div>
            </div>
          </div>

          <!-- Search room or sensor (Management only) -->
          <div class="management-search-bar">
            <input type="search" id="management-search" class="input" placeholder="Search room or sensor..." aria-label="Search room or sensor">
            <button type="button" id="management-search-btn" class="btn btn--primary">Search</button>
          </div>

          <!-- Tabs Navigation -->
          <div class="management-tabs-bar">
            <button class="management-tab active" data-tab="sensors" style="padding: var(--space-3) var(--space-4); border: none; background: transparent; color: var(--text); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); cursor: pointer; border-bottom: 2px solid var(--accent); margin-bottom: -1px;">Sensors</button>
            <button class="management-tab" data-tab="ai-events" style="padding: var(--space-3) var(--space-4); border: none; background: transparent; color: var(--muted); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;">AI Events</button>
            <button class="management-tab" data-tab="users" style="padding: var(--space-3) var(--space-4); border: none; background: transparent; color: var(--muted); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;">Users</button>
            <button class="management-tab" data-tab="settings" style="padding: var(--space-3) var(--space-4); border: none; background: transparent; color: var(--muted); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;">Settings</button>
          </div>

          <!-- Sensors Management Tab -->
          <div id="management-sensors-tab" class="management-tab-content">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
              <h3 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); color: var(--text); margin: 0;">Sensor Management</h3>
              <button id="add-sensor-btn" class="btn btn--primary" style="display: flex; align-items: center; gap: var(--space-2);">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add Sensor
              </button>
            </div>
            
            <!-- Sensors Table -->
            <div class="card" style="overflow-x: auto;">
              <div class="card__body" style="padding: 0;">
                <table id="sensors-management-table" style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: var(--surface-2); border-bottom: 2px solid var(--border);">
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Device ID</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Name</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Type</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Location</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Status</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Battery</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Signal</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="sensors-management-table-body">
                    @foreach($sensors as $sensor)
                      @php
                        $latest = $sensor_latest->firstWhere('sensor_id', $sensor->id);
                        $site = $sites->firstWhere('id', $sensor->site_id);
                        $deviceId = $sensor->external_id ?? $sensor->id;
                        $batteryPct = $latest->battery_pct ?? null;
                      @endphp
                      <tr style="border-bottom: 1px solid var(--border); transition: background 0.2s;">
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text); font-family: monospace;">
                          {{ $deviceId }}
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
                          {{ $sensor->name }}
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
                          {{ $sensor->device_type ?? 'N/A' }}
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
                          {{ $site->name ?? '—' }}
                        </td>
                        <td style="padding: var(--space-3) var(--space-4);">
                          @if($sensor->is_active)
                            <span class="badge badge--success badge--sm">Live</span>
                          @else
                            <span class="badge badge--muted badge--sm">Inactive</span>
                          @endif
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
                          @if(!is_null($batteryPct))
                            <div style="display: flex; align-items: center; gap: var(--space-2);">
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              </svg>
                              <span>{{ $batteryPct }}%</span>
                            </div>
                          @else
                            —
                          @endif
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
                          —
                        </td>
                        <td style="padding: var(--space-3) var(--space-4);">
                          <div style="display: flex; gap: var(--space-2);">
                            <button class="btn btn--ghost btn--sm edit-sensor-btn" style="padding: var(--space-1); min-width: auto;" title="Edit" data-sensor-id="{{ $deviceId }}">
                              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                              </svg>
                            </button>
                            <button class="btn btn--ghost btn--sm delete-sensor-btn" style="padding: var(--space-1); min-width: auto; color: var(--danger);" title="Delete" data-sensor-id="{{ $deviceId }}">
                              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    @endforeach
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- AI Events Management Tab -->
          <div id="management-ai-events-tab" class="management-tab-content" style="display: none;">
            <h3 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); color: var(--text); margin: 0 0 var(--space-4) 0;">AI Events Management</h3>
            <div class="card" style="overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
              <div class="card__body" style="padding: 0;">
                <table class="ai-events-table" style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: var(--surface-2); border-bottom: 2px solid var(--border);">
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Type</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Title</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Location</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Severity</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Status</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">prediction</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Expected occupancy</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Central Library</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--info">low</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">open</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">alert</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Low sensor battery</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Conference Room</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--danger">critical</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">acknowledged</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">recommendation</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Ventilation optimization</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Amphitheater A</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--warning">medium</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">open</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">prediction</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Expected consumption increase</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Building A</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--info">low</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">acknowledged</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">alert</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">High temperature</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">IT Lab</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--high">high</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">open</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                    <tr class="ai-events-row">
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">anomaly</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Abnormally high CO₂ levels</td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">Room B2</td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--danger">critical</span></td>
                      <td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">acknowledged</span></td>
                      <td style="padding: var(--space-3) var(--space-4); color: var(--text);">4/11/2025</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <!-- Users Management Tab -->
          <div id="management-users-tab" class="management-tab-content" style="display: none;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
              <h3 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); color: var(--text); margin: 0;">Users Management</h3>
              <button id="add-user-btn" class="btn btn--primary" style="display: flex; align-items: center; gap: var(--space-2);">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add User
              </button>
            </div>
            <div class="card" style="overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
              <div class="card__body" style="padding: 0;">
                <table id="users-management-table" style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: var(--surface-2); border-bottom: 2px solid var(--border);">
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Name</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Email</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Role</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Status</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Last Login</th>
                      <th style="padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text);">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="users-management-table-body">
                    <!-- Users loaded from API/database via loadUsers() -->
                  </tbody>
                </table>
                <div id="users-empty-state" class="users-empty-state" style="display: none; padding: var(--space-8); text-align: center; color: var(--muted);">
                  <p style="margin: 0;">No users yet. Users will appear here when the database is connected.</p>
                </div>
              </div>
            </div>
          </div>
          <div id="management-settings-tab" class="management-tab-content" style="display: none;">
            <div class="card">
              <div class="card__body">
                <p style="color: var(--muted);">System settings coming soon...</p>
              </div>
            </div>
          </div>
        </div>
@endsection
