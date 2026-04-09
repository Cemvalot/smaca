function getIAQItemIdentityKey(item) {
  if (!item) return null;
  return item.sensorId ?? null;
}

function normalizeSensorTypeToken(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveSensorNameForClassification(x) {
  return (
    x?.payload?.object?.sensor_name ||
    x?.payload?.sensor_name ||
    x?.sensor_name ||
    x?.deviceInfo?.deviceName ||
    x?.sensorName ||
    x?.type_name ||
    x?.typeName ||
    x?.['type-name'] ||
    x?.device_type ||
    x?.deviceType ||
    ''
  );
}

function getSensorTypeNameCandidates(sensor) {
  const row = sensor || {};
  return [
    resolveSensorNameForClassification(row)
  ].filter(function (value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
  });
}

function getPrimarySensorTypeName(sensor) {
  const candidates = getSensorTypeNameCandidates(sensor);
  return candidates[0] || null;
}

function matchesSensorCategoryByName(sensor, acceptedNormalizedNames) {
  const accepted = new Set((Array.isArray(acceptedNormalizedNames) ? acceptedNormalizedNames : []).map(normalizeSensorTypeToken));
  if (accepted.size === 0) return false;
  const candidates = getSensorTypeNameCandidates(sensor).map(normalizeSensorTypeToken).filter(Boolean);
  return candidates.some(function (candidate) { return accepted.has(candidate); });
}

function isIaqSensor(sensor) {
  return matchesSensorCategoryByName(sensor, [
    'indoorAirQuality',
    'iaq'
  ]);
}

function isOccupancySensor(sensor) {
  return matchesSensorCategoryByName(sensor, [
    'peopleCounter',
    'occupancy'
  ]);
}

function isEnvironmentalSensor(sensor) {
  return matchesSensorCategoryByName(sensor, [
    'sensorUV',
    'uv',
    'environmental'
  ]);
}

function getDetectedIaqSensors() {
  const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
  return sensors.filter(isIaqSensor);
}

function getIaqNormalizedNameSample(limit) {
  const max = Number.isFinite(Number(limit)) ? Number(limit) : 8;
  const fromSensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
  const fromIaqRows = Array.isArray(SMACAState?.rawData?.iaq) ? SMACAState.rawData.iaq : [];
  return fromSensors.concat(fromIaqRows).slice(0, max).map(function (item) {
    const rawName = resolveSensorNameForClassification(item);
    return {
      rawName: rawName || '',
      normalizedName: normalizeSensorTypeToken(rawName)
    };
  });
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

const SMACA_PAGE_BUCKETS = {
  overview: ['iaq'],
  iaq: ['iaq'],
  occupancy: ['occupancy'],
  environmental: ['environmental'],
  connectivity: [],
  'ai-insights': [],
  energy: ['energy', 'occupancy'],
  management: []
};

const SMACA_TS_CACHE = {
  timeseries: {},
  latest: {},
  render: {}
};

function getSmacaCurrentPage() {
  const explicitPage = typeof window !== 'undefined' ? window.SMACA_CURRENT_PAGE : null;
  if (explicitPage) return String(explicitPage);
  const path = typeof window !== 'undefined' ? (window.location?.pathname || '') : '';
  const parts = path.split('/').filter(Boolean);
  const maybePage = parts.length > 1 ? parts[1] : 'overview';
  return maybePage || 'overview';
}

function getRequiredBucketsForCurrentPage() {
  const page = getSmacaCurrentPage();
  return SMACA_PAGE_BUCKETS[page] || [];
}

function shouldHydrateAllSensorLatestForCurrentPage() {
  const page = getSmacaCurrentPage();
  return page === 'connectivity' || page === 'management' || page === 'overview';
}

function getCachedTimeseriesKey(sensorId, timeframe, bucket, metric) {
  return [String(sensorId), String(timeframe || '24h'), String(bucket), String(metric)].join('|');
}

function clearSmacaTimeseriesCache() {
  SMACA_TS_CACHE.timeseries = {};
  SMACA_TS_CACHE.latest = {};
}

function setSectionLoadingState(sectionId, isLoading) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.style.opacity = '1';
}

function setDashboardLoadingMessage(message) {
  const messageEl = document.getElementById('smaca-page-loading-message');
  if (!messageEl) return;
  messageEl.textContent = message || 'Loading data...';
}

function showDashboardLoadingOverlay(pageName) {
  const overlay = document.getElementById('smaca-page-loading-overlay');
  if (!overlay) return;
  setDashboardLoadingMessage('Loading data...');
  overlay.classList.add('is-visible');
  overlay.setAttribute('aria-hidden', 'false');
  console.log('[SMACA] loading overlay shown', { page: pageName || getSmacaCurrentPage() });
  if ((pageName || getSmacaCurrentPage()) === 'iaq') {
    console.log('[SMACA][IAQ] loading overlay shown');
  }
}

function hideDashboardLoadingOverlay(pageName) {
  const overlay = document.getElementById('smaca-page-loading-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-visible');
  overlay.setAttribute('aria-hidden', 'true');
  console.log('[SMACA] loading overlay hidden', { page: pageName || getSmacaCurrentPage() });
  if ((pageName || getSmacaCurrentPage()) === 'iaq') {
    console.log('[SMACA][IAQ] loading overlay hidden');
  }
}

function setCurrentPageLoadingState(isLoading) {
  const page = getSmacaCurrentPage();
  const sectionByPage = {
    overview: 'overview',
    iaq: 'iaq',
    occupancy: 'occupancy',
    environmental: 'environmental',
    connectivity: 'connectivity',
    'ai-insights': 'ai-insights',
    energy: 'energy',
    management: 'management'
  };
  const sectionId = sectionByPage[page];
  if (sectionId) setSectionLoadingState(sectionId, isLoading);
  if (isLoading) showDashboardLoadingOverlay(page);
  else hideDashboardLoadingOverlay(page);
}

function renderEmptyState(containerId, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div style="color: var(--muted); text-align: center; padding: var(--space-6);">${message || 'No data available'}</div>`;
}

function renderCurrentPageFailureState(page) {
  if (page === 'occupancy') {
    renderEmptyState('occupancy-flow-chart', 'No occupancy data available');
    renderEmptyState('occupancy-density-timeline', 'No occupancy data available');
  }
  if (page === 'environmental') {
    renderEmptyState('uv-hourly-chart', 'No UV data available');
  }
  if (page === 'energy') {
    renderEmptyState('energy-correlation-chart', 'No data available');
  }
  if (page === 'iaq') {
    renderEmptyState('iaq-co2-band-chart', 'No data available');
  }
}

function escapeSmacaHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

  if (typeof window !== 'undefined' && !window.__smacaIAQVisibilityBound) {
    window.__smacaIAQVisibilityBound = true;
    window.addEventListener('smaca:section-visible', function (event) {
      if (event?.detail?.sectionId === 'iaq') {
        renderIAQSection('section-visible', false);
      }
    });
  }
  
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

function renderIAQSection(reason, allowDeferred) {
  const iaqSection = document.getElementById('iaq');
  const chartContainer = document.getElementById('iaq-co2-band-chart');
  const kpiContainer = document.getElementById('iaq-kpi-cards');
  const filteredIAQ = SMACAState.getFilteredIAQ();
  console.log('[SMACA][IAQ] normalized names sample', getIaqNormalizedNameSample(12));
  const iaqSensors = getDetectedIaqSensors();
  const iaqSensorIds = iaqSensors.map(function (sensor) { return Number(sensor?.id); }).filter(Number.isFinite);
  const iaqSensorNames = iaqSensors.map(function (sensor) { return getPrimarySensorTypeName(sensor) || `Sensor ${sensor?.id || 'Unknown'}`; });
  console.log('[SMACA][IAQ] detected IAQ sensors', {
    ids: iaqSensorIds,
    names: iaqSensorNames
  });
  const isVisible = !!iaqSection && iaqSection.style.display !== 'none';
  const pointsCount = Array.isArray(filteredIAQ) ? filteredIAQ.length : 0;
  console.log('[SMACA][IAQ] filtered row count', { count: pointsCount });
  if (!iaqSection || !chartContainer) return;
  if (iaqSensorIds.length === 0) {
    renderEmptyState('iaq-co2-band-chart', 'No IAQ sensors available');
    if (kpiContainer) {
      kpiContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: var(--space-4); color: var(--muted);">No IAQ sensors available</div>';
    }
    if (typeof hideDashboardLoadingOverlay === 'function') {
      hideDashboardLoadingOverlay('iaq');
      console.log('[SMACA][IAQ] loading overlay hidden');
    }
    return;
  }
  if (pointsCount === 0) {
    renderEmptyState('iaq-co2-band-chart', 'No IAQ data available');
    if (kpiContainer) {
      kpiContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: var(--space-4); color: var(--muted);">No IAQ data available</div>';
    }
    if (typeof hideDashboardLoadingOverlay === 'function') {
      hideDashboardLoadingOverlay('iaq');
      console.log('[SMACA][IAQ] loading overlay hidden');
    }
    return;
  }

  if (!isVisible) {
    if (allowDeferred === false) return;
    let attempts = 0;
    const maxAttempts = 12;
    const deferredRender = function () {
      const visibleNow = iaqSection.style.display !== 'none';
      if (visibleNow) {
        renderIAQSection('deferred-visible', false);
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        requestAnimationFrame(function () {
          setTimeout(deferredRender, 80);
        });
      }
    };
    requestAnimationFrame(function () {
      setTimeout(deferredRender, 80);
    });
    return;
  }

  if (typeof initAccurateIAQDashboard === 'function') {
    if (typeof window !== 'undefined') {
      window.lastRenderedTimeframe = null;
    }
    initAccurateIAQDashboard();
  } else {
    // Backward-compatible fallback if advanced IAQ renderer is unavailable.
    updateIAQDashboardWithTrends(filteredIAQ, SMACAState.currentTimeframe);
  }
}

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

    await setCurrentSensorAndReload(selectedSensorId, { forceRefresh: true });
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

function isValidFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed);
}

function getLatestValidMetricPerSensor(items, metricKey) {
  const rows = Array.isArray(items) ? items : [];
  const perSensor = {};
  rows.forEach(function (item) {
    const sensorId = item?.sensorId;
    const value = item?.payload?.object?.[metricKey];
    if (sensorId === null || sensorId === undefined || !isValidFiniteNumber(value)) return;
    const timeMs = new Date(item?.time || item?.timestamp || 0).getTime();
    if (!Number.isFinite(timeMs)) return;
    const existing = perSensor[String(sensorId)];
    if (!existing || timeMs >= existing.timeMs) {
      perSensor[String(sensorId)] = { value: Number(value), timeMs: timeMs };
    }
  });
  return perSensor;
}

function getAggregatedAverage(perSensorLatestMap) {
  const entries = Object.values(perSensorLatestMap || {}).map(function (item) {
    return Number(item?.value);
  }).filter(Number.isFinite);
  if (entries.length === 0) return null;
  const sum = entries.reduce(function (acc, value) { return acc + value; }, 0);
  return sum / entries.length;
}

function getAggregatedSum(perSensorLatestMap) {
  const entries = Object.values(perSensorLatestMap || {}).map(function (item) {
    return Number(item?.value);
  }).filter(Number.isFinite);
  if (entries.length === 0) return null;
  return entries.reduce(function (acc, value) { return acc + value; }, 0);
}

function sumLatestMetricAcrossSensors(items, metricKey) {
  return getAggregatedSum(getLatestValidMetricPerSensor(items, metricKey));
}

function averageLatestMetricAcrossSensors(items, metricKey) {
  return getAggregatedAverage(getLatestValidMetricPerSensor(items, metricKey));
}

function getEnergyDeltaPerSensor(items, sensorId) {
  const rows = (Array.isArray(items) ? items : [])
    .filter(function (item) { return String(item?.sensorId) === String(sensorId); })
    .map(function (item) {
      return {
        timeMs: new Date(item?.time || item?.timestamp || 0).getTime(),
        value: Number(item?.payload?.object?.energy_kwh)
      };
    })
    .filter(function (entry) {
      return Number.isFinite(entry.timeMs) && Number.isFinite(entry.value);
    })
    .sort(function (a, b) { return a.timeMs - b.timeMs; });
  if (rows.length < 2) return null;
  const first = rows[0].value;
  const last = rows[rows.length - 1].value;
  const delta = last - first;
  if (!Number.isFinite(delta) || delta < 0) return null;
  return delta;
}

function getAggregatedEnergyForTimeframe(energyItems) {
  const rows = Array.isArray(energyItems) ? energyItems : [];
  const sensorIds = new Set(rows.map(function (item) { return item?.sensorId; }).filter(function (id) {
    return id !== null && id !== undefined;
  }));
  let totalDelta = 0;
  sensorIds.forEach(function (sensorId) {
    const delta = getEnergyDeltaPerSensor(rows, sensorId);
    if (Number.isFinite(delta) && delta >= 0) totalDelta += delta;
  });
  return totalDelta;
}

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

async function refreshDashboardForSelection(sensorId, timeframe, options) {
  const canonicalSensorId = Number(sensorId);
  const tf = timeframe || SMACAState.currentTimeframe || '24h';
  const opts = options || {};
  const forceRefresh = opts.forceRefresh === true;
  const currentPage = getSmacaCurrentPage();
  const requiredBuckets = getRequiredBucketsForCurrentPage();
  const shouldHydrateLatestRows = shouldHydrateAllSensorLatestForCurrentPage();
  if (Number.isFinite(canonicalSensorId)) {
    if (window.SMACACurrentSensorId !== canonicalSensorId) clearSmacaTimeseriesCache();
    window.SMACACurrentSensorId = canonicalSensorId;
    logSmacaSelection(canonicalSensorId, tf);
  } else {
    logSmacaSelection(null, tf);
  }
  if ((SMACAState.currentTimeframe || '24h') !== tf) clearSmacaTimeseriesCache();
  if (forceRefresh) clearSmacaTimeseriesCache();
  console.log('[SMACA] refresh context', {
    page: currentPage,
    selectedSensorId: Number.isFinite(canonicalSensorId) ? canonicalSensorId : null,
    timeframe: tf,
    requiredBuckets: requiredBuckets
  });
  console.log('[SMACA] loading start', { page: currentPage });
  setCurrentPageLoadingState(true);
  let refreshSucceeded = false;

  try {
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

    const allSensorIds = sensors
      .map(function (sensor) { return Number(sensor?.id); })
      .filter(Number.isFinite);
    console.log('[SMACA][IAQ] normalized names sample', sensors.slice(0, 12).map(function (sensor) {
      const rawName = resolveSensorNameForClassification(sensor);
      return {
        id: Number(sensor?.id),
        rawName: rawName || '',
        normalizedName: normalizeSensorTypeToken(rawName)
      };
    }));
    const iaqSensors = sensors.filter(isIaqSensor);
    const iaqSensorIds = iaqSensors
      .map(function (sensor) { return Number(sensor?.id); })
      .filter(Number.isFinite);
    console.log('[SMACA][IAQ] detected IAQ sensors', {
      ids: iaqSensorIds,
      names: iaqSensors.map(function (sensor) { return getPrimarySensorTypeName(sensor) || `Sensor ${sensor?.id || 'Unknown'}`; })
    });

    const bucketFetchers = {
      iaq: function () { return fetchAndMapTimeseriesForSensors(iaqSensorIds, tf, SMACA_SECTION_METRICS.iaq, 'iaq', forceRefresh); },
      occupancy: function () { return fetchAndMapTimeseriesForSensors(allSensorIds, tf, SMACA_SECTION_METRICS.occupancy, 'occupancy', forceRefresh); },
      environmental: function () { return fetchAndMapTimeseriesForSensors(allSensorIds, tf, SMACA_SECTION_METRICS.environmental, 'environmental', forceRefresh); },
      energy: function () { return fetchAndMapTimeseriesForSensors(allSensorIds, tf, SMACA_SECTION_METRICS.energy, 'energy', forceRefresh); }
    };

    const fetchTasks = requiredBuckets.map(function (bucket) {
      const fn = bucketFetchers[bucket];
      if (!fn) return Promise.resolve({ bucket: bucket, items: [] });
      return fn().then(function (result) {
        return { bucket: bucket, items: result.items || [] };
      });
    });
    const fetchedBuckets = await Promise.all(fetchTasks);
    console.log('[SMACA] fetched buckets count', { page: currentPage, count: fetchedBuckets.length });

    const nextHydratedState = {
      iaq: [],
      occupancy: [],
      environmental: [],
      energy: []
    };
    fetchedBuckets.forEach(function (bucketPayload) {
      if (nextHydratedState[bucketPayload.bucket] !== undefined) {
        nextHydratedState[bucketPayload.bucket] = Array.isArray(bucketPayload.items) ? bucketPayload.items : [];
      }
    });
    applyHydratedState(nextHydratedState, false);

    if (shouldHydrateLatestRows) {
      await hydrateSensorLatestRowsForUi(sensors, forceRefresh);
    }
    if (currentPage === 'connectivity' && document.getElementById('sensor-health-table')) {
      renderConnectivityFromLiveSensors();
    }
    if (currentPage === 'management' && document.getElementById('sensors-management-table-body')) {
      renderManagementSensorsFromLiveData();
    }
    refreshSucceeded = true;
  } catch (error) {
    renderCurrentPageFailureState(currentPage);
    throw error;
  } finally {
    console.log('[SMACA] loading end', { page: currentPage });
    setCurrentPageLoadingState(false);
  }
  if (refreshSucceeded) SMACAState.setTimeframe(tf);
}

async function setCurrentSensorAndReload(selectedSensorId, options) {
  await refreshDashboardForSelection(selectedSensorId, SMACAState.currentTimeframe, options);
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
    renderIAQSection('sensor-selected-api', true);
  };

  window.addEventListener('smaca:sensor-selected', async function (event) {
    const sensorId = event?.detail?.sensorId;
    if (sensorId === null || sensorId === undefined) return;
    await setCurrentSensorAndReload(sensorId);
    renderIAQSection('sensor-selected-event', true);
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

async function hydrateSensorLatestRowsForUi(sensors, forceRefresh) {
  const rows = Array.isArray(sensors) ? sensors : [];
  const results = await Promise.all(rows.map(function (sensor) {
    const sensorId = Number(sensor?.id);
    if (!Number.isFinite(sensorId)) return Promise.resolve(null);
    const cacheKey = String(sensorId);
    if (!forceRefresh && Object.prototype.hasOwnProperty.call(SMACA_TS_CACHE.latest, cacheKey)) {
      return Promise.resolve({ sensorId: sensorId, row: SMACA_TS_CACHE.latest[cacheKey] });
    }
    return window.SMACAApi.fetchSensorLatest(sensorId).then(function (payload) {
      const row = payload?.row || null;
      SMACA_TS_CACHE.latest[cacheKey] = row;
      return { sensorId: sensorId, row: row };
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
    const sensorIdentifier = escapeSmacaHtml(sensor?.sensor_uid || sensor?.id || '');
    const rawSensorName = latestRow?.sensor_name || sensor?.sensor_name || latestRow?.name || sensor?.name || '';
    const displayTypeName = escapeSmacaHtml(rawSensorName || sensor?.device_type || 'Unknown');
    const sensorLocation = escapeSmacaHtml(
      latestRow?.sensor_location || sensor?.sensor_location || 'N/A'
    );
    const batteryTextEscaped = escapeSmacaHtml(batteryText);
    const lastSeenEscaped = escapeSmacaHtml(lastSeenText);
    return `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text); font-family: monospace;">${sensorIdentifier}</td>
        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${displayTypeName}</td>
        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${sensorLocation}</td>
        <td style="padding: var(--space-3) var(--space-4);"><span class="badge ${isActive ? 'badge--success' : 'badge--muted'} badge--sm">${isActive ? 'Live' : 'Inactive'}</span></td>
        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${batteryTextEscaped}</td>
        <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${lastSeenEscaped}</td>
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

async function fetchAndMapTimeseriesForSensor(sensorId, timeframe, metricList, bucket, forceRefresh) {
  const tf = timeframe || '24h';
  const metrics = Array.isArray(metricList) ? metricList : [];
  const adapters = window.SMACAApi.adapters;
  if (!Number.isFinite(Number(sensorId))) return { items: [], latestRow: null };

  const responses = await Promise.all(metrics.map(function (metric) {
    const cacheKey = getCachedTimeseriesKey(sensorId, tf, bucket, metric);
    if (!forceRefresh && SMACA_TS_CACHE.timeseries[cacheKey]) {
      return Promise.resolve({ metric: metric, payload: SMACA_TS_CACHE.timeseries[cacheKey] });
    }
    return window.SMACAApi
      .fetchSensorTimeseries(sensorId, metric, tf)
      .then(function (payload) {
        const safePayload = payload || { points: [] };
        SMACA_TS_CACHE.timeseries[cacheKey] = safePayload;
        return { metric: metric, payload: safePayload };
      })
      .catch(function () { return { metric: metric, payload: { points: [] } }; });
  }));
  const latestCacheKey = String(sensorId);
  let latestPayload = null;
  if (!forceRefresh && Object.prototype.hasOwnProperty.call(SMACA_TS_CACHE.latest, latestCacheKey)) {
    latestPayload = { row: SMACA_TS_CACHE.latest[latestCacheKey] };
  } else {
    latestPayload = await window.SMACAApi.fetchSensorLatest(sensorId).catch(function () { return null; });
    if (latestPayload?.row || latestPayload === null) SMACA_TS_CACHE.latest[latestCacheKey] = latestPayload?.row || null;
  }
  const latestRow = latestPayload?.row || null;
  const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
  const sensorMeta = sensors.find(function (sensor) { return String(sensor?.id) === String(sensorId); }) || null;
  const resolvedSensorUid = latestRow?.sensor_uid ?? sensorMeta?.sensor_uid ?? null;
  const resolvedSensorName = latestRow?.sensor_name
    || sensorMeta?.sensor_name
    || sensorMeta?.name
    || latestRow?.name
    || null;

  const meta = {
    sensorId: sensorId,
    sensorUid: resolvedSensorUid,
    deviceName: resolvedSensorName || `Sensor ${sensorId}`,
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
      sensor_name: latestRow.sensor_name || latestRow.name,
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
    const itemSensorId = item?.sensorId ?? sensorId;
    const itemSensorMeta = sensors.find(function (sensor) { return String(sensor?.id) === String(itemSensorId); }) || sensorMeta;
    const rowSensorName = item?.sensorName
      || item?.sensor_name
      || item?.payload?.object?.sensor_name
      || item?.payload?.sensor_name
      || latestRow?.sensor_name
      || itemSensorMeta?.sensor_name
      || item?.deviceInfo?.deviceName
      || item?.deviceName
      || itemSensorMeta?.name
      || null;
    return {
      ...item,
      sensorId: itemSensorId,
      sensorUid: item?.sensorUid ?? resolvedSensorUid,
      sensorName: rowSensorName,
      sensor_name: rowSensorName,
      deviceName: item?.deviceName || meta.deviceName,
      deviceProfileName: item?.deviceProfileName || meta.deviceProfileName,
      deviceInfo: {
        ...((item && item.deviceInfo) || {}),
        deviceName: rowSensorName || item?.deviceInfo?.deviceName || item?.deviceName || meta.deviceName || null
      },
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

async function fetchAndMapTimeseriesForSensors(sensorIds, timeframe, metricList, bucket, forceRefresh) {
  const ids = Array.isArray(sensorIds) ? sensorIds.filter(Number.isFinite) : [];
  if (ids.length === 0) return { items: [], latestRowsBySensorId: {} };
  const results = await Promise.all(ids.map(function (sensorId) {
    return fetchAndMapTimeseriesForSensor(sensorId, timeframe, metricList, bucket, forceRefresh)
      .catch(function () { return { items: [], latestRow: null, sensorId: sensorId }; });
  }));
  const mergedItems = [];
  const latestRowsBySensorId = {};
  results.forEach(function (result, index) {
    const sid = ids[index];
    const items = Array.isArray(result?.items) ? result.items : [];
    mergedItems.push.apply(mergedItems, items);
    latestRowsBySensorId[String(sid)] = result?.latestRow || null;
  });
  mergedItems.sort(function (a, b) { return new Date(a.time) - new Date(b.time); });
  return { items: mergedItems, latestRowsBySensorId: latestRowsBySensorId };
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
  const iaqHydratedSample = SMACAState.rawData.iaq.slice(0, 10).map(function (row) {
    return {
      sensorId: row?.sensorId ?? null,
      sensorName: row?.sensorName
        || row?.sensor_name
        || row?.payload?.object?.sensor_name
        || row?.payload?.sensor_name
        || row?.deviceInfo?.deviceName
        || null
    };
  });
  const distinctIaqNames = Array.from(new Set(
    SMACAState.rawData.iaq.map(function (row) {
      return row?.sensorName
        || row?.sensor_name
        || row?.payload?.object?.sensor_name
        || row?.payload?.sensor_name
        || row?.deviceInfo?.deviceName
        || null;
    }).filter(function (name) {
      return name !== null && name !== undefined && String(name).trim() !== '';
    }).map(function (name) {
      return String(name).trim();
    })
  ));
  console.log('[SMACA][IAQ] hydrated rows sample', iaqHydratedSample);
  console.log('[SMACA][IAQ] distinct IAQ sensor names detected', distinctIaqNames);
  if (notify) {
    SMACAState.notifyListeners();
  }
}

// Setup time range selector
function setupTimeRangeSelector() {
  if (typeof window !== 'undefined' && window.__smacaTimeRangeBound) return;
  if (typeof window !== 'undefined') window.__smacaTimeRangeBound = true;
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
  if (typeof window !== 'undefined' && window.__smacaExportBound) return;
  if (typeof window !== 'undefined') window.__smacaExportBound = true;
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
    const safeMessage = escapeSmacaHtml(alert.message || '');
    const safeSeverity = escapeSmacaHtml(alert.severity || 'info');
    const safeTimeAgo = escapeSmacaHtml(timeAgo || '');
    const safeConfidence = Number.isFinite(Number(alert.confidence)) ? Number(alert.confidence) : 0;
    
    return `
      <div class="alert-card" style="padding: var(--space-4); border-bottom: 1px solid var(--border); display: flex; align-items: start; gap: var(--space-3);">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);">
            <span class="badge ${severityClass} badge--sm">${safeSeverity}</span>
            <span style="font-size: var(--font-size-xs); color: var(--muted);">${safeTimeAgo}</span>
          </div>
          <p style="margin: 0; font-size: var(--font-size-sm);">${safeMessage}</p>
          <div style="margin-top: var(--space-2); font-size: var(--font-size-xs); color: var(--muted);">
            Confidence: ${safeConfidence}%
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
  renderCurrentPageOnly(timeframe, filteredData);
}

function renderCurrentPageOnly(timeframe, filteredData) {
  const currentPage = getSmacaCurrentPage();
  const signature = [
    currentPage,
    timeframe,
    window.SMACACurrentSensorId || 'none',
    (filteredData?.iaq || []).length,
    (filteredData?.occupancy || []).length,
    (filteredData?.environmental || []).length,
    (filteredData?.energy || []).length
  ].join('|');
  if (SMACA_TS_CACHE.render.lastSignature === signature) return;
  SMACA_TS_CACHE.render.lastSignature = signature;

  if (currentPage === 'overview' || currentPage === 'iaq') {
    renderIAQSection('render-current-page-only', true);
  }
  if (currentPage === 'occupancy') {
    if (!document.getElementById('occupancy')) return;
    updateOccupancyDashboardWithTrends(filteredData.occupancy, timeframe);
    updateOccupancyCharts(filteredData.occupancy, timeframe);
  }
  if (currentPage === 'energy') {
    updateEnergyCharts(filteredData.energy || [], timeframe);
  }
  if (currentPage === 'environmental') {
    if (!document.getElementById('environmental')) return;
    updateEnvironmentalDashboard(filteredData.environmental, timeframe);
  }
  if (currentPage === 'connectivity' && document.getElementById('sensor-health-table')) {
    renderConnectivityFromLiveSensors();
  }
  if (currentPage === 'management' && document.getElementById('sensors-management-table-body')) {
    renderManagementSensorsFromLiveData();
  }
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
    kpiContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: var(--space-4); color: var(--muted);">No IAQ data available</div>';
    return;
  }

  const rawIAQ = Array.isArray(SMACAState.rawData?.iaq) ? SMACAState.rawData.iaq : [];
  const liveSeries = rawIAQ.length > 0 ? rawIAQ : filteredIAQ;
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
    const byBucket = {};
    sortedSeries.forEach(function (item) {
      const timeMs = new Date(item?.time || item?.timestamp || 0).getTime();
      const value = Number(item?.payload?.object?.[metricKey]);
      if (!Number.isFinite(timeMs) || !Number.isFinite(value)) return;
      const bucket = Math.floor(timeMs / (60 * 60 * 1000)) * (60 * 60 * 1000);
      if (!byBucket[bucket]) byBucket[bucket] = [];
      byBucket[bucket].push(value);
    });
    return Object.keys(byBucket)
      .map(function (bucket) {
        const values = byBucket[bucket];
        const sum = values.reduce(function (acc, v) { return acc + v; }, 0);
        return { bucket: Number(bucket), avg: sum / values.length };
      })
      .sort(function (a, b) { return a.bucket - b.bucket; })
      .map(function (entry) { return entry.avg; });
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
  
  // Aggregate latest valid value per sensor, then aggregate across sensors.
  const co2 = getAggregatedAverage(getLatestValidMetricPerSensor(liveSeries, 'co2'));
  const temp = getAggregatedAverage(getLatestValidMetricPerSensor(liveSeries, 'temperature'));
  const humidity = getAggregatedAverage(getLatestValidMetricPerSensor(liveSeries, 'humidity'));
  const pm25 = getAggregatedAverage(getLatestValidMetricPerSensor(liveSeries, 'pm2_5'));
  const pm10 = getAggregatedAverage(getLatestValidMetricPerSensor(liveSeries, 'pm10'));
  const tvoc = getAggregatedAverage(getLatestValidMetricPerSensor(liveSeries, 'tvoc'));
  console.log('[SMACA][IAQ] aggregated widget values', {
    co2: Number.isFinite(Number(co2)) ? Number(co2) : null,
    temperature: Number.isFinite(Number(temp)) ? Number(temp) : null,
    humidity: Number.isFinite(Number(humidity)) ? Number(humidity) : null,
    pm2_5: Number.isFinite(Number(pm25)) ? Number(pm25) : null,
    pm10: Number.isFinite(Number(pm10)) ? Number(pm10) : null,
    tvoc: Number.isFinite(Number(tvoc)) ? Number(tvoc) : null
  });

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
  
  const occupancyRows = Array.isArray(SMACAState.rawData?.occupancy) ? SMACAState.rawData.occupancy : filteredOccupancy;
  if (!occupancyRows || occupancyRows.length === 0) {
    const currentCardValue = occupancySection.querySelector('.card:first-child .card__body div div div:nth-child(2)');
    if (currentCardValue) currentCardValue.textContent = 'No occupancy data available';
    const occupancyCounter = document.getElementById('occupancy-current-count');
    if (occupancyCounter) occupancyCounter.textContent = 'No occupancy data available';
    return;
  }

  const occupancyTrend = SMACATrendCalculator.calculateMetricTrend(occupancyRows, 'people_in', timeframe);
  const latestPeopleIn = sumLatestMetricAcrossSensors(occupancyRows, 'people_in');
  const latestPeopleOut = sumLatestMetricAcrossSensors(occupancyRows, 'people_out');
  const latestTotalIn = sumLatestMetricAcrossSensors(occupancyRows, 'people_total_in');
  const latestTotalOut = sumLatestMetricAcrossSensors(occupancyRows, 'people_total_out');
  const latestActivity = Number(latestPeopleIn || 0) + Number(latestPeopleOut || 0);
  const occupancyTrendFormatted = SMACATrendCalculator.formatTrend(occupancyTrend);
  console.log('[SMACA] occupancy cumulative totals', {
    page: getSmacaCurrentPage(),
    latestTotalIn: Number.isFinite(Number(latestTotalIn)) ? Number(latestTotalIn) : null,
    latestTotalOut: Number.isFinite(Number(latestTotalOut)) ? Number(latestTotalOut) : null
  });
  
  // Update occupancy KPI card if it exists
  const occupancyCard = occupancySection.querySelector('.stat-card');
  if (occupancyCard) {
    const valueEl = occupancyCard.querySelector('.stat-card__value');
    if (valueEl) {
      valueEl.textContent = Math.round(latestActivity);
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

  const summaryValueEl = occupancySection.querySelector('.card .card__body div div div:nth-child(2)');
  if (summaryValueEl) {
    const hasAnyOccupancyMetric = [latestPeopleIn, latestPeopleOut, latestTotalIn, latestTotalOut].some(function (value) {
      return Number.isFinite(Number(value));
    });
    summaryValueEl.textContent = hasAnyOccupancyMetric ? String(Math.round(latestActivity)) : 'No occupancy data available';
  }
  const heroLabel = occupancySection.querySelector('.section-hero__stat-label');
  if (heroLabel) heroLabel.textContent = 'Recent movements';
  const summaryLabel = occupancySection.querySelector('.card .card__body div div div:first-child');
  if (summaryLabel) summaryLabel.textContent = 'Current Activity';
  const summarySubLabel = occupancySection.querySelector('.card .card__body div div div:nth-child(3)');
  if (summarySubLabel) summarySubLabel.textContent = `Cumulative entries: ${Number.isFinite(Number(latestTotalIn)) ? Math.round(Number(latestTotalIn)) : 'N/A'} | exits: ${Number.isFinite(Number(latestTotalOut)) ? Math.round(Number(latestTotalOut)) : 'N/A'}`;
  const occupancyCounter = document.getElementById('occupancy-current-count');
  if (occupancyCounter) {
    occupancyCounter.textContent = Number.isFinite(latestActivity) ? String(Math.round(latestActivity)) : 'No occupancy data available';
  }
}

// Update Environmental dashboard
function updateEnvironmentalDashboard(filteredEnvironmental, timeframe) {
  if (getSmacaCurrentPage() !== 'environmental') return;
  const environmentalSection = document.querySelector('#environmental');
  if (!environmentalSection) return;

  const uvCounter = document.getElementById('environmental-uv-index');
  const uvCardValue = environmentalSection.querySelector('.stat-card .stat-card__value');
  const uvCardMeta = environmentalSection.querySelector('.stat-card .stat-card__meta');
  const environmentalRows = typeof SMACAState.getFilteredEnvironmental === 'function'
    ? SMACAState.getFilteredEnvironmental()
    : (Array.isArray(SMACAState.rawData?.environmental) ? SMACAState.rawData.environmental : filteredEnvironmental);
  const latestUv = averageLatestMetricAcrossSensors(environmentalRows, 'uv_index');
  if (latestUv === null) {
    if (uvCounter) uvCounter.textContent = 'No UV data available';
    if (uvCardValue) uvCardValue.textContent = 'No UV data available';
    if (uvCardMeta) uvCardMeta.textContent = 'Unsupported by device';
    renderEmptyState('uv-hourly-chart', 'No UV data available');
    return;
  }

  if (uvCounter) uvCounter.textContent = latestUv.toFixed(1);
  if (uvCardValue) uvCardValue.textContent = latestUv.toFixed(1);
  if (uvCardMeta) uvCardMeta.textContent = latestUv >= 8 ? 'Very High' : latestUv >= 6 ? 'High' : latestUv >= 3 ? 'Moderate' : 'Low';

  // Keep chart behavior for detail views (selected sensor drill-down).
  const chartRows = (Array.isArray(environmentalRows) ? environmentalRows : [])
    .map(function (item) {
      const timeMs = new Date(item?.time || item?.timestamp || 0).getTime();
      const uv = Number(item?.payload?.object?.uv_index);
      return { timeMs: timeMs, uv: uv };
    })
    .filter(function (entry) {
      return Number.isFinite(entry.timeMs) && Number.isFinite(entry.uv);
    })
    .sort(function (a, b) { return a.timeMs - b.timeMs; });
  const uvValues = chartRows.map(function (entry) { return entry.uv; });
  console.log('[SMACA] UV valid points', { page: getSmacaCurrentPage(), count: uvValues.length });

  const uvGauge = document.getElementById('uv-gauge-chart');
  if (uvGauge && typeof createGaugeChart === 'function') {
    const gaugeValue = uvValues.length > 0 ? uvValues[uvValues.length - 1] : latestUv;
    createGaugeChart('uv-gauge-chart', gaugeValue, 11, {
      size: 200,
      color: gaugeValue >= 6 ? '#ef4444' : gaugeValue >= 3 ? '#f59e0b' : '#10b981',
      label: 'UV Index'
    });
  }
  const uvHourly = document.getElementById('uv-hourly-chart');
  if (uvHourly && typeof createLineChart === 'function') {
    if (uvValues.length === 0) {
      renderEmptyState('uv-hourly-chart', 'No UV data available');
      return;
    }
    createLineChart('uv-hourly-chart', [{
      label: 'UV Index',
      values: uvValues,
      color: '#f97316'
    }], { height: 300, legend: true });
  }
}

// Update Occupancy charts with filtered data
function updateOccupancyCharts(filteredOccupancy, timeframe) {
  if (getSmacaCurrentPage() !== 'occupancy') return;
  console.log('[SMACA] updateOccupancyCharts entered', { page: getSmacaCurrentPage(), timeframe: timeframe });
  ensureOccupancyLocationChartContainers();
  const selectedSensorId = typeof window !== 'undefined' ? window.SMACACurrentSensorId : null;
  const hydratedRows = Array.isArray(SMACAState.rawData?.occupancy) ? SMACAState.rawData.occupancy : [];
  const fallbackRows = Array.isArray(filteredOccupancy) ? filteredOccupancy : [];
  const occupancyRows = fallbackRows.length > 0 ? fallbackRows : hydratedRows;
  console.log('[SMACA] occupancy chart source', {
    page: getSmacaCurrentPage(),
    filteredCount: fallbackRows.length,
    hydratedCount: hydratedRows.length,
    selectedSensorId: selectedSensorId,
    selectedSensorBypassed: true,
    usingAllSensorsCount: occupancyRows.length
  });
  if (!occupancyRows || occupancyRows.length === 0) {
    renderEmptyState('occupancy-flow-chart', 'No occupancy data available');
    renderEmptyState('occupancy-density-timeline', 'No occupancy data available');
    renderEmptyState('occupancy-current-by-location-chart', 'No occupancy data available');
    renderEmptyState('occupancy-total-entries-by-location-chart', 'No occupancy data available');
    renderEmptyState('occupancy-flow-by-location-chart', 'No occupancy data available');
    console.log('[SMACA] occupancy render empty state', { page: getSmacaCurrentPage() });
    return;
  }
  
  // Convert filtered data to chart format
  const activityData = [];
  const flowIn = [];
  const flowOut = [];
  
  // Group by hour based on timeframe
  const timeInterval = timeframe === '24h' ? 60 * 60 * 1000 : // 1 hour
                        timeframe === '7d' ? 24 * 60 * 60 * 1000 : // 1 day
                        24 * 60 * 60 * 1000; // 1 day for 30d
  
  const grouped = {};
  const normalizedPreview = [];
  occupancyRows.forEach(function (item, idx) {
    const time = new Date(item?.time || item?.timestamp || 0).getTime();
    const peopleIn = Number(item?.payload?.object?.people_in);
    const peopleOut = Number(item?.payload?.object?.people_out);
    const peopleTotalIn = Number(item?.payload?.object?.people_total_in);
    const peopleTotalOut = Number(item?.payload?.object?.people_total_out);
    if (normalizedPreview.length < 3) {
      normalizedPreview.push({
        sensorId: item?.sensorId ?? null,
        timeMs: Number.isFinite(time) ? time : null,
        peopleIn: Number.isFinite(peopleIn) ? peopleIn : null,
        peopleOut: Number.isFinite(peopleOut) ? peopleOut : null,
        peopleTotalIn: Number.isFinite(peopleTotalIn) ? peopleTotalIn : null,
        peopleTotalOut: Number.isFinite(peopleTotalOut) ? peopleTotalOut : null
      });
    }
    if (!Number.isFinite(time)) return;
    const bucket = Math.floor(time / timeInterval) * timeInterval;
    
    if (!grouped[bucket]) grouped[bucket] = { in: 0, out: 0 };

    grouped[bucket].in += Number.isFinite(peopleIn) ? peopleIn : 0;
    grouped[bucket].out += Number.isFinite(peopleOut) ? peopleOut : 0;

  });
  
  const sortedBuckets = Object.keys(grouped).sort((a, b) => a - b);
  console.log('[SMACA] occupancy grouped flow buckets', {
    page: getSmacaCurrentPage(),
    buckets: sortedBuckets.length,
    firstBuckets: sortedBuckets.slice(0, 10).map(function (bucket) {
      return {
        bucket: Number(bucket),
        peopleIn: grouped[bucket]?.in || 0,
        peopleOut: grouped[bucket]?.out || 0
      };
    })
  });
  sortedBuckets.forEach(bucket => {
    const bucketIn = Number(grouped[bucket]?.in || 0);
    const bucketOut = Number(grouped[bucket]?.out || 0);
    activityData.push(Math.max(0, bucketIn + bucketOut));
    flowIn.push(bucketIn);
    flowOut.push(bucketOut);
  });
  console.log('[SMACA] occupancy grouped activity buckets', {
    page: getSmacaCurrentPage(),
    buckets: sortedBuckets.length,
    firstBuckets: sortedBuckets.slice(0, 10).map(function (bucket, idx) {
      return {
        bucket: Number(bucket),
        activity: activityData[idx] || 0
      };
    })
  });
  console.log('[SMACA] occupancy chart arrays', {
    page: getSmacaCurrentPage(),
    flowInLength: flowIn.length,
    flowOutLength: flowOut.length,
    activityLength: activityData.length,
    flowInHead: flowIn.slice(0, 8),
    flowOutHead: flowOut.slice(0, 8),
    activityHead: activityData.slice(0, 8)
  });
  const safeFlowIn = flowIn.map(function (value) { return Number.isFinite(Number(value)) ? Number(value) : 0; });
  const safeFlowOut = flowOut.map(function (value) { return Number.isFinite(Number(value)) ? Number(value) : 0; });
  const safeActivityData = activityData.map(function (value) { return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0; });
  console.log('[SMACA] flow/activity arrays ready', {
    flowInLength: safeFlowIn.length,
    flowOutLength: safeFlowOut.length,
    activityLength: safeActivityData.length
  });
  if (typeof window !== 'undefined') {
    window.__lastOccupancyFlowBuckets = sortedBuckets.slice(0, 200).map(function (bucket, idx) {
      return {
        bucket: Number(bucket),
        peopleIn: flowIn[idx] || 0,
        peopleOut: flowOut[idx] || 0
      };
    });
    window.__lastOccupancyActivityBuckets = sortedBuckets.slice(0, 200).map(function (bucket, idx) {
      return {
        bucket: Number(bucket),
        activity: activityData[idx] || 0
      };
    });
    window.__lastOccupancyChartArrays = {
      source: {
        filteredCount: fallbackRows.length,
        hydratedCount: hydratedRows.length,
        selectedSensorBypassed: true
      },
      flowIn: safeFlowIn.slice(),
      flowOut: safeFlowOut.slice(),
      activity: safeActivityData.slice()
    };
  }

  // Update charts after layout is measurable.
  setTimeout(function () {
    renderOccupancyChartWhenReady('occupancy-flow-chart', function () {
      if (typeof createFlowBarChart !== 'function') throw new Error('createFlowBarChart unavailable');
      if (safeFlowIn.length === 0 || safeFlowOut.length === 0) throw new Error('empty-flow-arrays');
      createFlowBarChart('occupancy-flow-chart', safeFlowIn, safeFlowOut, { height: 400, minVisibleBarPx: 3 });
    }, function (reason) {
      console.warn('[SMACA] occupancy flow render failed', { reason: reason });
      renderEmptyState('occupancy-flow-chart', 'No occupancy data available');
    });

    renderOccupancyChartWhenReady('occupancy-density-timeline', function () {
      if (typeof createOccupancyDensityTimeline !== 'function') throw new Error('createOccupancyDensityTimeline unavailable');
      if (safeActivityData.length === 0) throw new Error('empty-activity-array');
      createOccupancyDensityTimeline('occupancy-density-timeline', safeActivityData, { height: 300, minVisiblePointPx: 2 });
    }, function (reason) {
      console.warn('[SMACA] occupancy activity render failed', { reason: reason });
      renderEmptyState('occupancy-density-timeline', 'No occupancy data available');
    });

    renderOccupancyLocationCharts(occupancyRows);
    console.log('[SMACA] occupancy render completed', { page: getSmacaCurrentPage(), points: occupancyRows.length });
  }, 120);
}

function renderOccupancyChartWhenReady(containerId, renderFn, onFailure) {
  const maxAttempts = 12;
  let attempt = 0;
  const tryRender = function () {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn('[SMACA] occupancy container missing', { id: containerId, page: getSmacaCurrentPage() });
      if (typeof onFailure === 'function') onFailure('container-missing');
      return;
    }
    const width = Number(container.offsetWidth || 0);
    const height = Number(container.offsetHeight || 0);
    console.log('[SMACA] occupancy container check', {
      page: getSmacaCurrentPage(),
      id: containerId,
      width: width,
      height: height,
      attempt: attempt + 1
    });
    if (width <= 0 || height <= 0) {
      attempt += 1;
      if (attempt >= maxAttempts) {
        if (typeof onFailure === 'function') onFailure('container-not-measurable');
        return;
      }
      requestAnimationFrame(function () {
        setTimeout(tryRender, 50);
      });
      return;
    }

    try {
      container.innerHTML = '';
      renderFn();
      const hasSvg = !!container.querySelector('svg');
      if (!hasSvg) throw new Error('no-svg-appended');
      console.log('[SMACA] occupancy chart helper completed', { id: containerId });
      console.log('[SMACA] occupancy chart rendered', { id: containerId, width: width, height: height });
    } catch (error) {
      if (typeof onFailure === 'function') onFailure(error?.message || 'render-error');
    }
  };
  tryRender();
}

function getOccupancyLocationLabel(item, sensorMetaById) {
  const sensorId = Number(item?.sensorId);
  const sensorMeta = Number.isFinite(sensorId) ? sensorMetaById[String(sensorId)] : null;
  const label = item?.location
    || item?.siteName
    || sensorMeta?.site?.name
    || sensorMeta?.location
    || sensorMeta?.name;
  return label ? String(label) : 'Unknown location';
}

function groupOccupancyByLocation(items) {
  const rows = Array.isArray(items) ? items : [];
  const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
  const sensorMetaById = sensors.reduce(function (acc, sensor) {
    const sensorId = Number(sensor?.id);
    if (Number.isFinite(sensorId)) acc[String(sensorId)] = sensor;
    return acc;
  }, {});
  return rows.reduce(function (acc, item) {
    const label = getOccupancyLocationLabel(item, sensorMetaById);
    if (!acc[label]) acc[label] = [];
    acc[label].push(item);
    return acc;
  }, {});
}

function getFlowTotalsPerLocation(itemsByLocation) {
  return Object.keys(itemsByLocation).map(function (location) {
    const rows = itemsByLocation[location] || [];
    const totals = rows.reduce(function (acc, item) {
      const inValue = Number(item?.payload?.object?.people_in);
      const outValue = Number(item?.payload?.object?.people_out);
      if (Number.isFinite(inValue)) acc.peopleIn += inValue;
      if (Number.isFinite(outValue)) acc.peopleOut += outValue;
      return acc;
    }, { peopleIn: 0, peopleOut: 0 });
    return { location: location, peopleIn: totals.peopleIn, peopleOut: totals.peopleOut };
  }).filter(function (entry) {
    return entry.peopleIn > 0 || entry.peopleOut > 0;
  });
}

function getActivityPerLocation(itemsByLocation) {
  return Object.keys(itemsByLocation).map(function (location) {
    const rows = itemsByLocation[location] || [];
    const activity = rows.reduce(function (sum, item) {
      const peopleIn = Number(item?.payload?.object?.people_in);
      const peopleOut = Number(item?.payload?.object?.people_out);
      return sum + (Number.isFinite(peopleIn) ? peopleIn : 0) + (Number.isFinite(peopleOut) ? peopleOut : 0);
    }, 0);
    return { location: location, activity: activity };
  }).filter(function (entry) {
    return Number.isFinite(entry.activity) && entry.activity > 0;
  });
}

function getTotalEntriesPerLocation(itemsByLocation) {
  return Object.keys(itemsByLocation).map(function (location) {
    const rows = itemsByLocation[location] || [];
    const totalEntries = rows.reduce(function (sum, item) {
      const value = Number(item?.payload?.object?.people_total_in);
      return Number.isFinite(value) ? Math.max(sum, value) : sum;
    }, 0);
    return { location: location, totalEntries: totalEntries };
  }).filter(function (entry) {
    return Number.isFinite(entry.totalEntries) && entry.totalEntries > 0;
  });
}

function ensureOccupancyLocationChartContainers() {
  const occupancySection = document.getElementById('occupancy');
  if (!occupancySection) return;
  if (document.getElementById('occupancy-current-by-location-chart')) return;
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
  grid.style.gap = 'var(--space-6)';
  grid.style.marginTop = 'var(--space-6)';
  grid.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">Activity by Location</h3>
      </div>
      <div class="card__body">
        <div class="chart-placeholder" id="occupancy-current-by-location-chart"></div>
      </div>
    </div>
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">Cumulative Entries by Location</h3>
      </div>
      <div class="card__body">
        <div class="chart-placeholder" id="occupancy-total-entries-by-location-chart"></div>
      </div>
    </div>
    <div class="card" style="grid-column: 1 / -1;">
      <div class="card__header">
        <h3 class="card__title">Flow by Location (In/Out)</h3>
      </div>
      <div class="card__body">
        <div class="chart-placeholder" id="occupancy-flow-by-location-chart"></div>
      </div>
    </div>
  `;
  occupancySection.appendChild(grid);
}

function renderOccupancyLocationCharts(occupancyRows) {
  if (getSmacaCurrentPage() !== 'occupancy') return;
  ensureOccupancyLocationChartContainers();
  const byLocation = groupOccupancyByLocation(occupancyRows);
  const locationCount = Object.keys(byLocation).length;
  console.log('[SMACA] occupancy locations grouped', { page: getSmacaCurrentPage(), locations: locationCount });
  if (locationCount === 0) {
    renderEmptyState('occupancy-current-by-location-chart', 'No data available');
    renderEmptyState('occupancy-total-entries-by-location-chart', 'No data available');
    renderEmptyState('occupancy-flow-by-location-chart', 'No data available');
    return;
  }

  const currentByLocation = getActivityPerLocation(byLocation);
  const entriesByLocation = getTotalEntriesPerLocation(byLocation);
  const flowByLocation = getFlowTotalsPerLocation(byLocation);

  if (currentByLocation.length > 0) {
    renderLocationBarChart(
      'occupancy-current-by-location-chart',
      currentByLocation.map(function (item) { return item.location; }),
      currentByLocation.map(function (item) { return item.activity; }),
      '#3b82f6'
    );
  } else {
    renderEmptyState('occupancy-current-by-location-chart', 'No data available');
  }

  if (entriesByLocation.length > 0) {
    renderLocationBarChart(
      'occupancy-total-entries-by-location-chart',
      entriesByLocation.map(function (item) { return item.location; }),
      entriesByLocation.map(function (item) { return item.totalEntries; }),
      '#10b981'
    );
  } else {
    renderEmptyState('occupancy-total-entries-by-location-chart', 'No data available');
  }

  if (flowByLocation.length > 0) {
    renderLocationFlowChart(
      'occupancy-flow-by-location-chart',
      flowByLocation.map(function (item) { return item.location; }),
      flowByLocation.map(function (item) { return item.peopleIn; }),
      flowByLocation.map(function (item) { return item.peopleOut; }),
      { height: 360 }
    );
  } else {
    renderEmptyState('occupancy-flow-by-location-chart', 'No data available');
  }
  if (locationCount === 1) {
    const chartEl = document.getElementById('occupancy-current-by-location-chart');
    if (chartEl && !chartEl.querySelector('[data-one-location-note]')) {
      const note = document.createElement('div');
      note.setAttribute('data-one-location-note', 'true');
      note.style.cssText = 'font-size: var(--font-size-xs); color: var(--muted); text-align: center; margin-top: var(--space-2);';
      note.textContent = 'Only one location available';
      chartEl.appendChild(note);
    }
  }
}

function renderLocationBarChart(containerId, labels, values, color) {
  const container = document.getElementById(containerId);
  if (!container || !Array.isArray(labels) || !Array.isArray(values) || labels.length === 0 || labels.length !== values.length) return;
  const width = container.offsetWidth || 800;
  const height = 320;
  const padding = { top: 20, right: 20, bottom: 70, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const safeValues = values.map(function (value) { return Number.isFinite(Number(value)) ? Number(value) : 0; });
  const maxValue = Math.max(1, ...safeValues);
  const barSpace = chartWidth / labels.length;
  const barWidth = Math.max(14, barSpace * 0.6);
  container.innerHTML = '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  safeValues.forEach(function (value, idx) {
    const barHeight = (value / maxValue) * chartHeight;
    const x = idx * barSpace + ((barSpace - barWidth) / 2);
    const y = chartHeight - barHeight;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('fill', color || '#3b82f6');
    rect.setAttribute('rx', '4');
    group.appendChild(rect);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x + (barWidth / 2));
    label.setAttribute('y', chartHeight + 20);
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '10');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = String(labels[idx]).slice(0, 16);
    group.appendChild(label);
  });
  svg.appendChild(group);
  container.appendChild(svg);
}

function renderLocationFlowChart(containerId, labels, inValues, outValues, options) {
  const container = document.getElementById(containerId);
  if (!container || !Array.isArray(labels) || !Array.isArray(inValues) || !Array.isArray(outValues)) return;
  if (labels.length === 0 || labels.length !== inValues.length || labels.length !== outValues.length) return;
  const width = container.offsetWidth || 800;
  const height = options?.height || 360;
  const padding = { top: 30, right: 20, bottom: 80, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const safeIn = inValues.map(function (value) { return Number.isFinite(Number(value)) ? Number(value) : 0; });
  const safeOut = outValues.map(function (value) { return Number.isFinite(Number(value)) ? Number(value) : 0; });
  const maxValue = Math.max(1, ...safeIn, ...safeOut);
  const groupSpace = chartWidth / labels.length;
  const barWidth = Math.max(10, groupSpace * 0.25);
  container.innerHTML = '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  safeIn.forEach(function (inValue, idx) {
    const outValue = safeOut[idx];
    const baseX = idx * groupSpace + (groupSpace / 2);
    const inHeight = (inValue / maxValue) * chartHeight;
    const outHeight = (outValue / maxValue) * chartHeight;
    const inRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    inRect.setAttribute('x', baseX - barWidth - 2);
    inRect.setAttribute('y', chartHeight - inHeight);
    inRect.setAttribute('width', barWidth);
    inRect.setAttribute('height', inHeight);
    inRect.setAttribute('fill', '#10b981');
    group.appendChild(inRect);
    const outRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    outRect.setAttribute('x', baseX + 2);
    outRect.setAttribute('y', chartHeight - outHeight);
    outRect.setAttribute('width', barWidth);
    outRect.setAttribute('height', outHeight);
    outRect.setAttribute('fill', '#ef4444');
    group.appendChild(outRect);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', baseX);
    label.setAttribute('y', chartHeight + 22);
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '10');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = String(labels[idx]).slice(0, 16);
    group.appendChild(label);
  });
  svg.appendChild(group);
  container.appendChild(svg);
}

// Update Energy charts with filtered data
function updateEnergyCharts(filteredEnergy, timeframe) {
  const energyRows = Array.isArray(SMACAState.rawData?.energy) ? SMACAState.rawData.energy : filteredEnergy;
  if (!energyRows || energyRows.length === 0) {
    const energyChartEl = document.getElementById('energy-correlation-chart');
    if (energyChartEl) energyChartEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: var(--space-6);">No data for selected timeframe</div>';
    return;
  }

  // Build explicit numeric series from hydrated payloads.
  const timeInterval = timeframe === '24h' ? 60 * 60 * 1000 :
                        timeframe === '7d' ? 24 * 60 * 60 * 1000 :
                        24 * 60 * 60 * 1000;
  const filteredOccupancy = typeof SMACAState?.getFilteredOccupancy === 'function'
    ? SMACAState.getFilteredOccupancy()
    : (Array.isArray(SMACAState?.rawData?.occupancy) ? SMACAState.rawData.occupancy : []);

  const energyPoints = energyRows
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
      energyChartEl.innerHTML = '<div style="color: var(--muted); text-align: center; padding: var(--space-6);">No data for selected timeframe</div>';
      return;
    }

    if (typeof createDualAxisChart === 'function') {
      createDualAxisChart('energy-correlation-chart', occupancyData, energyData, { height: 400 });
    }
  }, 200);

  const energySection = document.querySelector('#energy');
  if (energySection) {
    const summaryValue = energySection.querySelector('.card .card__body div div div:nth-child(2)');
    const totalDelta = getAggregatedEnergyForTimeframe(energyRows);
    if (summaryValue && Number.isFinite(totalDelta)) {
      summaryValue.textContent = totalDelta.toFixed(1);
    }
    const summaryLabel = energySection.querySelector('.card .card__body div div div:nth-child(3)');
    if (summaryLabel) {
      summaryLabel.textContent = timeframe === '24h' ? 'kWh today' : timeframe === '7d' ? 'kWh this week' : 'kWh this month';
    }
  }
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
  const occupancyRows = Array.isArray(SMACAState.rawData?.occupancy) ? SMACAState.rawData.occupancy : (filteredData.occupancy || []);
  if (occupancyCounter && occupancyRows.length > 0) {
    const latestIn = sumLatestMetricAcrossSensors(occupancyRows, 'people_in');
    const latestOut = sumLatestMetricAcrossSensors(occupancyRows, 'people_out');
    const activity = Number(latestIn || 0) + Number(latestOut || 0);
    occupancyCounter.textContent = String(Math.max(0, Math.round(activity)));
  } else if (occupancyCounter) {
    occupancyCounter.textContent = 'No occupancy data available';
  }
  const occupancySection = document.getElementById('occupancy');
  if (occupancySection) {
    const cumulativeLabelEl = occupancySection.querySelector('.card .card__body div div div:nth-child(3)');
    if (cumulativeLabelEl && occupancyRows.length > 0) {
      const totalEntries = sumLatestMetricAcrossSensors(occupancyRows, 'people_total_in');
      const totalExits = sumLatestMetricAcrossSensors(occupancyRows, 'people_total_out');
      cumulativeLabelEl.textContent = `Cumulative Entries: ${Number.isFinite(Number(totalEntries)) ? Math.round(Number(totalEntries)) : 'N/A'} | Cumulative Exits: ${Number.isFinite(Number(totalExits)) ? Math.round(Number(totalExits)) : 'N/A'}`;
    }
  }
  
  // Update Energy daily consumption
  const energyCounter = document.getElementById('energy-daily-consumption');
  if (energyCounter) {
    const energyRows = Array.isArray(SMACAState.rawData?.energy) ? SMACAState.rawData.energy : (filteredData.energy || []);
    const totalDelta = getAggregatedEnergyForTimeframe(energyRows);
    energyCounter.textContent = energyRows.length > 0 ? totalDelta.toFixed(1) : 'No data';
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
  const environmentalRows = Array.isArray(SMACAState.rawData?.environmental) ? SMACAState.rawData.environmental : (filteredData.environmental || []);
  if (uvCounter && environmentalRows.length > 0) {
    const uvValue = getAggregatedAverage(getLatestValidMetricPerSensor(environmentalRows, 'uv_index'));
    uvCounter.textContent = Number.isFinite(Number(uvValue)) ? Number(uvValue).toFixed(1) : 'Unsupported by device';
  } else if (uvCounter) {
    uvCounter.textContent = 'No UV data available';
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
