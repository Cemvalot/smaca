function getIAQItemIdentityKey(item) {
  if (!item) return null;
  return item.sensorId ?? null;
}

// Tracks the currently selected sensor for backend timeseries requests.
window.SMACACurrentSensorId = null;
window.SMACADashboardContext = {
  overview: null,
  sensors: [],
  selectedSensorLatest: null
};

function logSmacaSelection(selectedSensorId, timeframe) {
  console.log('[SMACA]', { selectedSensorId: selectedSensorId, timeframe: timeframe });
}

function logSmacaFetchedPoints(pointsByMetric) {
  console.log('[SMACA] fetched points', pointsByMetric);
}

function logSmacaHydratedState(lengths) {
  console.log('[SMACA] hydrated state', lengths);
}

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
    applyHydratedState({ iaq: [], occupancy: [], environmental: [] });
    return;
  }

  try {
    const [overview, sensorsPayload] = await Promise.all([
      window.SMACAApi.fetchDashboardOverview(),
      window.SMACAApi.fetchSensors()
    ]);

    const sensors = Array.isArray(sensorsPayload?.rows) ? sensorsPayload.rows : [];
    hydrateLegacySensorsForUi(sensors, overview);
    if (typeof window !== 'undefined') {
      window.SMACADashboardContext.overview = overview || null;
      window.SMACADashboardContext.sensors = sensors;
    }
    updateOverviewCountersFromApi(overview, sensors);

    const selectedSensorId = chooseDefaultSensorIdFromSnapshots(overview, sensors);
    if (!Number.isFinite(Number(selectedSensorId))) {
      // No sensors yet; keep state empty but valid.
      applyHydratedState({ iaq: [], occupancy: [], environmental: [] });
      return;
    }

    await setCurrentSensorAndReload(selectedSensorId);
    setupSensorSelectionListeners();
  } catch (error) {
    console.error('SMACA API initialization failed:', error);
    applyHydratedState({ iaq: [], occupancy: [], environmental: [] });
  }
}

async function refreshDashboardForSelection(sensorId, timeframe) {
  const canonicalSensorId = Number(sensorId);
  if (!Number.isFinite(canonicalSensorId)) return;
  const tf = timeframe || SMACAState.currentTimeframe || '24h';
  window.SMACACurrentSensorId = canonicalSensorId;

  logSmacaSelection(canonicalSensorId, tf);

  const hydrated = await fetchAndMapTimeseriesForSensor(canonicalSensorId, tf);
  applyHydratedState(hydrated, false);
  SMACAState.setTimeframe(tf);
}

async function setCurrentSensorAndReload(selectedSensorId) {
  await refreshDashboardForSelection(selectedSensorId, SMACAState.currentTimeframe);
}

function chooseDefaultSensorIdFromSnapshots(overview, sensors) {
  const rows = Array.isArray(sensors) ? sensors : [];
  const sensorIdSet = new Set(rows.map(function (sensor) { return Number(sensor?.id); }).filter(Number.isFinite));
  if (sensorIdSet.size === 0) return null;

  const snapshotRows = Array.isArray(overview?.latest_sensor_snapshot_rows)
    ? overview.latest_sensor_snapshot_rows
    : [];

  if (snapshotRows.length === 0) return null;

  const scoreMetricKeys = [
    'co2_ppm',
    'temperature_c',
    'humidity_rh',
    'pm2_5_ugm3',
    'pm10_ugm3'
  ];

  const scoredCandidates = snapshotRows
    .map(function (snapshot) {
      const score = scoreMetricKeys.reduce(function (total, metricKey) {
        return snapshot?.[metricKey] !== null && snapshot?.[metricKey] !== undefined ? total + 1 : total;
      }, 0);
      const measuredAtMs = snapshot?.measured_at ? new Date(snapshot.measured_at).getTime() : 0;
      return {
        sensorId: Number(snapshot?.sensor_id),
        score: score,
        measuredAtMs: Number.isFinite(measuredAtMs) ? measuredAtMs : 0,
        measured_at: snapshot?.measured_at || null
      };
    })
    .filter(function (item) {
      return Number.isFinite(item.sensorId) && sensorIdSet.has(item.sensorId);
    })
    .sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return b.measuredAtMs - a.measuredAtMs;
    });

  return scoredCandidates[0]?.sensorId ?? null;
}

function hydrateLegacySensorsForUi(sensors, overview) {
  if (typeof mockData === 'undefined') return;

  const rows = Array.isArray(sensors) ? sensors : [];
  mockData.sensors = rows.map(function (sensor) {
    const isActive = sensor.is_active === 1 || sensor.is_active === true || sensor.is_active === '1';
    return {
      id: sensor.id,
      name: sensor.name || `Sensor ${sensor.id}`,
      status: isActive ? 'active' : 'maintenance',
      lastSeen: sensor.last_seen_at || null,
      type: sensor.device_type || 'Unknown',
      siteName: sensor.site?.name || null,
      sensorUid: null,
      battery: sensor.latest_snapshot?.battery_pct ?? null,
      rssi: sensor.latest_snapshot?.rssi ?? null,
      location: sensor.site?.name || 'N/A'
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

function setupSensorSelectionListeners() {
  if (typeof window === 'undefined') return;
  if (window.__smacaSensorSelectionBound) return;
  window.__smacaSensorSelectionBound = true;

  window.SMACASelectSensorById = async function (sensorId) {
    await setCurrentSensorAndReload(sensorId);
  };

  window.addEventListener('smaca:sensor-selected', async function (event) {
    const sensorId = event?.detail?.sensorId;
    if (sensorId === null || sensorId === undefined) return;
    await setCurrentSensorAndReload(sensorId);
  });
}

function updateOverviewCountersFromApi(overview, sensors) {
  const totals = overview?.totals || {};
  const latestUpdate = overview?.latest_update_at || null;
  const sensorRows = Array.isArray(sensors) ? sensors : [];

  const totalSensorsEl = document.getElementById('overview-total-sensors');
  if (totalSensorsEl) totalSensorsEl.textContent = String(totals.sensors ?? sensorRows.length ?? 0);

  const connectedEl = document.getElementById('overview-connected-sensors');
  if (connectedEl) connectedEl.textContent = String(totals.connected_sensors ?? sensorRows.length ?? 0);

  const activeEl = document.getElementById('overview-active-sensors');
  if (activeEl) activeEl.textContent = String(totals.active_sensors ?? 0);

  const maintenanceEl = document.getElementById('overview-maintenance-sensors');
  if (maintenanceEl) maintenanceEl.textContent = String(totals.maintenance_sensors ?? totals.inactive_sensors ?? 0);

  const lastRefreshEl = document.getElementById('overview-last-refresh');
  if (lastRefreshEl) {
    lastRefreshEl.textContent = latestUpdate ? new Date(latestUpdate).toLocaleString() : 'N/A';
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
    'tvoc_index',
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
  if (typeof window !== 'undefined') {
    window.SMACADashboardContext.selectedSensorLatest = latestRow;
  }
  const adapters = window.SMACAApi.adapters;
  const meta = {
    sensorId: sensorId,
    sensorUid: null,
    deviceName: latestRow?.name || `Sensor ${sensorId}`,
    deviceProfileName: latestRow?.device_type || null,
    batteryPct: latestRow?.latest?.battery_pct ?? null,
    lastSeenAt: latestRow?.last_seen_at || latestRow?.latest?.measured_at || null,
    siteName: latestRow?.site?.name || null
  };

  const pointsByMetric = responses.reduce(function (acc, response) {
    acc[response.metric] = Array.isArray(response.payload?.points) ? response.payload.points.length : 0;
    return acc;
  }, {});
  logSmacaFetchedPoints(pointsByMetric);

  const firstIAQ = responses.find(r => ['co2_ppm', 'temperature_c', 'humidity_rh', 'pm2_5_ugm3', 'pm10_ugm3', 'tvoc_index', 'battery_pct'].includes(r.metric));
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
      pm10_ugm3: latestRow.latest?.pm10_ugm3,
      tvoc_index: latestRow.latest?.tvoc_index
    };
    const snapshotItem = adapters.normalizeSnapshotToIAQItem(snapshotRow);
    if (snapshotItem) iaq.push(snapshotItem);
  }

  iaq = iaq.map(function (item) {
    const resolvedSensorId = item?.sensorId ?? (latestRow?.id ?? sensorId);
    const deviceName = item?.deviceInfo?.deviceName || item?.deviceName || latestRow?.name || `Sensor ${resolvedSensorId}`;
    const deviceProfileName = item?.deviceInfo?.deviceProfileName || item?.deviceProfileName || latestRow?.device_type || null;
    return {
      ...item,
      sensorId: resolvedSensorId ?? null,
      sensorUid: null,
      deviceName: deviceName || 'Unknown',
      deviceProfileName: deviceProfileName,
      battery: item?.battery ?? latestRow?.latest?.battery_pct ?? null,
      rssi: item?.rssi ?? latestRow?.latest?.rssi ?? null,
      snr: item?.snr ?? latestRow?.latest?.snr ?? null,
      gatewayId: item?.gatewayId ?? latestRow?.latest?.gateway_id ?? null,
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

  occupancy = occupancy.map(function (item) {
    return {
      ...item,
      deviceName: meta.deviceName,
      deviceProfileName: meta.deviceProfileName,
      battery: meta.batteryPct,
      lastSeenAt: meta.lastSeenAt,
      siteName: meta.siteName
    };
  });

  environmental = environmental.map(function (item) {
    return {
      ...item,
      deviceName: meta.deviceName,
      deviceProfileName: meta.deviceProfileName,
      battery: meta.batteryPct,
      lastSeenAt: meta.lastSeenAt,
      siteName: meta.siteName
    };
  });

  return { iaq: iaq, occupancy: occupancy, environmental: environmental };
}

function applyHydratedState(data, shouldNotify) {
  const notify = shouldNotify !== false;
  // Keep existing state-manager architecture; just replace raw arrays atomically.
  SMACAState.rawData.iaq = Array.isArray(data?.iaq) ? data.iaq : [];
  SMACAState.rawData.occupancy = Array.isArray(data?.occupancy) ? data.occupancy : [];
  SMACAState.rawData.environmental = Array.isArray(data?.environmental) ? data.environmental : [];
  logSmacaHydratedState({
    iaq: SMACAState.rawData.iaq.length,
    occupancy: SMACAState.rawData.occupancy.length,
    environmental: SMACAState.rawData.environmental.length
  });
  if (notify) {
    SMACAState.notifyListeners();
  }
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
      
      if (window.SMACAApi && window.SMACACurrentSensorId) {
        try {
          await refreshDashboardForSelection(window.SMACACurrentSensorId, timeframe);
        } catch (error) {
          console.error('Failed to refresh timeframe from API:', error);
        }
      } else {
        SMACAState.setTimeframe(timeframe);
      }
      
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
  // Update header counters based on timeframe
  updateHeaderCounters(timeframe, filteredData);

  // Update IAQ KPI and charts from backend-backed state.
  updateIAQDashboardWithTrends(filteredData.iaq, timeframe);
  if (typeof initAccurateIAQDashboard === 'function') {
    if (typeof window !== 'undefined') {
      window.lastRenderedTimeframe = null;
    }
    initAccurateIAQDashboard();
  }

  updateOccupancyDashboardWithTrends(filteredData.occupancy, timeframe);
  updateOccupancyCharts(filteredData.occupancy, timeframe);
  updateEnergyCharts(filteredData.environmental, timeframe);
  updateEnvironmentalDashboard(filteredData.environmental, timeframe);

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
    kpiContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: var(--space-4); color: var(--muted);">No backend points returned for selected sensor/timeframe</div>';
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

  const sortedSeries = [...liveSeries].sort((a, b) => new Date(a.time) - new Date(b.time));
  const metricPrecision = {
    co2: 0,
    temperature: 1,
    humidity: 0,
    pm2_5: 1,
    pm10: 1,
    tvoc: 1
  };

  function resolveMetricValues(metricKey) {
    return sortedSeries
      .map(item => item?.payload?.object?.[metricKey])
      .filter(value => value !== null && value !== undefined && Number.isFinite(Number(value)))
      .map(value => Number(value));
  }

  function buildTrend(metricKey) {
    const values = resolveMetricValues(metricKey);
    if (values.length < 2) {
      return { text: '—', class: 'trend-neutral' };
    }

    const current = values[values.length - 1];
    const previous = values[values.length - 2];
    const delta = current - previous;
    const precision = metricPrecision[metricKey] ?? 1;

    if (delta > 0) {
      return { text: `↑ +${delta.toFixed(precision)}`, class: 'trend-up' };
    }
    if (delta < 0) {
      return { text: `↓ ${delta.toFixed(precision)}`, class: 'trend-down' };
    }
    return { text: '→ 0', class: 'trend-stable' };
  }
  
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
  
  // Compute trends from selected sensor's hydrated IAQ series.
  const co2TrendFormatted = buildTrend('co2');
  const tempTrendFormatted = buildTrend('temperature');
  const humidityTrendFormatted = buildTrend('humidity');
  const pm25TrendFormatted = buildTrend('pm2_5');
  const pm10TrendFormatted = buildTrend('pm10');
  const tvocTrendFormatted = buildTrend('tvoc');

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
function updateEnergyCharts(filteredEnvironmental, timeframe) {
  if (!filteredEnvironmental || filteredEnvironmental.length === 0) return;

  // Build energy series from backend energy_kwh values.
  const timeInterval = timeframe === '24h' ? 60 * 60 * 1000 :
                        timeframe === '7d' ? 24 * 60 * 60 * 1000 :
                        24 * 60 * 60 * 1000;
  
  const grouped = {};
  filteredEnvironmental.forEach(item => {
    const time = new Date(item.time).getTime();
    const bucket = Math.floor(time / timeInterval) * timeInterval;
    
    if (!grouped[bucket]) {
      grouped[bucket] = { energy: 0, count: 0 };
    }
    
    const energyValue = item.payload?.object?.energy_kwh;
    if (typeof energyValue === 'number' && Number.isFinite(energyValue)) {
      grouped[bucket].energy += energyValue;
      grouped[bucket].count++;
    }
  });
  
  const sortedBuckets = Object.keys(grouped).sort((a, b) => a - b);
  const energyData = sortedBuckets.map(bucket => {
    const avg = grouped[bucket].count > 0 ? grouped[bucket].energy / grouped[bucket].count : null;
    return avg;
  });

  const occupancyData = sortedBuckets.map(function (bucket) {
    const bucketTime = Number(bucket);
    const nearest = Array.isArray(SMACAState.rawData.occupancy)
      ? SMACAState.rawData.occupancy.find(item => Math.abs(new Date(item.time).getTime() - bucketTime) <= timeInterval)
      : null;
    if (!nearest) return null;
    const totalIn = nearest.payload?.object?.people_total_in ?? nearest.payload?.object?.total_in;
    const totalOut = nearest.payload?.object?.people_total_out ?? nearest.payload?.object?.total_out;
    if (typeof totalIn !== 'number' || typeof totalOut !== 'number') return null;
    return Math.max(0, totalIn - totalOut);
  });
  
  // Update correlation chart (only when energy section visible - avoids wrong size from hidden container)
  setTimeout(() => {
    const energySection = document.querySelector('#energy');
    if (energySection && energySection.style.display === 'none') return;
    if (typeof createDualAxisChart === 'function' && energyData.length > 0) {
      const energyChartEl = document.getElementById('energy-correlation-chart');
      if (energyChartEl) {
        const svg = energyChartEl.querySelector('svg');
        if (svg) svg.remove();
        createDualAxisChart('energy-correlation-chart', occupancyData.map(v => v ?? 0), energyData.map(v => v ?? 0), { height: 400 });
      }
    }
  }, 200);
}

// Update header counters based on timeframe
function updateHeaderCounters(timeframe, filteredData) {
  // Update IAQ active sensors counter
  const iaqCounter = document.getElementById('iaq-active-sensors');
  if (iaqCounter && filteredData.iaq) {
    const uniqueSensors = new Set(
      filteredData.iaq
        .map(d => d?.sensorId)
        .filter(id => id !== null && id !== undefined)
    );
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
    const energyValues = (filteredData.environmental || [])
      .map(item => item?.payload?.object?.energy_kwh)
      .filter(v => typeof v === 'number' && Number.isFinite(v));
    const total = energyValues.reduce((sum, value) => sum + value, 0);
    energyCounter.textContent = energyValues.length > 0 ? total.toFixed(1) : 'N/A';
  }
  
  // Update Connectivity counter
  const connectivityCounter = document.getElementById('connectivity-connected-sensors');
  if (connectivityCounter) {
    const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
    const connected = sensors.filter(sensor => sensor.is_active === true || sensor.is_active === 1 || sensor.is_active === '1');
    connectivityCounter.textContent = String(connected.length);
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
    const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
    managementCounter.textContent = String(sensors.length);
  }
  
  // Update Overview total sensors
  const overviewCounter = document.getElementById('overview-total-sensors');
  if (overviewCounter) {
    const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
    overviewCounter.textContent = String(sensors.length);
  }
  
  // Update Overview System Status counters
  updateOverviewSystemStatus();
}

// Update Overview System Status counters
function updateOverviewSystemStatus() {
  const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
  
  // Count active sensors
  const activeSensors = sensors.filter(s => s.is_active === true || s.is_active === 1 || s.is_active === '1').length;
  const activeCounter = document.getElementById('overview-active-sensors');
  if (activeCounter) {
    activeCounter.textContent = activeSensors;
  }
  
  // Count maintenance sensors
  const maintenanceSensors = sensors.filter(s => !(s.is_active === true || s.is_active === 1 || s.is_active === '1')).length;
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
