function getIAQItemIdentityKey(item) {
  if (!item) return null;
  return item.sensorId ?? null;
}

// Tracks the currently selected sensor for backend timeseries requests.
window.SMACACurrentSensorId = null;
window.SMACADashboardContext = {
  overview: null,
  sensors: [],
  selectedSensorLatest: null,
  selectedSensorLatestById: {},
  selectedSensorsBySection: {}
};

function logSmacaSelection(selectedSensorId, timeframe) {
  console.log('[SMACA]', { selectedSensorId: selectedSensorId, timeframe: timeframe });
}

function logSmacaSectionSelections(selections) {
  console.log('[SMACA] selected sensors per section', selections);
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
    environmental: SMACAState.getFilteredEnvironmental(),
    energy: typeof SMACAState.getFilteredEnergy === 'function' ? SMACAState.getFilteredEnergy() : []
  };
  updateAllDashboards(SMACAState.currentTimeframe, filteredData);
  
  // Update overview system status
  updateOverviewSystemStatus();
});

async function initializeStateFromApi() {
  const canUseApi = typeof window !== 'undefined' && window.SMACAApi;
  if (!canUseApi) {
    applyHydratedState({ iaq: [], occupancy: [], environmental: [], energy: [] });
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
      applyHydratedState({ iaq: [], occupancy: [], environmental: [], energy: [] });
      return;
    }

    await setCurrentSensorAndReload(selectedSensorId);
    setupSensorSelectionListeners();
  } catch (error) {
    console.error('SMACA API initialization failed:', error);
    applyHydratedState({ iaq: [], occupancy: [], environmental: [], energy: [] });
  }
}

const SMACA_SECTION_METRICS = {
  iaq: ['co2_ppm', 'temperature_c', 'humidity_rh', 'pm2_5_ugm3', 'pm10_ugm3', 'tvoc_index', 'battery_pct'],
  occupancy: ['people_in', 'people_out', 'people_total_in', 'people_total_out'],
  environmental: ['uv_index'],
  energy: ['energy_kwh']
};

function buildLatestSnapshotBySensorId(overview, sensors) {
  const byId = {};
  const snapshotRows = Array.isArray(overview?.latest_sensor_snapshot_rows) ? overview.latest_sensor_snapshot_rows : [];
  snapshotRows.forEach(function (row) {
    const sensorId = Number(row?.sensor_id);
    if (Number.isFinite(sensorId)) byId[sensorId] = row;
  });
  (Array.isArray(sensors) ? sensors : []).forEach(function (sensor) {
    const sensorId = Number(sensor?.id);
    if (!Number.isFinite(sensorId)) return;
    if (!byId[sensorId] && sensor?.latest_snapshot) {
      byId[sensorId] = {
        sensor_id: sensorId,
        measured_at: sensor.latest_snapshot?.measured_at || sensor.last_seen_at || null,
        battery_pct: sensor.latest_snapshot?.battery_pct ?? null,
        co2_ppm: sensor.latest_snapshot?.co2_ppm ?? null,
        temperature_c: sensor.latest_snapshot?.temperature_c ?? null,
        humidity_rh: sensor.latest_snapshot?.humidity_rh ?? null,
        pm2_5_ugm3: sensor.latest_snapshot?.pm2_5_ugm3 ?? null,
        pm10_ugm3: sensor.latest_snapshot?.pm10_ugm3 ?? null,
        tvoc_index: sensor.latest_snapshot?.tvoc_index ?? null,
        people_in: sensor.latest_snapshot?.people_in ?? null,
        people_out: sensor.latest_snapshot?.people_out ?? null,
        people_total_in: sensor.latest_snapshot?.people_total_in ?? null,
        people_total_out: sensor.latest_snapshot?.people_total_out ?? null,
        uv_index: sensor.latest_snapshot?.uv_index ?? null,
        energy_kwh: sensor.latest_snapshot?.energy_kwh ?? null
      };
    }
  });
  return byId;
}

function chooseBestSensorForMetrics(sensors, latestBySensorId, metrics, preferredSensorId) {
  const rows = Array.isArray(sensors) ? sensors : [];
  const preferredId = Number(preferredSensorId);
  const hasPreferred = Number.isFinite(preferredId) && rows.some(function (sensor) { return Number(sensor?.id) === preferredId; });
  if (hasPreferred) {
    const preferredSnapshot = latestBySensorId[preferredId];
    const supportsPreferred = metrics.some(function (metric) {
      return preferredSnapshot?.[metric] !== null && preferredSnapshot?.[metric] !== undefined;
    });
    if (supportsPreferred) return preferredId;
  }

  const scored = rows.map(function (sensor) {
    const sensorId = Number(sensor?.id);
    const snapshot = latestBySensorId[sensorId] || {};
    const score = metrics.reduce(function (total, metric) {
      return snapshot?.[metric] !== null && snapshot?.[metric] !== undefined ? total + 1 : total;
    }, 0);
    const measuredAtMs = snapshot?.measured_at ? new Date(snapshot.measured_at).getTime() : 0;
    const isActive = sensor?.is_active === true || sensor?.is_active === 1 || sensor?.is_active === '1';
    return {
      sensorId: sensorId,
      score: score,
      measuredAtMs: Number.isFinite(measuredAtMs) ? measuredAtMs : 0,
      isActive: isActive ? 1 : 0
    };
  }).filter(function (item) {
    return Number.isFinite(item.sensorId);
  }).sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (b.isActive !== a.isActive) return b.isActive - a.isActive;
    return b.measuredAtMs - a.measuredAtMs;
  });

  if (scored.length === 0) return null;
  return scored[0].sensorId;
}

function chooseSectionSensors(overview, sensors, preferredSensorId) {
  const latestBySensorId = buildLatestSnapshotBySensorId(overview, sensors);
  return {
    iaq: chooseBestSensorForMetrics(sensors, latestBySensorId, SMACA_SECTION_METRICS.iaq, preferredSensorId),
    occupancy: chooseBestSensorForMetrics(sensors, latestBySensorId, SMACA_SECTION_METRICS.occupancy, preferredSensorId),
    environmental: chooseBestSensorForMetrics(sensors, latestBySensorId, SMACA_SECTION_METRICS.environmental, preferredSensorId),
    energy: chooseBestSensorForMetrics(sensors, latestBySensorId, SMACA_SECTION_METRICS.energy, preferredSensorId)
  };
}

async function refreshDashboardForSelection(sensorId, timeframe) {
  const canonicalSensorId = Number(sensorId);
  const tf = timeframe || SMACAState.currentTimeframe || '24h';
  if (Number.isFinite(canonicalSensorId)) {
    window.SMACACurrentSensorId = canonicalSensorId;
    logSmacaSelection(canonicalSensorId, tf);
  } else {
    logSmacaSelection(null, tf);
  }

  const [overview, sensorsPayload] = await Promise.all([
    window.SMACAApi.fetchDashboardOverview(),
    window.SMACAApi.fetchSensors()
  ]);
  const sensors = Array.isArray(sensorsPayload?.rows) ? sensorsPayload.rows : [];
  const selectedBySection = chooseSectionSensors(overview, sensors, canonicalSensorId);
  if (typeof window !== 'undefined') {
    window.SMACADashboardContext.overview = overview || null;
    window.SMACADashboardContext.sensors = sensors;
    window.SMACADashboardContext.selectedSensorsBySection = selectedBySection;
  }
  logSmacaSectionSelections(selectedBySection);
  hydrateLegacySensorsForUi(sensors, overview);
  updateOverviewCountersFromApi(overview, sensors);

  const iaqHydrated = await fetchAndMapTimeseriesForSensor(selectedBySection.iaq, tf, SMACA_SECTION_METRICS.iaq, 'iaq');
  const occupancyHydrated = await fetchAndMapTimeseriesForSensor(selectedBySection.occupancy, tf, SMACA_SECTION_METRICS.occupancy, 'occupancy');
  const environmentalHydrated = await fetchAndMapTimeseriesForSensor(selectedBySection.environmental, tf, SMACA_SECTION_METRICS.environmental, 'environmental');
  const energyHydrated = await fetchAndMapTimeseriesForSensor(selectedBySection.energy, tf, SMACA_SECTION_METRICS.energy, 'energy');

  applyHydratedState({
    iaq: iaqHydrated.items,
    occupancy: occupancyHydrated.items,
    environmental: environmentalHydrated.items,
    energy: energyHydrated.items
  }, false);

  await hydrateSensorLatestRowsForUi(sensors);
  renderConnectivityFromLiveSensors();
  renderManagementSensorsFromLiveData();
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

function toConnectivitySensorRow(sensor, latestRow) {
  const isActive = sensor?.is_active === true || sensor?.is_active === 1 || sensor?.is_active === '1';
  const latest = latestRow?.latest || sensor?.latest_snapshot || {};
  return {
    id: Number(sensor?.id),
    location: sensor?.site?.name || sensor?.location || 'Not reported by sensor',
    status: isActive ? 'active' : 'inactive',
    battery: latest?.battery_pct ?? null,
    rssi: latest?.rssi ?? 'Not reported by sensor',
    snr: latest?.snr ?? 'Not reported by sensor',
    gatewayId: latest?.gateway_id ?? 'Not reported by sensor',
    lastSeenAt: latestRow?.last_seen_at || latest?.measured_at || sensor?.last_seen_at || null,
    deviceName: sensor?.name || latestRow?.name || `Sensor ${sensor?.id}`,
    deviceType: sensor?.device_type || latestRow?.device_type || 'Not reported by sensor',
    sensorUid: sensor?.sensor_uid || latestRow?.sensor_uid || 'Not reported by sensor'
  };
}

async function hydrateSensorLatestRowsForUi(sensors) {
  const rows = Array.isArray(sensors) ? sensors : [];
  const results = await Promise.all(rows.map(function (sensor) {
    const sensorId = Number(sensor?.id);
    if (!Number.isFinite(sensorId)) return Promise.resolve(null);
    return window.SMACAApi.fetchSensorLatest(sensorId).then(function (payload) {
      return { sensorId: sensorId, row: payload?.row || null };
    }).catch(function () {
      return { sensorId: sensorId, row: null };
    });
  }));
  if (typeof window !== 'undefined') {
    window.SMACADashboardContext.selectedSensorLatestById = results.reduce(function (acc, item) {
      if (item && Number.isFinite(item.sensorId)) acc[String(item.sensorId)] = item.row;
      return acc;
    }, {});
  }
}

function renderConnectivityFromLiveSensors() {
  const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
  const latestById = window.SMACADashboardContext?.selectedSensorLatestById || {};
  const tableRows = sensors.map(function (sensor) {
    return toConnectivitySensorRow(sensor, latestById[String(sensor.id)]);
  });
  if (typeof window !== 'undefined') window.SMACA_SENSORS = tableRows;
  if (typeof createSensorHealthTable === 'function') {
    createSensorHealthTable('sensor-health-table', tableRows);
  }
}

function renderManagementSensorsFromLiveData() {
  const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
  const latestById = window.SMACADashboardContext?.selectedSensorLatestById || {};
  const tbody = document.getElementById('sensors-management-table-body');
  if (!tbody) return;

  tbody.innerHTML = sensors.map(function (sensor) {
    const latestRow = latestById[String(sensor.id)] || {};
    const latest = latestRow?.latest || sensor?.latest_snapshot || {};
    const isActive = sensor?.is_active === true || sensor?.is_active === 1 || sensor?.is_active === '1';
    const batteryText = latest?.battery_pct !== null && latest?.battery_pct !== undefined ? `${latest.battery_pct}%` : 'Not reported by sensor';
    const lastSeen = latestRow?.last_seen_at || latest?.measured_at || sensor?.last_seen_at || null;
    const lastSeenText = lastSeen ? new Date(lastSeen).toLocaleString() : 'No data for this sensor';
    return `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text); font-family: monospace;">${sensor?.sensor_uid || sensor?.id}</td>
        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${sensor?.name || `Sensor ${sensor?.id}`}</td>
        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${sensor?.device_type || 'Not reported by sensor'}</td>
        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${sensor?.site?.name || 'Not reported by sensor'}</td>
        <td style="padding: var(--space-3) var(--space-4);"><span class="badge ${isActive ? 'badge--success' : 'badge--muted'} badge--sm">${isActive ? 'Live' : 'Inactive'}</span></td>
        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${batteryText}</td>
        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${lastSeenText}</td>
        <td style="padding: var(--space-3) var(--space-4);"><span style="font-size: var(--font-size-xs); color: var(--muted);">Read-only</span></td>
      </tr>
    `;
  }).join('');

  const totalSensors = sensors.length;
  const activeSensors = sensors.filter(function (sensor) { return sensor?.is_active === true || sensor?.is_active === 1 || sensor?.is_active === '1'; }).length;
  const maintenanceSensors = totalSensors - activeSensors;
  const totalEl = document.getElementById('total-sensors');
  if (totalEl) totalEl.textContent = String(totalSensors);
  const mgmtTotalEl = document.getElementById('management-total-sensors');
  if (mgmtTotalEl) mgmtTotalEl.textContent = String(totalSensors);
  const activeEl = document.getElementById('active-sensors');
  if (activeEl) activeEl.textContent = String(activeSensors);
  const maintenanceEl = document.getElementById('maintenance-sensors');
  if (maintenanceEl) maintenanceEl.textContent = String(maintenanceSensors);
}

function updateOverviewCountersFromApi(overview, sensors) {
  const totals = overview?.totals || {};
  const latestUpdate = overview?.latest_update_at || null;
  const sensorRows = Array.isArray(sensors) ? sensors : [];
  const activeFromSensors = sensorRows.filter(function (sensor) {
    return sensor?.is_active === true || sensor?.is_active === 1 || sensor?.is_active === '1';
  }).length;
  const connectedFallback = sensorRows.length;
  const totalFallback = sensorRows.length;
  const maintenanceFallback = Math.max(0, totalFallback - activeFromSensors);
  const formatCount = function (value, fallback) {
    const resolved = Number.isFinite(Number(value)) ? Number(value) : Number(fallback);
    return Number.isFinite(resolved) ? String(resolved) : 'Not available';
  };

  const totalSensorsEl = document.getElementById('overview-total-sensors');
  if (totalSensorsEl) totalSensorsEl.textContent = formatCount(totals.sensors, totalFallback);

  const connectedEl = document.getElementById('overview-connected-sensors');
  if (connectedEl) connectedEl.textContent = formatCount(totals.connected_sensors, connectedFallback);

  const activeEl = document.getElementById('overview-active-sensors');
  if (activeEl) activeEl.textContent = formatCount(totals.active_sensors, activeFromSensors);

  const maintenanceEl = document.getElementById('overview-maintenance-sensors');
  if (maintenanceEl) maintenanceEl.textContent = formatCount(totals.maintenance_sensors ?? totals.inactive_sensors, maintenanceFallback);

  const lastRefreshEl = document.getElementById('overview-last-refresh');
  if (lastRefreshEl) {
    lastRefreshEl.textContent = latestUpdate ? new Date(latestUpdate).toLocaleString() : 'Not available';
  }

  const pills = document.querySelectorAll('.last-updated-pill');
  pills.forEach(function (pill) {
    pill.textContent = latestUpdate
      ? `Last updated: ${new Date(latestUpdate).toLocaleString()}`
      : 'Last updated: Not available';
  });

  const overviewSection = document.getElementById('overview');
  if (!overviewSection) return;
  const cards = overviewSection.querySelectorAll('.grid--metrics .stat-card');
  cards.forEach(function (card) {
    const label = (card.querySelector('.stat-card__label')?.textContent || '').trim().toLowerCase();
    const valueEl = card.querySelector('.stat-card__value');
    const unitEl = card.querySelector('.stat-card__unit');
    if (!valueEl) return;

    if (label === 'total sensors') {
      valueEl.textContent = formatCount(totals.sensors, totalFallback);
      if (unitEl) unitEl.textContent = 'sensors';
      return;
    }

    if (label === 'system health') {
      const connected = Number(formatCount(totals.connected_sensors, connectedFallback));
      const total = Number(formatCount(totals.sensors, totalFallback));
      if (Number.isFinite(connected) && Number.isFinite(total) && total > 0) {
        const pct = Math.round((connected / total) * 100);
        valueEl.textContent = `${pct}%`;
      } else {
        valueEl.textContent = 'Not available';
      }
      return;
    }

    if (label === 'last update') {
      if (!latestUpdate) {
        valueEl.textContent = 'Not available';
        if (unitEl) unitEl.textContent = '';
      } else {
        const deltaMs = Date.now() - new Date(latestUpdate).getTime();
        const minutes = Math.max(0, Math.round(deltaMs / 60000));
        valueEl.textContent = String(minutes);
        if (unitEl) unitEl.textContent = 'min ago';
      }
    }
  });
}

async function fetchAndMapTimeseriesForSensor(sensorId, timeframe, metricList, bucket) {
  const tf = timeframe || '24h';
  const metrics = Array.isArray(metricList) ? metricList : [];
  const adapters = window.SMACAApi.adapters;
  if (!Number.isFinite(Number(sensorId))) return { items: [], latestRow: null };

  const responses = await Promise.all(metrics.map(function (metric) {
    return window.SMACAApi
      .fetchSensorTimeseries(sensorId, metric, tf)
      .then(function (payload) { return { metric: metric, payload: payload }; })
      .catch(function () { return { metric: metric, payload: { points: [] } }; });
  }));
  const latestPayload = await window.SMACAApi.fetchSensorLatest(sensorId).catch(function () { return null; });
  const latestRow = latestPayload?.row || null;

  const meta = {
    sensorId: sensorId,
    sensorUid: latestRow?.sensor_uid ?? null,
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
  logSmacaFetchedPoints({ bucket: bucket, sensorId: sensorId, pointsByMetric: pointsByMetric });

  const firstResponse = responses.find(function (r) { return Array.isArray(r.payload?.points) && r.payload.points.length > 0; }) || responses[0];
  let items = [];
  if (bucket === 'iaq') items = adapters.timeseriesPointsToIAQItems(firstResponse?.payload?.points || [], meta);
  if (bucket === 'occupancy') items = adapters.timeseriesPointsToOccupancyItems(firstResponse?.payload?.points || [], meta);
  if (bucket === 'environmental' || bucket === 'energy') items = adapters.timeseriesPointsToEnvironmentalItems(firstResponse?.payload?.points || [], meta);

  responses.forEach(function (response) {
    if (bucket === 'iaq') items = adapters.mergeMetricIntoIAQItems(items, response.metric, response.payload?.points || []);
    if (bucket === 'occupancy') items = adapters.mergeMetricIntoOccupancyItems(items, response.metric, response.payload?.points || []);
    if (bucket === 'environmental' || bucket === 'energy') items = adapters.mergeMetricIntoEnvironmentalItems(items, response.metric, response.payload?.points || []);
  });

  if (bucket === 'iaq' && latestRow && items.length === 0) {
    const snapshotItem = adapters.normalizeSnapshotToIAQItem({
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
    });
    if (snapshotItem) items.push(snapshotItem);
  }

  items = items.map(function (item) {
    return {
      ...item,
      sensorId: item?.sensorId ?? sensorId,
      sensorUid: item?.sensorUid ?? latestRow?.sensor_uid ?? null,
      deviceName: item?.deviceName || meta.deviceName,
      deviceProfileName: item?.deviceProfileName || meta.deviceProfileName,
      battery: item?.battery ?? meta.batteryPct,
      lastSeenAt: item?.lastSeenAt || meta.lastSeenAt,
      siteName: item?.siteName || meta.siteName
    };
  }).sort(function (a, b) { return new Date(a.time) - new Date(b.time); });

  if (bucket === 'energy') {
    items = items.map(function (item) {
      return {
        ...item,
        payload: {
          ...(item.payload || {}),
          object: {
            ...((item.payload && item.payload.object) || {}),
            energy_kwh: item?.payload?.object?.energy_kwh ?? null
          }
        }
      };
    });
  }

  if (typeof window !== 'undefined') {
    window.SMACADashboardContext.selectedSensorLatest = latestRow;
    window.SMACADashboardContext.selectedSensorLatestById[String(sensorId)] = latestRow;
  }
  return { items: items, latestRow: latestRow };
}

function applyHydratedState(data, shouldNotify) {
  const notify = shouldNotify !== false;
  // Keep existing state-manager architecture; just replace raw arrays atomically.
  SMACAState.rawData.iaq = Array.isArray(data?.iaq) ? data.iaq : [];
  SMACAState.rawData.occupancy = Array.isArray(data?.occupancy) ? data.occupancy : [];
  SMACAState.rawData.environmental = Array.isArray(data?.environmental) ? data.environmental : [];
  SMACAState.rawData.energy = Array.isArray(data?.energy) ? data.energy : [];
  logSmacaHydratedState({
    iaq: SMACAState.rawData.iaq.length,
    occupancy: SMACAState.rawData.occupancy.length,
    environmental: SMACAState.rawData.environmental.length,
    energy: SMACAState.rawData.energy.length
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
  updateEnergyCharts(filteredData.energy || [], timeframe);
  updateEnvironmentalDashboard(filteredData.environmental, timeframe);
  renderConnectivityFromLiveSensors();
  renderManagementSensorsFromLiveData();

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
    const currentCardValue = occupancySection.querySelector('.card:first-child .card__body div div div:nth-child(2)');
    if (currentCardValue) currentCardValue.textContent = 'No data for this sensor';
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
  if (!environmentalSection) return;

  const uvCounter = document.getElementById('environmental-uv-index');
  const uvCardValue = environmentalSection.querySelector('.stat-card .stat-card__value');
  const uvCardMeta = environmentalSection.querySelector('.stat-card .stat-card__meta');
  const uvValues = (filteredEnvironmental || [])
    .map(function (item) { return item?.payload?.object?.uv_index; })
    .filter(function (value) { return typeof value === 'number' && Number.isFinite(value); });
  const latestUv = uvValues.length > 0 ? uvValues[uvValues.length - 1] : null;
  if (latestUv === null) {
    if (uvCounter) uvCounter.textContent = 'Unsupported by device';
    if (uvCardValue) uvCardValue.textContent = 'No data for this sensor';
    if (uvCardMeta) uvCardMeta.textContent = 'Unsupported by device';
    const uvGauge = document.getElementById('uv-gauge-chart');
    const uvHourly = document.getElementById('uv-hourly-chart');
    if (uvGauge) uvGauge.innerHTML = '<div style="color: var(--muted); text-align: center; padding: var(--space-6);">No data for this sensor</div>';
    if (uvHourly) uvHourly.innerHTML = '<div style="color: var(--muted); text-align: center; padding: var(--space-6);">Unsupported by device</div>';
    return;
  }

  if (uvCounter) uvCounter.textContent = latestUv.toFixed(1);
  if (uvCardValue) uvCardValue.textContent = latestUv.toFixed(1);
  if (uvCardMeta) uvCardMeta.textContent = latestUv >= 8 ? 'Very High' : latestUv >= 6 ? 'High' : latestUv >= 3 ? 'Moderate' : 'Low';

  // Update UV gauge and line chart from backend data
  const uvGauge = document.getElementById('uv-gauge-chart');
  if (uvGauge && typeof createGaugeChart === 'function') {
    createGaugeChart('uv-gauge-chart', latestUv, 11, {
      size: 200,
      color: latestUv >= 6 ? '#ef4444' : latestUv >= 3 ? '#f59e0b' : '#10b981',
      label: 'UV Index'
    });
  }
  const uvHourly = document.getElementById('uv-hourly-chart');
  if (uvHourly && typeof createLineChart === 'function') {
    createLineChart('uv-hourly-chart', [{
      label: 'UV Index',
      values: uvValues,
      color: '#f97316'
    }], { height: 300, legend: true });
  }
}

// Update Occupancy charts with filtered data
function updateOccupancyCharts(filteredOccupancy, timeframe) {
  if (!filteredOccupancy || filteredOccupancy.length === 0) {
    const flowChartEl = document.getElementById('occupancy-flow-chart');
    const densityChartEl = document.getElementById('occupancy-density-timeline');
    if (flowChartEl) flowChartEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: var(--space-6);">No data for this sensor</div>';
    if (densityChartEl) densityChartEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: var(--space-6);">No data for this sensor</div>';
    return;
  }
  
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
function updateEnergyCharts(filteredEnergy, timeframe) {
  if (!filteredEnergy || filteredEnergy.length === 0) {
    const energyChartEl = document.getElementById('energy-correlation-chart');
    if (energyChartEl) energyChartEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: var(--space-6);">No data for this sensor</div>';
    return;
  }

  // Build explicit numeric series from hydrated payloads.
  const timeInterval = timeframe === '24h' ? 60 * 60 * 1000 :
                        timeframe === '7d' ? 24 * 60 * 60 * 1000 :
                        24 * 60 * 60 * 1000;
  const filteredOccupancy = typeof SMACAState?.getFilteredOccupancy === 'function'
    ? SMACAState.getFilteredOccupancy()
    : (Array.isArray(SMACAState?.rawData?.occupancy) ? SMACAState.rawData.occupancy : []);

  const energyPoints = filteredEnergy
    .map(function (row) {
      const time = row?.time;
      const timeMs = new Date(time).getTime();
      const energyValue = Number(row?.payload?.object?.energy_kwh);
      return { time: time, timeMs: timeMs, value: energyValue };
    })
    .filter(function (point) {
      return point.time && Number.isFinite(point.timeMs) && Number.isFinite(point.value);
    });

  const occupancyPoints = filteredOccupancy
    .map(function (row) {
      const time = row?.time;
      const timeMs = new Date(time).getTime();
      const peopleIn = Number(row?.payload?.object?.people_in);
      const peopleOut = Number(row?.payload?.object?.people_out);
      const activity = peopleIn + peopleOut;
      return {
        time: time,
        timeMs: timeMs,
        people_in: peopleIn,
        people_out: peopleOut,
        value: activity
      };
    })
    .filter(function (point) {
      return point.time && Number.isFinite(point.timeMs) && Number.isFinite(point.value);
    });

  const groupedEnergy = {};
  energyPoints.forEach(function (point) {
    const bucket = Math.floor(point.timeMs / timeInterval) * timeInterval;
    if (!groupedEnergy[bucket]) groupedEnergy[bucket] = { sum: 0, count: 0 };
    groupedEnergy[bucket].sum += point.value;
    groupedEnergy[bucket].count += 1;
  });

  const groupedOccupancy = {};
  occupancyPoints.forEach(function (point) {
    const bucket = Math.floor(point.timeMs / timeInterval) * timeInterval;
    if (!groupedOccupancy[bucket]) groupedOccupancy[bucket] = { sum: 0, count: 0 };
    groupedOccupancy[bucket].sum += point.value;
    groupedOccupancy[bucket].count += 1;
  });

  const sampleOccupancy = occupancyPoints.slice(0, 3).map(function (item) {
    return {
      time: item?.time || null,
      people_in: item?.people_in ?? null,
      people_out: item?.people_out ?? null,
      activity: item?.value ?? null
    };
  });
  const sampleEnergy = energyPoints.slice(0, 3).map(function (item) {
    return {
      time: item?.time || null,
      energy_kwh: item?.value ?? null
    };
  });
  console.log('[SMACA] energy chart input sample', sampleEnergy);
  console.log('[SMACA] occupancy chart input sample', sampleOccupancy);

  const sharedBuckets = Object.keys(groupedEnergy)
    .filter(function (bucket) { return !!groupedOccupancy[bucket]; })
    .map(function (bucket) { return Number(bucket); })
    .filter(Number.isFinite)
    .sort(function (a, b) { return a - b; });

  const pairedSeries = sharedBuckets
    .map(function (bucket) {
      const energyAvg = groupedEnergy[bucket].count > 0 ? groupedEnergy[bucket].sum / groupedEnergy[bucket].count : NaN;
      const occupancyAvg = groupedOccupancy[bucket].count > 0 ? groupedOccupancy[bucket].sum / groupedOccupancy[bucket].count : NaN;
      const energyValue = Number(energyAvg);
      const occupancyValue = Number(occupancyAvg);
      return { occupancy: occupancyValue, energy: energyValue };
    })
    .filter(function (point) {
      return Number.isFinite(point.occupancy) && Number.isFinite(point.energy);
    });

  const occupancyData = pairedSeries.map(function (point) { return point.occupancy; });
  const energyData = pairedSeries.map(function (point) { return point.energy; });
  const maxOccupancy = occupancyData.length > 0 ? Math.max.apply(null, occupancyData) : 0;
  const maxEnergy = energyData.length > 0 ? Math.max.apply(null, energyData) : 0;
  console.log('[SMACA] valid counts', {
    occupancy: occupancyData.length,
    energy: energyData.length
  });
  
  // Update correlation chart (only when energy section visible - avoids wrong size from hidden container)
  setTimeout(() => {
    const energySection = document.querySelector('#energy');
    if (energySection && energySection.style.display === 'none') return;
    const energyChartEl = document.getElementById('energy-correlation-chart');
    if (!energyChartEl) return;

    const svg = energyChartEl.querySelector('svg');
    if (svg) svg.remove();

    if (occupancyData.length === 0 || energyData.length === 0 || !Number.isFinite(maxOccupancy) || !Number.isFinite(maxEnergy) || maxOccupancy <= 0 || maxEnergy <= 0) {
      energyChartEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: var(--space-6);">No data for this sensor</div>';
      return;
    }

    if (typeof createDualAxisChart === 'function') {
      createDualAxisChart('energy-correlation-chart', occupancyData, energyData, { height: 400 });
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
    const totalIn = latest.payload?.object?.people_total_in ?? latest.payload?.object?.total_in ?? 0;
    const totalOut = latest.payload?.object?.people_total_out ?? latest.payload?.object?.total_out ?? 0;
    const current = Number(totalIn) - Number(totalOut);
    occupancyCounter.textContent = String(Math.max(0, Math.round(current)));
  } else if (occupancyCounter) {
    occupancyCounter.textContent = '0';
  }
  
  // Update Energy daily consumption
  const energyCounter = document.getElementById('energy-daily-consumption');
  if (energyCounter) {
    const energyValues = (filteredData.energy || [])
      .map(item => item?.payload?.object?.energy_kwh)
      .filter(v => typeof v === 'number' && Number.isFinite(v));
    const total = energyValues.reduce((sum, value) => sum + value, 0);
    energyCounter.textContent = energyValues.length > 0 ? total.toFixed(1) : 'No data for this sensor';
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
    const uvValue = latest.payload?.object?.uv_index;
    uvCounter.textContent = typeof uvValue === 'number' && Number.isFinite(uvValue)
      ? uvValue.toFixed(1)
      : 'Unsupported by device';
  } else if (uvCounter) {
    uvCounter.textContent = 'No data for this sensor';
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
    const totals = window.SMACADashboardContext?.overview?.totals || {};
    const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
    const resolvedTotal = Number.isFinite(Number(totals.sensors)) ? Number(totals.sensors) : sensors.length;
    overviewCounter.textContent = Number.isFinite(resolvedTotal) ? String(resolvedTotal) : 'Not available';
  }
  
  // Update Overview System Status counters
  updateOverviewSystemStatus();
}

// Update Overview System Status counters
function updateOverviewSystemStatus() {
  const totals = window.SMACADashboardContext?.overview?.totals || {};
  const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
  const activeFallback = sensors.filter(s => s.is_active === true || s.is_active === 1 || s.is_active === '1').length;
  const activeSensors = Number.isFinite(Number(totals.active_sensors)) ? Number(totals.active_sensors) : activeFallback;
  const activeCounter = document.getElementById('overview-active-sensors');
  if (activeCounter) {
    activeCounter.textContent = activeSensors;
  }
  
  const maintenanceFallback = Math.max(0, sensors.length - activeFallback);
  const maintenanceSensors = Number.isFinite(Number(totals.maintenance_sensors ?? totals.inactive_sensors))
    ? Number(totals.maintenance_sensors ?? totals.inactive_sensors)
    : maintenanceFallback;
  const maintenanceCounter = document.getElementById('overview-maintenance-sensors');
  if (maintenanceCounter) {
    maintenanceCounter.textContent = maintenanceSensors;
  }
  
  const connectedSensors = Number.isFinite(Number(totals.connected_sensors)) ? Number(totals.connected_sensors) : sensors.length;
  const connectedCounter = document.getElementById('overview-connected-sensors');
  if (connectedCounter) {
    connectedCounter.textContent = connectedSensors;
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
