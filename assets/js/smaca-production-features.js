function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getIAQItemIdentityKey(item) {
  if (!item) return null;
  return item.sensorId ?? item.sensorUid ?? item.deviceInfo?.deviceName ?? item.deviceName ?? null;
}

// Tracks the currently selected sensor for backend timeseries requests.
window.SMACACurrentSensorId = null;

document.addEventListener('DOMContentLoaded', async function() {
  // API-first initialization for production dashboard data.
  await initializeStateFromApi();
  
  // Setup time range selector
  setupTimeRangeSelector();
  
  // Setup export button
  setupExportButton();
  
  // Setup system health badge
  updateSystemHealthBadge();
  
  // Setup alerts panel
  updateAlertsPanel();
  
  // Listen for state changes
  SMACAState.onUpdate(function(timeframe, filteredData) {
    updateAllDashboards(timeframe, filteredData);
    updateSystemHealthBadge();
    updateAlertsPanel();
  });
  
  // Initial render
  const filteredData = {
    iaq: SMACAState.getFilteredIAQ(),
    occupancy: SMACAState.getFilteredOccupancy(),
    environmental: SMACAState.getFilteredEnvironmental()
  };
  updateAllDashboards(SMACAState.currentTimeframe, filteredData);
  
  // Update overview system status
  updateOverviewSystemStatus();
});

async function initializeStateFromApi() {
  const canUseApi = typeof window !== 'undefined' && window.SMACAApi;
  if (!canUseApi) {
    initializeStateWithSampleData();
    return;
  }

  try {
    const [overview, sensorsPayload] = await Promise.all([
      window.SMACAApi.fetchDashboardOverview(),
      window.SMACAApi.fetchSensors()
    ]);

    const sensors = Array.isArray(sensorsPayload?.rows) ? sensorsPayload.rows : [];
    hydrateLegacySensorsForUi(sensors, overview);

    const defaultSensor = chooseDefaultSensor(sensors, overview);
    window.SMACACurrentSensorId = defaultSensor
      ? (defaultSensor.id ?? defaultSensor.sensor_uid ?? defaultSensor.name ?? null)
      : null;

    if (!window.SMACACurrentSensorId) {
      // No sensors yet; keep state empty but valid.
      applyHydratedState({ iaq: [], occupancy: [], environmental: [] });
      return;
    }

    const hydrated = await fetchAndMapTimeseriesForSensor(window.SMACACurrentSensorId, SMACAState.currentTimeframe);
    applyHydratedState(hydrated);
  } catch (error) {
    console.error('SMACA API initialization failed, falling back to sample data:', error);
    initializeStateWithSampleData();
  }
}

function chooseDefaultSensor(sensors, overview) {
  const rows = Array.isArray(sensors) ? sensors : [];
  if (rows.length === 0) return null;

  const snapshotRows = Array.isArray(overview?.latest_sensor_snapshot_rows)
    ? overview.latest_sensor_snapshot_rows
    : [];
  const snapshotIds = new Set(snapshotRows.map(r => Number(r.sensor_id)).filter(Number.isFinite));
  const withData = rows.find(s => snapshotIds.has(Number(s.id)));
  return withData || rows[0];
}

function hydrateLegacySensorsForUi(sensors, overview) {
  if (typeof mockData === 'undefined') return;

  const rows = Array.isArray(sensors) ? sensors : [];
  mockData.sensors = rows.map(function (sensor) {
    const isActive = sensor.is_active === 1 || sensor.is_active === true || sensor.is_active === '1';
    return {
      id: sensor.id,
      name: sensor.name || sensor.sensor_uid || `Sensor ${sensor.id}`,
      status: isActive ? 'active' : 'maintenance',
      lastSeen: sensor.last_seen_at || null,
      type: sensor.device_type || 'Unknown',
      siteName: sensor.site?.name || null,
      sensorUid: sensor.sensor_uid || null
    };
  });

  // Keep pre-existing global list for connectivity table.
  if (typeof window !== 'undefined') {
    window.SMACA_SENSORS = mockData.sensors;
  }

  const totalSensorsEl = document.getElementById('overview-total-sensors');
  if (totalSensorsEl && overview?.totals?.sensors !== undefined) {
    totalSensorsEl.textContent = String(overview.totals.sensors);
  }
}

async function fetchAndMapTimeseriesForSensor(sensorId, timeframe) {
  const tf = timeframe || '24h';
  const metricList = [
    'co2_ppm',
    'temperature_c',
    'humidity_rh',
    'pm2_5_ugm3',
    'pm10_ugm3',
    'people_in',
    'people_out',
    'people_total_in',
    'people_total_out',
    'uv_index',
    'energy_kwh',
    'battery_pct'
  ];

  const latestPromise = window.SMACAApi.fetchSensorLatest(sensorId).catch(function () {
    return null;
  });

  const responses = await Promise.all(metricList.map(function (metric) {
    return window.SMACAApi
      .fetchSensorTimeseries(sensorId, metric, tf)
      .then(function (payload) { return { metric: metric, payload: payload }; })
      .catch(function () {
        return { metric: metric, payload: { points: [] } };
      });
  }));

  const latestPayload = await latestPromise;
  const latestRow = latestPayload?.row || null;
  const adapters = window.SMACAApi.adapters;
  const meta = {
    sensorId: sensorId,
    sensorUid: latestRow?.sensor_uid || null,
    deviceName: latestRow?.name || `Sensor ${sensorId}`,
    deviceProfileName: latestRow?.device_type || null
  };

  const firstIAQ = responses.find(r => ['co2_ppm', 'temperature_c', 'humidity_rh', 'pm2_5_ugm3', 'pm10_ugm3', 'battery_pct'].includes(r.metric));
  const firstOcc = responses.find(r => ['people_in', 'people_out', 'people_total_in', 'people_total_out'].includes(r.metric));
  const firstEnv = responses.find(r => ['uv_index', 'energy_kwh'].includes(r.metric));

  let iaq = adapters.timeseriesPointsToIAQItems(firstIAQ?.payload?.points || [], meta);
  let occupancy = adapters.timeseriesPointsToOccupancyItems(firstOcc?.payload?.points || [], meta);
  let environmental = adapters.timeseriesPointsToEnvironmentalItems(firstEnv?.payload?.points || [], meta);

  responses.forEach(function (response) {
    iaq = adapters.mergeMetricIntoIAQItems(iaq, response.metric, response.payload?.points || []);
    occupancy = adapters.mergeMetricIntoOccupancyItems(occupancy, response.metric, response.payload?.points || []);
    environmental = adapters.mergeMetricIntoEnvironmentalItems(environmental, response.metric, response.payload?.points || []);
  });

  // Ensure latest snapshot can still drive KPI cards when timeseries is sparse.
  if (latestRow && iaq.length === 0) {
    const snapshotRow = {
      sensor_id: latestRow.id,
      sensor_uid: latestRow.sensor_uid,
      sensor_name: latestRow.name,
      device_type: latestRow.device_type,
      measured_at: latestRow.latest?.measured_at,
      battery_pct: latestRow.latest?.battery_pct,
      co2_ppm: latestRow.latest?.co2_ppm,
      temperature_c: latestRow.latest?.temperature_c,
      humidity_rh: latestRow.latest?.humidity_rh,
      pm2_5_ugm3: latestRow.latest?.pm2_5_ugm3,
      pm10_ugm3: latestRow.latest?.pm10_ugm3
    };
    const snapshotItem = adapters.normalizeSnapshotToIAQItem(snapshotRow);
    if (snapshotItem) iaq.push(snapshotItem);
  }

  iaq = iaq.map(function (item) {
    const resolvedSensorId = item?.sensorId ?? (latestRow?.id ?? sensorId);
    const resolvedSensorUid = item?.sensorUid ?? (latestRow?.sensor_uid ?? null);
    const deviceName = item?.deviceInfo?.deviceName || item?.deviceName || latestRow?.name || `Sensor ${resolvedSensorId}`;
    const deviceProfileName = item?.deviceInfo?.deviceProfileName || item?.deviceProfileName || latestRow?.device_type || null;
    return {
      ...item,
      sensorId: resolvedSensorId ?? null,
      sensorUid: resolvedSensorUid ?? null,
      deviceName: deviceName || 'Unknown',
      deviceProfileName: deviceProfileName,
      deviceInfo: {
        ...(item?.deviceInfo || {}),
        deviceName: deviceName || 'Unknown',
        deviceProfileName: deviceProfileName
      }
    };
  });

  iaq.sort((a, b) => new Date(a.time) - new Date(b.time));
  occupancy.sort((a, b) => new Date(a.time) - new Date(b.time));
  environmental.sort((a, b) => new Date(a.time) - new Date(b.time));

  return { iaq: iaq, occupancy: occupancy, environmental: environmental };
}

function applyHydratedState(data, shouldNotify) {
  const notify = shouldNotify !== false;
  // Keep existing state-manager architecture; just replace raw arrays atomically.
  SMACAState.rawData.iaq = Array.isArray(data?.iaq) ? data.iaq : [];
  SMACAState.rawData.occupancy = Array.isArray(data?.occupancy) ? data.occupancy : [];
  SMACAState.rawData.environmental = Array.isArray(data?.environmental) ? data.environmental : [];
  if (notify) {
    SMACAState.notifyListeners();
  }
}

// Initialize state with sample data (deterministic - same data every refresh)
// PRODUCTION NOTE: Replace this function to fetch data from Laravel API endpoints
// Example: fetch('/api/sensors/iaq/history').then(res => res.json()).then(data => SMACAState.addBulkData('iaq', data))
function initializeStateWithSampleData() {
  const now = Date.now();
  
  // Generate comprehensive IAQ history (30 days of hourly data) - DETERMINISTIC
  const sampleIAQHistory = [];
  for (let i = 0; i < 30 * 24; i++) {
    const time = new Date(now - (i * 60 * 60 * 1000));
    const hour = time.getHours();
    const dayOfWeek = time.getDay();
    const daysAgo = Math.floor(i / 24);
    
    // Use index as seed for deterministic random values
    const seed1 = i * 7 + 12345;
    const seed2 = i * 11 + 67890;
    const seed3 = i * 13 + 11111;
    const seed4 = i * 17 + 22222;
    const seed5 = i * 19 + 33333;
    const seed6 = i * 23 + 44444;
    const seed7 = i * 29 + 55555;
    
    // Daily cycle: higher CO2 during day (9-17), lower at night
    const hourFactor = hour >= 9 && hour <= 17 ? 1.2 : 0.8;
    const dayFactor = dayOfWeek >= 1 && dayOfWeek <= 5 ? 1.1 : 0.9; // Weekdays higher
    
    // Base CO2 with realistic patterns (deterministic)
    const baseCO2 = 450;
    const co2 = baseCO2 + (hourFactor * 80) + (dayFactor * 20) + (Math.sin(i / 24) * 30) + (seededRandom(seed1) * 40 - 20);
    
    // Temperature follows daily cycle (deterministic)
    const baseTemp = 21;
    const temp = baseTemp + (hour >= 12 && hour <= 16 ? 2 : 0) + (seededRandom(seed2) * 2 - 1);
    
    // Humidity varies inversely with temperature (deterministic)
    const baseHumidity = 45;
    const humidity = baseHumidity - (temp - baseTemp) * 2 + (seededRandom(seed3) * 8 - 4);
    
    sampleIAQHistory.push({
      payload: {
        object: {
          co2: Math.max(400, Math.min(1200, co2)),
          temperature: Math.max(18, Math.min(26, temp)),
          humidity: Math.max(30, Math.min(70, humidity)),
          pm2_5: 8 + seededRandom(seed4) * 7 + (hourFactor * 3),
          pm10: 12 + seededRandom(seed5) * 10 + (hourFactor * 5),
          tvoc: 130 + seededRandom(seed6) * 30 + (hourFactor * 20),
          battery: Math.max(20, 95 - (daysAgo * 0.15))
        }
      },
      deviceInfo: {
        deviceName: "IAQ-Sensor-001",
        deviceProfileName: "Milesight AM308L"
      },
      rxInfo: [{
        rssi: -50 - seededRandom(seed7) * 20 - (daysAgo * 0.1),
        snr: 20 + seededRandom(seed1 + 1000) * 10 - (daysAgo * 0.05),
        gatewayId: "gateway-001"
      }],
      time: time.toISOString()
    });
  }
  
  SMACAState.addBulkData('iaq', sampleIAQHistory);
  
  // Generate comprehensive occupancy history (30 days) - DETERMINISTIC
  const sampleOccupancyHistory = [];
  let totalIn = 100;
  let totalOut = 95;
  
  for (let i = 0; i < 30 * 24; i++) {
    const time = new Date(now - (i * 60 * 60 * 1000));
    const hour = time.getHours();
    const dayOfWeek = time.getDay();
    
    // Use index as seed for deterministic random values
    const seed1 = i * 31 + 99999;
    const seed2 = i * 37 + 88888;
    
    // Occupancy patterns: higher during work hours, lower at night/weekends
    const isWorkHours = hour >= 8 && hour <= 18;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const occupancyFactor = isWorkHours && isWeekday ? 1.5 : 0.3;
    
    // Deterministic random values
    const periodIn = isWorkHours && isWeekday ? Math.floor(seededRandom(seed1) * 8 + 2) : Math.floor(seededRandom(seed1) * 2);
    const periodOut = isWorkHours && isWeekday ? Math.floor(seededRandom(seed2) * 6 + 1) : Math.floor(seededRandom(seed2) * 2);
    
    totalIn += periodIn;
    totalOut += periodOut;
    
    sampleOccupancyHistory.push({
      payload: {
        object: {
          period_in: periodIn,
          period_out: periodOut,
          total_in: totalIn,
          total_out: totalOut,
          battery: Math.max(20, 85 - (Math.floor(i / 24) * 0.2))
        }
      },
      time: time.toISOString()
    });
  }
  
  SMACAState.addBulkData('occupancy', sampleOccupancyHistory);
  
  // Generate environmental/UV data (30 days) - DETERMINISTIC
  const sampleEnvironmentalHistory = [];
  for (let i = 0; i < 30 * 24; i++) {
    const time = new Date(now - (i * 60 * 60 * 1000));
    const hour = time.getHours();
    const daysAgo = Math.floor(i / 24);
    
    // Use index as seed for deterministic random values
    const seed1 = i * 41 + 77777;
    
    // UV follows sun pattern: highest at noon, zero at night (deterministic)
    let uvIndex = 0;
    if (hour >= 6 && hour <= 18) {
      const sunPosition = Math.abs(hour - 12) / 6; // 0 at noon, 1 at 6am/6pm
      uvIndex = (1 - sunPosition) * 8 + seededRandom(seed1) * 1.5 - 0.75;
    }
    
    sampleEnvironmentalHistory.push({
      payload: {
        object: {
          modbus_chn_1: Math.max(0, Math.min(11, uvIndex)),
          gpio_input_1: 0,
          gpio_input_2: 0
        }
      },
      time: time.toISOString()
    });
  }
  
  SMACAState.addBulkData('environmental', sampleEnvironmentalHistory);
}

// Setup time range selector
function setupTimeRangeSelector() {
  const buttons = document.querySelectorAll('.time-range-btn');
  const selector = document.querySelector('.time-range-selector');
  
  buttons.forEach(btn => {
    btn.addEventListener('click', async function() {
      const timeframe = this.getAttribute('data-timeframe');
      const currentTimeframe = SMACAState.currentTimeframe;
      
      // Skip if already active
      if (this.classList.contains('active') && currentTimeframe === timeframe) {
        return;
      }
      
      // Reset last rendered timeframe to force re-render
      if (typeof window !== 'undefined' && window.lastRenderedTimeframe !== undefined) {
        window.lastRenderedTimeframe = null;
      }
      
      // Mark that timeframe is changing
      if (typeof window !== 'undefined') {
        window.timeframeChangeTime = Date.now();
      }
      
      // Add loading state
      if (selector) {
        selector.style.opacity = '0.7';
        selector.style.pointerEvents = 'none';
      }
      
      // Update active state with smooth transition
      buttons.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = 'var(--muted)';
        b.style.fontWeight = 'normal';
      });
      
      this.classList.add('active');
      this.style.background = 'var(--surface)';
      this.style.color = 'var(--text)';
      this.style.fontWeight = '600';
      
      // Refetch from backend for selected timeframe when API mode is active.
      if (window.SMACAApi && window.SMACACurrentSensorId) {
        try {
          const hydrated = await fetchAndMapTimeseriesForSensor(window.SMACACurrentSensorId, timeframe);
          applyHydratedState(hydrated, false);
        } catch (error) {
          console.error('Failed to refresh timeframe from API:', error);
        }
      }

      // Update state (triggers listeners/charts and keeps existing behavior)
      SMACAState.setTimeframe(timeframe);
      
      // Remove loading state after a short delay
      setTimeout(() => {
        if (selector) {
          selector.style.opacity = '1';
          selector.style.pointerEvents = 'auto';
        }
      }, 300);
    });
  });
  
  // Set initial active state
  const activeBtn = Array.from(buttons).find(btn => btn.getAttribute('data-timeframe') === SMACAState.currentTimeframe);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.background = 'var(--surface)';
    activeBtn.style.color = 'var(--text)';
    activeBtn.style.fontWeight = '600';
  }
}

// Setup export button
function setupExportButton() {
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      const filteredIAQ = SMACAState.getFilteredIAQ();
      SMACACSVExport.exportIAQData(filteredIAQ, SMACAState.currentTimeframe);
    });
  }
}

// Update system health badge
function updateSystemHealthBadge() {
  const badge = document.getElementById('system-health-badge');
  if (!badge) return;
  
  const sensors = (typeof mockData !== 'undefined' && mockData.sensors) ? mockData.sensors : [];
  const now = Date.now();
  const fifteenMinutesAgo = now - (15 * 60 * 1000);
  
  let reportingCount = 0;
  
  sensors.forEach(sensor => {
    // Check if sensor has reported recently
    if (sensor.status === 'online') {
      reportingCount++;
    } else if (sensor.lastSeen) {
      const lastSeenTime = new Date(sensor.lastSeen).getTime();
      if (lastSeenTime >= fifteenMinutesAgo) {
        reportingCount++;
      }
    }
  });
  
  const percentage = sensors.length > 0 ? (reportingCount / sensors.length) * 100 : 0;
  
  const indicator = badge.querySelector('.system-health-badge__indicator');
  const text = badge.querySelector('.system-health-badge__text');
  
  if (percentage >= 80) {
    indicator.style.background = 'var(--success)';
    text.textContent = 'Operational';
  } else if (percentage >= 40) {
    indicator.style.background = 'var(--warning)';
    text.textContent = 'Degraded';
  } else {
    indicator.style.background = 'var(--danger)';
    text.textContent = 'Offline';
  }
}

// Update alerts panel
function updateAlertsPanel() {
  const panel = document.getElementById('alerts-panel');
  if (!panel) return;
  
  const filteredData = {
    iaq: SMACAState.getFilteredIAQ(),
    occupancy: SMACAState.getFilteredOccupancy(),
    environmental: SMACAState.getFilteredEnvironmental()
  };
  
  const sensors = (typeof mockData !== 'undefined' && mockData.sensors) ? mockData.sensors : [];
  const alerts = SMACAAlertsEngine.checkRules(filteredData, sensors);
  
  if (alerts.length === 0) {
    panel.innerHTML = '<div class="alerts-empty-state" style="text-align: center; padding: var(--space-8); color: var(--muted);"><p>No active alerts</p></div>';
    return;
  }
  
  const sortedAlerts = SMACAAlertsEngine.getSortedAlerts();
  
  panel.innerHTML = sortedAlerts.map(alert => {
    const severityClass = alert.severity === 'critical' ? 'badge--danger' : 
                         alert.severity === 'warning' ? 'badge--warning' : 'badge--info';
    
    const timeAgo = SMACAAlertsEngine.formatTimeAgo(alert.timestamp);
    
    return `
      <div class="alert-card" style="padding: var(--space-4); border-bottom: 1px solid var(--border); display: flex; align-items: start; gap: var(--space-3);">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);">
            <span class="badge ${severityClass} badge--sm">${alert.severity}</span>
            <span style="font-size: var(--font-size-xs); color: var(--muted);">${timeAgo}</span>
          </div>
          <p style="margin: 0; font-size: var(--font-size-sm);">${alert.message}</p>
          <div style="margin-top: var(--space-2); font-size: var(--font-size-xs); color: var(--muted);">
            Confidence: ${alert.confidence}%
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Update all dashboards with filtered data
function updateAllDashboards(timeframe, filteredData) {
  // Check if enough history
  const hasEnoughIAQ = SMACAState.hasEnoughHistory('iaq', timeframe);
  const hasEnoughOccupancy = SMACAState.hasEnoughHistory('occupancy', timeframe);
  const hasEnoughEnvironmental = SMACAState.hasEnoughHistory('environmental', timeframe);
  
  // Update header counters based on timeframe
  updateHeaderCounters(timeframe, filteredData);
  
  if (!hasEnoughIAQ && !hasEnoughOccupancy && !hasEnoughEnvironmental) {
    showInsufficientHistoryMessage();
    return;
  }
  
  // Update IAQ dashboard with trends FIRST (before charts)
  if (hasEnoughIAQ) {
    updateIAQDashboardWithTrends(filteredData.iaq, timeframe);
  } else {
    const kpiContainer = document.getElementById('iaq-kpi-cards');
    if (kpiContainer) {
      kpiContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: var(--space-4); color: var(--muted);">Insufficient history for selected range</div>';
    }
  }
  
  // Update Occupancy dashboard with trends
  if (hasEnoughOccupancy) {
    updateOccupancyDashboardWithTrends(filteredData.occupancy, timeframe);
  }
  
  // Update Environmental dashboard
  if (hasEnoughEnvironmental) {
    updateEnvironmentalDashboard(filteredData.environmental, timeframe);
  }
  
  // Update charts immediately without delay for better UX
  // Update charts (they will use filtered data from state)
  // Only update charts for sections that have enough data
  // Charts are updated AFTER KPI cards to ensure correct order
  if (hasEnoughIAQ && typeof initAccurateIAQDashboard === 'function') {
    // Reset the last rendered timeframe to force re-render
    if (typeof window !== 'undefined') {
      window.lastRenderedTimeframe = null;
      // Clear the timeframe change flag after a delay to allow showSection to check it
      setTimeout(() => {
        if (window.timeframeChangeTime) {
          window.timeframeChangeTime = null;
        }
      }, 1000);
    }
    // Only render charts, not KPI cards (they're already updated above)
    initAccurateIAQDashboard();
  }
  
  // Update occupancy charts with filtered data
  if (hasEnoughOccupancy) {
    updateOccupancyCharts(filteredData.occupancy, timeframe);
  }
  
  // Update energy charts with filtered data
  if (hasEnoughOccupancy) { // Energy uses occupancy data for correlation
    updateEnergyCharts(filteredData.occupancy, timeframe);
  }
  
  // Update environmental charts
  if (hasEnoughEnvironmental && typeof loadEnvironmentalData === 'function') {
    loadEnvironmentalData();
  }
  
  // Clear insufficient history messages
  const chartPlaceholders = document.querySelectorAll('.chart-placeholder');
  chartPlaceholders.forEach(placeholder => {
    if (placeholder.dataset.hasMessage) {
      delete placeholder.dataset.hasMessage;
    }
  });
}

// Show insufficient history message
function showInsufficientHistoryMessage() {
  const chartPlaceholders = document.querySelectorAll('.chart-placeholder');
  const timeframe = SMACAState.currentTimeframe;
  const timeframeLabel = timeframe === '24h' ? '24 hours' : timeframe === '7d' ? '7 days' : '30 days';
  
  chartPlaceholders.forEach(placeholder => {
    if (!placeholder.dataset.hasMessage) {
      placeholder.innerHTML = `
        <div style="text-align: center; padding: var(--space-8); color: var(--muted);">
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto var(--space-4); opacity: 0.5;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">Insufficient data for ${timeframeLabel} range</p>
          <p style="font-size: var(--font-size-sm); opacity: 0.8;">Please select a shorter time range or wait for more data to be collected.</p>
        </div>
      `;
      placeholder.dataset.hasMessage = 'true';
    }
  });
}

// Update IAQ dashboard with trend pills
function updateIAQDashboardWithTrends(filteredIAQ, timeframe) {
  const kpiContainer = document.getElementById('iaq-kpi-cards');
  if (!kpiContainer) {
    return;
  }
  
  if (!filteredIAQ || filteredIAQ.length === 0) {
    kpiContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: var(--space-4); color: var(--muted);">Insufficient history for selected range</div>';
    return;
  }

  const selectedSensorId = typeof window !== 'undefined' ? window.SMACACurrentSensorId : null;
  const rawIAQ = Array.isArray(SMACAState.rawData?.iaq) ? SMACAState.rawData.iaq : [];
  const selectedSensorRawIAQ = selectedSensorId == null
    ? rawIAQ
    : rawIAQ.filter(item => String(getIAQItemIdentityKey(item)) === String(selectedSensorId));
  const liveSeries = selectedSensorRawIAQ.length > 0 ? selectedSensorRawIAQ : filteredIAQ;
  const latest = liveSeries[liveSeries.length - 1] || filteredIAQ[filteredIAQ.length - 1];
  const latestValues = latest?.payload?.object || {};
  
  // Calculate trends for all metrics
  const co2Trend = SMACATrendCalculator.calculateMetricTrend(SMACAState.rawData.iaq, 'co2', timeframe);
  const tempTrend = SMACATrendCalculator.calculateMetricTrend(SMACAState.rawData.iaq, 'temperature', timeframe);
  const humidityTrend = SMACATrendCalculator.calculateMetricTrend(SMACAState.rawData.iaq, 'humidity', timeframe);
  const pm25Trend = SMACATrendCalculator.calculateMetricTrend(SMACAState.rawData.iaq, 'pm2_5', timeframe);
  const pm10Trend = SMACATrendCalculator.calculateMetricTrend(SMACAState.rawData.iaq, 'pm10', timeframe);
  const tvocTrend = SMACATrendCalculator.calculateMetricTrend(SMACAState.rawData.iaq, 'tvoc', timeframe);
  
  // Get latest live values for selected/current sensor.
  const co2 = latestValues?.co2 ?? null;
  const temp = latestValues?.temperature ?? null;
  const humidity = latestValues?.humidity ?? null;
  const pm25 = latestValues?.pm2_5 ?? null;
  const pm10 = latestValues?.pm10 ?? null;
  const tvoc = latestValues?.tvoc ?? null;

  const formatMetricValue = (value, decimals) => (
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(decimals) : 'N/A'
  );
  
  // Format trends
  const co2TrendFormatted = SMACATrendCalculator.formatTrend(co2Trend);
  const tempTrendFormatted = SMACATrendCalculator.formatTrend(tempTrend);
  const humidityTrendFormatted = SMACATrendCalculator.formatTrend(humidityTrend);
  const pm25TrendFormatted = SMACATrendCalculator.formatTrend(pm25Trend);
  const pm10TrendFormatted = SMACATrendCalculator.formatTrend(pm10Trend);
  const tvocTrendFormatted = SMACATrendCalculator.formatTrend(tvocTrend);

  console.log('[SMACA][IAQ] KPI render dataset', {
    timeframe: timeframe,
    selectedSensorKey: selectedSensorId,
    filteredCount: filteredIAQ.length,
    rawCount: rawIAQ.length,
    selectedSeriesCount: selectedSensorRawIAQ.length,
    renderSeriesCount: liveSeries.length,
    latestPoint: latest
  });
  console.log('[SMACA][IAQ] First IAQ item key fields', rawIAQ.length > 0 ? {
    sensorId: rawIAQ[0]?.sensorId ?? null,
    sensorUid: rawIAQ[0]?.sensorUid ?? null,
    deviceInfoDeviceName: rawIAQ[0]?.deviceInfo?.deviceName ?? null,
    identityKey: getIAQItemIdentityKey(rawIAQ[0])
  } : null);
  console.log('[SMACA][IAQ] Latest selected sensor', {
    selectedSensorKey: selectedSensorId,
    latestSensorId: latest?.sensorId ?? null,
    latestSensorUid: latest?.sensorUid ?? null,
    latestDeviceName: latest?.deviceName ?? latest?.deviceInfo?.deviceName ?? null
  });
  console.log('[SMACA][IAQ] Filtered selected-series count', selectedSensorRawIAQ.length);
  console.log('[SMACA][IAQ] KPI metric values', {
    co2: co2,
    temperature: temp,
    humidity: humidity,
    pm2_5: pm25,
    pm10: pm10,
    tvoc: tvoc
  });
  
  // Render all KPI cards with trends
  kpiContainer.innerHTML = `
    <div class="stat-card" style="position: relative;" title="Carbon dioxide concentration. Ventilate if above 1000 ppm">
      <div class="stat-card__content">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);">
          <div class="stat-card__label">CO₂</div>
          <span class="trend-pill ${co2TrendFormatted.class}" style="font-size: var(--font-size-xs); padding: var(--space-1) var(--space-2); border-radius: var(--r-sm); background: var(--surface-2);">${co2TrendFormatted.text}</span>
        </div>
        <div class="stat-card__value">${formatMetricValue(co2, 0)}</div>
        <div class="stat-card__unit">ppm</div>
      </div>
    </div>
    <div class="stat-card" style="position: relative;" title="Ambient air temperature">
      <div class="stat-card__content">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);">
          <div class="stat-card__label">Temperature</div>
          <span class="trend-pill ${tempTrendFormatted.class}" style="font-size: var(--font-size-xs); padding: var(--space-1) var(--space-2); border-radius: var(--r-sm); background: var(--surface-2);">${tempTrendFormatted.text}</span>
        </div>
        <div class="stat-card__value">${formatMetricValue(temp, 1)}</div>
        <div class="stat-card__unit">°C</div>
      </div>
    </div>
    <div class="stat-card" style="position: relative;" title="Relative humidity percentage">
      <div class="stat-card__content">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);">
          <div class="stat-card__label">Humidity</div>
          <span class="trend-pill ${humidityTrendFormatted.class}" style="font-size: var(--font-size-xs); padding: var(--space-1) var(--space-2); border-radius: var(--r-sm); background: var(--surface-2);">${humidityTrendFormatted.text}</span>
        </div>
        <div class="stat-card__value">${formatMetricValue(humidity, 0)}</div>
        <div class="stat-card__unit">%</div>
      </div>
    </div>
    <div class="stat-card" style="position: relative;" title="Particulate matter &lt; 2.5µm. Higher values may affect air quality">
      <div class="stat-card__content">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);">
          <div class="stat-card__label">PM2.5</div>
          <span class="trend-pill ${pm25TrendFormatted.class}" style="font-size: var(--font-size-xs); padding: var(--space-1) var(--space-2); border-radius: var(--r-sm); background: var(--surface-2);">${pm25TrendFormatted.text}</span>
        </div>
        <div class="stat-card__value">${formatMetricValue(pm25, 1)}</div>
        <div class="stat-card__unit">µg/m³</div>
      </div>
    </div>
    <div class="stat-card" style="position: relative;" title="Particulate matter &lt; 10µm. Higher values may affect air quality">
      <div class="stat-card__content">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);">
          <div class="stat-card__label">PM10</div>
          <span class="trend-pill ${pm10TrendFormatted.class}" style="font-size: var(--font-size-xs); padding: var(--space-1) var(--space-2); border-radius: var(--r-sm); background: var(--surface-2);">${pm10TrendFormatted.text}</span>
        </div>
        <div class="stat-card__value">${formatMetricValue(pm10, 1)}</div>
        <div class="stat-card__unit">µg/m³</div>
      </div>
    </div>
    <div class="stat-card" style="position: relative;" title="Total volatile organic compounds from sensor (raw value)">
      <div class="stat-card__content">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);">
          <div class="stat-card__label">TVOC</div>
          <span class="trend-pill ${tvocTrendFormatted.class}" style="font-size: var(--font-size-xs); padding: var(--space-1) var(--space-2); border-radius: var(--r-sm); background: var(--surface-2);">${tvocTrendFormatted.text}</span>
        </div>
        <div class="stat-card__value">${formatMetricValue(tvoc, 1)}</div>
        <div class="stat-card__unit">(raw)</div>
      </div>
    </div>
  `;
}

// Update Occupancy dashboard with trend
function updateOccupancyDashboardWithTrends(filteredOccupancy, timeframe) {
  const occupancySection = document.querySelector('#occupancy');
  if (!occupancySection) return;
  
  if (!filteredOccupancy || filteredOccupancy.length === 0) {
    return;
  }
  
  // Calculate occupancy average trend
  const occupancyTrend = SMACATrendCalculator.calculateMetricTrend(SMACAState.rawData.occupancy, 'total_in', timeframe);
  const occupancyAvg = SMACATrendCalculator.calculateAverage(filteredOccupancy, 'total_in') || 0;
  const occupancyTrendFormatted = SMACATrendCalculator.formatTrend(occupancyTrend);
  
  // Update occupancy KPI card if it exists
  const occupancyCard = occupancySection.querySelector('.stat-card');
  if (occupancyCard) {
    const valueEl = occupancyCard.querySelector('.stat-card__value');
    if (valueEl) {
      valueEl.textContent = Math.round(occupancyAvg);
    }
    
    // Add trend pill if not exists
    let trendPill = occupancyCard.querySelector('.trend-pill');
    if (!trendPill) {
      const labelEl = occupancyCard.querySelector('.stat-card__label');
      if (labelEl && labelEl.parentElement) {
        const trendContainer = document.createElement('div');
        trendContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);';
        trendContainer.innerHTML = `
          <div class="stat-card__label">${labelEl.textContent}</div>
          <span class="trend-pill ${occupancyTrendFormatted.class}" style="font-size: var(--font-size-xs); padding: var(--space-1) var(--space-2); border-radius: var(--r-sm); background: var(--surface-2);">${occupancyTrendFormatted.text}</span>
        `;
        labelEl.parentElement.insertBefore(trendContainer, labelEl);
        labelEl.remove();
      }
    } else {
      trendPill.textContent = occupancyTrendFormatted.text;
      trendPill.className = `trend-pill ${occupancyTrendFormatted.class}`;
    }
  }
}

// Update Environmental dashboard
function updateEnvironmentalDashboard(filteredEnvironmental, timeframe) {
  const environmentalSection = document.querySelector('#environmental');
  if (!environmentalSection || !filteredEnvironmental || filteredEnvironmental.length === 0) return;
  
  // Update UV gauge if it exists
  const uvGauge = document.getElementById('uv-gauge-chart');
  if (uvGauge && typeof createUVGaugeChart === 'function') {
    setTimeout(() => {
      createUVGaugeChart(filteredEnvironmental);
    }, 100);
  }
}

// Update Occupancy charts with filtered data
function updateOccupancyCharts(filteredOccupancy, timeframe) {
  if (!filteredOccupancy || filteredOccupancy.length === 0) return;
  
  // Convert filtered data to chart format
  const hourlyData = [];
  const flowIn = [];
  const flowOut = [];
  
  // Group by hour based on timeframe
  const timeInterval = timeframe === '24h' ? 60 * 60 * 1000 : // 1 hour
                        timeframe === '7d' ? 24 * 60 * 60 * 1000 : // 1 day
                        24 * 60 * 60 * 1000; // 1 day for 30d
  
  const grouped = {};
  filteredOccupancy.forEach(item => {
    const time = new Date(item.time).getTime();
    const bucket = Math.floor(time / timeInterval) * timeInterval;
    
    if (!grouped[bucket]) {
      grouped[bucket] = { in: 0, out: 0, total: 0 };
    }
    
    grouped[bucket].in += item.payload?.object?.period_in || 0;
    grouped[bucket].out += item.payload?.object?.period_out || 0;
    grouped[bucket].total = (item.payload?.object?.total_in || 0) - (item.payload?.object?.total_out || 0);
  });
  
  const sortedBuckets = Object.keys(grouped).sort((a, b) => a - b);
  sortedBuckets.forEach(bucket => {
    hourlyData.push(grouped[bucket].total);
    flowIn.push(grouped[bucket].in);
    flowOut.push(grouped[bucket].out);
  });
  
  // Update charts
  setTimeout(() => {
    if (typeof createFlowBarChart === 'function' && flowIn.length > 0) {
      const flowChartEl = document.getElementById('occupancy-flow-chart');
      if (flowChartEl) {
        // Clear previous chart SVG
        const svg = flowChartEl.querySelector('svg');
        if (svg) svg.remove();
        createFlowBarChart('occupancy-flow-chart', flowIn, flowOut, { height: 400 });
      }
    }
    
    if (typeof createOccupancyDensityTimeline === 'function' && hourlyData.length > 0) {
      const densityChartEl = document.getElementById('occupancy-density-timeline');
      if (densityChartEl) {
        // Clear previous chart SVG
        const svg = densityChartEl.querySelector('svg');
        if (svg) svg.remove();
        createOccupancyDensityTimeline('occupancy-density-timeline', hourlyData, { height: 300 });
      }
    }
  }, 150);
}

// Update Energy charts with filtered data
function updateEnergyCharts(filteredOccupancy, timeframe) {
  if (!filteredOccupancy || filteredOccupancy.length === 0) return;
  
  // Convert occupancy to energy correlation data
  const timeInterval = timeframe === '24h' ? 60 * 60 * 1000 :
                        timeframe === '7d' ? 24 * 60 * 60 * 1000 :
                        24 * 60 * 60 * 1000;
  
  const grouped = {};
  filteredOccupancy.forEach(item => {
    const time = new Date(item.time).getTime();
    const bucket = Math.floor(time / timeInterval) * timeInterval;
    
    if (!grouped[bucket]) {
      grouped[bucket] = { occupancy: 0, count: 0 };
    }
    
    const currentOccupancy = (item.payload?.object?.total_in || 0) - (item.payload?.object?.total_out || 0);
    grouped[bucket].occupancy += currentOccupancy;
    grouped[bucket].count++;
  });
  
  const sortedBuckets = Object.keys(grouped).sort((a, b) => a - b);
  const occupancyData = sortedBuckets.map(bucket => {
    const avg = grouped[bucket].count > 0 ? grouped[bucket].occupancy / grouped[bucket].count : 0;
    return Math.max(0, Math.floor(avg / 10)); // Normalize to reasonable range
  });
  
  // Energy correlates with occupancy (simplified model) - DETERMINISTIC
  const energyData = occupancyData.map((occ, idx) => {
    const baseEnergy = 50;
    const energyPerPerson = 8;
    // Use index for deterministic variation
    const variation = seededRandom(idx * 47 + 66666) * 10;
    return baseEnergy + (occ * energyPerPerson) + variation;
  });
  
  // Update correlation chart (only when energy section visible - avoids wrong size from hidden container)
  setTimeout(() => {
    const energySection = document.querySelector('#energy');
    if (energySection && energySection.style.display === 'none') return;
    if (typeof createDualAxisChart === 'function' && occupancyData.length > 0) {
      const energyChartEl = document.getElementById('energy-correlation-chart');
      if (energyChartEl) {
        const svg = energyChartEl.querySelector('svg');
        if (svg) svg.remove();
        createDualAxisChart('energy-correlation-chart', occupancyData, energyData, { height: 400 });
      }
    }
  }, 200);
}

// Update header counters based on timeframe
function updateHeaderCounters(timeframe, filteredData) {
  // Update IAQ active sensors counter
  const iaqCounter = document.getElementById('iaq-active-sensors');
  if (iaqCounter && filteredData.iaq) {
    const uniqueSensors = new Set(filteredData.iaq.map(d => d.deviceName || d.deviceInfo?.deviceName || 'default'));
    iaqCounter.textContent = String(uniqueSensors.size || (filteredData.iaq.length > 0 ? 1 : 0));
  }
  
  // Update Occupancy current count
  const occupancyCounter = document.getElementById('occupancy-current-count');
  if (occupancyCounter && filteredData.occupancy && filteredData.occupancy.length > 0) {
    const latest = filteredData.occupancy[filteredData.occupancy.length - 1];
    const current = (latest.payload?.object?.total_in || 0) - (latest.payload?.object?.total_out || 0);
    occupancyCounter.textContent = Math.max(0, Math.floor(current / 10)); // Approximate current occupancy
  }
  
  // Update Energy daily consumption
  const energyCounter = document.getElementById('energy-daily-consumption');
  if (energyCounter) {
    // Calculate based on timeframe
    let consumption = 1688;
    if (timeframe === '7d') {
      consumption = Math.round(1688 * 7);
    } else if (timeframe === '30d') {
      consumption = Math.round(1688 * 30);
    }
    energyCounter.textContent = consumption.toLocaleString();
  }
  
  // Update Connectivity counter
  const connectivityCounter = document.getElementById('connectivity-connected-sensors');
  if (connectivityCounter) {
    // Count sensors that have reported in the timeframe
    const allData = [...(filteredData.iaq || []), ...(filteredData.occupancy || []), ...(filteredData.environmental || [])];
    const uniqueDevices = new Set();
    allData.forEach(d => {
      const deviceName = d.deviceInfo?.deviceName || d.payload?.deviceName;
      if (deviceName) uniqueDevices.add(deviceName);
    });
    connectivityCounter.textContent = uniqueDevices.size || 24;
  }
  
  // Update Environmental UV index
  const uvCounter = document.getElementById('environmental-uv-index');
  if (uvCounter && filteredData.environmental && filteredData.environmental.length > 0) {
    const latest = filteredData.environmental[filteredData.environmental.length - 1];
    const uvValue = latest.payload?.object?.modbus_chn_1 || 0;
    uvCounter.textContent = uvValue.toFixed(1);
  }
  
  // Update Management total sensors
  const managementCounter = document.getElementById('management-total-sensors');
  if (managementCounter) {
    managementCounter.textContent = String((typeof mockData !== 'undefined' && mockData.sensors?.length) ? mockData.sensors.length : 0);
  }
  
  // Update Overview total sensors
  const overviewCounter = document.getElementById('overview-total-sensors');
  if (overviewCounter) {
    overviewCounter.textContent = String((typeof mockData !== 'undefined' && mockData.sensors?.length) ? mockData.sensors.length : 0);
  }
  
  // Update Overview System Status counters
  updateOverviewSystemStatus();
}

// Update Overview System Status counters
function updateOverviewSystemStatus() {
  const sensors = (typeof mockData !== 'undefined' && mockData.sensors) ? mockData.sensors : [];
  
  // Count active sensors
  const activeSensors = sensors.filter(s => s.status === 'active').length;
  const activeCounter = document.getElementById('overview-active-sensors');
  if (activeCounter) {
    activeCounter.textContent = activeSensors;
  }
  
  // Count maintenance sensors
  const maintenanceSensors = sensors.filter(s => s.status === 'maintenance').length;
  const maintenanceCounter = document.getElementById('overview-maintenance-sensors');
  if (maintenanceCounter) {
    maintenanceCounter.textContent = maintenanceSensors;
  }
  
  // Count connected sensors (all sensors)
  const connectedCounter = document.getElementById('overview-connected-sensors');
  if (connectedCounter) {
    connectedCounter.textContent = sensors.length;
  }
  
  // Update AI events (from AI Insights if available)
  const aiEventsCounter = document.getElementById('overview-ai-events');
  if (aiEventsCounter) {
    // Try to get from AI Insights active events count
    const aiActiveEvents = document.getElementById('active-events-count');
    if (aiActiveEvents) {
      aiEventsCounter.textContent = aiActiveEvents.textContent || '47';
    } else {
      aiEventsCounter.textContent = '47'; // Default value
    }
  }
}
