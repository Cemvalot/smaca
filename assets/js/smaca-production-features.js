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
}

function logSmacaSectionSelections(selections) {
}

function logSmacaFetchedPoints(pointsByMetric) {
}

function logSmacaHydratedState(lengths) {
}

const SMACA_PAGE_BUCKETS = {
  overview: ['iaq', 'occupancy', 'environmental', 'connectivity'],
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

const SMACA_DEBUG_ENABLED = typeof window !== 'undefined' && window.SMACA_DEBUG === true;
function smacaDebug() {
  if (!SMACA_DEBUG_ENABLED || typeof console === 'undefined' || typeof console.debug !== 'function') return;
  console.debug.apply(console, arguments);
}


function smacaT(key, fallback) {
  const map = (typeof window !== 'undefined' && window.SMACA_TRANSLATIONS) ? window.SMACA_TRANSLATIONS : null;
  if (map && Object.prototype.hasOwnProperty.call(map, key) && map[key] !== undefined && map[key] !== null && map[key] !== '') {
    return map[key];
  }
  return fallback;
}

function runWhenBrowserIdle(callback, timeoutMs) {
  if (typeof callback !== 'function') return;
  const timeout = Number.isFinite(timeoutMs) ? timeoutMs : 180;
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(function () { callback(); }, { timeout: timeout });
    return;
  }
  setTimeout(callback, Math.min(timeout, 180));
}

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
  return page === 'connectivity' || page === 'management';
}

function getCachedTimeseriesKey(sensorId, timeframe, bucket, metric) {
  return [String(sensorId), String(timeframe || '24h'), String(bucket), String(metric)].join('|');
}

function clearSmacaTimeseriesCache() {
  SMACA_TS_CACHE.timeseries = {};
  SMACA_TS_CACHE.latest = {};
  SMACA_TS_CACHE.render = {};
}

const SMACA_CHART_HOUR_MS = 60 * 60 * 1000;
const SMACA_CHART_DAY_MS = 24 * SMACA_CHART_HOUR_MS;

function getSmacaOperationalDayStartMs(atMs) {
  const ref = Number.isFinite(atMs) ? new Date(atMs) : new Date();
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0).getTime();
}

function getSmacaOperationalCurrentHourIndex(bucketTimesMs, nowMs) {
  if (!Array.isArray(bucketTimesMs) || !bucketTimesMs.length || !Number.isFinite(nowMs)) return -1;
  let idx = -1;
  for (let i = 0; i < bucketTimesMs.length; i++) {
    const bucketStart = Number(bucketTimesMs[i]);
    if (!Number.isFinite(bucketStart) || bucketStart > nowMs) break;
    idx = i;
  }
  return idx;
}

function getSmacaLineChartWindow(timeframe) {
  const tf = timeframe || '24h';
  const now = Date.now();
  if (tf === '24h') {
    const dayStartLocal = getSmacaOperationalDayStartMs(now);
    const dayEndLocal = dayStartLocal + (24 * SMACA_CHART_HOUR_MS) - 1;
    const bucketCount = 24;
    const bucketTimesMs = Array.from({ length: bucketCount }, function (_, idx) {
      return dayStartLocal + (idx * SMACA_CHART_HOUR_MS);
    });
    return {
      timeframe: '24h',
      bucketMs: SMACA_CHART_HOUR_MS,
      bucketCount: bucketCount,
      bucketTimesMs: bucketTimesMs,
      rangeStartMs: dayStartLocal,
      rangeEndMs: Math.min(now, dayEndLocal),
      operationalDay: true
    };
  }

  const days = tf === '7d' ? 7 : 30;
  const alignedEndBucketMs = Math.floor(now / SMACA_CHART_DAY_MS) * SMACA_CHART_DAY_MS;
  const bucketTimesMs = Array.from({ length: days }, function (_, idx) {
    return alignedEndBucketMs - (days - 1 - idx) * SMACA_CHART_DAY_MS;
  });
  return {
    timeframe: tf,
    bucketMs: SMACA_CHART_DAY_MS,
    bucketCount: days,
    bucketTimesMs: bucketTimesMs,
    rangeStartMs: bucketTimesMs[0],
    rangeEndMs: now
  };
}

function getSmacaOccupancyFlowWindow(timeframe) {
  const tf = timeframe || '24h';
  const now = new Date();
  if (tf === '24h') {
    const dayStartLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const bucketCount = 24;
    const bucketTimesMs = Array.from({ length: bucketCount }, function (_, idx) {
      return dayStartLocal + (idx * SMACA_CHART_HOUR_MS);
    });
    return {
      timeframe: '24h',
      bucketMs: SMACA_CHART_HOUR_MS,
      bucketCount: bucketCount,
      bucketTimesMs: bucketTimesMs,
      rangeStartMs: dayStartLocal,
      rangeEndMs: dayStartLocal + (24 * SMACA_CHART_HOUR_MS) - 1
    };
  }

  if (tf === '7d') {
    const todayLocalStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const weekStartLocal = todayLocalStart - (6 * SMACA_CHART_DAY_MS);
    const bucketTimesMs = Array.from({ length: 7 }, function (_, idx) {
      return weekStartLocal + (idx * SMACA_CHART_DAY_MS);
    });
    return {
      timeframe: '7d',
      bucketMs: SMACA_CHART_DAY_MS,
      bucketCount: 7,
      bucketTimesMs: bucketTimesMs,
      rangeStartMs: weekStartLocal,
      rangeEndMs: weekStartLocal + (7 * SMACA_CHART_DAY_MS) - 1
    };
  }

  const monthStartLocal = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
  const nextMonthStartLocal = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
  const monthDays = Math.max(1, Math.round((nextMonthStartLocal - monthStartLocal) / SMACA_CHART_DAY_MS));
  const bucketTimesMs = Array.from({ length: monthDays }, function (_, idx) {
    return monthStartLocal + (idx * SMACA_CHART_DAY_MS);
  });
  return {
    timeframe: tf,
    bucketMs: SMACA_CHART_DAY_MS,
    bucketCount: monthDays,
    bucketTimesMs: bucketTimesMs,
    rangeStartMs: monthStartLocal,
    rangeEndMs: nextMonthStartLocal - 1
  };
}

function parseSmacaRowTimeMs(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const raw = String(value).trim();
  if (!raw) return NaN;
  const hasTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(raw);
  const normalized = hasTz ? raw : raw.replace(' ', 'T') + 'Z';
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : NaN;
}

function resolveSmacaChartBucketKey(timeMs, chartWindow) {
  if (!chartWindow || !Number.isFinite(timeMs)) return null;
  const bucketTimes = Array.isArray(chartWindow.bucketTimesMs) ? chartWindow.bucketTimesMs : [];
  if (!bucketTimes.length) return null;
  const bucketMs = Number(chartWindow.bucketMs) || SMACA_CHART_HOUR_MS;
  for (let i = 0; i < bucketTimes.length; i += 1) {
    const start = Number(bucketTimes[i]);
    const end = start + bucketMs;
    if (timeMs >= start && timeMs < end) return start;
  }
  return null;
}

function getOverviewModuleRows(module, filteredData, timeframe) {
  const state = typeof SMACAState !== 'undefined' ? SMACAState : null;
  const raw = state && Array.isArray(state.rawData?.[module]) ? state.rawData[module] : [];
  if (state && typeof state.filterByTimeframe === 'function' && raw.length) {
    return state.filterByTimeframe(raw, timeframe);
  }
  const fallback = filteredData && filteredData[module];
  return Array.isArray(fallback) ? fallback : raw;
}

function resolveOverviewMetricValue(row, metricKey) {
  const obj = row?.payload?.object || row?.object || row?.payload || {};
  const aliases = {
    co2: ['co2', 'co2_ppm'],
    uv_index: ['uv_index', 'modbus_chn_1', 'uv']
  };
  const keys = aliases[metricKey] || [metricKey];
  for (let i = 0; i < keys.length; i += 1) {
    const value = Number(obj[keys[i]]);
    if (Number.isFinite(value)) return value;
  }
  return NaN;
}

function formatSmacaChartAxisLabel(timestampMs, timeframe) {
  const date = new Date(timestampMs);
  if (!Number.isFinite(date.getTime())) return '';
  if (timeframe === '24h') {
    const h = date.getHours();
    return String(h).padStart(2, '0') + ':00';
  }
  if (timeframe === '7d') {
    return date.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

function getSmacaHighchartsAxisBounds(chartWindow) {
  if (!chartWindow || !Array.isArray(chartWindow.bucketTimesMs) || !chartWindow.bucketTimesMs.length) {
    return {};
  }
  const first = chartWindow.bucketTimesMs[0];
  if (chartWindow.timeframe === '24h' && chartWindow.operationalDay) {
    return {
      min: first,
      max: first + (24 * SMACA_CHART_HOUR_MS)
    };
  }
  const last = chartWindow.bucketTimesMs[chartWindow.bucketTimesMs.length - 1];
  return {
    min: first,
    max: last + chartWindow.bucketMs
  };
}

if (typeof window !== 'undefined') {
  window.SMACAChartTime = {
    getLineChartWindow: getSmacaLineChartWindow,
    getOperationalDayStartMs: getSmacaOperationalDayStartMs,
    resolveBucketKey: resolveSmacaChartBucketKey,
    formatAxisLabel: formatSmacaChartAxisLabel,
    getHighchartsAxisBounds: getSmacaHighchartsAxisBounds
  };
}

function setSectionLoadingState(sectionId, isLoading) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.style.opacity = '1';
}

function setDashboardLoadingMessage(message) {
  const messageEl = document.getElementById('smaca-page-loading-message');
  if (!messageEl) return;
  messageEl.textContent = message || smacaT('loading_data','Loading data...');
}

function showDashboardLoadingOverlay(pageName) {
  const overlay = document.getElementById('smaca-page-loading-overlay');
  if (!overlay) return;
  setDashboardLoadingMessage(smacaT('loading_data','Loading data...'));
  overlay.classList.add('is-visible');
  overlay.setAttribute('aria-hidden', 'false');
  if ((pageName || getSmacaCurrentPage()) === 'iaq') {
  }
}

function hideDashboardLoadingOverlay(pageName) {
  const overlay = document.getElementById('smaca-page-loading-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-visible');
  overlay.setAttribute('aria-hidden', 'true');
  if ((pageName || getSmacaCurrentPage()) === 'iaq') {
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

// Show or hide a small "sparse data" hint above a chart container when the
// values populate only a tiny slice of the timeframe. The note prevents
// 30d charts from looking like they pile data on the far right without
// telling the user that the rest of the window genuinely had no readings.
//   - `valuesWithData` is the count of buckets that have a real value.
//   - `totalBuckets` is the total bucket count in the timeframe.
// We only show the hint when there is some data AND less than 35% of
// buckets are populated. The hint is appended once per chart container and
// auto-removed when the chart re-renders into a non-sparse state.
function renderSparseDataNote(containerId, valuesWithData, totalBuckets, timeframe) {
  const el = document.getElementById(containerId);
  if (!el || !el.parentNode) return;
  const noteId = containerId + '__sparse-note';
  const existing = document.getElementById(noteId);
  const total = Number(totalBuckets) || 0;
  const populated = Number(valuesWithData) || 0;
  const ratio = total > 0 ? (populated / total) : 0;
  const isSparse = total >= 7 && populated > 0 && ratio < 0.35;
  if (!isSparse) {
    if (existing) existing.remove();
    return;
  }
  const window_ = (typeof window !== 'undefined') ? window : null;
  const tfText = timeframe === '7d' ? smacaT('last_7_days', 'last 7 days')
              : timeframe === '30d' ? smacaT('last_30_days', 'last 30 days')
              : smacaT('selected_window', 'selected window');
  const html =
    '<div style="display:flex;align-items:center;gap:8px;margin:0 0 var(--space-2);' +
    'padding:6px 10px;border-radius:8px;font-size:11px;color:#cbd5e1;' +
    'background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 9v4"/><path d="M12 17h.01"/>' +
        '<path d="M10.3 3.7L1.5 19a2 2 0 001.7 3h17.6a2 2 0 001.7-3L13.7 3.7a2 2 0 00-3.4 0z"/>' +
      '</svg>' +
      '<span><strong style="color:#fbbf24;">' +
        smacaT('sparse_data', 'Sparse data') +
      '</strong> · ' +
      smacaT('sparse_data_explain', 'Only ') +
      populated + '/' + total + ' ' +
      smacaT('buckets_have_data', 'buckets have data — empty stretches reflect missing readings, not chart errors.') +
      ' (' + tfText + ')' +
      '</span>' +
    '</div>';
  if (existing) {
    existing.innerHTML = html;
  } else {
    const note = document.createElement('div');
    note.id = noteId;
    note.className = 'smaca-sparse-data-note';
    note.innerHTML = html;
    el.parentNode.insertBefore(note, el);
  }
}

function renderEmptyState(containerId, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const adapter = typeof window !== 'undefined' ? window.SMACAHighchartsAdapter : null;
  if (adapter && typeof adapter.destroyChartsInContainer === 'function') {
    adapter.destroyChartsInContainer(containerId);
  }
  el.style.flex = '0 0 auto';
  el.style.overflow = 'hidden';
  if (containerId === 'uv-daily-comparison-chart' || containerId === 'uv-main-chart' || containerId === 'uv-pattern-chart') {
    el.style.height = '260px';
    el.style.minHeight = '260px';
    el.style.maxHeight = '260px';
  } else {
    el.style.height = '';
    el.style.minHeight = '';
    el.style.maxHeight = '';
  }
  const text = message || smacaT('no_data_available','No data available');
  // Designed empty-state: a centred dim icon + headline + reason, instead
  // of a bare blank Highcharts area. Keeps the dark SMACA look-and-feel
  // and gives the user a visible reason when no data is available.
  el.innerHTML =
    '<div class="smaca-chart-empty" role="status" aria-live="polite"' +
    ' style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:8px;min-height:180px;padding:24px 16px;color:var(--muted);text-align:center;' +
    'border:1px dashed rgba(148,163,184,0.18);border-radius:12px;' +
    'background:rgba(15,23,42,0.35);">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      ' style="opacity:0.55;">' +
        '<rect x="3" y="3" width="18" height="18" rx="3"/>' +
        '<line x1="9" y1="9" x2="15" y2="9"/>' +
        '<line x1="9" y1="13" x2="15" y2="13"/>' +
        '<line x1="9" y1="17" x2="13" y2="17"/>' +
      '</svg>' +
      '<div style="font-size:12px;font-weight:600;letter-spacing:0.02em;color:rgba(226,232,240,0.85);">' +
        smacaT('no_data_available','No data available') +
      '</div>' +
      '<div style="font-size:11px;color:rgba(148,163,184,0.85);max-width:360px;">' + text + '</div>' +
    '</div>';
}

function renderCurrentPageFailureState(page) {
  if (page === 'occupancy') {
    renderEmptyState('occupancy-flow-chart', 'No occupancy data available');
    renderEmptyState('occupancy-density-timeline', 'No occupancy data available');
  }
  if (page === 'environmental') {
    renderEmptyState('uv-main-chart', 'No UV data available');
    renderEmptyState('uv-pattern-chart', 'No UV data available');
    renderEmptyState('uv-daily-comparison-chart', 'No UV data available');
  }
  if (page === 'energy') {
    renderEmptyState('energy-correlation-chart', smacaT('no_data_available','No data available'));
  }
  if (page === 'iaq') {
    renderEmptyState('iaq-co2-band-chart', smacaT('no_data_available','No data available'));
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
  if (typeof window !== 'undefined') {
    window.SMACA_DISABLE_AUTO_REFRESH = getSmacaCurrentPage() === 'occupancy';
    if (!window.SMACA_DISABLE_AUTO_REFRESH) {
      window.__smacaOccupancyLastRefresh = null;
    }
  }
  // API-first initialization for production dashboard data.
  await initializeStateFromApi();

  if (typeof window.SMACAHighchartsLoader !== 'undefined'
    && typeof window.SMACAHighchartsLoader.load === 'function') {
    try {
      await window.SMACAHighchartsLoader.load();
    } catch (e) {
      smacaDebug('[SMACA] Highcharts preload failed; chart tiles may use fallbacks', e);
    }
  }

  // Setup time range selector
  setupTimeRangeSelector();
  
  // Setup export button
  setupExportButton();
  
  // Setup system health badge
  updateSystemHealthBadge();
  
  // Setup alerts panel after core content is interactive.
  runWhenBrowserIdle(function () {
    updateAlertsPanel();
  }, 220);
  
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
    energy: typeof SMACAState.getFilteredEnergy === 'function' ? SMACAState.getFilteredEnergy() : [],
    connectivity: typeof SMACAState.getFilteredConnectivity === 'function' ? SMACAState.getFilteredConnectivity() : [],
    connectivity: typeof SMACAState.getFilteredConnectivity === 'function' ? SMACAState.getFilteredConnectivity() : []
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
  const iaqSensors = getDetectedIaqSensors();
  const iaqSensorIds = iaqSensors.map(function (sensor) { return Number(sensor?.id); }).filter(Number.isFinite);
  const iaqSensorNames = iaqSensors.map(function (sensor) { return getPrimarySensorTypeName(sensor) || `Sensor ${sensor?.id || 'Unknown'}`; });
  const isVisible = !!iaqSection && iaqSection.style.display !== 'none';
  const pointsCount = Array.isArray(filteredIAQ) ? filteredIAQ.length : 0;
  if (!iaqSection || !chartContainer) return;
  if (iaqSensorIds.length === 0) {
    renderEmptyState('iaq-co2-band-chart', 'No IAQ sensors available');
    if (kpiContainer) {
      kpiContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: var(--space-4); color: var(--muted);">No IAQ sensors available</div>';
    }
    if (typeof hideDashboardLoadingOverlay === 'function') {
      hideDashboardLoadingOverlay('iaq');
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

  const forceRefresh = reason === 'sensor-selected-api'
    || reason === 'sensor-selected-event'
    || reason === 'section-visible';
  if (typeof initAccurateIAQDashboard === 'function') {
    initAccurateIAQDashboard(forceRefresh);
  } else {
    // Backward-compatible fallback if advanced IAQ renderer is unavailable.
    updateIAQDashboardWithTrends(filteredIAQ, SMACAState.currentTimeframe);
  }
}

async function initializeStateFromApi() {
  const canUseApi = typeof window !== 'undefined' && window.SMACAApi;
  if (!canUseApi) {
    applyHydratedState({ iaq: [], occupancy: [], environmental: [], energy: [], connectivity: [] });
    return;
  }

  try {
    const apiResults = await Promise.allSettled([
      window.SMACAApi.fetchDashboardOverview(),
      window.SMACAApi.fetchSensors()
    ]);
    const overviewResult = apiResults[0];
    const sensorsResult = apiResults[1];
    const overview = overviewResult?.status === 'fulfilled' ? overviewResult.value : null;
    const sensorsPayload = sensorsResult?.status === 'fulfilled' ? sensorsResult.value : { rows: [] };
    const sensors = Array.isArray(sensorsPayload?.rows) ? sensorsPayload.rows : [];

    if (overviewResult?.status === 'rejected') {
      console.warn('SMACA dashboard overview request failed during initialization:', overviewResult.reason);
    }
    if (sensorsResult?.status === 'rejected') {
      console.warn('SMACA sensors request failed during initialization:', sensorsResult.reason);
    }

    if (!overview && sensors.length === 0) {
      throw overviewResult?.reason || sensorsResult?.reason || new Error('Unable to initialize SMACA API state.');
    }

    hydrateLegacySensorsForUi(sensors, overview);
    if (typeof window !== 'undefined') {
      window.SMACADashboardContext.overview = overview || null;
      window.SMACADashboardContext.sensors = sensors;
    }
    updateOverviewCountersFromApi(overview, sensors);

    const selectedSensorId = chooseDefaultSensorIdFromSnapshots(overview, sensors);
    if (!Number.isFinite(Number(selectedSensorId))) {
      // No sensors yet; keep state empty but valid.
      applyHydratedState({ iaq: [], occupancy: [], environmental: [], energy: [], connectivity: [] });
      return;
    }

    await setCurrentSensorAndReload(selectedSensorId, {
      forceRefresh: true,
      prefetchedOverview: overview,
      prefetchedSensors: sensors
    });
    setupSensorSelectionListeners();
  } catch (error) {
    console.error('SMACA API initialization failed:', error);
    applyHydratedState({ iaq: [], occupancy: [], environmental: [], energy: [], connectivity: [] });
  }
}

const SMACA_SECTION_METRICS = {
  iaq: ['co2_ppm', 'temperature_c', 'humidity_rh', 'pm2_5_ugm3', 'pm10_ugm3', 'tvoc_index', 'battery_pct'],
  occupancy: ['people_in', 'people_out', 'people_total_in', 'people_total_out'],
  environmental: ['uv_index'],
  energy: ['energy_kwh'],
  connectivity: ['signal_strength', 'snr', 'tx_ccq', 'tx_rate']
};

function sensorHasWirelessMetrics(sensor) {
  if (!sensor) return false;
  var latest = sensor.latest_snapshot || sensor.latest || {};
  if (typeof window !== 'undefined' && window.SMACA_TELEMETRY_METRIC_NORMALIZE && typeof window.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest === 'function') {
    latest = window.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest(latest);
  }
  if (typeof window !== 'undefined' && window.SMACA_CONNECTIVITY_QUALITY && typeof window.SMACA_CONNECTIVITY_QUALITY.hasConnectivityMetrics === 'function') {
    return window.SMACA_CONNECTIVITY_QUALITY.hasConnectivityMetrics(latest);
  }
  return latest.rssi !== null && latest.rssi !== undefined
    || latest.signal_strength !== null && latest.signal_strength !== undefined
    || latest.snr !== null && latest.snr !== undefined
    || latest.tx_ccq !== null && latest.tx_ccq !== undefined
    || latest.tx_rate !== null && latest.tx_rate !== undefined;
}

function connectivityBandToScore(bandKey) {
  var map = { excellent: 100, very_good: 85, good_usable: 70, weak_unstable: 45, bad: 20 };
  return map[bandKey] !== undefined ? map[bandKey] : null;
}

function connectivityMetricsFromRow(row) {
  var obj = row && row.payload && row.payload.object ? row.payload.object : (row || {});
  if (typeof window !== 'undefined' && window.SMACA_TELEMETRY_METRIC_NORMALIZE && typeof window.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest === 'function') {
    obj = window.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest(obj);
  }
  return {
    rssi: obj.rssi !== undefined && obj.rssi !== null ? Number(obj.rssi) : (obj.signal_strength != null ? Number(obj.signal_strength) : null),
    snr: obj.snr != null ? Number(obj.snr) : null,
    tx_ccq: obj.tx_ccq != null ? Number(obj.tx_ccq) : null,
    tx_rate: obj.tx_rate != null ? Number(obj.tx_rate) : null
  };
}

function resolveCampusConnectivityQualityPct(sensors) {
  var list = Array.isArray(sensors) ? sensors.filter(sensorHasWirelessMetrics) : [];
  if (!list.length || typeof window === 'undefined' || !window.SMACA_CONNECTIVITY_QUALITY) return null;
  var sums = { rssi: [], snr: [], tx_ccq: [], tx_rate: [] };
  list.forEach(function (sensor) {
    var latest = sensor.latest_snapshot || sensor.latest || {};
    var m = connectivityMetricsFromRow({ payload: { object: latest } });
    if (Number.isFinite(m.rssi)) sums.rssi.push(m.rssi);
    if (Number.isFinite(m.snr)) sums.snr.push(m.snr);
    if (Number.isFinite(m.tx_ccq)) sums.tx_ccq.push(m.tx_ccq);
    if (Number.isFinite(m.tx_rate)) sums.tx_rate.push(m.tx_rate);
  });
  function avg(arr) {
    if (!arr.length) return null;
    return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
  }
  var overall = window.SMACA_CONNECTIVITY_QUALITY.classifyOverall({
    rssi: avg(sums.rssi),
    snr: avg(sums.snr),
    tx_ccq: avg(sums.tx_ccq),
    tx_rate: avg(sums.tx_rate)
  });
  var band = (overall && (overall.dominant_band || overall.overall_band)) || null;
  return band ? connectivityBandToScore(band) : null;
}

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

function buildBucketSensorIds(currentPage, bucket, selectedBySection, iaqSensorIds, occupancySensorIds, allSensorIds) {
  const selected = selectedBySection || {};
  const allIds = Array.isArray(allSensorIds) ? allSensorIds.filter(Number.isFinite) : [];
  const iaqIds = Array.isArray(iaqSensorIds) ? iaqSensorIds.filter(Number.isFinite) : [];
  const occupancyIds = Array.isArray(occupancySensorIds) ? occupancySensorIds.filter(Number.isFinite) : [];

  // Keep overview lightweight by sampling representative sensors per module.
  if (currentPage === 'overview') {
    if (bucket === 'iaq') {
      const prioritized = [];
      const selectedIaq = Number(selected.iaq);
      if (Number.isFinite(selectedIaq)) prioritized.push(selectedIaq);
      iaqIds.slice(0, 2).forEach(function (id) {
        if (!prioritized.includes(id)) prioritized.push(id);
      });
      return prioritized;
    }
    if (bucket === 'occupancy') {
      return occupancyIds.length > 0 ? occupancyIds : [];
    }
    if (bucket === 'connectivity') {
      var wirelessIds = (Array.isArray(allSensorIds) ? allSensorIds : [])
        .filter(function (id) {
          var sensor = (window.SMACADashboardContext && window.SMACADashboardContext.sensors || [])
            .find(function (s) { return Number(s && s.id) === id; });
          return sensorHasWirelessMetrics(sensor);
        });
      return wirelessIds.slice(0, 3);
    }

    const selectedSensorId = Number(selected[bucket]);
    return Number.isFinite(selectedSensorId) ? [selectedSensorId] : [];
  }

  if (bucket === 'iaq') return iaqIds;
  return allIds;
}

async function refreshDashboardForSelection(sensorId, timeframe, options) {
  const canonicalSensorId = Number(sensorId);
  const tf = timeframe || SMACAState.currentTimeframe || '24h';
  const opts = options || {};
  const forceRefresh = opts.forceRefresh === true;
  const currentPage = getSmacaCurrentPage();
  const disableAutoRefreshForOccupancy = currentPage === 'occupancy' && typeof window !== 'undefined' && window.SMACA_DISABLE_AUTO_REFRESH === true;
  const occupancyLastRefresh = (typeof window !== 'undefined' && window.__smacaOccupancyLastRefresh)
    ? window.__smacaOccupancyLastRefresh
    : null;
  if (
    disableAutoRefreshForOccupancy &&
    !forceRefresh &&
    occupancyLastRefresh &&
    occupancyLastRefresh.timeframe === tf &&
    occupancyLastRefresh.sensorId === (Number.isFinite(canonicalSensorId) ? canonicalSensorId : null)
  ) {
    // Occupancy page is load-once by design unless timeframe changes or full page reload.
    return;
  }
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
  setCurrentPageLoadingState(true);
  let refreshSucceeded = false;

  try {
    const prefetchedOverview = opts.prefetchedOverview || null;
    const prefetchedSensors = Array.isArray(opts.prefetchedSensors) ? opts.prefetchedSensors : null;
    const cachedContextOverview = window.SMACADashboardContext?.overview || null;
    const cachedContextSensors = Array.isArray(window.SMACADashboardContext?.sensors)
      ? window.SMACADashboardContext.sensors
      : null;
    const canReuseCachedContext = !forceRefresh && !!cachedContextOverview && Array.isArray(cachedContextSensors) && cachedContextSensors.length > 0;

    let overview;
    let sensors;
    if (prefetchedOverview && prefetchedSensors) {
      overview = prefetchedOverview;
      sensors = prefetchedSensors;
    } else if (canReuseCachedContext) {
      overview = cachedContextOverview;
      sensors = cachedContextSensors;
    } else {
      const apiResults = await Promise.allSettled([
        window.SMACAApi.fetchDashboardOverview(),
        window.SMACAApi.fetchSensors()
      ]);
      const overviewResult = apiResults[0];
      const sensorsResult = apiResults[1];
      overview = overviewResult?.status === 'fulfilled' ? overviewResult.value : null;
      const sensorsPayload = sensorsResult?.status === 'fulfilled' ? sensorsResult.value : { rows: [] };
      sensors = Array.isArray(sensorsPayload?.rows) ? sensorsPayload.rows : [];

      if (overviewResult?.status === 'rejected') {
        console.warn('SMACA dashboard overview request failed during refresh:', overviewResult.reason);
      }
      if (sensorsResult?.status === 'rejected') {
        console.warn('SMACA sensors request failed during refresh:', sensorsResult.reason);
      }
      if (!overview && sensors.length === 0) {
        throw overviewResult?.reason || sensorsResult?.reason || new Error('Unable to refresh SMACA dashboard data.');
      }
    }
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
    const iaqSensors = sensors.filter(isIaqSensor);
    const iaqSensorIds = iaqSensors
      .map(function (sensor) { return Number(sensor?.id); })
      .filter(Number.isFinite);
    const occupancySensorIds = sensors
      .filter(isOccupancySensor)
      .map(function (sensor) { return Number(sensor?.id); })
      .filter(Number.isFinite);

    const bucketFetchers = {
      iaq: function () {
        const prioritizedIds = buildBucketSensorIds(currentPage, 'iaq', selectedBySection, iaqSensorIds, occupancySensorIds, allSensorIds);
        const remainingIaqIds = iaqSensorIds.filter(function (id) { return !prioritizedIds.includes(id); });
        return fetchAndMapTimeseriesForSensors(prioritizedIds, tf, SMACA_SECTION_METRICS.iaq, 'iaq', forceRefresh)
          .then(function (result) {
            if (Array.isArray(result?.items) && result.items.length > 0) return result;
            if (remainingIaqIds.length === 0) return result;
            return fetchAndMapTimeseriesForSensors(iaqSensorIds, tf, SMACA_SECTION_METRICS.iaq, 'iaq', forceRefresh);
          });
      },
      occupancy: function () {
        const ids = buildBucketSensorIds(currentPage, 'occupancy', selectedBySection, iaqSensorIds, occupancySensorIds, allSensorIds);
        return fetchAndMapTimeseriesForSensors(ids, tf, SMACA_SECTION_METRICS.occupancy, 'occupancy', forceRefresh);
      },
      environmental: function () {
        const ids = buildBucketSensorIds(currentPage, 'environmental', selectedBySection, iaqSensorIds, occupancySensorIds, allSensorIds);
        return fetchAndMapTimeseriesForSensors(ids, tf, SMACA_SECTION_METRICS.environmental, 'environmental', forceRefresh);
      },
      energy: function () {
        const ids = buildBucketSensorIds(currentPage, 'energy', selectedBySection, iaqSensorIds, occupancySensorIds, allSensorIds);
        return fetchAndMapTimeseriesForSensors(ids, tf, SMACA_SECTION_METRICS.energy, 'energy', forceRefresh);
      },
      connectivity: function () {
        const ids = buildBucketSensorIds(currentPage, 'connectivity', selectedBySection, iaqSensorIds, occupancySensorIds, allSensorIds);
        return fetchAndMapTimeseriesForSensors(ids, tf, SMACA_SECTION_METRICS.connectivity, 'connectivity', forceRefresh);
      }
    };

    const fetchTasks = requiredBuckets.map(function (bucket) {
      const fn = bucketFetchers[bucket];
      if (!fn) return Promise.resolve({ bucket: bucket, items: [] });
      return fn().then(function (result) {
        return { bucket: bucket, items: result.items || [] };
      });
    });
    const fetchedBuckets = await Promise.all(fetchTasks);

    const nextHydratedState = {
      iaq: [],
      occupancy: [],
      environmental: [],
      energy: [],
      connectivity: []
    };
    fetchedBuckets.forEach(function (bucketPayload) {
      if (nextHydratedState[bucketPayload.bucket] !== undefined) {
        nextHydratedState[bucketPayload.bucket] = Array.isArray(bucketPayload.items) ? bucketPayload.items : [];
      }
    });
    applyHydratedState(nextHydratedState, true);

    if (shouldHydrateLatestRows) {
      await hydrateSensorLatestRowsForUi(sensors, forceRefresh);
    }
    if (currentPage === 'connectivity' && window.SMACAConnectivityDashboard && typeof window.SMACAConnectivityDashboard.refresh === 'function') {
      window.SMACAConnectivityDashboard.refresh();
    }
    if (currentPage === 'management' && document.getElementById('sensors-management-table-body')) {
      renderManagementSensorsFromLiveData();
    }
    refreshSucceeded = true;
  } catch (error) {
    renderCurrentPageFailureState(currentPage);
    throw error;
  } finally {
    setCurrentPageLoadingState(false);
  }
  if (disableAutoRefreshForOccupancy && typeof window !== 'undefined' && refreshSucceeded) {
    window.__smacaOccupancyLastRefresh = {
      timeframe: tf,
      sensorId: Number.isFinite(canonicalSensorId) ? canonicalSensorId : null
    };
  }
  if (refreshSucceeded) {
    if (SMACAState.currentTimeframe !== tf) {
      SMACAState.setTimeframe(tf);
    } else {
      SMACAState.invalidateFilteredCache();
      SMACAState.notifyListeners();
    }
  }
}

if (typeof window !== 'undefined') {
  window.__smacaRefreshDashboardForSelection = refreshDashboardForSelection;
  window.SMACA_PAGE_BUCKETS = SMACA_PAGE_BUCKETS;
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
  const norm = (typeof window !== 'undefined' && window.SMACA_TELEMETRY_METRIC_NORMALIZE?.normalizeLatest)
    ? window.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest(latest)
    : latest;
  const rssiVal = norm?.rssi ?? norm?.signal_strength ?? null;
  const snrVal = norm?.snr ?? null;
  const txCcqVal = norm?.tx_ccq ?? null;
  const txRateVal = norm?.tx_rate ?? null;
  let overallLabel = null;
  if (typeof window !== 'undefined' && window.SMACA_CONNECTIVITY_QUALITY?.classifyOverall) {
    const overall = window.SMACA_CONNECTIVITY_QUALITY.classifyOverall({
      rssi: rssiVal,
      snr: snrVal,
      tx_ccq: txCcqVal,
      tx_rate: txRateVal
    });
    overallLabel = overall?.overall_label ?? null;
  }
  return {
    id: Number(sensor?.id),
    location: sensor?.site?.name || sensor?.location || 'Not reported by sensor',
    status: isActive ? 'active' : 'inactive',
    battery: latest?.battery_pct ?? null,
    rssi: rssiVal ?? 'Not reported by sensor',
    snr: snrVal ?? 'Not reported by sensor',
    tx_ccq: txCcqVal ?? 'Not reported by sensor',
    tx_rate: txRateVal ?? 'Not reported by sensor',
    overallQuality: overallLabel,
    gatewayId: latest?.gateway_id ?? 'Not reported by sensor',
    lastSeenAt: latestRow?.last_seen_at || latest?.measured_at || sensor?.last_seen_at || null,
    deviceName: sensor?.name || latestRow?.name || `Sensor ${sensor?.id}`,
    deviceType: sensor?.device_type || latestRow?.device_type || 'Not reported by sensor',
    sensorUid: sensor?.sensor_uid || latestRow?.sensor_uid || 'Not reported by sensor'
  };
}

async function hydrateSensorLatestRowsForUi(sensors, forceRefresh) {
  const rows = Array.isArray(sensors) ? sensors : [];
  const validSensorIds = rows
    .map(function (sensor) { return Number(sensor?.id); })
    .filter(Number.isFinite);
  const latestById = {};
  const maxConcurrency = 8;

  for (let idx = 0; idx < validSensorIds.length; idx += maxConcurrency) {
    const batch = validSensorIds.slice(idx, idx + maxConcurrency);
    const batchResults = await Promise.all(batch.map(function (sensorId) {
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

    batchResults.forEach(function (item) {
      if (item && Number.isFinite(item.sensorId)) latestById[String(item.sensorId)] = item.row;
    });
  }

  if (typeof window !== 'undefined') {
    window.SMACADashboardContext.selectedSensorLatestById = latestById;
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

function isManagementSensorStale(sensor) {
  if (window.SMACASensorFreshness && typeof window.SMACASensorFreshness.isStale === 'function') {
    return window.SMACASensorFreshness.isStale(sensor);
  }
  const latest = sensor?.latest || sensor?.latest_snapshot || {};
  const lastSeen = latest?.measured_at || sensor?.last_seen_at || null;
  const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : NaN;
  return !Number.isFinite(lastSeenMs) || ((Date.now() - lastSeenMs) > (6 * 60 * 60 * 1000));
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
    const batteryInfo = getManagementBatteryDisplay(sensor, latest, latestRow);
    const batteryText = batteryInfo.text;
    const batteryClass = batteryInfo.className;
    const lastSeen = latestRow?.last_seen_at || latest?.measured_at || sensor?.last_seen_at || null;
    const lastSeenText = lastSeen ? new Date(lastSeen).toLocaleString() : 'No data for this sensor';
    const isStale = isManagementSensorStale(Object.assign({}, sensor, {
      last_seen_at: lastSeen,
      latest: latest && latest.measured_at ? latest : (sensor.latest || { measured_at: lastSeen })
    }));
    const sensorIdentifier = escapeSmacaHtml(sensor?.sensor_uid || sensor?.id || '');
    const rawSensorName = latestRow?.sensor_name || sensor?.sensor_name || latestRow?.name || sensor?.name || '';
    const displayTypeName = escapeSmacaHtml(rawSensorName || sensor?.device_type || 'Unknown');
    const rawLocationCode = latestRow?.sensor_location || sensor?.sensor_location || '';
    const locationLabel = (window.SMACASpatial && typeof window.SMACASpatial.labelFor === 'function')
      ? window.SMACASpatial.labelFor(rawLocationCode)
      : rawLocationCode;
    // Secondary raw code (e.g. "F1") is technical metadata — only show it for
    // admin/researcher views. Normal users/students see only the human label.
    const showRawCode = !!(window.SMACARole && typeof window.SMACARole.shouldShowTechnicalLabels === 'function'
      ? window.SMACARole.shouldShowTechnicalLabels()
      : false);
    const sensorLocationCell = rawLocationCode
      ? `<span>${escapeSmacaHtml(locationLabel || rawLocationCode)}</span>`
        + (showRawCode && rawLocationCode !== (locationLabel || '')
          ? ` <span style="font-size: var(--font-size-xs); color: var(--muted); font-family: monospace; margin-left: var(--space-1);">${escapeSmacaHtml(rawLocationCode)}</span>`
          : '')
      : escapeSmacaHtml('N/A');
    const batteryTextEscaped = escapeSmacaHtml(batteryText);
    const lastSeenEscaped = escapeSmacaHtml(lastSeenText);
    return `
      <tr class="${isStale ? 'management-sensor-row--stale' : ''}" style="border-bottom: 1px solid var(--border);">
        <td data-label="Device ID" style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text); font-family: monospace;">${sensorIdentifier}</td>
        <td data-label="Type" style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${displayTypeName}</td>
        <td data-label="Location" style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${sensorLocationCell}</td>
        <td data-label="Status" style="padding: var(--space-3) var(--space-4);"><span class="badge ${isActive ? 'badge--success' : 'badge--muted'} badge--sm">${isActive ? 'Live' : 'Inactive'}</span></td>
        <td data-label="Battery" style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm);" class="${batteryClass}">${batteryTextEscaped}</td>
        <td data-label="Last seen" style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${lastSeenEscaped}${isStale ? ' <span class="badge badge--warning badge--sm">Stale</span>' : ''}</td>
        <td data-label="Actions" style="padding: var(--space-3) var(--space-4);"><span style="font-size: var(--font-size-xs); color: var(--muted);">Read-only</span></td>
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

  const activeUsersTodayEl = document.getElementById('management-active-users-today');
  if (activeUsersTodayEl) {
    const activeUsers = Array.from(document.querySelectorAll('#users-management-table-body tr')).filter(function (row) {
      const statusCell = row.querySelector('td:nth-child(5)');
      const statusText = statusCell ? String(statusCell.textContent || '').trim().toLowerCase() : '';
      return statusText === 'active' || statusText === 'online';
    }).length;
    activeUsersTodayEl.textContent = String(activeUsers);
  }

  updateManagementAccessControlSummary();
  ensureManagementAccessControlSeed();
  ensureManagementUsersObserver();
  ensureManagementSettingsActions();
  updateManagementSystemHealth(sensors, latestById, activeSensors);
  updateManagementCriticalIssues(sensors, latestById, activeSensors, maintenanceSensors);
  updateManagementAdminMetaTicker();
}

function getManagementBatteryDisplay(sensor, latest, latestRow) {
  const rawBattery = Number(latest?.battery_pct);
  if (Number.isFinite(rawBattery) && rawBattery > 0) {
    return {
      text: String(Math.round(rawBattery)) + '%',
      className: rawBattery <= 20 ? 'management-battery--critical' : (rawBattery <= 40 ? 'management-battery--warning' : 'management-battery--healthy')
    };
  }

  const lastKnown = findLastKnownBatteryPct(sensor?.id);
  if (Number.isFinite(lastKnown) && lastKnown > 0) {
    return {
      text: 'Last known ' + String(Math.round(lastKnown)) + '%',
      className: lastKnown <= 20 ? 'management-battery--critical' : (lastKnown <= 40 ? 'management-battery--warning' : 'management-battery--healthy')
    };
  }

  if (isLikelyMainsPoweredSensor(sensor, latestRow)) {
    return {
      text: 'Powered',
      className: 'management-battery--powered'
    };
  }

  return {
    text: 'Not reported',
    className: ''
  };
}

function isLikelyMainsPoweredSensor(sensor, latestRow) {
  const descriptor = [
    sensor?.device_type,
    sensor?.name,
    sensor?.sensor_name,
    latestRow?.sensor_name
  ].filter(Boolean).join(' ').toLowerCase();
  return /(sdm|power|meter|mains|plug|grid|energy)/.test(descriptor);
}

function findLastKnownBatteryPct(sensorId) {
  if (!Number.isFinite(Number(sensorId))) return null;
  const rows = []
    .concat(Array.isArray(SMACAState?.rawData?.iaq) ? SMACAState.rawData.iaq : [])
    .concat(Array.isArray(SMACAState?.rawData?.occupancy) ? SMACAState.rawData.occupancy : [])
    .concat(Array.isArray(SMACAState?.rawData?.environmental) ? SMACAState.rawData.environmental : [])
    .concat(Array.isArray(SMACAState?.rawData?.energy) ? SMACAState.rawData.energy : []);
  let latestBattery = null;
  let latestTs = -Infinity;
  rows.forEach(function (row) {
    const sid = Number(row?.sensorId || row?.sensor_id);
    if (!Number.isFinite(sid) || sid !== Number(sensorId)) return;
    const battery = Number(row?.payload?.object?.battery_pct);
    if (!Number.isFinite(battery) || battery <= 0) return;
    const ts = new Date(row?.time || row?.timestamp || 0).getTime();
    if (!Number.isFinite(ts) || ts < latestTs) return;
    latestTs = ts;
    latestBattery = battery;
  });
  return latestBattery;
}

function updateManagementAccessControlSummary() {
  const rows = Array.from(document.querySelectorAll('#users-management-table-body tr'));
  const totalUsers = rows.length;
  let adminUsers = 0;
  let standardUsers = 0;
  let recentLogins = 0;
  const nowMs = Date.now();
  const roleCounts = {};

  rows.forEach(function (row) {
    const roleText = String((row.querySelector('td:nth-child(3)')?.textContent || 'user')).trim().toLowerCase();
    const lastLoginText = String((row.querySelector('td:nth-child(4)')?.textContent || '')).trim();
    const statusText = String((row.querySelector('td:nth-child(5)')?.textContent || '')).trim().toLowerCase();

    roleCounts[roleText] = (roleCounts[roleText] || 0) + 1;
    if (roleText === 'admin') adminUsers += 1;
    else if (roleText) standardUsers += 1;

    if (statusText === 'active' || statusText === 'online') recentLogins += 1;
    const parsed = new Date(lastLoginText).getTime();
    if (Number.isFinite(parsed) && (nowMs - parsed) <= (24 * 60 * 60 * 1000)) recentLogins += 1;
  });

  const totalEl = document.getElementById('access-total-users');
  if (totalEl) totalEl.textContent = String(totalUsers);
  const adminEl = document.getElementById('access-admin-users');
  if (adminEl) adminEl.textContent = String(adminUsers);
  const standardEl = document.getElementById('access-standard-users');
  if (standardEl) standardEl.textContent = String(Math.max(0, standardUsers));
  const recentEl = document.getElementById('access-recent-logins');
  if (recentEl) recentEl.textContent = String(Math.min(totalUsers, recentLogins));

  const roleSummaryEl = document.getElementById('access-role-summary');
  if (roleSummaryEl) {
    const roleEntries = Object.keys(roleCounts);
    if (!roleEntries.length) {
      roleSummaryEl.innerHTML = '<span class="badge badge--muted badge--sm">No role distribution yet</span>';
      return;
    }
    roleSummaryEl.innerHTML = roleEntries.map(function (role) {
      const roleName = escapeSmacaHtml(role || 'user');
      const count = Number(roleCounts[role] || 0);
      const cls = role === 'admin' ? 'badge--danger' : (role === 'viewer' ? 'badge--info' : 'badge--success');
      return '<span class="badge ' + cls + ' badge--sm" style="text-transform:none;">' + roleName + ': ' + count + '</span>';
    }).join('');
  }
}

function ensureManagementAccessControlSeed() {
  const tbody = document.getElementById('users-management-table-body');
  const emptyState = document.getElementById('users-empty-state');
  if (!tbody) return;
  if (tbody.children.length > 0) {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.slice(15).forEach(function (row) { row.remove(); });
    return;
  }
  const seededUsers = [
    { name: 'Maria Petrou', email: 'maria.petrou@smaca.io', role: 'admin', status: 'Active', lastLogin: '2026-04-17 09:22' },
    { name: 'John Markos', email: 'john.markos@smaca.io', role: 'user', status: 'Active', lastLogin: '2026-04-17 09:14' },
    { name: 'Elena Pappa', email: 'elena.pappa@smaca.io', role: 'user', status: 'Inactive', lastLogin: '2026-04-16 18:40' },
    { name: 'Nikos Arvanitis', email: 'nikos.arvanitis@smaca.io', role: 'user', status: 'Active', lastLogin: '2026-04-17 08:59' },
    { name: 'Anna Kouri', email: 'anna.kouri@smaca.io', role: 'admin', status: 'Active', lastLogin: '2026-04-17 08:51' },
    { name: 'Panos Georgiou', email: 'panos.georgiou@smaca.io', role: 'user', status: 'Active', lastLogin: '2026-04-17 08:44' },
    { name: 'Irene Vassiliou', email: 'irene.vassiliou@smaca.io', role: 'user', status: 'Inactive', lastLogin: '2026-04-15 16:33' },
    { name: 'George Papas', email: 'george.papas@smaca.io', role: 'admin', status: 'Active', lastLogin: '2026-04-17 08:20' },
    { name: 'Sofia Manta', email: 'sofia.manta@smaca.io', role: 'user', status: 'Active', lastLogin: '2026-04-17 08:10' },
    { name: 'Chris Ladas', email: 'chris.ladas@smaca.io', role: 'user', status: 'Active', lastLogin: '2026-04-17 08:07' },
    { name: 'Dimitra Kapsi', email: 'dimitra.kapsi@smaca.io', role: 'user', status: 'Active', lastLogin: '2026-04-17 08:04' },
    { name: 'Petros Mani', email: 'petros.mani@smaca.io', role: 'user', status: 'Inactive', lastLogin: '2026-04-14 12:11' },
    { name: 'Katerina Louka', email: 'katerina.louka@smaca.io', role: 'admin', status: 'Active', lastLogin: '2026-04-17 07:58' },
    { name: 'Marios Iliadis', email: 'marios.iliadis@smaca.io', role: 'user', status: 'Active', lastLogin: '2026-04-17 07:44' },
    { name: 'Efi Kanelou', email: 'efi.kanelou@smaca.io', role: 'user', status: 'Active', lastLogin: '2026-04-17 07:32' }
  ];
  tbody.innerHTML = seededUsers.map(function (user) {
    const roleClass = user.role === 'admin' ? 'badge--danger' : 'badge--success';
    const statusClass = user.status.toLowerCase() === 'active' ? 'badge--success' : 'badge--muted';
    return (
      '<tr style="border-bottom: 1px solid var(--border);">' +
      '<td style="padding: var(--space-3) var(--space-4); color: var(--text);">' + escapeSmacaHtml(user.name) + '</td>' +
      '<td style="padding: var(--space-3) var(--space-4); color: var(--text);">' + escapeSmacaHtml(user.email) + '</td>' +
      '<td style="padding: var(--space-3) var(--space-4);"><span class="badge ' + roleClass + ' badge--sm" style="text-transform:none;">' + escapeSmacaHtml(user.role) + '</span></td>' +
      '<td style="padding: var(--space-3) var(--space-4); color: var(--text);">' + escapeSmacaHtml(user.lastLogin) + '</td>' +
      '<td style="padding: var(--space-3) var(--space-4);"><span class="badge ' + statusClass + ' badge--sm">' + escapeSmacaHtml(user.status) + '</span></td>' +
      '</tr>'
    );
  }).join('');
  if (emptyState) emptyState.style.display = 'none';
}

function ensureManagementUsersObserver() {
  if (typeof window === 'undefined') return;
  if (window.__smacaManagementUsersObserverBound) return;
  const tbody = document.getElementById('users-management-table-body');
  if (!tbody || typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(function () {
    updateManagementAccessControlSummary();
    const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
    const activeSensors = sensors.filter(function (sensor) { return sensor?.is_active === true || sensor?.is_active === 1 || sensor?.is_active === '1'; }).length;
    updateManagementSystemHealth(sensors, window.SMACADashboardContext?.selectedSensorLatestById || {}, activeSensors);
  });
  observer.observe(tbody, { childList: true, subtree: true });
  window.__smacaManagementUsersObserverBound = true;
}

function ensureManagementSettingsActions() {
  if (typeof window === 'undefined') return;
  if (window.__smacaManagementSettingsBound) return;
  const parseUtcMs = function (value) {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') return value;
    const raw = String(value).trim();
    if (!raw) return NaN;
    const hasTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(raw);
    const normalized = hasTz ? raw : raw.replace(' ', 'T');
    const ms = new Date(normalized).getTime();
    return Number.isFinite(ms) ? ms : NaN;
  };
  const filterDataForExportRange = function (rows, range) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const now = Date.now();
    const rangeToMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '6m': 182 * 24 * 60 * 60 * 1000
    };
    const selectedRange = Object.prototype.hasOwnProperty.call(rangeToMs, range) ? range : '6m';
    const cutoff = now - rangeToMs[selectedRange];
    return rows.filter(function (item) {
      const itemMs = parseUtcMs(item?.time || item?.timestamp);
      return Number.isFinite(itemMs) && itemMs >= cutoff && itemMs <= now;
    }).sort(function (a, b) {
      return parseUtcMs(a?.time || a?.timestamp) - parseUtcMs(b?.time || b?.timestamp);
    });
  };
  const mergeIaqRows = function (baseRows, incomingRows) {
    const merged = [].concat(Array.isArray(baseRows) ? baseRows : [], Array.isArray(incomingRows) ? incomingRows : []);
    const deduped = [];
    const seen = new Set();
    merged.forEach(function (row) {
      const sensorId = String(row?.sensorId ?? row?.sensor_id ?? '');
      const timeKey = String(row?.time || row?.timestamp || '');
      const key = sensorId + '|' + timeKey;
      if (!timeKey || seen.has(key)) return;
      seen.add(key);
      deduped.push(row);
    });
    deduped.sort(function (a, b) {
      return parseUtcMs(a?.time || a?.timestamp) - parseUtcMs(b?.time || b?.timestamp);
    });
    return deduped;
  };
  const resolveApiTimeframe = function (range) {
    if (range === '24h' || range === '7d' || range === '30d' || range === '6m') return range;
    return '6m';
  };
  const ensureIaqRowsForExport = async function (range) {
    const existingRows = Array.isArray(SMACAState?.rawData?.iaq) ? SMACAState.rawData.iaq : [];
    const existingFiltered = filterDataForExportRange(existingRows, range);
    if (existingFiltered.length > 0) return existingFiltered;
    const canUseApi = typeof window !== 'undefined'
      && !!window.SMACAApi
      && typeof fetchAndMapTimeseriesForSensors === 'function';
    if (!canUseApi) return existingFiltered;
    const iaqSensorIds = getDetectedIaqSensors()
      .map(function (sensor) { return Number(sensor?.id); })
      .filter(Number.isFinite);
    if (iaqSensorIds.length === 0) return existingFiltered;
    try {
      const result = await fetchAndMapTimeseriesForSensors(
        iaqSensorIds,
        resolveApiTimeframe(range),
        SMACA_SECTION_METRICS.iaq,
        'iaq',
        true
      );
      const apiRows = Array.isArray(result?.items) ? result.items : [];
      if (apiRows.length === 0) return existingFiltered;
      SMACAState.rawData.iaq = mergeIaqRows(existingRows, apiRows);
      return filterDataForExportRange(SMACAState.rawData.iaq, range);
    } catch (error) {
      console.error('Failed to fetch IAQ rows for management export:', error);
      return existingFiltered;
    }
  };
  const exportDataBtn = document.getElementById('management-export-data-btn');
  const exportDataBtnLabel = document.getElementById('management-export-data-btn-label');
  const exportMenu = document.getElementById('management-export-menu');
  if (exportDataBtn) {
    const DROPDOWN_GAP = 8;
    const VIEWPORT_MARGIN = 16;

    const clearMenuPositionStyles = function () {
      if (!exportMenu) return;
      exportMenu.style.top = '';
      exportMenu.style.left = '';
      exportMenu.style.right = '';
      exportMenu.style.width = '';
      exportMenu.style.maxHeight = '';
    };

    const positionExportMenu = function () {
      if (!exportMenu) return;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const btnRect = exportDataBtn.getBoundingClientRect();
      if (!btnRect || !viewportWidth || !viewportHeight) return;

      const mobileLayout = viewportWidth <= 640;
      if (mobileLayout) {
        exportMenu.style.left = VIEWPORT_MARGIN + 'px';
        exportMenu.style.right = VIEWPORT_MARGIN + 'px';
        exportMenu.style.width = 'auto';
      } else {
        exportMenu.style.right = 'auto';
        exportMenu.style.width = '';
      }

      const menuRectInitial = exportMenu.getBoundingClientRect();
      const menuWidth = mobileLayout
        ? Math.max(0, viewportWidth - (VIEWPORT_MARGIN * 2))
        : Math.max(menuRectInitial.width || 0, 240);
      const menuHeight = Math.max(menuRectInitial.height || 0, 120);

      let left = mobileLayout ? VIEWPORT_MARGIN : btnRect.left;
      if (!mobileLayout) {
        const maxLeft = viewportWidth - VIEWPORT_MARGIN - menuWidth;
        left = Math.max(VIEWPORT_MARGIN, Math.min(left, maxLeft));
      }

      const spaceBelow = viewportHeight - btnRect.bottom - VIEWPORT_MARGIN;
      const spaceAbove = btnRect.top - VIEWPORT_MARGIN;
      const shouldOpenUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;

      let top = shouldOpenUpward
        ? (btnRect.top - menuHeight - DROPDOWN_GAP)
        : (btnRect.bottom + DROPDOWN_GAP);
      const maxTop = viewportHeight - VIEWPORT_MARGIN - Math.min(menuHeight, viewportHeight - (VIEWPORT_MARGIN * 2));
      top = Math.max(VIEWPORT_MARGIN, Math.min(top, maxTop));

      exportMenu.style.left = Math.round(left) + 'px';
      exportMenu.style.top = Math.round(top) + 'px';
      exportMenu.style.maxHeight = Math.max(140, viewportHeight - (VIEWPORT_MARGIN * 2)) + 'px';
    };

    const setMenuOpen = function (open) {
      if (!exportMenu) return;
      exportMenu.hidden = !open;
      exportDataBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        requestAnimationFrame(function () {
          requestAnimationFrame(positionExportMenu);
        });
      } else {
        clearMenuPositionStyles();
      }
    };

    exportDataBtn.addEventListener('click', function () {
      if (!exportMenu) return;
      setMenuOpen(exportMenu.hidden);
    });

    if (exportMenu) {
      exportMenu.addEventListener('click', async function (event) {
        const item = event.target && event.target.closest('[data-export-format]');
        if (!item) return;
        const format = String(item.getAttribute('data-export-format') || 'xlsx').toLowerCase();
        const range = document.getElementById('management-export-range')?.value || '6m';
        const originalLabel = exportDataBtnLabel ? exportDataBtnLabel.textContent : exportDataBtn.textContent;
        exportDataBtn.disabled = true;
        if (exportDataBtnLabel) {
          exportDataBtnLabel.textContent = format === 'csv' ? smacaT('download_csv','Download CSV') + '...' : smacaT('download_excel','Download Excel') + '...';
        } else {
          exportDataBtn.textContent = format === 'csv' ? smacaT('download_csv','Download CSV') + '...' : smacaT('download_excel','Download Excel') + '...';
        }
        setMenuOpen(false);

        const filteredIaq = await ensureIaqRowsForExport(range);
        if (!Array.isArray(filteredIaq) || filteredIaq.length === 0) {
          alert('No sensor data available for the selected export range.');
        } else {
          await SMACACSVExport.exportSensorData(filteredIaq, range, format);
        }

        exportDataBtn.disabled = false;
        if (exportDataBtnLabel) {
          exportDataBtnLabel.textContent = originalLabel;
        } else {
          exportDataBtn.textContent = originalLabel;
        }
      });

      document.addEventListener('click', function (event) {
        const target = event.target;
        if (!target) return;
        if (target.closest('#management-export-data-btn') || target.closest('#management-export-menu')) return;
        setMenuOpen(false);
      });

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') setMenuOpen(false);
      });

      window.addEventListener('resize', function () {
        if (!exportMenu.hidden) positionExportMenu();
      });

      window.addEventListener('scroll', function () {
        if (!exportMenu.hidden) positionExportMenu();
      }, true);
    }
  }

  window.__smacaManagementSettingsBound = true;
}

function renderManagementSmartAlerts(sensors, latestById) {
  const tbody = document.getElementById('management-smart-alerts-body');
  if (!tbody) return;
  const alerts = [];

  const latestCo2 = resolveLatestMetricValue(Array.isArray(SMACAState?.rawData?.iaq) ? SMACAState.rawData.iaq : [], 'co2');
  if (Number.isFinite(latestCo2) && latestCo2 > 1000) {
    alerts.push({ type: 'high-co2', title: 'High CO₂ detected', location: 'IAQ zone', severity: 'high', status: 'open', date: new Date().toLocaleDateString() });
  }

  const lowBatterySensors = sensors.filter(function (sensor) {
    const latest = (latestById[String(sensor.id)]?.latest || sensor?.latest_snapshot || {});
    const battery = Number(latest?.battery_pct);
    return Number.isFinite(battery) && battery > 0 && battery <= 20;
  });
  if (lowBatterySensors.length > 0) {
    alerts.push({ type: 'low-battery', title: lowBatterySensors.length + ' sensors low battery', location: 'Multiple', severity: 'critical', status: 'open', date: new Date().toLocaleDateString() });
  }

  const staleSensors = sensors.filter(function (sensor) {
    const latest = (latestById[String(sensor.id)]?.latest || sensor?.latest_snapshot || {});
    const lastSeen = latestById[String(sensor.id)]?.last_seen_at || latest?.measured_at || sensor?.last_seen_at || null;
    return isManagementSensorStale(Object.assign({}, sensor, {
      last_seen_at: lastSeen,
      latest: latest && latest.measured_at ? latest : (sensor.latest || { measured_at: lastSeen })
    }));
  });
  if (staleSensors.length > 0) {
    alerts.push({ type: 'signal-loss', title: staleSensors.length + ' sensors no recent signal', location: smacaT('connectivity','Connectivity'), severity: 'medium', status: 'open', date: new Date().toLocaleDateString() });
  }

  const latestEnergy = resolveLatestMetricValue(Array.isArray(SMACAState?.rawData?.energy) ? SMACAState.rawData.energy : [], 'energy_kwh');
  const latestIn = sumLatestMetricAcrossSensors(Array.isArray(SMACAState?.rawData?.occupancy) ? SMACAState.rawData.occupancy : [], 'people_in');
  const latestOut = sumLatestMetricAcrossSensors(Array.isArray(SMACAState?.rawData?.occupancy) ? SMACAState.rawData.occupancy : [], 'people_out');
  const occupancyActivity = Number(latestIn || 0) + Number(latestOut || 0);
  if (Number.isFinite(latestEnergy) && latestEnergy >= 6 && occupancyActivity <= 4) {
    alerts.push({ type: 'energy-vs-occupancy', title: 'High energy during low occupancy', location: 'Energy module', severity: 'medium', status: 'open', date: new Date().toLocaleDateString() });
  }

  const latestUv = resolveLatestMetricValue(Array.isArray(SMACAState?.rawData?.environmental) ? SMACAState.rawData.environmental : [], 'uv_index');
  if (Number.isFinite(latestUv) && latestUv >= 8) {
    alerts.push({ type: 'uv-peak', title: 'UV peak warning', location: 'Solar exposure zone', severity: 'high', status: 'open', date: new Date().toLocaleDateString() });
  }

  const severityBadge = function (severity) {
    if (severity === 'critical') return 'badge--danger';
    if (severity === 'high') return 'badge--high';
    if (severity === 'medium') return 'badge--warning';
    return 'badge--info';
  };

  if (!alerts.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="padding: var(--space-5); color: var(--muted); text-align: center;">No smart alerts currently triggered.</td></tr>';
    return;
  }

  tbody.innerHTML = alerts.map(function (eventItem) {
    return (
      '<tr class="ai-events-row">' +
      '<td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted ai-events-type-badge">' + escapeSmacaHtml(eventItem.type) + '</span></td>' +
      '<td style="padding: var(--space-3) var(--space-4); color: var(--text);">' + escapeSmacaHtml(eventItem.title) + '</td>' +
      '<td style="padding: var(--space-3) var(--space-4); color: var(--text);">' + escapeSmacaHtml(eventItem.location) + '</td>' +
      '<td style="padding: var(--space-3) var(--space-4);"><span class="badge ' + severityBadge(eventItem.severity) + '">' + escapeSmacaHtml(eventItem.severity) + '</span></td>' +
      '<td style="padding: var(--space-3) var(--space-4);"><span class="badge badge--muted">' + escapeSmacaHtml(eventItem.status) + '</span></td>' +
      '<td style="padding: var(--space-3) var(--space-4); color: var(--text);">' + escapeSmacaHtml(eventItem.date) + '</td>' +
      '<td style="padding: var(--space-3) var(--space-4);"><div class="management-row-actions"><button class="btn btn--ghost btn--sm management-ai-action-btn" data-ai-action="ack">Acknowledge</button><button class="btn btn--secondary btn--sm management-ai-action-btn" data-ai-action="resolve">Resolve</button></div></td>' +
      '</tr>'
    );
  }).join('');
}

function ensureManagementAiEventActions() {
  if (typeof window === 'undefined') return;
  if (window.__smacaManagementAiActionsBound) return;
  const table = document.querySelector('#management-ai-events-tab table');
  if (!table) return;
  table.addEventListener('click', function (event) {
    const target = event.target?.closest?.('.management-ai-action-btn');
    if (!target) return;
    const action = String(target.getAttribute('data-ai-action') || '').toLowerCase();
    const row = target.closest('tr');
    if (!row) return;
    const statusCell = row.querySelector('td:nth-child(5) .badge');
    if (statusCell) {
      if (action === 'ack') statusCell.textContent = smacaT('acknowledged','acknowledged');
      if (action === 'resolve') statusCell.textContent = smacaT('resolved','resolved');
    }
    const openCount = Array.from(document.querySelectorAll('#management-smart-alerts-body tr')).filter(function (r) {
      const badge = r.querySelector('td:nth-child(5) .badge');
      return badge && String(badge.textContent || '').trim().toLowerCase() === smacaT('open','open').toLowerCase();
    }).length;
    const aiEventsOpenEl = document.getElementById('ai-events-open-count');
    if (aiEventsOpenEl) aiEventsOpenEl.textContent = String(openCount);
    const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
    const activeSensors = sensors.filter(function (sensor) { return sensor?.is_active === true || sensor?.is_active === 1 || sensor?.is_active === '1'; }).length;
    const maintenanceSensors = Math.max(0, sensors.length - activeSensors);
    updateManagementCriticalIssues(sensors, window.SMACADashboardContext?.selectedSensorLatestById || {}, activeSensors, maintenanceSensors);
    if (window.SMACAUI?.toast) {
      window.SMACAUI.toast(action === 'resolve' ? 'AI event resolved' : 'AI event acknowledged');
    }
  });
  window.__smacaManagementAiActionsBound = true;
}

function updateManagementSystemHealth(sensors, latestById, activeSensors) {
  const latestUpdate = window.SMACADashboardContext?.overview?.latest_update_at || null;
  const apiStatusEl = document.getElementById('system-health-api-status');
  const dbEl = document.getElementById('system-health-db');
  const queueEl = document.getElementById('system-health-queue');
  const telemetryEl = document.getElementById('system-health-ingestion-status');
  const ingestionEl = document.getElementById('system-health-last-ingestion');
  const sensorsEl = document.getElementById('system-health-sensors');
  const uptimeEl = document.getElementById('system-health-uptime');
  const pendingJobsEl = document.getElementById('system-health-pending-jobs');
  const openIncidentsEl = document.getElementById('system-health-open-incidents');
  const storageEl = document.getElementById('system-health-storage');

  const offlineSensors = Math.max(0, sensors.length - activeSensors);
  const hasIngestion = !!latestUpdate;
  const apiState = hasIngestion ? smacaT('operational_upper', 'OPERATIONAL') : smacaT('unavailable', 'Unavailable');
  const dbState = hasIngestion ? 'Connected' : 'Unknown';
  const queueJobs = offlineSensors + Math.max(0, Math.round((sensors.length - activeSensors) * 0.5));
  const queueState = queueJobs > 0 ? ('Backlog ' + queueJobs) : '0 pending';
  const telemetryState = hasIngestion ? smacaT('health','Healthy') : 'Stalled';
  const uptimeState = offlineSensors <= 1 ? '99.9%' : (offlineSensors <= 3 ? '99.5%' : '98.7%');
  const storageUsage = estimateLocalStorageUsagePct();

  const toBadge = function (text, cls) {
    return '<span class="badge ' + cls + '">' + escapeSmacaHtml(text) + '</span>';
  };
  if (apiStatusEl) apiStatusEl.innerHTML = toBadge(apiState, hasIngestion ? 'badge--success' : 'badge--danger');
  if (dbEl) dbEl.innerHTML = toBadge(dbState, hasIngestion ? 'badge--success' : 'badge--muted');
  if (queueEl) queueEl.innerHTML = toBadge(queueState, queueJobs === 0 ? 'badge--success' : 'badge--warning');
  if (telemetryEl) telemetryEl.innerHTML = toBadge(telemetryState, telemetryState === smacaT('health','Healthy') ? 'badge--success' : 'badge--warning');
  if (ingestionEl) ingestionEl.textContent = latestUpdate ? new Date(latestUpdate).toLocaleString() : smacaT('not_available','Not available');
  if (sensorsEl) sensorsEl.textContent = String(activeSensors) + ' / ' + String(offlineSensors);
  if (uptimeEl) uptimeEl.innerHTML = toBadge(uptimeState, offlineSensors <= 1 ? 'badge--success' : (offlineSensors <= 3 ? 'badge--warning' : 'badge--danger'));
  if (pendingJobsEl) pendingJobsEl.textContent = String(queueJobs);
  if (openIncidentsEl) {
    openIncidentsEl.textContent = '—';
    if (window.SMACAApi && typeof window.SMACAApi.fetchAlertsSummary === 'function') {
      window.SMACAApi.fetchAlertsSummary()
        .then(function (summary) {
          if (openIncidentsEl) {
            openIncidentsEl.textContent = String((summary && summary.active_events) || 0);
          }
        })
        .catch(function () {
          if (openIncidentsEl) openIncidentsEl.textContent = '0';
        });
    }
  }
  if (storageEl) storageEl.textContent = storageUsage;
}

function estimateLocalStorageUsagePct() {
  try {
    const entries = Object.keys(window.localStorage || {});
    const totalBytes = entries.reduce(function (sum, key) {
      const value = window.localStorage.getItem(key) || '';
      return sum + key.length + value.length;
    }, 0);
    const quotaApprox = 5 * 1024 * 1024;
    const pct = Math.round((totalBytes / quotaApprox) * 1000) / 10;
    return String(pct) + '%';
  } catch (e) {
    return 'N/A';
  }
}

function updateManagementAdminMetaTicker() {
  if (typeof window === 'undefined') return;
  const target = document.getElementById('management-last-sync-meta');
  if (!target) return;
  const latestUpdate = window.SMACADashboardContext?.overview?.latest_update_at || null;
  if (!latestUpdate) {
    target.textContent = smacaT('last_sync_label', 'Last sync') + ': ' + smacaT('unavailable', 'unavailable');
    return;
  }
  const updateLabel = function () {
    const deltaSec = Math.max(0, Math.round((Date.now() - new Date(latestUpdate).getTime()) / 1000));
    target.textContent = smacaT('last_sync_label', 'Last sync') + ': ' + deltaSec + ' sec ago';
  };
  updateLabel();
  if (window.__smacaManagementMetaTimer) return;
  window.__smacaManagementMetaTimer = window.setInterval(updateLabel, 1000);
}

function updateManagementCriticalIssues(sensors, latestById, activeSensors, maintenanceSensors) {
  const criticalList = document.getElementById('management-critical-issues-list');
  if (!criticalList) return;
  const lowBatteryCount = sensors.filter(function (sensor) {
    const latestRow = latestById[String(sensor.id)] || {};
    const latest = latestRow?.latest || sensor?.latest_snapshot || {};
    const battery = Number(latest?.battery_pct);
    return Number.isFinite(battery) && battery > 0 && battery <= 20;
  }).length;
  const offlineCount = Math.max(0, sensors.length - activeSensors);

  function renderCriticalIssueLines(pendingAlerts) {
    const issueLines = [];
    if (lowBatteryCount > 0) issueLines.push('<div class="quick-tip"><span>•</span><span>' + lowBatteryCount + ' low battery sensors</span></div>');
    if (offlineCount > 0) issueLines.push('<div class="quick-tip"><span>•</span><span>' + offlineCount + ' offline sensors</span></div>');
    if (pendingAlerts > 0) {
      issueLines.push('<div class="quick-tip"><span>•</span><span>' + pendingAlerts + ' active alert events</span></div>');
    }
    if (maintenanceSensors > 0) issueLines.push('<div class="quick-tip"><span>•</span><span>' + maintenanceSensors + ' sensors need maintenance</span></div>');
    if (!issueLines.length) issueLines.push('<div class="quick-tip"><span>•</span><span>No critical issues detected</span></div>');
    criticalList.innerHTML = issueLines.join('');
  }

  renderCriticalIssueLines(0);
  if (window.SMACAApi && typeof window.SMACAApi.fetchAlertsSummary === 'function') {
    window.SMACAApi.fetchAlertsSummary()
      .then(function (summary) {
        renderCriticalIssueLines((summary && summary.active_events) || 0);
      })
      .catch(function () {
        renderCriticalIssueLines(0);
      });
  }
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
  const formatCount = function (value, fallback) {
    const resolved = Number.isFinite(Number(value)) ? Number(value) : Number(fallback);
    return Number.isFinite(resolved) ? String(resolved) : smacaT('not_available','Not available');
  };

  const activeEl = document.getElementById('overview-active-sensors');
  if (activeEl) activeEl.textContent = formatCount(totals.active_sensors, activeFromSensors);
  const activeTrendEl = document.getElementById('overview-active-sensors-trend');
  if (activeTrendEl) activeTrendEl.textContent = `${formatCount(totals.active_sensors, activeFromSensors)} ${smacaT('active_now', 'active now')}`;

  const connectivityHealthEl = document.getElementById('overview-connectivity-health');
  if (connectivityHealthEl) {
    const connected = Number.isFinite(Number(totals.connected_sensors)) ? Number(totals.connected_sensors) : connectedFallback;
    const total = Number.isFinite(Number(totals.sensors)) ? Number(totals.sensors) : totalFallback;
    connectivityHealthEl.textContent = total > 0 ? `${Math.round((connected / total) * 100)}%` : smacaT('not_available','Not available');
  }

  const occupancyLoadEl = document.getElementById('overview-occupancy-load');
  if (occupancyLoadEl) {
    const timeframe = SMACAState?.currentTimeframe || '24h';
    const occupancyRows = (typeof SMACAState.getFilteredOccupancy === 'function')
      ? (SMACAState.getFilteredOccupancy() || [])
      : (Array.isArray(SMACAState.rawData?.occupancy) ? SMACAState.rawData.occupancy : []);
    const latestOccupancy = resolveOverviewOccupancyLoadByTimeframe(occupancyRows, timeframe);
    const fallbackSnapshot = resolveLatestOccupancyFromOverviewSnapshot(overview);
    const resolvedOccupancy = Number.isFinite(latestOccupancy) ? latestOccupancy : fallbackSnapshot;
    occupancyLoadEl.textContent = Number.isFinite(resolvedOccupancy) ? String(Math.round(resolvedOccupancy)) : '--';
    const occupancyTrendEl = document.getElementById('overview-occupancy-trend');
    if (occupancyTrendEl) {
      if (Number.isFinite(resolvedOccupancy)) {
        const remainingLabel = smacaT('occupancy_metric_remaining_inside', 'Remaining inside');
        occupancyTrendEl.textContent = `${remainingLabel} ${Math.round(resolvedOccupancy)} (${timeframe})`;
      } else {
        occupancyTrendEl.textContent = 'No occupancy data';
      }
    }
  }

  updateOverviewLiveValues(overview, sensorRows);

  const lastRefreshEl = document.getElementById('overview-last-refresh');
  if (lastRefreshEl) {
    lastRefreshEl.textContent = latestUpdate ? new Date(latestUpdate).toLocaleString() : smacaT('not_available','Not available');
  }

  const pills = document.querySelectorAll('.last-updated-pill');
  pills.forEach(function (pill) {
    pill.textContent = latestUpdate
      ? `${smacaT('last_updated_label', 'Last updated')}: ${new Date(latestUpdate).toLocaleString()}`
      : `${smacaT('last_updated_label', 'Last updated')}: ${smacaT('not_available_label', 'Not available')}`;
  });
  const explicitLastSync = document.getElementById('overview-last-sync');
  if (explicitLastSync) {
    explicitLastSync.textContent = latestUpdate
      ? `${smacaT('last_sync_label', 'Last sync')}: ${new Date(latestUpdate).toLocaleString()}`
      : `${smacaT('last_sync_label', 'Last sync')}: ${smacaT('not_available_label', 'Not available')}`;
  }

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
        valueEl.textContent = smacaT('not_available','Not available');
      }
      return;
    }

    if (label === 'last update') {
      if (!latestUpdate) {
        valueEl.textContent = smacaT('not_available','Not available');
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
    siteName: latestRow?.site?.name || null,
    sensorLocation: latestRow?.sensor_location || sensorMeta?.sensor_location || sensorMeta?.location || null
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
  if (bucket === 'environmental' || bucket === 'energy' || bucket === 'connectivity') {
    items = adapters.timeseriesPointsToEnvironmentalItems(firstResponse?.payload?.points || [], meta);
  }

  responses.forEach(function (response) {
    if (bucket === 'iaq') items = adapters.mergeMetricIntoIAQItems(items, response.metric, response.payload?.points || []);
    if (bucket === 'occupancy') items = adapters.mergeMetricIntoOccupancyItems(items, response.metric, response.payload?.points || []);
    if (bucket === 'environmental' || bucket === 'energy' || bucket === 'connectivity') {
      items = adapters.mergeMetricIntoEnvironmentalItems(items, response.metric, response.payload?.points || []);
    }
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
      siteName: item?.siteName || meta.siteName,
      sensorLocation: item?.sensorLocation || item?.sensor_location || itemSensorMeta?.sensor_location || itemSensorMeta?.location || meta.sensorLocation || null
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
  SMACAState.rawData.connectivity = Array.isArray(data?.connectivity) ? data.connectivity : [];
  logSmacaHydratedState({
    iaq: SMACAState.rawData.iaq.length,
    occupancy: SMACAState.rawData.occupancy.length,
    environmental: SMACAState.rawData.environmental.length,
    energy: SMACAState.rawData.energy.length,
    connectivity: SMACAState.rawData.connectivity.length
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
      
      // Update active state via classes to avoid inline style churn.
      buttons.forEach(b => {
        b.classList.remove('active');
      });
      
      this.classList.add('active');
      
      try {
        // Always update the global state so KPI cards / charts / operational
        // summaries re-fetch consistently. setTimeframe dispatches
        // `smaca:timeframe-changed`, which KPI pages listen for.
        SMACAState.setTimeframe(timeframe);
        if (window.SMACAApi) {
          const selectedId = Number.isFinite(Number(window.SMACACurrentSensorId))
            ? Number(window.SMACACurrentSensorId)
            : chooseDefaultSensorIdFromSnapshots(
              window.SMACADashboardContext?.overview,
              window.SMACADashboardContext?.sensors || []
            );
          await refreshDashboardForSelection(selectedId, timeframe, { forceRefresh: true });
        }
      } catch (error) {
        console.error('Failed to refresh timeframe from API:', error);
      } finally {
        if (selector) {
          selector.style.opacity = '1';
          selector.style.pointerEvents = 'auto';
        }
      }
    });
  });
  
  // Set initial active state
  const activeBtn = Array.from(buttons).find(btn => btn.getAttribute('data-timeframe') === SMACAState.currentTimeframe);
  if (activeBtn) {
    buttons.forEach(function (b) { b.classList.remove('active'); });
    activeBtn.classList.add('active');
  }
}

// Setup export button
function setupExportButton() {
  if (typeof window !== 'undefined' && window.__smacaExportBound) return;
  if (typeof window !== 'undefined') window.__smacaExportBound = true;
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async function() {
      const timeframe = SMACAState.currentTimeframe;
      const currentPage = getSmacaCurrentPage();
      if (currentPage === 'occupancy') {
        let metrics = null;
        if (window.SMACAApi && typeof window.SMACAApi.fetchKpiSummary === 'function') {
          try {
            const payload = await window.SMACAApi.fetchKpiSummary('occupancy');
            metrics = payload && payload.occupancy_metrics ? payload.occupancy_metrics : null;
          } catch (error) {
            console.error('Occupancy metrics export fetch failed:', error);
          }
        }
        await SMACACSVExport.exportOccupancyData(SMACAState.getFilteredOccupancy(), timeframe, metrics);
        return;
      }

      const filteredIAQ = SMACAState.getFilteredIAQ();
      await SMACACSVExport.exportSensorData(filteredIAQ, timeframe, 'xlsx');
    });
  }
}

// Update system health badge
function updateSystemHealthBadge() {
  const badge = document.getElementById('system-health-badge');
  if (!badge) return;
  
  const sensors = (typeof window !== 'undefined' && Array.isArray(window.SMACA_SENSORS))
    ? window.SMACA_SENSORS
    : ((typeof mockData !== 'undefined' && Array.isArray(mockData.sensors)) ? mockData.sensors : []);
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
    text.textContent = smacaT('operational_upper', 'OPERATIONAL');
  } else if (percentage >= 40) {
    indicator.style.background = 'var(--warning)';
    text.textContent = 'Degraded';
  } else {
    indicator.style.background = 'var(--danger)';
    text.textContent = smacaT('offline','Offline');
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
  
  const sensors = (typeof window !== 'undefined' && Array.isArray(window.SMACA_SENSORS))
    ? window.SMACA_SENSORS
    : ((typeof mockData !== 'undefined' && Array.isArray(mockData.sensors)) ? mockData.sensors : []);
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
    window.SMACA_LOCATION || 'all',
    SMACAState.cacheVersion || 0,
    (filteredData?.iaq || []).length,
    (filteredData?.occupancy || []).length,
    (filteredData?.environmental || []).length,
    (filteredData?.energy || []).length,
    (filteredData?.connectivity || []).length
  ].join('|');
  if (SMACA_TS_CACHE.render.lastSignature === signature) return;
  SMACA_TS_CACHE.render.lastSignature = signature;

  if (currentPage === 'overview' || currentPage === 'iaq') {
    renderIAQSection('render-current-page-only', true);
  }
  if (currentPage === 'overview') {
    renderOverviewTrendChart(filteredData, timeframe);
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
  if (currentPage === 'connectivity' && window.SMACAConnectivityDashboard && typeof window.SMACAConnectivityDashboard.refresh === 'function') {
    window.SMACAConnectivityDashboard.refresh();
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
  const iaqSemPf = typeof window !== 'undefined' && window.SMACA_IAQ_SEMANTICS ? window.SMACA_IAQ_SEMANTICS : {};
  const tvocModePf = String(iaqSemPf.tvoc_semantic_mode || 'iaq_rating_level');
  const tvocUnitDisplayPf = tvocModePf === 'raw_tvoc_ugm3'
    ? 'µg/m³'
    : String(iaqSemPf.tvoc_mode_label || 'IAQ rating level');
  const tvocPrecisionPf = tvocModePf === 'raw_tvoc_ugm3' ? 1 : 2;
  const tvocCardTitleAttr = tvocModePf === 'raw_tvoc_ugm3'
    ? smacaT('explain_metric_tvoc_raw', 'TVOC is interpreted as a raw concentration (µg/m³) from sensor readings.')
    : smacaT('explain_metric_tvoc_iaq_rating', 'TVOC is currently interpreted from the IAQ rating level reported by the sensor, not from raw µg/m³ concentration.');
  const tvocTitleSafe = String(tvocCardTitleAttr).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const metricPrecision = {
    co2: 0,
    temperature: 1,
    humidity: 0,
    pm2_5: 1,
    pm10: 1,
    tvoc: tvocPrecisionPf
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
          <div class="stat-card__label">${smacaT('temperature_label', 'Temperature')}</div>
          <span class="trend-pill ${tempTrendFormatted.class}" style="font-size: var(--font-size-xs); padding: var(--space-1) var(--space-2); border-radius: var(--r-sm); background: var(--surface-2);">${tempTrendFormatted.text}</span>
        </div>
        <div class="stat-card__value">${formatMetricValue(temp, 1)}</div>
        <div class="stat-card__unit">°C</div>
      </div>
    </div>
    <div class="stat-card" style="position: relative;" title="Relative humidity percentage">
      <div class="stat-card__content">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);">
          <div class="stat-card__label">${smacaT('humidity_label', 'Relative Humidity')}</div>
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
        <div class="stat-card__unit">μg/m³</div>
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
    <div class="stat-card" style="position: relative;" title="${tvocTitleSafe}">
      <div class="stat-card__content">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);">
          <div class="stat-card__label">TVOC</div>
          <span class="trend-pill ${tvocTrendFormatted.class}" style="font-size: var(--font-size-xs); padding: var(--space-1) var(--space-2); border-radius: var(--r-sm); background: var(--surface-2);">${tvocTrendFormatted.text}</span>
        </div>
        <div class="stat-card__value">${formatMetricValue(tvoc, tvocPrecisionPf)}</div>
        <div class="stat-card__unit">${tvocUnitDisplayPf}</div>
      </div>
    </div>
  `;
}

// Update Occupancy dashboard with trend
function updateOccupancyDashboardWithTrends(filteredOccupancy, timeframe) {
  const occupancySection = document.querySelector('#occupancy');
  if (!occupancySection) return;
  const isLoadingPlaceholder = function (value) {
    const text = String(value || '').toLowerCase();
    return text.indexOf('loading') !== -1 || text.indexOf('φόρτωση') !== -1;
  };
  
  const occupancyRows = Array.isArray(SMACAState.rawData?.occupancy) ? SMACAState.rawData.occupancy : filteredOccupancy;
  if (!occupancyRows || occupancyRows.length === 0) {
    const currentCardValue = document.getElementById('occupancy-operational-summary-value');
    if (currentCardValue && !isLoadingPlaceholder(currentCardValue.textContent)) {
      currentCardValue.textContent = 'No occupancy data available';
    }
    const occupancyCounter = document.getElementById('occupancy-current-count');
    if (occupancyCounter && !isLoadingPlaceholder(occupancyCounter.textContent)) {
      occupancyCounter.textContent = 'No occupancy data available';
    }
    return;
  }

  const latestPeopleIn = sumLatestMetricAcrossSensors(occupancyRows, 'people_in');
  const latestPeopleOut = sumLatestMetricAcrossSensors(occupancyRows, 'people_out');
  const latestActivity = Number(latestPeopleIn || 0) + Number(latestPeopleOut || 0);
  let latestSampleMs = null;
  occupancyRows.forEach(function (item) {
    const raw = item?.time || item?.timestamp || item?.measured_at;
    if (!raw) return;
    const ms = new Date(raw).getTime();
    if (!Number.isFinite(ms)) return;
    if (latestSampleMs === null || ms > latestSampleMs) latestSampleMs = ms;
  });

  const summaryValueEl = document.getElementById('occupancy-operational-summary-value');
  if (summaryValueEl) {
    const hasAnyOccupancyMetric = [latestPeopleIn, latestPeopleOut].some(function (value) {
      return Number.isFinite(Number(value));
    });
    summaryValueEl.textContent = hasAnyOccupancyMetric ? String(Math.round(latestActivity)) : 'No occupancy data available';
  }
  const summarySubLabel = document.getElementById('occupancy-operational-summary-sub');
  if (summarySubLabel) {
    const entriesLabel = smacaT('occupancy_operational_latest_entries', 'Latest entries sample');
    const exitsLabel = smacaT('occupancy_operational_latest_exits', 'Latest exits sample');
    const freshnessLabel = smacaT('occupancy_operational_latest_freshness', 'Latest sample freshness');
    const entriesText = Number.isFinite(Number(latestPeopleIn)) ? String(Math.round(Number(latestPeopleIn))) : 'N/A';
    const exitsText = Number.isFinite(Number(latestPeopleOut)) ? String(Math.round(Number(latestPeopleOut))) : 'N/A';
    let freshnessText = 'N/A';
    if (Number.isFinite(latestSampleMs)) {
      const minutesAgo = Math.max(0, Math.round((Date.now() - latestSampleMs) / 60000));
      freshnessText = minutesAgo + ' min ago';
    }
    summarySubLabel.textContent = entriesLabel + ': ' + entriesText + ' · ' + exitsLabel + ': ' + exitsText + ' · ' + freshnessLabel + ': ' + freshnessText;
  }
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
  const tf = timeframe || '24h';
  smacaDebug('[SMACA][UV] timeframe change start', { timeframe: tf });

  const UV_STALE_MS = 2 * 60 * 60 * 1000;
  const uvCounter = document.getElementById('environmental-uv-index');
  const uvStaleEl = document.getElementById('environmental-uv-stale');
  const uvStaleLabel = smacaT('uv_hero_stale', 'Reading may be stale');
  const currentUvEl = document.getElementById('env-kpi-current-uv');
  const currentUvMetaEl = document.getElementById('env-kpi-current-uv-meta');
  const exposureEl = document.getElementById('env-kpi-exposure');
  const exposureMetaEl = document.getElementById('env-kpi-exposure-meta');
  const peakEl = document.getElementById('env-kpi-peak');
  const peakMetaEl = document.getElementById('env-kpi-peak-meta');
  const trendEl = document.getElementById('env-kpi-trend');
  const trendMetaEl = document.getElementById('env-kpi-trend-meta');
  const summaryCurrentEl = document.getElementById('env-summary-current');
  const summaryPeakEl = document.getElementById('env-summary-peak');
  const summaryPeriodEl = document.getElementById('env-summary-period');
  const summaryGuidanceEl = document.getElementById('env-summary-guidance');
  const meaningLevelEl = document.getElementById('env-meaning-level');
  const meaningCopyEl = document.getElementById('env-meaning-copy');

  function getExposureLabel(uvValue) {
    if (!Number.isFinite(uvValue)) return smacaT('unavailable', 'Unavailable');
    if (uvValue >= 11) return smacaT('uv_band_extreme', smacaT('extreme', 'Extreme'));
    if (uvValue >= 8) return smacaT('uv_band_very_high', 'Very High');
    if (uvValue >= 6) return smacaT('uv_band_high', smacaT('high', 'High'));
    if (uvValue >= 3) return smacaT('uv_band_moderate', smacaT('moderate', 'Moderate'));
    return smacaT('uv_band_low', smacaT('low', 'Low'));
  }

  function getExposureGuidance(uvValue) {
    if (!Number.isFinite(uvValue)) {
      return {
        summary: 'No UV guidance available until data is received.',
        interpretation: 'Live UV data is currently unavailable. Check sensor connectivity and refresh this panel.'
      };
    }
    if (uvValue >= 11) {
      return {
        summary: smacaT('extreme_uv_summary', 'Extreme UV: avoid direct sun where possible; full protection is essential.'),
        interpretation: smacaT('extreme_uv_interpretation', 'UV is in the extreme zone. Keep outdoor exposure brief and use SPF 50+, protective clothing, hat, and UV-blocking eyewear.')
      };
    }
    if (uvValue >= 8) {
      return {
        summary: smacaT('very_high_uv_summary', 'Very high UV: minimize direct sun during peak hours.'),
        interpretation: smacaT('very_high_uv_interpretation', 'UV is very high. Reduce time in direct sunlight, reapply sunscreen often, and prioritize shade around midday.')
      };
    }
    if (uvValue >= 6) {
      return {
        summary: smacaT('high_uv_summary', 'High UV: protection is strongly recommended outdoors.'),
        interpretation: smacaT('high_uv_interpretation', 'UV is high. Plan outdoor activity for lower UV windows and use sunscreen, hat, and sunglasses.')
      };
    }
    if (uvValue >= 3) {
      return {
        summary: 'Moderate UV: basic sun protection is advised.',
        interpretation: 'UV is moderate. Consider sunscreen and shade for extended outdoor activity, especially around noon.'
      };
    }
    return {
      summary: 'Low UV: lower risk for most outdoor activity.',
      interpretation: 'UV is low at the moment. Basic awareness is still recommended for long outdoor stays.'
    };
  }

  function getTrendLabel(previousValue, currentValue) {
    if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
      return { title: 'Stable', detail: 'Not enough history for trend' };
    }
    const delta = currentValue - previousValue;
    if (Math.abs(delta) < 0.2) return { title: smacaT('stable', 'Stable'), detail: smacaT('little_change_prior_reading', 'Little change from prior reading') };
    if (delta > 0) return { title: smacaT('rising', 'Rising'), detail: `+${delta.toFixed(1)} ${smacaT('vs_previous_reading', 'vs previous reading')}` };
    return { title: smacaT('falling', 'Falling'), detail: `${delta.toFixed(1)} ${smacaT('vs_previous_reading', 'vs previous reading')}` };
  }

  function formatHourRange(timestampMs) {
    if (!Number.isFinite(timestampMs)) return 'Unavailable';
    const start = new Date(timestampMs);
    const end = new Date(timestampMs + (60 * 60 * 1000));
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return `${pad(start.getHours())}:00-${pad(end.getHours())}:00`;
  }

  const parseUtcMs = function (value) {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    const raw = String(value).trim();
    if (!raw) return NaN;
    const hasTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(raw);
    const normalized = hasTz ? raw : raw.replace(' ', 'T');
    const ms = new Date(normalized).getTime();
    return Number.isFinite(ms) ? ms : NaN;
  };

  const chartWindow = getSmacaLineChartWindow(tf);
  const bucketMs = chartWindow.bucketMs;
  const bucketTimesMs = chartWindow.bucketTimesMs;
  const rangeStartMs = chartWindow.rangeStartMs;
  const rangeEndMs = chartWindow.rangeEndMs;

  const rawRows = Array.isArray(SMACAState.rawData?.environmental)
    ? SMACAState.rawData.environmental
    : (Array.isArray(filteredEnvironmental) ? filteredEnvironmental : []);
  const filteredRows = rawRows
    .map(function (item) {
      const timeMs = parseUtcMs(item?.time || item?.timestamp || item?.payload?.time);
      const uv = Number(item?.payload?.object?.uv_index);
      return { timeMs: timeMs, uv: uv };
    })
    .filter(function (entry) {
      return Number.isFinite(entry.timeMs)
        && Number.isFinite(entry.uv)
        && entry.timeMs >= rangeStartMs
        && entry.timeMs <= rangeEndMs;
    })
    .sort(function (a, b) { return a.timeMs - b.timeMs; });

  const latestRow = filteredRows.length ? filteredRows[filteredRows.length - 1] : null;
  const latestMeasuredUv = latestRow ? latestRow.uv : null;
  const latestMeasuredAtMs = latestRow ? latestRow.timeMs : NaN;
  if (latestMeasuredUv === null) {
    if (uvCounter) uvCounter.textContent = 'No UV data available';
    if (currentUvEl) currentUvEl.textContent = '--';
    if (currentUvMetaEl) currentUvMetaEl.textContent = 'No current UV reading';
    if (exposureEl) exposureEl.textContent = 'Unavailable';
    if (exposureMetaEl) exposureMetaEl.textContent = 'Sensor data required';
    if (peakEl) peakEl.textContent = '--';
    if (peakMetaEl) peakMetaEl.textContent = 'No peak available';
    if (trendEl) trendEl.textContent = 'Stable';
    if (trendMetaEl) trendMetaEl.textContent = 'No trend data';
    if (summaryCurrentEl) summaryCurrentEl.textContent = 'Unavailable';
    if (summaryPeakEl) summaryPeakEl.textContent = 'Unavailable';
    if (summaryPeriodEl) summaryPeriodEl.textContent = 'Unavailable';
    if (summaryGuidanceEl) summaryGuidanceEl.textContent = 'No UV guidance available until data is received.';
    if (meaningLevelEl) meaningLevelEl.textContent = 'Current interpretation: UV data unavailable';
    if (meaningCopyEl) meaningCopyEl.textContent = 'Live UV data is currently unavailable. Check sensor connectivity and refresh this panel.';
    if (uvStaleEl) uvStaleEl.style.display = 'none';
    renderEmptyState('uv-main-chart', 'No UV data available');
    renderEmptyState('uv-pattern-chart', 'No UV data available');
    renderEmptyState('uv-daily-comparison-chart', 'No UV data available');
    return;
  }

  const bucketMap = {};
  const bucketHasDataMap = {};
  filteredRows.forEach(function (entry) {
    const bucketTime = resolveSmacaChartBucketKey(entry.timeMs, chartWindow);
    if (bucketTime === null) return;
    if (!bucketMap[bucketTime]) bucketMap[bucketTime] = [];
    bucketMap[bucketTime].push(entry.uv);
    bucketHasDataMap[bucketTime] = true;
  });
  const bucketHasData = bucketTimesMs.map(function (bucketTime) {
    return !!bucketHasDataMap[bucketTime];
  });
  const mainSeries = bucketTimesMs.map(function (bucketTime) {
    const points = bucketMap[bucketTime] || [];
    if (!points.length) return null;
    const sum = points.reduce(function (acc, value) { return acc + value; }, 0);
    return sum / points.length;
  });

  const operationalNowMs = Number(chartWindow.rangeEndMs) || Date.now();
  const currentHourIndex = tf === '24h'
    ? getSmacaOperationalCurrentHourIndex(bucketTimesMs, operationalNowMs)
    : bucketTimesMs.length - 1;
  if (tf === '24h') {
    for (let i = 0; i < mainSeries.length; i += 1) {
      if (i > currentHourIndex || !bucketHasData[i]) {
        mainSeries[i] = null;
      }
    }
  }
  let lastRealBucketIndex = -1;
  for (let i = 0; i < bucketHasData.length; i += 1) {
    if (!bucketHasData[i]) continue;
    if (tf === '24h' && i > currentHourIndex) continue;
    lastRealBucketIndex = i;
  }

  const patternSums = Array.from({ length: 24 }, function () { return 0; });
  const patternCounts = Array.from({ length: 24 }, function () { return 0; });
  filteredRows.forEach(function (entry) {
    const hour = new Date(entry.timeMs).getHours();
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;
    patternSums[hour] += entry.uv;
    patternCounts[hour] += 1;
  });
  const patternCategories = Array.from({ length: 24 }, function (_, hour) {
    return String(hour).padStart(2, '0');
  });
  const patternSeries = patternCategories.map(function (_, hour) {
    return patternCounts[hour] > 0 ? (patternSums[hour] / patternCounts[hour]) : null;
  });

  const dailyPeakByDay = {};
  filteredRows.forEach(function (entry) {
    const d = new Date(entry.timeMs);
    const key = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
    if (!dailyPeakByDay[key] || entry.uv > dailyPeakByDay[key]) dailyPeakByDay[key] = entry.uv;
  });
  const dailyComparisonCategories = Object.keys(dailyPeakByDay).sort(function (a, b) {
    return new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime();
  }).map(function (dayKey) {
    const d = new Date(dayKey + 'T00:00:00');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return day + '/' + month;
  });
  const dailyComparisonSeries = Object.keys(dailyPeakByDay).sort(function (a, b) {
    return new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime();
  }).map(function (dayKey) {
    return Number(dailyPeakByDay[dayKey]);
  });

  const validMainSeries = mainSeries.filter(function (v) { return Number.isFinite(Number(v)); }).map(Number);
  const latestValue = Number.isFinite(latestMeasuredUv) ? latestMeasuredUv : (validMainSeries.length ? validMainSeries[validMainSeries.length - 1] : null);
  const previousValue = validMainSeries.length > 1 ? validMainSeries[validMainSeries.length - 2] : null;
  const peakValue = validMainSeries.length ? Math.max.apply(null, validMainSeries) : latestValue;
  const strongestEntry = filteredRows.reduce(function (maxEntry, entry) {
    if (!maxEntry || entry.uv > maxEntry.uv) return entry;
    return maxEntry;
  }, null);
  const strongestPeriod = strongestEntry ? formatHourRange(strongestEntry.timeMs) : 'Unavailable';
  const exposureLabel = getExposureLabel(latestValue);
  const trend = getTrendLabel(previousValue, latestValue);
  const guidance = getExposureGuidance(latestValue);

  if (uvCounter) uvCounter.textContent = latestValue.toFixed(1);
  if (uvStaleEl) {
    const isStale = Number.isFinite(latestMeasuredAtMs) && (Date.now() - latestMeasuredAtMs > UV_STALE_MS);
    uvStaleEl.textContent = uvStaleLabel;
    uvStaleEl.style.display = isStale ? '' : 'none';
  }
  if (currentUvEl) currentUvEl.textContent = latestValue.toFixed(1);
  if (currentUvMetaEl) currentUvMetaEl.textContent = `${tf} monitoring window`;
  if (exposureEl) exposureEl.textContent = exposureLabel;
  if (exposureMetaEl) exposureMetaEl.textContent = guidance.summary;
  if (peakEl) peakEl.textContent = peakValue.toFixed(1);
  if (peakMetaEl) peakMetaEl.textContent = `Peak in ${tf} window`;
  if (trendEl) trendEl.textContent = trend.title;
  if (trendMetaEl) trendMetaEl.textContent = trend.detail;
  if (summaryCurrentEl) summaryCurrentEl.textContent = `${latestValue.toFixed(1)} (${exposureLabel})`;
  if (summaryPeakEl) summaryPeakEl.textContent = peakValue.toFixed(1);
  if (summaryPeriodEl) summaryPeriodEl.textContent = strongestPeriod;
  if (summaryGuidanceEl) summaryGuidanceEl.textContent = guidance.summary;
  if (meaningLevelEl) meaningLevelEl.textContent = `Current interpretation: ${exposureLabel} UV exposure`;
  if (meaningCopyEl) meaningCopyEl.textContent = guidance.interpretation;
  const adapter = typeof window !== 'undefined' ? window.SMACAHighchartsAdapter : null;
  const hasHighcharts = !!(adapter
    && typeof adapter.createUvMainTrendChart === 'function'
    && typeof adapter.createUvPatternChart === 'function'
    && typeof adapter.createUvDailyComparisonChart === 'function'
    && adapter.hasHighcharts
    && adapter.hasHighcharts());
  smacaDebug('[SMACA][UV] chart update start', { timeframe: tf });
  if (hasHighcharts) {
    smacaDebug('[SMACA][UV] renderer = highcharts');
    const uvNoDataYet = smacaT('uv_no_data_yet', smacaT('energy_no_data_yet', 'No data yet'));
    adapter.createUvMainTrendChart('uv-main-chart', {
      timeframe: tf,
      bucketTimesMs: bucketTimesMs,
      values: mainSeries,
      currentHourIndex: currentHourIndex,
      lastRealBucketIndex: lastRealBucketIndex,
      noDataYetLabel: uvNoDataYet
    });
    adapter.createUvPatternChart('uv-pattern-chart', {
      timeframe: tf,
      categories: patternCategories,
      values: patternSeries
    });
    if (dailyComparisonSeries.length > 0) {
      adapter.createUvDailyComparisonChart('uv-daily-comparison-chart', {
        timeframe: tf,
        categories: dailyComparisonCategories,
        values: dailyComparisonSeries,
        metricLabel: 'Daily peak UV'
      });
    } else {
      renderEmptyState('uv-daily-comparison-chart', 'No daily UV data available');
    }
  } else {
    renderEmptyState('uv-main-chart', 'UV chart unavailable (Highcharts not loaded)');
    renderEmptyState('uv-pattern-chart', 'UV chart unavailable (Highcharts not loaded)');
    renderEmptyState('uv-daily-comparison-chart', 'UV chart unavailable (Highcharts not loaded)');
  }

  if (typeof window !== 'undefined') {
    window.__uvChartDebug = {
      timeframe: tf,
      rangeStart: new Date(rangeStartMs).toISOString(),
      rangeEnd: new Date(rangeEndMs).toISOString(),
      pointCount: filteredRows.length,
      metricUsed: 'uv_index',
      mainSeries: mainSeries,
      patternSeries: patternSeries,
      dailyComparisonSeries: dailyComparisonSeries
    };
  }
  smacaDebug('[SMACA][UV] chart update success', { timeframe: tf, points: filteredRows.length });
}

// Update Occupancy charts with filtered data
function updateOccupancyCharts(filteredOccupancy, timeframe) {
  if (getSmacaCurrentPage() !== 'occupancy') return;
  smacaDebug('[SMACA][OCCUPANCY] timeframe change start', { timeframe: timeframe });
  ensureOccupancyLocationChartContainers();
  const selectedSensorId = typeof window !== 'undefined' ? window.SMACACurrentSensorId : null;
  const hydratedRows = Array.isArray(SMACAState.rawData?.occupancy) ? SMACAState.rawData.occupancy : [];
  const fallbackRows = Array.isArray(filteredOccupancy) ? filteredOccupancy : [];
  const occupancyRows = fallbackRows.length > 0 ? fallbackRows : hydratedRows;
  if (!occupancyRows || occupancyRows.length === 0) {
    renderEmptyState('occupancy-flow-chart', 'No occupancy data available');
    renderEmptyState('occupancy-density-timeline', 'No occupancy data available');
    renderEmptyState('occupancy-top-traffic-locations-chart', 'No occupancy data available');
    return;
  }
  
  const parseUtcMs = function (value) {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') return value;
    const raw = String(value).trim();
    if (!raw) return NaN;
    const hasTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(raw);
    const normalized = hasTz ? raw : raw.replace(' ', 'T');
    const ms = new Date(normalized).getTime();
    return Number.isFinite(ms) ? ms : NaN;
  };

  const adapter = typeof window !== 'undefined' ? window.SMACAHighchartsAdapter : null;
  const hasHighcharts = !!(adapter && typeof adapter.createOccupancyMainCombinedChart === 'function' && adapter.hasHighcharts && adapter.hasHighcharts());
  const hasHeatmapModule = !!(adapter && adapter.hasHeatmapModule && adapter.hasHeatmapModule());

  smacaDebug('[SMACA][OCCUPANCY] chart update start', { timeframe: timeframe });

  const chartWindow = getSmacaOccupancyFlowWindow(timeframe);
  const bucketMs = chartWindow.bucketMs;
  const bucketTimesMs = chartWindow.bucketTimesMs;
  const rangeStartMs = chartWindow.rangeStartMs;
  const rangeEndMs = chartWindow.rangeEndMs;

  const grouped = {};
  occupancyRows.forEach(function (item) {
    const timeMs = parseUtcMs(item?.time || item?.timestamp || 0);
    if (!Number.isFinite(timeMs)) return;
    if (timeMs < rangeStartMs || timeMs > rangeEndMs) return;

    const peopleIn = Number(item?.payload?.object?.people_in);
    const peopleOut = Number(item?.payload?.object?.people_out);
    const peopleTotalIn = Number(item?.payload?.object?.people_total_in);
    const peopleTotalOut = Number(item?.payload?.object?.people_total_out);

    const bucketKey = resolveSmacaChartBucketKey(timeMs, chartWindow);
    if (bucketKey === null) return;
    if (!grouped[bucketKey]) grouped[bucketKey] = { in: 0, out: 0, totalIn: null, totalOut: null };
    if (Number.isFinite(peopleIn)) grouped[bucketKey].in += peopleIn;
    if (Number.isFinite(peopleOut)) grouped[bucketKey].out += peopleOut;
    if (Number.isFinite(peopleTotalIn)) {
      grouped[bucketKey].totalIn = grouped[bucketKey].totalIn === null ? peopleTotalIn : Math.max(grouped[bucketKey].totalIn, peopleTotalIn);
    }
    if (Number.isFinite(peopleTotalOut)) {
      grouped[bucketKey].totalOut = grouped[bucketKey].totalOut === null ? peopleTotalOut : Math.max(grouped[bucketKey].totalOut, peopleTotalOut);
    }
  });

  const peopleIn = bucketTimesMs.map(function (t) {
    return grouped[t] ? Number(grouped[t].in) : null;
  });
  const peopleOut = bucketTimesMs.map(function (t) {
    return grouped[t] ? Number(grouped[t].out) : null;
  });
  const activityData = bucketTimesMs.map(function (t) {
    if (!grouped[t]) return null;
    const v = Number(grouped[t].in) + Number(grouped[t].out);
    return Number.isFinite(v) ? Math.max(0, v) : null;
  });

  const safeFlowIn = peopleIn.map(function (value) { return Number.isFinite(Number(value)) ? Number(value) : 0; });
  const safeFlowOut = peopleOut.map(function (value) { return Number.isFinite(Number(value)) ? Number(value) : 0; });
  const safeActivityData = activityData.map(function (value) { return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0; });

  // Pattern heatmap inputs
  let patternCategories = [];
  let patternValues = [];
  if (timeframe === '24h') {
    patternCategories = Array.from({ length: 24 }, function (_, h) { return String(h).padStart(2, '0'); });
    patternValues = Array.from({ length: 24 }, function () { return null; });
    bucketTimesMs.forEach(function (t, idx) {
      const hour = new Date(t).getHours();
      if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
        patternValues[hour] = activityData[idx];
      }
    });
  } else {
    const cellSums = {};
    occupancyRows.forEach(function (item) {
      const timeMs = parseUtcMs(item?.time || item?.timestamp || 0);
      if (!Number.isFinite(timeMs)) return;
      if (timeMs < rangeStartMs || timeMs > rangeEndMs) return;

      const peopleInVal = Number(item?.payload?.object?.people_in);
      const peopleOutVal = Number(item?.payload?.object?.people_out);
      const hasIn = Number.isFinite(peopleInVal);
      const hasOut = Number.isFinite(peopleOutVal);
      if (!hasIn && !hasOut) return;

      const activity = (hasIn ? peopleInVal : 0) + (hasOut ? peopleOutVal : 0);
      if (!Number.isFinite(activity)) return;

      const dayKey = resolveSmacaChartBucketKey(timeMs, chartWindow);
      if (dayKey === null) return;
      const hourOfDay = new Date(timeMs).getHours();
      const cellKey = String(dayKey) + '|' + String(hourOfDay);
      if (!cellSums[cellKey]) cellSums[cellKey] = 0;
      cellSums[cellKey] += activity;
    });

    const hourSum = Array.from({ length: 24 }, function () { return 0; });
    const hourCount = Array.from({ length: 24 }, function () { return 0; });
    Object.keys(cellSums).forEach(function (cellKey) {
      const parts = String(cellKey).split('|');
      const hour = Number(parts[1]);
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;
      const v = Number(cellSums[cellKey]);
      if (!Number.isFinite(v)) return;
      hourSum[hour] += v;
      hourCount[hour] += 1;
    });

    patternCategories = Array.from({ length: 24 }, function (_, h) { return String(h).padStart(2, '0'); });
    patternValues = patternCategories.map(function (_, idx) {
      return hourCount[idx] > 0 ? (hourSum[idx] / hourCount[idx]) : null;
    });
  }

  // High-level debug KPIs (no mock/demo values)
  const totalIn = safeFlowIn.reduce(function (s, v) { return s + (Number.isFinite(Number(v)) ? Number(v) : 0); }, 0);
  const totalOut = safeFlowOut.reduce(function (s, v) { return s + (Number.isFinite(Number(v)) ? Number(v) : 0); }, 0);

  const timeframeRows = occupancyRows.filter(function (item) {
    const timeMs = parseUtcMs(item?.time || item?.timestamp || 0);
    return Number.isFinite(timeMs) && timeMs >= rangeStartMs && timeMs <= rangeEndMs;
  });
  const byLocation = groupOccupancyByLocation(timeframeRows);
  const locationLabelsCount = Object.keys(byLocation).length;
  const movementByLocation = getActivityPerLocation(byLocation)
    .sort(function (a, b) { return Number(b.activity) - Number(a.activity); });

  let peakHour = null;
  let peakValue = null;
  let peakHourLabel = null;
  if (Array.isArray(patternValues) && patternValues.length) {
    const numericPattern = patternValues
      .map(function (v) { return v === null ? null : Number(v); });
    const maxIdx = numericPattern.reduce(function (best, v, idx) {
      if (!Number.isFinite(v)) return best;
      if (best === null) return idx;
      return v > numericPattern[best] ? idx : best;
    }, null);
    if (maxIdx !== null && maxIdx !== undefined) {
      const hour = patternCategories[maxIdx] || '--';
      peakHour = hour;
      peakValue = Number.isFinite(numericPattern[maxIdx]) ? numericPattern[maxIdx] : null;
      peakHourLabel = hour + ':00 UTC';
    }
  }

  if (typeof window !== 'undefined') {
    window.__occupancyChartDebug = {
      timeframe: timeframe,
      pointCount: bucketTimesMs.length,
      populatedBuckets: activityData.filter(function (value) { return Number.isFinite(Number(value)); }).length,
      peakHour: peakHour,
      peakValue: Number.isFinite(Number(peakValue)) ? Number(peakValue) : null,
      locationSummary: {
        locationCount: locationLabelsCount,
        topLocation: movementByLocation.length ? movementByLocation[0].location : null,
        topLocationValue: movementByLocation.length ? movementByLocation[0].activity : null
      }
    };
  }

  // Update charts after layout is measurable.
  setTimeout(function () {
    if (hasHighcharts) {
      smacaDebug('[SMACA][OCCUPANCY] renderer = highcharts');
      try {
        adapter.createOccupancyMainCombinedChart('occupancy-flow-chart', {
          timeframe: timeframe,
          bucketTimesMs: bucketTimesMs,
          peopleIn: peopleIn,
          peopleOut: peopleOut
        });

        const densityContainer = document.getElementById('occupancy-density-timeline');
        if (densityContainer) {
          const patternLegend = `
            <div style="margin-top: var(--space-2); display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap: var(--space-2); padding: 0 var(--space-1);">
              <div style="display:flex; align-items:center; gap: var(--space-2);">
                <span style="width: 16px; height: 10px; background: #16a34a; border-radius: 3px; display:inline-block;"></span>
                <span style="font-size: 11px; color: var(--muted);">${smacaT('low', 'Low')}</span>
              </div>
              <div style="display:flex; align-items:center; justify-content:center; gap: var(--space-2);">
                <span style="width: 16px; height: 10px; background: #eab308; border-radius: 3px; display:inline-block;"></span>
                <span style="font-size: 11px; color: var(--muted);">Medium</span>
              </div>
              <div style="display:flex; align-items:center; gap: var(--space-2);">
                <span style="width: 16px; height: 10px; background: #ef4444; border-radius: 3px; display:inline-block;"></span>
                <span style="font-size: 11px; color: var(--muted);">High</span>
              </div>
            </div>
          `;

          densityContainer.innerHTML = `
            <div id="occupancy-activity-trend-chart" style="width: 100%; height: 240px; min-height: 240px;"></div>
            <div style="width: 100%; margin-top: var(--space-6);">
              <div id="occupancy-occupancy-pattern-heatmap-chart" style="width: 100%; height: 190px; min-height: 190px;"></div>
              ${patternLegend}
            </div>
          `;

          adapter.createOccupancyActivityTrendChart('occupancy-activity-trend-chart', {
            timeframe: timeframe,
            bucketTimesMs: bucketTimesMs,
            values: activityData,
            seriesName: smacaT('occupancy_tile_total_movement_title', 'Total Movement Events'),
            color: '#60a5fa'
          });

          const patternElId = 'occupancy-occupancy-pattern-heatmap-chart';
          const heatOk = hasHeatmapModule && typeof adapter.createOccupancyPatternHeatmap === 'function';
          if (heatOk) {
            adapter.createOccupancyPatternHeatmap(patternElId, {
              timeframe: timeframe,
              categories: patternCategories,
              values: patternValues
            });
          } else {
            const heatEl = document.getElementById(patternElId);
            if (heatEl) heatEl.textContent = 'Pattern heatmap unavailable (heatmap module not loaded).';
          }
        }

        // Top Traffic Locations (merged)
        const byLoc = groupOccupancyByLocation(timeframeRows);
        const locCount = Object.keys(byLoc).length;
        if (locCount > 0) {
          const topN = 7;
          const movement = getActivityPerLocation(byLoc)
            .sort(function (a, b) { return Number(b.activity) - Number(a.activity); })
            .slice(0, topN);

          if (movement.length) {
            adapter.createOccupancyTopTrafficLocationsChart('occupancy-top-traffic-locations-chart', {
              chartKey: 'occupancy-top-traffic-locations',
              timeframe: timeframe,
              categories: movement.map(function (i) { return i.location; }),
              values: movement.map(function (i) { return i.activity; }),
              seriesName: smacaT('occupancy_tile_total_movement_title', 'Total Movement Events'),
              color: 'rgba(16, 185, 129, 0.85)'
            });
          } else {
            renderEmptyState('occupancy-top-traffic-locations-chart', 'No location data available');
          }
        } else {
          const el = document.getElementById('occupancy-top-traffic-locations-chart');
          if (el) el.innerHTML = '';
        }

        smacaDebug('[SMACA][OCCUPANCY] chart update success', { timeframe: timeframe });
      } catch (e) {
        smacaDebug('[SMACA][OCCUPANCY] highcharts renderer failed, falling back', e);
        renderOccupancyChartWhenReady('occupancy-flow-chart', function () {
          if (typeof createFlowBarChart !== 'function') throw new Error('createFlowBarChart unavailable');
          if (safeFlowIn.length === 0 || safeFlowOut.length === 0) throw new Error('empty-flow-arrays');
          createFlowBarChart('occupancy-flow-chart', safeFlowIn, safeFlowOut, { height: 320, minVisibleBarPx: 3 });
        }, function () {
          renderEmptyState('occupancy-flow-chart', 'No occupancy data available');
        });

        renderOccupancyChartWhenReady('occupancy-density-timeline', function () {
          if (typeof createOccupancyDensityTimeline !== 'function') throw new Error('createOccupancyDensityTimeline unavailable');
          if (safeActivityData.length === 0) throw new Error('empty-activity-array');
          createOccupancyDensityTimeline('occupancy-density-timeline', safeActivityData, { height: 260, minVisiblePointPx: 2 });
        }, function () {
          renderEmptyState('occupancy-density-timeline', 'No occupancy data available');
        });

        renderOccupancyLocationCharts(occupancyRows);
      }
      return;
    }

    smacaDebug('[SMACA][OCCUPANCY] renderer = fallback');
    renderOccupancyChartWhenReady('occupancy-flow-chart', function () {
      if (typeof createFlowBarChart !== 'function') throw new Error('createFlowBarChart unavailable');
      if (safeFlowIn.length === 0 || safeFlowOut.length === 0) throw new Error('empty-flow-arrays');
      createFlowBarChart('occupancy-flow-chart', safeFlowIn, safeFlowOut, { height: 320, minVisibleBarPx: 3 });
    }, function () {
      renderEmptyState('occupancy-flow-chart', 'No occupancy data available');
    });

    renderOccupancyChartWhenReady('occupancy-density-timeline', function () {
      if (typeof createOccupancyDensityTimeline !== 'function') throw new Error('createOccupancyDensityTimeline unavailable');
      if (safeActivityData.length === 0) throw new Error('empty-activity-array');
      createOccupancyDensityTimeline('occupancy-density-timeline', safeActivityData, { height: 260, minVisiblePointPx: 2 });
    }, function () {
      renderEmptyState('occupancy-density-timeline', 'No occupancy data available');
    });

    renderOccupancyLocationCharts(occupancyRows);
  }, 120);
}

function renderOccupancyChartWhenReady(containerId, renderFn, onFailure) {
  const maxAttempts = 12;
  let attempt = 0;
  const tryRender = function () {
    const container = document.getElementById(containerId);
    if (!container) {
      if (typeof onFailure === 'function') onFailure('container-missing');
      return;
    }
    const width = Number(container.offsetWidth || 0);
    const height = Number(container.offsetHeight || 0);
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
    } catch (error) {
      if (typeof onFailure === 'function') onFailure(error?.message || 'render-error');
    }
  };
  tryRender();
}

function truncateOccupancyLabel(text, maxLen) {
  const value = String(text || '').trim();
  if (!value) return 'Unknown location';
  const limit = Number.isFinite(Number(maxLen)) ? Number(maxLen) : 40;
  if (value.length <= limit) return value;
  return value.slice(0, Math.max(0, limit - 1)).trim() + '…';
}

function getOccupancyLocationLabel(item, sensorMetaById) {
  const sensorId = Number(item?.sensorId);
  const sensorMeta = Number.isFinite(sensorId) ? sensorMetaById[String(sensorId)] : null;
  const payloadLocation = item?.payload?.object?.sensor_location
    || item?.payload?.object?.location
    || item?.payload?.sensor_location
    || item?.payload?.location;
  const rawCode = payloadLocation
    || item?.sensorLocation
    || item?.sensor_location
    || sensorMeta?.sensor_location
    || sensorMeta?.location
    || item?.location
    || null;
  let primary = null;
  if (rawCode && window.SMACASpatial && typeof window.SMACASpatial.labelFor === 'function') {
    const resolved = window.SMACASpatial.labelFor(rawCode);
    if (resolved && resolved !== rawCode) primary = String(resolved);
  }
  if (!primary) {
    if (rawCode && /^AUD/i.test(String(rawCode))) {
      primary = smacaT('occupancy_group_auditorium', 'Auditorium');
    } else if (rawCode) {
      primary = String(rawCode);
    } else {
      primary = item?.siteName || sensorMeta?.site?.name || sensorMeta?.name || 'Unknown location';
    }
  }
  const floor = sensorMeta?.sensor_floor
    || sensorMeta?.floor
    || item?.sensor_floor
    || null;
  let label = primary;
  if (floor && !String(label).toLowerCase().includes(String(floor).toLowerCase())) {
    label = String(floor) + ' · ' + label;
  }
  return truncateOccupancyLabel(label, 42);
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
  const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
  const sensorMetaById = sensors.reduce(function (acc, sensor) {
    const sensorId = Number(sensor?.id);
    if (Number.isFinite(sensorId)) acc[String(sensorId)] = sensor;
    return acc;
  }, {});

  return Object.keys(itemsByLocation).map(function (location) {
    const rows = itemsByLocation[location] || [];
    const activity = rows.reduce(function (sum, item) {
      const peopleIn = Number(item?.payload?.object?.people_in);
      const peopleOut = Number(item?.payload?.object?.people_out);
      return sum + (Number.isFinite(peopleIn) ? peopleIn : 0) + (Number.isFinite(peopleOut) ? peopleOut : 0);
    }, 0);
    const sample = rows[0] || null;
    const sensorId = Number(sample?.sensorId);
    const sensorMeta = Number.isFinite(sensorId) ? sensorMetaById[String(sensorId)] : null;
    const rawId = sensorMeta?.sensor_uid || sensorMeta?.name || (Number.isFinite(sensorId) ? ('Sensor ' + sensorId) : null);
    const displayLocation = rawId && rawId !== location
      ? (location + ' (' + truncateOccupancyLabel(rawId, 18) + ')')
      : location;
    return { location: displayLocation, activity: activity };
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
  if (document.getElementById('occupancy-top-traffic-locations-chart')) return;
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
  grid.style.gap = 'var(--space-6)';
  grid.style.marginTop = 'var(--space-6)';
  grid.innerHTML = `
    <div class="card" style="grid-column: 1 / -1;">
      <div class="card__header">
        <h3 class="card__title">${smacaT('top_traffic_locations', 'Top Traffic Locations')}</h3>
        <p style="font-size: 11px; color: var(--muted); margin-top: var(--space-1);">${smacaT('occupancy_chart_top_traffic_subtitle', 'Highest movement locations in the selected timeframe.')}</p>
      </div>
      <div class="card__body">
        <div class="chart-placeholder" id="occupancy-top-traffic-locations-chart"></div>
        <div class="smaca-accordion smaca-accordion--collapsed">
          <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
            <span>${smacaT('what_is_this_graph', 'What is this graph?')}</span>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          <div class="smaca-accordion__body" hidden>
            <div class="accordion-content">
              <p><strong>${smacaT('what_it_shows', 'What it shows:')}</strong> ${smacaT('occupancy_chart_explainer_top_traffic', 'Shows locations with the highest movement in the selected timeframe, based on entries + exits.')}</p>
              <p><strong>${smacaT('how_to_read_chart', 'How to read this chart:')}</strong> ${smacaT('longer_bars_more_inbound', 'Longer bars mean more movement events. Hover to see exact totals.')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  occupancySection.appendChild(grid);
  if (typeof window !== 'undefined' && window.SMACAUI && typeof window.SMACAUI.initAccordions === 'function') {
    window.SMACAUI.initAccordions('#occupancy .smaca-accordion');
  }
}

function renderOccupancyLocationCharts(occupancyRows) {
  if (getSmacaCurrentPage() !== 'occupancy') return;
  ensureOccupancyLocationChartContainers();
  const byLocation = groupOccupancyByLocation(occupancyRows);
  const locationCount = Object.keys(byLocation).length;
  const chartId = 'occupancy-top-traffic-locations-chart';
  const chartEl = document.getElementById(chartId);
  if (chartEl) chartEl.innerHTML = '';

  if (locationCount === 0) {
    renderEmptyState(chartId, smacaT('no_data_available','No data available'));
    return;
  }

  if (locationCount === 1) {
    // Requirement: if only one location exists, do not render a misleading comparison chart.
    return;
  }

  const topN = 7;
  const entries = getTotalEntriesPerLocation(byLocation)
    .sort(function (a, b) { return Number(b.totalEntries) - Number(a.totalEntries); })
    .slice(0, topN);

  if (!entries.length) {
    renderEmptyState(chartId, 'No location data available');
    return;
  }

  renderLocationBarChart(
    chartId,
    entries.map(function (item) { return item.location; }),
    entries.map(function (item) { return item.totalEntries; }),
    '#10b981'
  );
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
  const yTicks = 5;
  for (let i = 0; i < yTicks; i += 1) {
    const ratio = i / Math.max(1, yTicks - 1);
    const yValue = maxValue * (1 - ratio);
    const y = chartHeight * ratio;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', String(y));
    line.setAttribute('x2', String(chartWidth));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', 'var(--border)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('opacity', '0.25');
    group.appendChild(line);

    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tick.setAttribute('x', '-8');
    tick.setAttribute('y', String(y));
    tick.setAttribute('fill', 'var(--muted)');
    tick.setAttribute('font-size', '10');
    tick.setAttribute('text-anchor', 'end');
    tick.setAttribute('dominant-baseline', 'middle');
    tick.textContent = String(Math.round(yValue));
    group.appendChild(tick);
  }

  const tooltip = document.createElement('div');
  tooltip.style.cssText = 'position:absolute;pointer-events:none;min-width:140px;padding:8px 10px;border-radius:var(--r-md);border:1px solid rgba(148,163,184,.3);background:#111827;color:var(--text);font-size:var(--font-size-xs);opacity:0;transform:translateY(4px);transition:opacity .15s ease, transform .15s ease;z-index:3;';
  container.style.position = 'relative';
  container.appendChild(tooltip);

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
    rect.style.cursor = 'pointer';
    rect.addEventListener('mouseenter', function () {
      tooltip.innerHTML = `<div style="color:var(--muted);margin-bottom:4px;">${labels[idx]}</div><strong>${Math.round(value)}</strong>`;
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
      const tipW = tooltip.offsetWidth || 140;
      tooltip.style.left = `${Math.min(Math.max(8, x + padding.left + 8), width - tipW - 8)}px`;
      tooltip.style.top = `${Math.max(8, y + padding.top - 38)}px`;
    });
    rect.addEventListener('mouseleave', function () {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(4px)';
    });
    group.appendChild(rect);

    const valueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    valueLabel.setAttribute('x', x + (barWidth / 2));
    valueLabel.setAttribute('y', Math.max(10, y - 6));
    valueLabel.setAttribute('fill', 'var(--text)');
    valueLabel.setAttribute('font-size', '10');
    valueLabel.setAttribute('text-anchor', 'middle');
    valueLabel.textContent = String(Math.round(value));
    group.appendChild(valueLabel);

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
  const yTicks = 5;
  for (let i = 0; i < yTicks; i += 1) {
    const ratio = i / Math.max(1, yTicks - 1);
    const yValue = maxValue * (1 - ratio);
    const y = chartHeight * ratio;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', String(y));
    line.setAttribute('x2', String(chartWidth));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', 'var(--border)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('opacity', '0.25');
    group.appendChild(line);

    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tick.setAttribute('x', '-8');
    tick.setAttribute('y', String(y));
    tick.setAttribute('fill', 'var(--muted)');
    tick.setAttribute('font-size', '10');
    tick.setAttribute('text-anchor', 'end');
    tick.setAttribute('dominant-baseline', 'middle');
    tick.textContent = String(Math.round(yValue));
    group.appendChild(tick);
  }

  const tooltip = document.createElement('div');
  tooltip.style.cssText = 'position:absolute;pointer-events:none;min-width:160px;padding:8px 10px;border-radius:var(--r-md);border:1px solid rgba(148,163,184,.3);background:#111827;color:var(--text);font-size:var(--font-size-xs);opacity:0;transform:translateY(4px);transition:opacity .15s ease, transform .15s ease;z-index:3;';
  container.style.position = 'relative';
  container.appendChild(tooltip);

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
    inRect.style.cursor = 'pointer';
    inRect.addEventListener('mouseenter', function () {
      tooltip.innerHTML = `<div style="color:var(--muted);margin-bottom:4px;">${labels[idx]}</div><div>In: <strong>${Math.round(inValue)}</strong></div><div>Out: <strong>${Math.round(outValue)}</strong></div>`;
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
      const tipW = tooltip.offsetWidth || 160;
      tooltip.style.left = `${Math.min(Math.max(8, baseX + padding.left + 8), width - tipW - 8)}px`;
      tooltip.style.top = `${Math.max(8, chartHeight - inHeight + padding.top - 42)}px`;
    });
    inRect.addEventListener('mouseleave', function () {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(4px)';
    });
    group.appendChild(inRect);
    const outRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    outRect.setAttribute('x', baseX + 2);
    outRect.setAttribute('y', chartHeight - outHeight);
    outRect.setAttribute('width', barWidth);
    outRect.setAttribute('height', outHeight);
    outRect.setAttribute('fill', '#ef4444');
    outRect.style.cursor = 'pointer';
    outRect.addEventListener('mouseenter', function () {
      tooltip.innerHTML = `<div style="color:var(--muted);margin-bottom:4px;">${labels[idx]}</div><div>In: <strong>${Math.round(inValue)}</strong></div><div>Out: <strong>${Math.round(outValue)}</strong></div>`;
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
      const tipW = tooltip.offsetWidth || 160;
      tooltip.style.left = `${Math.min(Math.max(8, baseX + padding.left + 8), width - tipW - 8)}px`;
      tooltip.style.top = `${Math.max(8, chartHeight - outHeight + padding.top - 42)}px`;
    });
    outRect.addEventListener('mouseleave', function () {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(4px)';
    });
    group.appendChild(outRect);

    const inValueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    inValueLabel.setAttribute('x', baseX - barWidth / 2 - 2);
    inValueLabel.setAttribute('y', Math.max(10, chartHeight - inHeight - 6));
    inValueLabel.setAttribute('fill', '#10b981');
    inValueLabel.setAttribute('font-size', '10');
    inValueLabel.setAttribute('text-anchor', 'middle');
    inValueLabel.textContent = String(Math.round(inValue));
    group.appendChild(inValueLabel);

    const outValueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    outValueLabel.setAttribute('x', baseX + barWidth / 2 + 2);
    outValueLabel.setAttribute('y', Math.max(10, chartHeight - outHeight - 6));
    outValueLabel.setAttribute('fill', '#ef4444');
    outValueLabel.setAttribute('font-size', '10');
    outValueLabel.setAttribute('text-anchor', 'middle');
    outValueLabel.textContent = String(Math.round(outValue));
    group.appendChild(outValueLabel);
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

  const mainChartId = 'energy-main-combined-chart';
  const demandChartId = 'energy-demand-trend-chart';
  const patternChartId = 'energy-usage-pattern-hour-chart';
  const distributionChartId = 'energy-distribution-location-chart';
  const shareChartId = 'energy-share-donut-chart';
  const kpiIds = {
    total: 'energy-kpi-total',
    totalMeta: 'energy-kpi-total-meta',
    peak: 'energy-kpi-peak',
    peakMeta: 'energy-kpi-peak-meta',
    avg: 'energy-kpi-avg',
    avgMeta: 'energy-kpi-avg-meta',
    topLocation: 'energy-kpi-top-location',
    topLocationMeta: 'energy-kpi-top-location-meta'
  };

  const clearContainer = function (id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  };

  const setEmptyContainer = function (id, message) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div style="color: var(--muted); text-align: center; padding: var(--space-6);">' + message + '</div>';
  };

  const setKpi = function (valueId, value) {
    const el = document.getElementById(valueId);
    if (el) el.textContent = (value == null ? '--' : String(value));
  };

  const setKpiMeta = function (valueId, value) {
    const el = document.getElementById(valueId);
    if (el) el.textContent = (value == null ? '--' : String(value));
  };

  const timeframeMeta = timeframe === '24h'
    ? smacaT('energy_operational_day_meta', 'Operational day (00:00–23:59)')
    : (timeframe === '7d' ? smacaT('time_7d', 'Last 7 days') : smacaT('time_30d', 'Last 30 days'));

  const usageSubtitleEl = document.querySelector('[data-energy-chart-subtitle="usage"]');
  if (usageSubtitleEl) {
    usageSubtitleEl.textContent = timeframe === '24h'
      ? smacaT('energy_usage_24h_subtitle', 'Hourly consumption for the operational day (00:00–23:59, local time).')
      : smacaT('columns_spline_energy', 'kWh per bucket from cumulative meter deltas (MAX−MIN) in the selected timeframe — not the latest meter reading.');
  }
  const demandSubtitleEl = document.querySelector('[data-energy-chart-subtitle="demand"]');
  if (demandSubtitleEl) {
    demandSubtitleEl.textContent = timeframe === '24h'
      ? smacaT('energy_demand_24h_subtitle', 'Hourly demand intensity for the operational day (00:00–23:59, local time).')
      : smacaT('operational_demand_intensity', 'Operational demand intensity from meter deltas in the selected timeframe (when reported by devices).');
  }

  if (!energyRows || energyRows.length === 0) {
    [mainChartId, demandChartId, patternChartId, distributionChartId, shareChartId].forEach(function (id) {
      setEmptyContainer(id, 'No energy data for selected timeframe.');
    });
    setKpi(kpiIds.total, '--'); setKpiMeta(kpiIds.totalMeta, '--');
    setKpi(kpiIds.peak, '--'); setKpiMeta(kpiIds.peakMeta, '--');
    setKpi(kpiIds.avg, '--'); setKpiMeta(kpiIds.avgMeta, '--');
    setKpi(kpiIds.topLocation, '--'); setKpiMeta(kpiIds.topLocationMeta, '--');
    return;
  }

  smacaDebug('[SMACA][ENERGY] timeframe change start', { timeframe: timeframe });
  smacaDebug('[SMACA][ENERGY] active timeframe = ' + timeframe);

  const adapter = typeof window !== 'undefined' ? window.SMACAHighchartsAdapter : null;
  const hasHighcharts = !!(adapter && typeof adapter.createEnergyMainCombinedChart === 'function' && adapter.hasHighcharts && adapter.hasHighcharts());

  if (!hasHighcharts) {
    [mainChartId, demandChartId, patternChartId, distributionChartId, shareChartId].forEach(function (id) {
      setEmptyContainer(id, 'Highcharts is unavailable, unable to render charts.');
    });
    return;
  }

  smacaDebug('[SMACA][ENERGY] chart update start', { timeframe: timeframe });

  const HOUR_MS = 60 * 60 * 1000;
  const chartWindow = getSmacaLineChartWindow(timeframe);
  const bucketMs = chartWindow.bucketMs;
  const bucketTimesMs = chartWindow.bucketTimesMs;
  const rangeStartMs = chartWindow.rangeStartMs;
  const rangeEndMs = chartWindow.rangeEndMs;

  const metricUsed = 'energy_kwh';
  const bucketStrategy = 'per-sensor delta using last value in bucket (delta>=0) summed across sensors';

  const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
  const sensorMetaById = sensors.reduce(function (acc, s) {
    const id = Number(s?.id);
    if (Number.isFinite(id)) acc[String(id)] = s;
    return acc;
  }, {});

  const isValidRealEnergySensor = function (sensorKey) {
    const sensorMeta = sensorMetaById[String(sensorKey)];
    if (!sensorMeta) return false;
    const sensorLocation = String(sensorMeta?.sensor_location ?? sensorMeta?.location ?? '').trim();
    const sensorName = String(sensorMeta?.sensor_name ?? sensorMeta?.name ?? '').trim();
    if (!sensorLocation) return false;
    if (!sensorName) return false;
    // Guard against obvious mock/test naming patterns in metadata.
    const lowercaseName = sensorName.toLowerCase();
    const lowercaseLocation = sensorLocation.toLowerCase();
    if (lowercaseName.includes('test') || lowercaseName.includes('mock')) return false;
    if (lowercaseLocation.includes('test') || lowercaseLocation.includes('mock')) return false;
    // Reject the historical "Default Site" placeholder. Older readings
    // (before the spatial taxonomy was wired up) used `sensor_location =
    // 'Default Site'` and `sensor_name = 'Sensor <uid>'`. Including those
    // pollutes per-location aggregates with a fake area bucket.
    if (lowercaseLocation === 'default site') return false;
    if (/^sensor\s+\w+/.test(sensorName) && lowercaseLocation === 'default site') return false;
    return true;
  };

  const getEnergyLocationLabel = function (sensorKey, locationHint) {
    const sensorMeta = sensorMetaById[String(sensorKey)];
    const rawCode = locationHint
      || sensorMeta?.sensor_location
      || sensorMeta?.location
      || null;
    // Prefer the human-readable spatial label (e.g. "1st Floor" rather than
    // "F1") for any KPI card, chart axis, or "Top Contributor" caption.
    if (rawCode && window.SMACASpatial && typeof window.SMACASpatial.labelFor === 'function') {
      const resolved = window.SMACASpatial.labelFor(rawCode);
      if (resolved && resolved !== rawCode) return String(resolved);
    }
    return rawCode
      ? String(rawCode)
      : (sensorMeta?.site?.name || sensorMeta?.siteName || sensorMeta?.name || 'Unknown location');
  };

  // Parse raw energy rows into per-sensor point list (real hydrated data only).
  const energyPoints = energyRows
    .map(function (row) {
      return {
        timeMs: new Date(row?.time).getTime(),
        sensorId: row?.sensorId,
        value: Number(row?.payload?.object?.energy_kwh),
        locationHint: row?.payload?.object?.sensor_location
          || row?.payload?.object?.location
          || row?.payload?.object?.site
          || row?.payload?.object?.siteName
          || row?.payload?.object?.room
          || row?.payload?.object?.zone
          || null
      };
    })
    .filter(function (p) {
      return Number.isFinite(p?.timeMs) && Number.isFinite(Number(p?.sensorId)) && Number.isFinite(p?.value)
        && p.timeMs >= rangeStartMs && p.timeMs <= rangeEndMs;
    });

  const pointsBySensor = energyPoints.reduce(function (acc, p) {
    const sensorKey = String(p.sensorId);
    if (!acc[sensorKey]) acc[sensorKey] = [];
    acc[sensorKey].push(p);
    return acc;
  }, {});

  const sensorIds = Object.keys(pointsBySensor).filter(function (sensorKey) {
    if (!isValidRealEnergySensor(sensorKey)) return false;
    // Exclude extremely low data volume sensors.
    return (pointsBySensor[sensorKey] || []).length > 1;
  });
  const filteredOutSensorCount = Math.max(0, Object.keys(pointsBySensor).length - sensorIds.length);
  const allowedSensorSet = sensorIds.reduce(function (acc, sensorKey) {
    acc[sensorKey] = true;
    return acc;
  }, {});
  const filteredEnergyPoints = energyPoints.filter(function (p) {
    return !!allowedSensorSet[String(p.sensorId)];
  });
  smacaDebug('[SMACA][ENERGY] sensor quality filter', {
    timeframe: timeframe,
    validSensorCount: sensorIds.length,
    filteredOutSensorCount: filteredOutSensorCount
  });
  const bucketMin = bucketTimesMs.length ? bucketTimesMs[0] : null;
  const bucketMax = bucketTimesMs.length ? bucketTimesMs[bucketTimesMs.length - 1] : null;

  // Track last reading per sensor per bucket.
  const lastBySensorByBucket = {};
  filteredEnergyPoints.forEach(function (p) {
    const bucketKey = resolveSmacaChartBucketKey(p.timeMs, chartWindow);
    if (bucketKey === null || bucketKey < bucketMin || bucketKey > bucketMax) return;
    const sensorKey = String(p.sensorId);
    if (!lastBySensorByBucket[sensorKey]) lastBySensorByBucket[sensorKey] = {};
    const existing = lastBySensorByBucket[sensorKey][bucketKey];
    if (!existing || p.timeMs > existing.timeMs) {
      lastBySensorByBucket[sensorKey][bucketKey] = { timeMs: p.timeMs, value: p.value, locationHint: p.locationHint };
    }
  });

  // Energy usage per bucket = summed positive deltas between consecutive buckets.
  const energyValues = [];
  const bucketHasData = [];
  for (let i = 0; i < bucketTimesMs.length; i += 1) {
    const bucketKey = bucketTimesMs[i];
    const prevKey = i > 0 ? bucketTimesMs[i - 1] : null;
    let sumDelta = 0;
    let hasAny = false;

    sensorIds.forEach(function (sensorKey) {
      if (!prevKey) return;
      const byBucket = lastBySensorByBucket[sensorKey];
      if (!byBucket) return;
      const curr = byBucket[bucketKey];
      const prev = byBucket[prevKey];
      if (!curr || !prev) return;
      const delta = Number(curr.value) - Number(prev.value);
      if (Number.isFinite(delta) && delta >= 0) {
        sumDelta += delta;
        hasAny = true;
      }
    });

    bucketHasData.push(hasAny);
    energyValues.push(hasAny ? sumDelta : null);
  }

  const operationalNowMs = Number(chartWindow.rangeEndMs) || Date.now();
  const currentHourIndex = timeframe === '24h'
    ? getSmacaOperationalCurrentHourIndex(bucketTimesMs, operationalNowMs)
    : bucketTimesMs.length - 1;
  let lastRealBucketIndex = -1;
  for (let i = 0; i < bucketHasData.length; i += 1) {
    if (!bucketHasData[i]) continue;
    if (timeframe === '24h' && i > currentHourIndex) continue;
    lastRealBucketIndex = i;
  }

  if (timeframe === '24h') {
    for (let i = 0; i < energyValues.length; i += 1) {
      if (i > currentHourIndex || !bucketHasData[i]) {
        energyValues[i] = null;
      }
    }
  }

  const hasAnyEnergy = energyValues.some(function (v) { return Number.isFinite(Number(v)); });
  const trendValues = [];
  let running = 0;
  for (let i = 0; i < energyValues.length; i += 1) {
    if (timeframe === '24h') {
      if (i > currentHourIndex || !bucketHasData[i]) {
        trendValues.push(null);
        continue;
      }
      running += Number(energyValues[i]);
      trendValues.push(running);
      continue;
    }
    const v = energyValues[i];
    if (Number.isFinite(Number(v))) {
      running += Number(v);
      trendValues.push(running);
    } else {
      trendValues.push(null);
    }
  }

  const chartAvgUsage = (function () {
    const samples = energyValues
      .map(function (v, idx) {
        if (!Number.isFinite(Number(v))) return null;
        if (timeframe === '24h' && (idx > currentHourIndex || !bucketHasData[idx])) return null;
        return Number(v);
      })
      .filter(function (v) { return v !== null; });
    return samples.length
      ? (samples.reduce(function (s, v) { return s + v; }, 0) / samples.length)
      : null;
  })();

  // Aggregate per location using real per-sensor delta across the selected timeframe window.
  // (This powers both the distribution bar and the share donut.)
  const bySensorFirstLast = {};
  filteredEnergyPoints.forEach(function (p) {
    const sensorKey = String(p.sensorId);
    if (!bySensorFirstLast[sensorKey]) {
      bySensorFirstLast[sensorKey] = {
        first: { timeMs: p.timeMs, value: p.value },
        last: { timeMs: p.timeMs, value: p.value },
        locationHint: p.locationHint
      };
    } else {
      const entry = bySensorFirstLast[sensorKey];
      entry.locationHint = entry.locationHint || p.locationHint || null;
      if (p.timeMs < entry.first.timeMs) {
        entry.first = { timeMs: p.timeMs, value: p.value };
      }
      if (p.timeMs > entry.last.timeMs) {
        entry.last = { timeMs: p.timeMs, value: p.value };
        entry.locationHint = p.locationHint || entry.locationHint || null;
      }
    }
  });

  const locationTotals = {};
  Object.keys(bySensorFirstLast).forEach(function (sensorKey) {
    const entry = bySensorFirstLast[sensorKey];
    if (!entry?.first || !entry?.last) return;
    const delta = Number(entry.last.value) - Number(entry.first.value);
    if (!Number.isFinite(delta) || delta < 0) return;
    const label = getEnergyLocationLabel(sensorKey, entry.locationHint);
    if (!locationTotals[label]) locationTotals[label] = 0;
    locationTotals[label] += delta;
  });

  const locationSorted = Object.keys(locationTotals)
    .map(function (label) { return { label: label, value: locationTotals[label] }; })
    .filter(function (e) { return Number.isFinite(Number(e.value)) && e.value > 0; })
    .sort(function (a, b) { return b.value - a.value; });

  const topN = 6;
  const topLocations = locationSorted.slice(0, topN);
  const otherLocations = locationSorted.slice(topN);
  const otherTotal = otherLocations.reduce(function (s, e) { return s + Number(e.value); }, 0);

  const locationLabels = topLocations.map(function (e) { return e.label; });
  const locationValues = topLocations.map(function (e) { return e.value; });
  if (otherLocations.length && Number.isFinite(Number(otherTotal)) && otherTotal > 0) {
    locationLabels.push('Other');
    locationValues.push(otherTotal);
  }

  // Usage pattern by hour (hour-of-day colored columns).
  const hourBucketCount = timeframe === '24h' ? 24 : (timeframe === '7d' ? 7 * 24 : 30 * 24);
  const hourlyBucketTimesMs = timeframe === '24h'
    ? Array.from({ length: 24 }, function (_, idx) {
      return getSmacaOperationalDayStartMs(rangeEndMs) + (idx * HOUR_MS);
    })
    : Array.from({ length: hourBucketCount }, function (_, idx) {
      const alignedEndHourMs = Math.floor(rangeEndMs / HOUR_MS) * HOUR_MS;
      return alignedEndHourMs - (hourBucketCount - 1 - idx) * HOUR_MS;
    });

  const hourlyMin = hourlyBucketTimesMs.length ? hourlyBucketTimesMs[0] : null;
  const hourlyMax = hourlyBucketTimesMs.length ? hourlyBucketTimesMs[hourlyBucketTimesMs.length - 1] : null;

  // Track last reading per sensor per hourly bucket to compute real deltas.
  const lastBySensorByHourlyBucket = {};
  filteredEnergyPoints.forEach(function (p) {
    const bucketKey = Math.floor(p.timeMs / HOUR_MS) * HOUR_MS;
    if (bucketKey < hourlyMin || bucketKey > hourlyMax) return;
    const sensorKey = String(p.sensorId);
    if (!lastBySensorByHourlyBucket[sensorKey]) lastBySensorByHourlyBucket[sensorKey] = {};
    const existing = lastBySensorByHourlyBucket[sensorKey][bucketKey];
    if (!existing || p.timeMs > existing.timeMs) {
      lastBySensorByHourlyBucket[sensorKey][bucketKey] = { timeMs: p.timeMs, value: p.value };
    }
  });

  const hourlyUsageValues = [];
  for (let i = 0; i < hourlyBucketTimesMs.length; i += 1) {
    const bucketKey = hourlyBucketTimesMs[i];
    const prevKey = i > 0 ? hourlyBucketTimesMs[i - 1] : null;
    let sumDelta = 0;
    let hasAny = false;

    sensorIds.forEach(function (sensorKey) {
      if (!prevKey) return;
      const byBucket = lastBySensorByHourlyBucket[sensorKey];
      if (!byBucket) return;
      const curr = byBucket[bucketKey];
      const prev = byBucket[prevKey];
      if (!curr || !prev) return;
      const delta = Number(curr.value) - Number(prev.value);
      if (Number.isFinite(delta) && delta >= 0) {
        sumDelta += delta;
        hasAny = true;
      }
    });

    hourlyUsageValues.push(hasAny ? sumDelta : null);
  }

  const hourCategories = Array.from({ length: 24 }, function (_, h) {
    return String(h).padStart(2, '0');
  });

  const usagePatternByHour = timeframe === '24h'
    ? hourlyUsageValues.map(function (v) {
      return Number.isFinite(Number(v)) ? Number(v) : 0;
    })
    : hourCategories.map(function (_, hourOfDay) {
      let sum = 0;
      let count = 0;
      hourlyUsageValues.forEach(function (v, idx) {
        if (!Number.isFinite(Number(v))) return;
        const bucketHour = new Date(hourlyBucketTimesMs[idx]).getHours();
        if (bucketHour === hourOfDay) {
          sum += Number(v);
          count += 1;
        }
      });
      return count > 0 ? (sum / count) : null;
    });

  // KPI calculations (real derived values from the selected window).
  const numericEnergy = energyValues
    .map(function (v) { return Number(v); })
    .filter(function (v) { return Number.isFinite(v); });

  const totalEnergy = numericEnergy.reduce(function (s, v) { return s + v; }, 0);
  const peakEnergy = numericEnergy.length ? Math.max.apply(null, numericEnergy) : null;
  const avgEnergy = numericEnergy.length ? (totalEnergy / numericEnergy.length) : null;

  let peakLabel = '--';
  if (peakEnergy != null) {
    const peakIdx = energyValues.findIndex(function (v) {
      return Number.isFinite(Number(v)) && Number(v) === peakEnergy;
    });
    if (peakIdx >= 0 && bucketTimesMs[peakIdx]) {
      const t = bucketTimesMs[peakIdx];
      const dt = new Date(t);
      peakLabel = timeframe === '24h'
        ? (String(new Date(t).getHours()).padStart(2, '0') + ':00')
        : window.Highcharts.dateFormat('%d %b', t);
    }
  }

  const topLocationLabel = locationLabels.length ? locationLabels[0] : '--';
  const topLocationValue = locationValues.length ? locationValues[0] : null;

  setKpi(kpiIds.total, totalEnergy && Number.isFinite(totalEnergy) ? totalEnergy.toFixed(1) : '--');
  setKpiMeta(kpiIds.totalMeta, timeframeMeta);
  setKpi(kpiIds.peak, peakEnergy != null && Number.isFinite(peakEnergy) ? Number(peakEnergy).toFixed(1) : '--');
  setKpiMeta(kpiIds.peakMeta, peakLabel === '--' ? 'Peak bucket' : 'Peak at ' + peakLabel);
  setKpi(kpiIds.avg, avgEnergy != null && Number.isFinite(avgEnergy) ? Number(avgEnergy).toFixed(1) : '--');
  setKpiMeta(kpiIds.avgMeta, 'Avg per bucket');
  setKpi(kpiIds.topLocation, topLocationLabel);
  setKpiMeta(kpiIds.topLocationMeta, topLocationValue != null && Number.isFinite(topLocationValue) ? topLocationValue.toFixed(1) + ' kWh' : '--');

  // Render charts (real data only).
  // Avoid clearing chart containers before Highcharts update/recreate; that can detach chart internals.

  if (!hasAnyEnergy) {
    setEmptyContainer(mainChartId, 'Energy data is unavailable for the selected timeframe.');
    setEmptyContainer(demandChartId, 'Demand trend is unavailable for the selected timeframe.');
    setEmptyContainer(patternChartId, smacaT('usage', 'Usage') + ' pattern is unavailable for the selected timeframe.');
    setEmptyContainer(distributionChartId, 'Energy distribution is unavailable for the selected timeframe.');
    setEmptyContainer(shareChartId, 'Energy share is unavailable for the selected timeframe.');
    return;
  }

  const energyRenderState = (typeof window !== 'undefined')
    ? (window.__smacaEnergyRenderState = window.__smacaEnergyRenderState || { lastTimeframe: null })
    : { lastTimeframe: null };
  const timeframeChanged = !!(energyRenderState.lastTimeframe && energyRenderState.lastTimeframe !== timeframe);
  let recreatedMainChart = false;
  if (timeframeChanged && adapter && typeof adapter.destroyChart === 'function') {
    recreatedMainChart = !!adapter.destroyChart('energy-main-combined');
  }
  energyRenderState.lastTimeframe = timeframe;

  smacaDebug('[SMACA][ENERGY] chart render start', { timeframe: timeframe });
  smacaDebug('[SMACA][ENERGY] using recreate path = ' + String(timeframeChanged));

  const energyNoDataYet = smacaT('energy_no_data_yet', 'No data yet');
  const mainRendered = adapter.createEnergyMainCombinedChart(mainChartId, {
    timeframe: timeframe,
    bucketTimesMs: bucketTimesMs,
    energyValues: energyValues,
    trendValues: trendValues,
    avgUsage: chartAvgUsage,
    currentHourIndex: currentHourIndex,
    lastRealBucketIndex: lastRealBucketIndex,
    noDataYetLabel: energyNoDataYet
  });
  recreatedMainChart = recreatedMainChart || !!(mainRendered && mainRendered.recreated);

  // Visual fairness: when data exists only in a tiny slice of the window
  // (e.g. 30d view but only the last 4 days have readings), surface a
  // banner so the empty left side is clearly explained rather than read
  // as "the chart is broken".
  const energyPopulatedBuckets = timeframe === '24h'
    ? bucketHasData.filter(function (has, idx) {
      return has && idx <= currentHourIndex;
    }).length
    : energyValues.filter(function (v) {
      return Number.isFinite(Number(v));
    }).length;
  renderSparseDataNote(mainChartId, energyPopulatedBuckets, energyValues.length, timeframe);

  // Enforce a safe lifecycle pass after timeframe transitions.
  const mainChart = window.__smacaHighchartsStore?.charts?.['energy-main-combined'] || null;
  if (mainChart) {
    try { mainChart.redraw(false); } catch (e) {}
    try { mainChart.reflow(); } catch (e) {}
    setTimeout(function () {
      try { mainChart.reflow(); } catch (e) {}
    }, 0);
  }

  const demandRendered = adapter.createEnergyDemandTrendChart(demandChartId, {
    timeframe: timeframe,
    bucketTimesMs: bucketTimesMs,
    values: energyValues,
    currentHourIndex: currentHourIndex,
    lastRealBucketIndex: lastRealBucketIndex,
    noDataYetLabel: energyNoDataYet
  });

  const patternRendered = adapter.createEnergyUsagePatternHourChart(patternChartId, {
    timeframe: timeframe,
    categories: hourCategories,
    values: usagePatternByHour
  });

  const distributionRendered = (locationLabels.length && locationValues.length)
    ? adapter.createEnergyDistributionByLocationChart(distributionChartId, {
      timeframe: timeframe,
      categories: locationLabels,
      values: locationValues
    })
    : { ok: false, reason: 'no-location-data' };

  const shareRendered = (locationLabels.length && locationValues.length)
    ? adapter.createEnergyShareDonutChart(shareChartId, {
      timeframe: timeframe,
      labels: locationLabels,
      values: locationValues
    })
    : { ok: false, reason: 'no-location-data' };

  if (!mainRendered || !mainRendered.ok) {
    setEmptyContainer(mainChartId, 'Unable to render energy chart for the selected timeframe.');
  }
  if (!demandRendered || !demandRendered.ok) {
    setEmptyContainer(demandChartId, 'Unable to render demand trend for the selected timeframe.');
  }
  if (!patternRendered || !patternRendered.ok) {
    setEmptyContainer(patternChartId, 'Unable to render usage pattern for the selected timeframe.');
  }
  if (!distributionRendered || !distributionRendered.ok) {
    setEmptyContainer(distributionChartId, 'Energy distribution unavailable for the selected timeframe.');
  }
  if (!shareRendered || !shareRendered.ok) {
    setEmptyContainer(shareChartId, 'Energy share unavailable for the selected timeframe.');
  }

  smacaDebug('[SMACA][ENERGY] renderer = highcharts', { timeframe: timeframe });
  smacaDebug('[SMACA][ENERGY] chart render success', { timeframe: timeframe });
  smacaDebug('[SMACA][ENERGY] chart update success', { timeframe: timeframe });

  const mainContainer = document.getElementById(mainChartId);
  const containerWidth = Number(mainContainer?.offsetWidth || 0);
  const containerHeight = Number(mainContainer?.offsetHeight || 0);
  const hasUsageSeries = energyValues.some(function (v) { return Number.isFinite(Number(v)); });
  const hasTrendSeries = trendValues.some(function (v) { return Number.isFinite(Number(v)); });
  const visibleSeriesCount = (hasUsageSeries ? 1 : 0) + (hasTrendSeries ? 1 : 0);

  window.__energyChartDebug = {
    timeframe: timeframe,
    rangeStart: new Date(rangeStartMs).toISOString(),
    rangeEnd: new Date(rangeEndMs).toISOString(),
    pointCount: bucketTimesMs.length,
    populatedBuckets: energyPopulatedBuckets,
    metricUsed: metricUsed,
    bucketStrategy: bucketStrategy,
    validSensorCount: sensorIds.length,
    filteredOutSensorCount: filteredOutSensorCount,
    mainSeries: { data: energyValues },
    trendSeries: { data: trendValues },
    demandTrendSeries: { data: energyValues },
    usagePatternByHour: { labels: hourCategories, data: usagePatternByHour },
    locationTotals: { labels: locationLabels, data: locationValues },
    render: {
      timeframe: timeframe,
      usingHighcharts: true,
      recreated: recreatedMainChart || timeframeChanged,
      containerWidth: containerWidth,
      containerHeight: containerHeight,
      visibleSeriesCount: visibleSeriesCount
    }
  };
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
    const occupancyText = String(occupancyCounter.textContent || '').toLowerCase();
    const hasLoadingPlaceholder = occupancyText.indexOf('loading') !== -1 || occupancyText.indexOf('φόρτωση') !== -1;
    if (!hasLoadingPlaceholder) {
      occupancyCounter.textContent = 'No occupancy data available';
    }
  }
  const occupancySection = document.getElementById('occupancy');
  if (occupancySection) {
    const cumulativeLabelEl = document.getElementById('occupancy-operational-summary-sub');
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
  
  // Environmental hero UV is owned by updateEnvironmentalDashboard on that page.
  if (getSmacaCurrentPage() !== 'environmental') {
    const uvCounter = document.getElementById('environmental-uv-index');
    const environmentalRows = Array.isArray(SMACAState.rawData?.environmental) ? SMACAState.rawData.environmental : (filteredData.environmental || []);
    if (uvCounter && environmentalRows.length > 0) {
      const uvValue = getAggregatedAverage(getLatestValidMetricPerSensor(environmentalRows, 'uv_index'));
      uvCounter.textContent = Number.isFinite(Number(uvValue)) ? Number(uvValue).toFixed(1) : 'Unsupported by device';
    } else if (uvCounter) {
      uvCounter.textContent = 'No UV data available';
    }
  }
  
  // Update Management total sensors
  const managementCounter = document.getElementById('management-total-sensors');
  if (managementCounter) {
    const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
    managementCounter.textContent = String(sensors.length);
  }
  
  // Update Overview total sensors
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
  if (activeCounter) activeCounter.textContent = String(activeSensors);
  
  const maintenanceFallback = Math.max(0, sensors.length - activeFallback);
  const maintenanceSensors = Number.isFinite(Number(totals.maintenance_sensors ?? totals.inactive_sensors))
    ? Number(totals.maintenance_sensors ?? totals.inactive_sensors)
    : maintenanceFallback;
  const freshnessAdmin = document.getElementById('overview-data-freshness-admin');
  if (freshnessAdmin) freshnessAdmin.textContent = computeOverviewFreshnessLabel();
  
  const connectedSensors = Number.isFinite(Number(totals.connected_sensors)) ? Number(totals.connected_sensors) : sensors.length;
  const totalSensors = Number.isFinite(Number(totals.sensors)) ? Number(totals.sensors) : sensors.length;
  const connectivityHealthCounter = document.getElementById('overview-connectivity-health');
  if (connectivityHealthCounter) {
    const wirelessPct = resolveCampusConnectivityQualityPct(sensors);
    connectivityHealthCounter.textContent = wirelessPct !== null
      ? `${Math.round(wirelessPct)}%`
      : (totalSensors > 0 ? `${Math.round((connectedSensors / totalSensors) * 100)}%` : smacaT('not_available','Not available'));
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
  const sensorsOnlineEl = document.getElementById('overview-sensors-online');
  if (sensorsOnlineEl) {
    const totalSensors = Number.isFinite(Number(totals.sensors)) ? Number(totals.sensors) : sensors.length;
    sensorsOnlineEl.textContent = `${connectedSensors}/${totalSensors}`;
  }
}

function updateOverviewLiveValues(overview, sensorRows) {
  const iaqRows = Array.isArray(SMACAState.rawData?.iaq) ? SMACAState.rawData.iaq : [];
  const environmentalRows = Array.isArray(SMACAState.rawData?.environmental) ? SMACAState.rawData.environmental : [];
  const filteredOccupancyRows = (typeof SMACAState.getFilteredOccupancy === 'function')
    ? (SMACAState.getFilteredOccupancy() || [])
    : [];
  const occupancyRows = filteredOccupancyRows.length > 0
    ? filteredOccupancyRows
    : (Array.isArray(SMACAState.rawData?.occupancy) ? SMACAState.rawData.occupancy : []);
  const totals = overview?.totals || {};
  const connectedSensors = Number.isFinite(Number(totals.connected_sensors)) ? Number(totals.connected_sensors) : sensorRows.length;
  const totalSensors = Number.isFinite(Number(totals.sensors)) ? Number(totals.sensors) : sensorRows.length;
  const wirelessQualityPct = resolveCampusConnectivityQualityPct(sensorRows);
  const connectivityPct = wirelessQualityPct !== null
    ? Math.round(wirelessQualityPct)
    : (totalSensors > 0 ? Math.round((connectedSensors / totalSensors) * 100) : null);

  const latestCo2 = resolveLatestIaqMetricForOverview('co2', iaqRows, overview, sensorRows);
  const latestPm25 = resolveLatestIaqMetricForOverview('pm2_5', iaqRows, overview, sensorRows);
  const latestUv = resolveLatestUvForOverview(environmentalRows, overview, sensorRows);
  const latestOccupancy = resolveLatestOccupancyForOverview(occupancyRows, overview, sensorRows);

  const airStatus = evaluateAirQualityStatus(latestCo2, latestPm25);
  const occupancyStatus = evaluateOccupancyStatus(latestOccupancy);
  const connectivityStatus = evaluateConnectivityStatus(connectivityPct);
  const uvStatus = evaluateUvStatus(latestUv);

  const airValueEl = document.getElementById('overview-air-quality-status');
  if (airValueEl) airValueEl.textContent = airStatus.label;
  const airTrendEl = document.getElementById('overview-air-quality-trend');
  if (airTrendEl) {
    airTrendEl.textContent = Number.isFinite(latestCo2) ? `CO₂ ${Math.round(latestCo2)} ppm` : smacaT('no_iaq_data', 'No IAQ data');
  }

  const connectivityTrendEl = document.getElementById('overview-connectivity-trend');
  if (connectivityTrendEl) {
    connectivityTrendEl.textContent = Number.isFinite(connectivityPct)
      ? `${connectivityPct}% ${smacaT('overview_connectivity_quality', 'quality')}`
      : smacaT('no_connectivity_data', 'No connectivity data');
  }

  const badgeAir = document.getElementById('overview-badge-air-quality');
  if (badgeAir) badgeAir.textContent = getOverviewOperationalHeadline('air-quality', airStatus);
  const badgeConn = document.getElementById('overview-badge-connectivity');
  if (badgeConn) badgeConn.textContent = getOverviewOperationalHeadline('connectivity', connectivityStatus);
  const badgeOcc = document.getElementById('overview-badge-occupancy');
  if (badgeOcc) badgeOcc.textContent = getOverviewOperationalHeadline('occupancy', occupancyStatus);
  const badgeUv = document.getElementById('overview-badge-uv');
  if (badgeUv) badgeUv.textContent = getOverviewOperationalHeadline('uv', uvStatus);
  updateOverviewStatusTile('overview-status-tile-air-quality', 'air-quality', airStatus);
  updateOverviewStatusTile('overview-status-tile-connectivity', 'connectivity', connectivityStatus);
  updateOverviewStatusTile('overview-status-tile-occupancy', 'occupancy', occupancyStatus);
  updateOverviewStatusTile('overview-status-tile-uv', 'uv', uvStatus);
  updateOverviewOverallLiveHealth([
    { key: 'air-quality', status: airStatus },
    { key: 'connectivity', status: connectivityStatus },
    { key: 'occupancy', status: occupancyStatus },
    { key: 'uv', status: uvStatus }
  ]);

  const streamsStatus = document.getElementById('overview-live-streams-status');
  if (streamsStatus) {
    streamsStatus.textContent = Number.isFinite(connectivityPct) ? `${smacaT('live_streams', 'Live Streams')}: ${connectivityPct}% ${smacaT('online', 'online')}` : `${smacaT('live_streams', 'Live Streams')}: ${smacaT('not_available_label', 'Not available')}`;
  }
  const freshnessText = computeOverviewFreshnessLabel();
  const dataFreshness = document.getElementById('overview-data-freshness');
  if (dataFreshness) dataFreshness.textContent = `${smacaT('data_freshness_label', 'Data freshness')}: ${freshnessText}`;

  setOverviewModuleStatus('overview-module-status-iaq', airStatus.moduleStatus, airStatus.moduleClass);
  setOverviewModuleStatus('overview-module-status-environmental', uvStatus.moduleStatus, uvStatus.moduleClass);
  setOverviewModuleStatus('overview-module-status-occupancy', occupancyStatus.moduleStatus, occupancyStatus.moduleClass);
  setOverviewModuleStatus('overview-module-status-connectivity', connectivityStatus.moduleStatus, connectivityStatus.moduleClass);
}

function resolveLatestMetricValue(rows, metricKey) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const metricAliases = {
    uv_index: ['uv_index', 'uv', 'uvIndex']
  };
  const metricKeys = Array.isArray(metricAliases[metricKey]) ? metricAliases[metricKey] : [metricKey];
  let latest = null;
  let latestTime = -Infinity;
  safeRows.forEach(function (item) {
    const t = new Date(item?.time || item?.timestamp || 0).getTime();
    const payloadObject = item?.payload?.object || {};
    let value = null;
    metricKeys.some(function (key) {
      const candidate = Number(payloadObject?.[key]);
      if (!Number.isFinite(candidate)) return false;
      value = candidate;
      return true;
    });
    if (!Number.isFinite(t) || !Number.isFinite(value) || t < latestTime) return;
    latestTime = t;
    latest = value;
  });
  return latest;
}

function extractLatestMetricFromOverviewSnapshotRows(overview, sensorRows, metricKey) {
  const snapshotRows = Array.isArray(overview?.latest_sensor_snapshot_rows) ? overview.latest_sensor_snapshot_rows : [];
  const sensors = Array.isArray(sensorRows) ? sensorRows : [];
  const metricMap = { co2: 'co2_ppm', pm2_5: 'pm2_5_ugm3' };
  const sourceMetric = metricMap[metricKey] || metricKey;
  const sensorById = sensors.reduce(function (acc, sensor) {
    const sid = Number(sensor?.id);
    if (Number.isFinite(sid)) acc[String(sid)] = sensor;
    return acc;
  }, {});
  let latest = null;
  let latestTime = -Infinity;
  snapshotRows.forEach(function (row) {
    const sid = Number(row?.sensor_id);
    const sensor = Number.isFinite(sid) ? sensorById[String(sid)] : null;
    if (!isIaqSensor(sensor)) return;
    const t = new Date(row?.measured_at || row?.latest?.measured_at || row?.last_seen_at || 0).getTime();
    const value = Number(row?.[sourceMetric] ?? row?.latest?.[sourceMetric]);
    if (!Number.isFinite(t) || !Number.isFinite(value) || t < latestTime) return;
    latestTime = t;
    latest = value;
  });
  return latest;
}

function extractLatestMetricFromSensorLatestReadings(sensorRows, metricKey) {
  const sensors = Array.isArray(sensorRows) ? sensorRows : [];
  const latestById = window.SMACADashboardContext?.selectedSensorLatestById || {};
  const metricMap = { co2: 'co2_ppm', pm2_5: 'pm2_5_ugm3' };
  const sourceMetric = metricMap[metricKey] || metricKey;
  let latest = null;
  let latestTime = -Infinity;
  sensors.forEach(function (sensor) {
    if (!isIaqSensor(sensor)) return;
    const sid = Number(sensor?.id);
    if (!Number.isFinite(sid)) return;
    const latestRow = latestById[String(sid)] || null;
    const t = new Date(latestRow?.latest?.measured_at || latestRow?.last_seen_at || 0).getTime();
    const value = Number(latestRow?.latest?.[sourceMetric]);
    if (!Number.isFinite(t) || !Number.isFinite(value) || t < latestTime) return;
    latestTime = t;
    latest = value;
  });
  return latest;
}

function resolveLatestIaqMetricForOverview(metricKey, iaqRows, overview, sensorRows) {
  const fromHydrated = resolveLatestMetricValue(iaqRows, metricKey);
  if (Number.isFinite(fromHydrated)) return fromHydrated;
  const fromLatestReadings = extractLatestMetricFromSensorLatestReadings(sensorRows, metricKey);
  if (Number.isFinite(fromLatestReadings)) return fromLatestReadings;
  return extractLatestMetricFromOverviewSnapshotRows(overview, sensorRows, metricKey);
}

function resolveLatestUvForOverview(environmentalRows, overview, sensorRows) {
  const fromHydrated = resolveLatestMetricValue(environmentalRows, 'uv_index');
  if (Number.isFinite(fromHydrated)) return fromHydrated;
  const fromLatestReadings = extractLatestEnvironmentalMetricFromSensorLatestReadings(sensorRows, ['uv_index', 'uv', 'uvIndex']);
  if (Number.isFinite(fromLatestReadings)) return fromLatestReadings;
  return extractLatestEnvironmentalMetricFromOverviewSnapshotRows(overview, sensorRows, ['uv_index', 'uv', 'uvIndex']);
}

function resolveLatestOccupancyForOverview(occupancyRows, overview, sensorRows) {
  const fromHydrated = resolveLatestOccupancyValue(occupancyRows);
  if (Number.isFinite(fromHydrated)) return fromHydrated;
  const fromLatestReadings = extractLatestOccupancyFromSensorLatestReadings(sensorRows);
  if (Number.isFinite(fromLatestReadings)) return fromLatestReadings;
  return resolveLatestOccupancyFromOverviewSnapshot(overview);
}

function extractLatestEnvironmentalMetricFromSensorLatestReadings(sensorRows, metricKeys) {
  const sensors = Array.isArray(sensorRows) ? sensorRows : [];
  const keys = Array.isArray(metricKeys) && metricKeys.length > 0 ? metricKeys : ['uv_index'];
  const latestById = window.SMACADashboardContext?.selectedSensorLatestById || {};
  let latest = null;
  let latestTime = -Infinity;
  sensors.forEach(function (sensor) {
    if (!isEnvironmentalSensor(sensor)) return;
    const sid = Number(sensor?.id);
    if (!Number.isFinite(sid)) return;
    const latestRow = latestById[String(sid)] || null;
    const t = new Date(latestRow?.latest?.measured_at || latestRow?.last_seen_at || 0).getTime();
    if (!Number.isFinite(t) || t < latestTime) return;
    const reading = latestRow?.latest || {};
    let value = null;
    keys.some(function (key) {
      const candidate = Number(reading?.[key]);
      if (!Number.isFinite(candidate)) return false;
      value = candidate;
      return true;
    });
    if (!Number.isFinite(value)) return;
    latestTime = t;
    latest = value;
  });
  return latest;
}

function extractLatestEnvironmentalMetricFromOverviewSnapshotRows(overview, sensorRows, metricKeys) {
  const snapshotRows = Array.isArray(overview?.latest_sensor_snapshot_rows) ? overview.latest_sensor_snapshot_rows : [];
  const sensors = Array.isArray(sensorRows) ? sensorRows : [];
  const keys = Array.isArray(metricKeys) && metricKeys.length > 0 ? metricKeys : ['uv_index'];
  const sensorById = sensors.reduce(function (acc, sensor) {
    const sid = Number(sensor?.id);
    if (Number.isFinite(sid)) acc[String(sid)] = sensor;
    return acc;
  }, {});
  let latest = null;
  let latestTime = -Infinity;
  snapshotRows.forEach(function (row) {
    const sid = Number(row?.sensor_id);
    const sensor = Number.isFinite(sid) ? sensorById[String(sid)] : null;
    if (!isEnvironmentalSensor(sensor)) return;
    const t = new Date(row?.measured_at || row?.latest?.measured_at || row?.last_seen_at || 0).getTime();
    if (!Number.isFinite(t) || t < latestTime) return;
    const container = row?.latest || row || {};
    let value = null;
    keys.some(function (key) {
      const candidate = Number(container?.[key]);
      if (!Number.isFinite(candidate)) return false;
      value = candidate;
      return true;
    });
    if (!Number.isFinite(value)) return;
    latestTime = t;
    latest = value;
  });
  return latest;
}

function extractLatestOccupancyFromSensorLatestReadings(sensorRows) {
  const sensors = Array.isArray(sensorRows) ? sensorRows : [];
  const latestById = window.SMACADashboardContext?.selectedSensorLatestById || {};
  const latestBySensor = new Map();
  let fallbackValue = null;
  let fallbackTime = -Infinity;
  sensors.forEach(function (sensor) {
    if (!isOccupancySensor(sensor)) return;
    const sid = Number(sensor?.id);
    if (!Number.isFinite(sid)) return;
    const latestRow = latestById[String(sid)] || null;
    const t = new Date(latestRow?.latest?.measured_at || latestRow?.last_seen_at || 0).getTime();
    const value = resolveOccupancyValueFromPayload(latestRow?.latest || latestRow?.payload?.object || {});
    if (!Number.isFinite(t) || !Number.isFinite(value)) return;
    const sensorKey = String(sid);
    const existing = latestBySensor.get(sensorKey);
    if (!existing || t >= existing.time) latestBySensor.set(sensorKey, { time: t, value: value });
    if (t >= fallbackTime) {
      fallbackTime = t;
      fallbackValue = value;
    }
  });
  if (latestBySensor.size > 0) {
    let total = 0;
    latestBySensor.forEach(function (entry) { total += Number(entry.value) || 0; });
    return total;
  }
  return fallbackValue;
}

function evaluateAirQualityStatus(co2, pm25) {
  if (!Number.isFinite(co2) && !Number.isFinite(pm25)) return { label: 'No data', moduleStatus: 'No data', moduleClass: 'stable' };
  if ((Number.isFinite(co2) && co2 > 1000) || (Number.isFinite(pm25) && pm25 > 35)) return { label: 'Alert', moduleStatus: 'Warning', moduleClass: 'warning' };
  if ((Number.isFinite(co2) && co2 > 800) || (Number.isFinite(pm25) && pm25 > 15)) return { label: smacaT('moderate','Moderate'), moduleStatus: 'Stable', moduleClass: 'stable' };
  return { label: smacaT('good', 'Good'), moduleStatus: 'Active', moduleClass: 'active' };
}

function evaluateOccupancyStatus(occupancy) {
  if (!Number.isFinite(occupancy)) return { label: 'No data', moduleStatus: 'No data', moduleClass: 'stable' };
  if (occupancy >= 80) return { label: 'High', moduleStatus: 'Warning', moduleClass: 'warning' };
  if (occupancy >= 30) return { label: smacaT('moderate','Moderate'), moduleStatus: 'Stable', moduleClass: 'stable' };
  return { label: smacaT('low', 'Low'), moduleStatus: 'Active', moduleClass: 'active' };
}

function evaluateConnectivityStatus(connectivityPct) {
  if (!Number.isFinite(connectivityPct)) return { label: 'No data', moduleStatus: 'No data', moduleClass: 'stable' };
  if (connectivityPct < 80) return { label: 'Unstable', moduleStatus: 'Warning', moduleClass: 'warning' };
  if (connectivityPct < 95) return { label: 'Degraded', moduleStatus: 'Stable', moduleClass: 'stable' };
  return { label: 'Stable', moduleStatus: 'Active', moduleClass: 'active' };
}

function evaluateUvStatus(uv) {
  const normalizedUv = normalizeUvIndexValue(uv);
  if (!Number.isFinite(normalizedUv)) return { label: 'No data', moduleStatus: 'No data', moduleClass: 'stable' };
  if (normalizedUv >= 8) return { label: 'High', moduleStatus: 'Warning', moduleClass: 'warning' };
  if (normalizedUv >= 3) return { label: smacaT('moderate','Moderate'), moduleStatus: 'Stable', moduleClass: 'stable' };
  return { label: 'Normal', moduleStatus: 'Active', moduleClass: 'active' };
}

function normalizeUvIndexValue(rawUv) {
  const uv = Number(rawUv);
  if (!Number.isFinite(uv)) return null;
  if (uv <= 11) return uv;
  // Some integrations send deci-index or centi-index style UV values.
  if (uv <= 150) return uv / 10;
  if (uv <= 2000) return uv / 100;
  return uv;
}

function computeOverviewFreshnessLabel() {
  const pools = [
    Array.isArray(SMACAState.rawData?.iaq) ? SMACAState.rawData.iaq : [],
    Array.isArray(SMACAState.rawData?.occupancy) ? SMACAState.rawData.occupancy : [],
    Array.isArray(SMACAState.rawData?.environmental) ? SMACAState.rawData.environmental : []
  ];
  let latestTime = -Infinity;
  pools.forEach(function (rows) {
    rows.forEach(function (row) {
      const t = new Date(row?.time || row?.timestamp || 0).getTime();
      if (Number.isFinite(t) && t > latestTime) latestTime = t;
    });
  });
  if (!Number.isFinite(latestTime) || latestTime <= 0) {
    latestTime = resolveLatestOverviewTelemetryTimestamp();
  }
  if (!Number.isFinite(latestTime) || latestTime <= 0) return smacaT('not_available','Not available');
  const seconds = Math.max(0, Math.round((Date.now() - latestTime) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

function resolveLatestOverviewTelemetryTimestamp() {
  let latestTime = -Infinity;
  const latestById = window.SMACADashboardContext?.selectedSensorLatestById || {};
  Object.keys(latestById).forEach(function (sensorId) {
    const row = latestById[sensorId];
    const t = new Date(row?.last_seen_at || row?.latest?.measured_at || row?.latest?.time || row?.timestamp || 0).getTime();
    if (Number.isFinite(t) && t > latestTime) latestTime = t;
  });

  const snapshotRows = Array.isArray(window.SMACADashboardContext?.overview?.latest_sensor_snapshot_rows)
    ? window.SMACADashboardContext.overview.latest_sensor_snapshot_rows
    : [];
  snapshotRows.forEach(function (row) {
    const t = new Date(row?.measured_at || row?.latest?.measured_at || row?.last_seen_at || row?.time || row?.timestamp || 0).getTime();
    if (Number.isFinite(t) && t > latestTime) latestTime = t;
  });

  const sensors = Array.isArray(window.SMACADashboardContext?.sensors) ? window.SMACADashboardContext.sensors : [];
  sensors.forEach(function (sensor) {
    const t = new Date(sensor?.last_seen_at || sensor?.updated_at || 0).getTime();
    if (Number.isFinite(t) && t > latestTime) latestTime = t;
  });
  return latestTime;
}

function updateOverviewStatusTile(tileId, moduleKey, status) {
  const tile = document.getElementById(tileId);
  if (!tile || !status) return;
  const insight = getOverviewOperationalInsight(moduleKey, status);
  const tone = insight.tone;
  const priority = getOverviewStatusPriority(tone);
  tile.classList.remove(
    'overview-status-box--success',
    'overview-status-box--info',
    'overview-status-box--warning',
    'overview-status-box--accent',
    'overview-status-box--neutral',
    'overview-status-box--critical'
  );
  tile.classList.add(`overview-status-box--${tone}`);
  tile.setAttribute('data-tone', tone);
  tile.style.order = String(priority);
  const attentionGrid = document.getElementById('overview-status-attention-grid');
  const operationalGrid = document.getElementById('overview-status-operational-grid');
  const targetGrid = (tone === 'critical' || tone === 'warning') ? attentionGrid : operationalGrid;
  if (targetGrid && tile.parentElement !== targetGrid) targetGrid.appendChild(tile);

  const chip = tile.querySelector('.overview-status-chip');
  if (chip) {
    chip.textContent = insight.chip;
    chip.classList.remove(
      'overview-status-chip--success',
      'overview-status-chip--info',
      'overview-status-chip--warning',
      'overview-status-chip--accent',
      'overview-status-chip--neutral',
      'overview-status-chip--critical'
    );
    chip.classList.add(`overview-status-chip--${tone}`);
  }
  const detail = tile.querySelector('.overview-status-box__insight');
  if (detail) detail.textContent = insight.detail;
}

function getOverviewStatusPriority(tone) {
  if (tone === 'critical') return 1;
  if (tone === 'warning') return 2;
  if (tone === 'neutral') return 3;
  if (tone === 'info') return 4;
  return 5;
}

function getOverviewOperationalHeadline(moduleKey, status) {
  const insight = getOverviewOperationalInsight(moduleKey, status);
  return insight.headline;
}

function getOverviewOperationalInsight(moduleKey, status) {
  const tone = getOverviewOperationalTone(status);
  const hasNoData = !status || status.label === 'No data';
  if (moduleKey === 'air-quality') {
    if (hasNoData) return { tone, chip: 'Missing', headline: 'Air quality data currently unavailable', detail: 'No recent IAQ telemetry was detected. Check sensor reporting and ingestion status.' };
    if (status.moduleClass === 'warning') return { tone, chip: 'Degraded', headline: 'Air quality needs review', detail: 'Air quality has moved outside preferred limits and should be checked by operations.' };
    if (status.moduleClass === 'stable') return { tone, chip: smacaT('stable_watch_upper', 'STABLE WATCH'), headline: smacaT('air_quality_stable_light_variance', 'Air quality stable with light variance'), detail: smacaT('readings_within_acceptable_limits', 'Readings remain within acceptable limits with no critical indoor air alerts detected.') };
    return { tone, chip: smacaT('operational_upper', 'OPERATIONAL'), headline: smacaT('air_quality_operating_normally', 'Air quality operating normally'), detail: smacaT('current_iaq_behavior_healthy', 'Current IAQ behavior is healthy and no immediate corrective action is indicated.') };
  }
  if (moduleKey === 'connectivity') {
    if (hasNoData) return { tone, chip: 'Missing', headline: 'Connectivity data currently unavailable', detail: 'Connectivity telemetry is incomplete. Confirm gateways are publishing status updates.' };
    if (status.moduleClass === 'warning') return { tone, chip: 'Degraded', headline: 'Connectivity is degraded', detail: 'Intermittent reliability issues may affect live sensor delivery.' };
    if (status.moduleClass === 'stable') return { tone, chip: smacaT('stable_upper', 'STABLE'), headline: smacaT('connectivity_mostly_stable', 'Connectivity mostly stable'), detail: smacaT('minor_instability_present', 'Minor instability is present but service continuity remains active for monitoring workflows.') };
    return { tone, chip: smacaT('operational_upper', 'OPERATIONAL'), headline: smacaT('connectivity_fully_operational', 'Connectivity fully operational'), detail: smacaT('live_sensor_transport_stable', 'Live sensor transport and module communication are currently stable across active endpoints.') };
  }
  if (moduleKey === 'occupancy') {
    if (hasNoData) return { tone, chip: 'Missing', headline: 'Occupancy data not detected', detail: 'No recent occupancy events were received. Validate people-flow sensor input.' };
    if (status.moduleClass === 'warning') return { tone, chip: 'Degraded', headline: 'Occupancy level elevated', detail: 'Utilization is higher than usual and may need operational review.' };
    if (status.moduleClass === 'stable') return { tone, chip: smacaT('stable_watch_upper', 'STABLE WATCH'), headline: smacaT('occupancy_patterns_balanced', 'Occupancy patterns balanced'), detail: smacaT('footfall_moderate_no_spikes', 'Footfall remains moderate with no unusual spikes requiring immediate operational action.') };
    return { tone, chip: smacaT('operational_upper', 'OPERATIONAL'), headline: smacaT('occupancy_flow_normal', 'Occupancy flow normal'), detail: smacaT('space_utilization_light_consistent', 'Space utilization is light and consistent with normal campus operating behavior.') };
  }
  if (hasNoData) return { tone, chip: 'Missing', headline: smacaT('environmental_data_unavailable', 'Solar exposure data currently unavailable'), detail: smacaT('environmental_telemetry_missing', 'Solar exposure (UV) telemetry is not reporting at the moment.') };
  if (status.moduleClass === 'warning') return { tone, chip: 'Degraded', headline: smacaT('environmental_exposure_elevated', 'Solar exposure elevated'), detail: smacaT('environmental_exposure_elevated_detail', 'UV exposure is above preferred levels and should be monitored.') };
  if (status.moduleClass === 'stable') return { tone, chip: smacaT('stable_watch_upper', 'STABLE WATCH'), headline: smacaT('environmental_conditions_moderate', 'Solar exposure conditions moderate'), detail: smacaT('environmental_conditions_controlled', 'Solar exposure remains within controlled limits with no severe risk indicators.') };
  return { tone, chip: smacaT('operational_upper', 'OPERATIONAL'), headline: smacaT('environmental_module_normal', 'Solar Exposure module operating normally'), detail: smacaT('environmental_uv_streams_healthy', 'Solar exposure (UV) monitoring streams are healthy with expected operating behavior.') };
}

function getOverviewOperationalTone(status) {
  if (!status || status.label === 'No data') return 'critical';
  if (status.moduleClass === 'warning') return 'warning';
  if (status.moduleClass === 'active') return 'success';
  return 'info';
}

function updateOverviewOverallLiveHealth(statuses) {
  const label = document.getElementById('overview-live-overall-status');
  const detail = document.getElementById('overview-live-overall-detail');
  if (!label) return;
  const shell = label.closest('.overview-live-health');
  const safeStatuses = Array.isArray(statuses) ? statuses.filter(function (item) { return item && item.status; }) : [];
  const warningCount = safeStatuses.filter(function (item) { return item.status.moduleClass === 'warning'; }).length;
  const noDataCount = safeStatuses.filter(function (item) { return item.status.label === 'No data'; }).length;
  const healthyCount = safeStatuses.filter(function (item) { return item.status.moduleClass === 'active'; }).length;
  const attentionCountEl = document.getElementById('overview-status-attention-count');
  const operationalCountEl = document.getElementById('overview-status-operational-count');
  const attentionGroup = document.getElementById('overview-status-attention-group');
  const issueCount = noDataCount + warningCount;
  const operationalCount = Math.max(0, safeStatuses.length - issueCount);
  if (attentionCountEl) attentionCountEl.textContent = `${issueCount} module${issueCount === 1 ? '' : 's'}`;
  if (operationalCountEl) operationalCountEl.textContent = `${operationalCount} module${operationalCount === 1 ? '' : 's'}`;
  if (attentionGroup) attentionGroup.classList.toggle('is-empty', issueCount === 0);

  if (noDataCount > 0) {
    label.textContent = 'Partial data availability';
    if (detail) detail.textContent = `${noDataCount} module${noDataCount > 1 ? 's are' : ' is'} not reporting data right now.`;
    if (shell) {
      shell.classList.remove('overview-live-health--stable');
      shell.classList.remove('overview-live-health--warning');
      shell.classList.add('overview-live-health--critical');
    }
    return;
  }
  if (warningCount > 0) {
    label.textContent = `${warningCount} module${warningCount > 1 ? 's require' : ' requires'} attention`;
    if (detail) detail.textContent = 'Some module conditions are degraded and should be reviewed.';
    if (shell) {
      shell.classList.remove('overview-live-health--stable');
      shell.classList.remove('overview-live-health--critical');
      shell.classList.add('overview-live-health--warning');
    }
    return;
  }
  if (healthyCount > 0) {
    label.textContent = smacaT('system_operating_normally', 'System operating normally');
    if (detail) detail.textContent = smacaT('modules_stable_operational', 'All monitored modules are currently stable or operational.');
    if (shell) {
      shell.classList.remove('overview-live-health--critical');
      shell.classList.remove('overview-live-health--warning');
      shell.classList.add('overview-live-health--stable');
    }
    return;
  }
  label.textContent = smacaT('system_monitoring_active', 'System monitoring active');
  if (detail) detail.textContent = smacaT('waiting_for_telemetry', 'Waiting for enough telemetry to determine operational interpretation.');
  if (shell) {
    shell.classList.remove('overview-live-health--critical');
    shell.classList.remove('overview-live-health--warning');
    shell.classList.add('overview-live-health--stable');
  }
}

function setOverviewModuleStatus(elementId, text, tone) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = text;
  el.classList.remove(
    'overview-module-activity-item__status--active',
    'overview-module-activity-item__status--stable',
    'overview-module-activity-item__status--warning'
  );
  const safeTone = tone === 'warning' ? 'warning' : tone === 'active' ? 'active' : 'stable';
  el.classList.add(`overview-module-activity-item__status--${safeTone}`);
}

function resolveOccupancyValueFromPayload(payload) {
  const safePayload = payload || {};
  const totalIn = Number(safePayload.people_total_in);
  const totalOut = Number(safePayload.people_total_out);
  const liveOccupancy = Number(safePayload.occupancy);
  const occupancyCount = Number(safePayload.occupancy_count);
  const peopleCount = Number(safePayload.people_count);
  const count = Number(safePayload.count);
  const peopleIn = Number(safePayload.people_in);
  const peopleOut = Number(safePayload.people_out);

  if (Number.isFinite(liveOccupancy)) return liveOccupancy;
  if (Number.isFinite(occupancyCount)) return occupancyCount;
  if (Number.isFinite(peopleCount)) return peopleCount;
  if (Number.isFinite(count)) return count;
  if (Number.isFinite(peopleIn) && Number.isFinite(peopleOut)) return Math.max(0, peopleIn - peopleOut);
  if (Number.isFinite(peopleIn)) return peopleIn;
  // Cumulative totals are used only as last-resort fallback for legacy payloads.
  if (Number.isFinite(totalIn) && Number.isFinite(totalOut)) return Math.max(0, totalIn - totalOut);
  if (Number.isFinite(totalIn)) return totalIn;
  return null;
}

function resolveLatestOccupancyValue(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const latestBySensor = new Map();
  let fallbackLatestValue = null;
  let fallbackLatestTime = -Infinity;
  safeRows.forEach(function (item) {
    const t = new Date(item?.time || item?.timestamp || 0).getTime();
    if (!Number.isFinite(t)) return;
    const value = resolveOccupancyValueFromPayload(item?.payload?.object);
    if (!Number.isFinite(value)) return;
    const sensorKey = item?.sensorId ?? item?.sensor_id ?? item?.sensorUid ?? item?.sensor_uid ?? null;
    if (sensorKey !== null && sensorKey !== undefined && String(sensorKey).trim() !== '') {
      const normalizedKey = String(sensorKey).trim();
      const existing = latestBySensor.get(normalizedKey);
      if (!existing || t >= existing.time) {
        latestBySensor.set(normalizedKey, { time: t, value: value });
      }
      return;
    }
    if (t >= fallbackLatestTime) {
      fallbackLatestTime = t;
      fallbackLatestValue = value;
    }
  });
  if (latestBySensor.size > 0) {
    let total = 0;
    latestBySensor.forEach(function (entry) {
      total += Number(entry.value) || 0;
    });
    return total;
  }
  return fallbackLatestValue;
}

function resolveOverviewOccupancyLoadByTimeframe(rows, timeframe) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) return null;
  const totals = safeRows.reduce(function (acc, item) {
    const payload = item?.payload?.object || {};
    const inValue = Number(payload.people_in ?? payload.period_in);
    const outValue = Number(payload.people_out ?? payload.period_out);
    if (Number.isFinite(inValue)) acc.in += inValue;
    if (Number.isFinite(outValue)) acc.out += outValue;
    return acc;
  }, { in: 0, out: 0 });

  if (!Number.isFinite(totals.in) && !Number.isFinite(totals.out)) return null;
  const net = totals.in - totals.out;
  return Number.isFinite(net) ? Math.max(0, net) : null;
}

function resolveLatestOccupancyFromOverviewSnapshot(overview) {
  const snapshotRows = Array.isArray(overview?.latest_sensor_snapshot_rows) ? overview.latest_sensor_snapshot_rows : [];
  let fallbackValue = null;
  const latestBySensor = new Map();
  snapshotRows.forEach(function (row) {
    const value = resolveOccupancyValueFromPayload(row?.payload?.object || row?.payload || row?.object || row);
    if (!Number.isFinite(value)) return;
    const sensorKey = row?.sensor_id ?? row?.sensorId ?? row?.sensor_uid ?? row?.sensorUid ?? null;
    if (sensorKey === null || sensorKey === undefined || String(sensorKey).trim() === '') {
      fallbackValue = value;
      return;
    }
    const normalizedKey = String(sensorKey).trim();
    const measuredAtMs = new Date(row?.measured_at || row?.time || row?.timestamp || 0).getTime();
    const existing = latestBySensor.get(normalizedKey);
    if (!existing || (!Number.isFinite(existing.time) && Number.isFinite(measuredAtMs)) || (Number.isFinite(measuredAtMs) && measuredAtMs >= existing.time)) {
      latestBySensor.set(normalizedKey, { time: measuredAtMs, value: value });
    }
  });
  if (latestBySensor.size > 0) {
    let total = 0;
    latestBySensor.forEach(function (entry) {
      total += Number(entry.value) || 0;
    });
    return total;
  }
  return fallbackValue;
}

function syncOverviewChartLegend(activeKeys) {
  var legend = document.getElementById('overview-chart-legend');
  if (!legend) return;
  var keys = Array.isArray(activeKeys) ? activeKeys : [];
  legend.querySelectorAll('[data-series]').forEach(function (el) {
    var key = el.getAttribute('data-series');
    var on = keys.indexOf(key) !== -1;
    el.classList.toggle('is-hidden', !on);
    el.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
}

function renderOverviewTrendChart(filteredData, timeframe) {
  const chartEl = document.getElementById('overview-campus-trend-chart');
  if (!chartEl) return;

  // RBAC: "simple"/non-admin users must not see connectivity in the overview graph.
  // (The overview connectivity module card is already admin-only in the Blade view.)
  const isAdminView = !!(
    (typeof window !== 'undefined'
      && window.SMACARBAC
      && typeof window.SMACARBAC.isAdmin === 'function'
      && window.SMACARBAC.isAdmin())
    || (typeof window !== 'undefined'
      && window.SMACA_USER
      && String(window.SMACA_USER.role || '').toLowerCase().trim() === 'admin')
  );

  const iaqRows = getOverviewModuleRows('iaq', filteredData, timeframe);
  const occupancyRows = getOverviewModuleRows('occupancy', filteredData, timeframe);
  const environmentalRows = getOverviewModuleRows('environmental', filteredData, timeframe);
  const connectivityRows = isAdminView
    ? getOverviewModuleRows('connectivity', filteredData, timeframe)
    : [];

  const chartWindow = getSmacaLineChartWindow(timeframe);
  const buckets = chartWindow.bucketTimesMs.slice();
  const startMs = chartWindow.rangeStartMs;
  const endMs = chartWindow.rangeEndMs;

  const co2ByBucket = aggregateMetricByBucket(iaqRows, 'co2', chartWindow);
  const occupancyByBucket = aggregateOccupancyByBucket(occupancyRows, chartWindow);
  const connectivityByBucket = isAdminView
    ? aggregateConnectivityQualityByBucket(connectivityRows, chartWindow)
    : {};
  const uvByBucket = aggregateMetricByBucket(environmentalRows, 'uv_index', chartWindow);

  const co2SeriesRaw = buckets.map(function (bucket) {
    const value = co2ByBucket[bucket];
    return Number.isFinite(value) ? value : null;
  });
  const occupancySeriesRaw = buckets.map(function (bucket) {
    const value = occupancyByBucket[bucket];
    return Number.isFinite(value) ? value : null;
  });
  const connectivitySeriesRaw = buckets.map(function (bucket) {
    const value = connectivityByBucket[bucket];
    return Number.isFinite(value) ? value : null;
  });
  const uvSeriesRaw = buckets.map(function (bucket) {
    const value = uvByBucket[bucket];
    return Number.isFinite(value) ? value : null;
  });

  const co2Series = truncateSeriesAtLastReal(co2SeriesRaw);
  const occupancySeries = truncateSeriesAtLastReal(occupancySeriesRaw);
  const connectivitySeries = truncateSeriesAtLastReal(connectivitySeriesRaw);
  const uvSeries = truncateSeriesAtLastReal(uvSeriesRaw);

  if (!co2Series.some(Number.isFinite) && !occupancySeries.some(Number.isFinite) && !connectivitySeries.some(Number.isFinite) && !uvSeries.some(Number.isFinite)) {
    renderEmptyState('overview-campus-trend-chart', 'No trend data available for the selected range');
    return;
  }

  const chartSeriesCandidates = [
    { key: 'co2', label: smacaT('overview_chart_legend_co2', 'CO₂ · Air quality'), unit: 'ppm', color: '#3b82f6', values: co2Series },
    { key: 'occupancy', label: smacaT('overview_chart_movement_balance', 'Movement balance'), unit: '', color: '#22c55e', values: occupancySeries },
    ...(isAdminView ? [{ key: 'connectivity', label: smacaT('overview_chart_legend_connectivity', 'Connectivity · quality'), unit: '%', color: '#06b6d4', values: connectivitySeries }] : []),
    { key: 'uv', label: smacaT('overview_chart_legend_uv', 'Solar Exposure (UV)'), unit: '', color: '#f59e0b', values: uvSeries }
  ];
  const chartSeries = chartSeriesCandidates.filter(function (series) {
    return Array.isArray(series.values) && series.values.some(Number.isFinite);
  });

  syncOverviewChartLegend(chartSeries.map(function (s) { return s.key; }));

  drawOverviewSvgLineChart(chartEl, {
    timeframe: timeframe,
    buckets: buckets,
    series: chartSeries
  });

  // Surface a sparse-data note if most buckets are empty across all four
  // tracked series. We count a bucket as "populated" if at least one
  // series has a finite value at that index — this matches what the
  // SVG line chart actually renders.
  const populatedCount = buckets.reduce(function (acc, _ts, idx) {
    const hasAny = Number.isFinite(co2Series[idx])
      || Number.isFinite(occupancySeries[idx])
      || Number.isFinite(connectivitySeries[idx])
      || Number.isFinite(uvSeries[idx]);
    return acc + (hasAny ? 1 : 0);
  }, 0);
  const rawPopulatedCount = buckets.reduce(function (acc, _ts, idx) {
    const hasAny = Number.isFinite(co2SeriesRaw[idx])
      || Number.isFinite(occupancySeriesRaw[idx])
      || Number.isFinite(connectivitySeriesRaw[idx])
      || Number.isFinite(uvSeriesRaw[idx]);
    return acc + (hasAny ? 1 : 0);
  }, 0);
  renderSparseDataNote('overview-campus-trend-chart', rawPopulatedCount, buckets.length, timeframe);

  if (typeof window !== 'undefined') {
    window.__overviewTrendDebug = {
      timeframe: timeframe,
      bucketCount: buckets.length,
      populatedCount: populatedCount,
      rawPopulatedCount: rawPopulatedCount,
      rangeStart: new Date(startMs).toISOString(),
      rangeEnd: new Date(endMs).toISOString(),
      seriesKeys: isAdminView ? ['co2', 'occupancy', 'connectivity', 'uv'] : ['co2', 'occupancy', 'uv']
    };
  }
}

function aggregateMetricByBucket(rows, metricKey, chartWindow) {
  const byBucket = {};
  const safeRows = Array.isArray(rows) ? rows : [];
  const startMs = chartWindow?.rangeStartMs;
  const endMs = chartWindow?.rangeEndMs;
  safeRows.forEach(function (item) {
    const t = parseSmacaRowTimeMs(item?.time || item?.timestamp || 0);
    const value = resolveOverviewMetricValue(item, metricKey);
    if (!Number.isFinite(t) || !Number.isFinite(value) || t < startMs || t > endMs) return;
    const bucket = resolveSmacaChartBucketKey(t, chartWindow);
    if (bucket === null) return;
    if (!byBucket[bucket]) byBucket[bucket] = [];
    byBucket[bucket].push(value);
  });
  return Object.keys(byBucket).reduce(function (acc, key) {
    const values = byBucket[key];
    acc[Number(key)] = values.reduce(function (sum, v) { return sum + v; }, 0) / values.length;
    return acc;
  }, {});
}

function aggregateOccupancyByBucket(rows, chartWindow) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rawByBucket = {};
  const startMs = chartWindow?.rangeStartMs;
  const endMs = chartWindow?.rangeEndMs;
  safeRows.forEach(function (item) {
    const t = parseSmacaRowTimeMs(item?.time || item?.timestamp || 0);
    if (!Number.isFinite(t) || t < startMs || t > endMs) return;
    const resolvedValue = resolveOccupancyValueFromPayload(item?.payload?.object);
    if (!Number.isFinite(resolvedValue)) return;
    const bucket = resolveSmacaChartBucketKey(t, chartWindow);
    if (bucket === null) return;
    if (!rawByBucket[bucket]) rawByBucket[bucket] = [];
    rawByBucket[bucket].push(resolvedValue);
  });

  const avgByBucket = {};
  Object.keys(rawByBucket).forEach(function (key) {
    const values = rawByBucket[key];
    avgByBucket[Number(key)] = values.reduce(function (sum, v) { return sum + v; }, 0) / values.length;
  });

  return avgByBucket;
}

function aggregateConnectivityQualityByBucket(rows, chartWindow) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const startMs = chartWindow?.rangeStartMs;
  const endMs = chartWindow?.rangeEndMs;
  const quality = typeof window !== 'undefined' ? window.SMACA_CONNECTIVITY_QUALITY : null;
  const bucketMetrics = {};

  safeRows.forEach(function (item) {
    const t = parseSmacaRowTimeMs(item?.time || item?.timestamp || 0);
    const sensorId = item?.sensorId;
    if (!Number.isFinite(t) || t < startMs || t > endMs || sensorId === null || sensorId === undefined) return;
    const bucket = resolveSmacaChartBucketKey(t, chartWindow);
    if (bucket === null) return;
    const m = connectivityMetricsFromRow(item);
    if (!bucketMetrics[bucket]) bucketMetrics[bucket] = {};
    const sid = String(sensorId);
    if (!bucketMetrics[bucket][sid]) {
      bucketMetrics[bucket][sid] = { rssi: [], snr: [], tx_ccq: [], tx_rate: [] };
    }
    if (Number.isFinite(m.rssi)) bucketMetrics[bucket][sid].rssi.push(m.rssi);
    if (Number.isFinite(m.snr)) bucketMetrics[bucket][sid].snr.push(m.snr);
    if (Number.isFinite(m.tx_ccq)) bucketMetrics[bucket][sid].tx_ccq.push(m.tx_ccq);
    if (Number.isFinite(m.tx_rate)) bucketMetrics[bucket][sid].tx_rate.push(m.tx_rate);
  });

  function avg(arr) {
    if (!arr || !arr.length) return null;
    return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
  }

  return Object.keys(bucketMetrics).reduce(function (acc, key) {
    const perSensor = bucketMetrics[key];
    const scores = [];
    Object.keys(perSensor).forEach(function (sid) {
      const s = perSensor[sid];
      const metrics = {
        rssi: avg(s.rssi),
        snr: avg(s.snr),
        tx_ccq: avg(s.tx_ccq),
        tx_rate: avg(s.tx_rate)
      };
      if (!quality || typeof quality.classifyOverall !== 'function') return;
      if (metrics.rssi === null && metrics.snr === null && metrics.tx_ccq === null && metrics.tx_rate === null) return;
      var overall = quality.classifyOverall(metrics);
      var band = overall && (overall.dominant_band || overall.overall_band);
      var score = band ? connectivityBandToScore(band) : null;
      if (score !== null) scores.push(score);
    });
    acc[Number(key)] = scores.length
      ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length
      : null;
    return acc;
  }, {});
}

function carryForwardSeries(values) {
  const result = [];
  let lastKnown = null;
  values.forEach(function (value) {
    if (Number.isFinite(value)) {
      lastKnown = value;
      result.push(value);
    } else {
      result.push(lastKnown);
    }
  });
  return result;
}

/** Stop line at last bucket with real data; do not fill future buckets. */
function truncateSeriesAtLastReal(values) {
  const safe = Array.isArray(values) ? values.slice() : [];
  let lastIdx = -1;
  safe.forEach(function (value, idx) {
    if (Number.isFinite(value)) lastIdx = idx;
  });
  if (lastIdx < 0) return safe.map(function () { return null; });
  return safe.map(function (value, idx) {
    return idx <= lastIdx ? value : null;
  });
}

function normalizeSeriesForOverviewChart(values, strategy) {
  const safeValues = Array.isArray(values) ? values : [];
  if (strategy === 'percent') {
    return safeValues.map(function (value) {
      if (!Number.isFinite(value)) return null;
      return Math.max(0, Math.min(100, value));
    });
  }
  const finiteValues = safeValues.filter(Number.isFinite);
  if (finiteValues.length === 0) {
    return safeValues.map(function () { return null; });
  }
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const range = Math.max(1, max - min);
  return safeValues.map(function (value) {
    if (!Number.isFinite(value)) return null;
    return ((value - min) / range) * 100;
  });
}

function drawOverviewSvgLineChart(container, payload) {
  const width = Math.max(container.clientWidth, 600);
  const height = Math.max(container.clientHeight, 280);
  const padding = { top: 18, right: 16, bottom: 34, left: 38 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const bucketCount = payload.buckets.length;

  if (!bucketCount) {
    renderEmptyState('overview-campus-trend-chart', 'No trend data available');
    return;
  }

  const timeframe = payload.timeframe || '24h';

  const toPath = function (points) {
    if (!points.length) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = (current.x + next.x) / 2;
      d += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }
    return d;
  };

  const xScale = function (idx) {
    return bucketCount <= 1 ? 0 : (idx / (bucketCount - 1)) * chartWidth;
  };
  const yScale = function (value) {
    return chartHeight - (Math.max(0, Math.min(100, value)) / 100) * chartHeight;
  };

  const normalizedSeries = payload.series.map(function (series) {
    const strategy = series.key === 'connectivity' ? 'percent' : 'relative';
    return normalizeSeriesForOverviewChart(series.values, strategy);
  });

  const pointsBySeries = payload.series.map(function (series, seriesIndex) {
    return normalizedSeries[seriesIndex].map(function (value, idx) {
      return {
        x: xScale(idx),
        y: yScale(Number.isFinite(value) ? value : 0),
        raw: series.values[idx]
      };
    });
  });

  const markerCount = Math.min(6, bucketCount);
  const xTickIndexes = Array.from({ length: markerCount }, function (_, idx) {
    return Math.round((idx / Math.max(1, markerCount - 1)) * (bucketCount - 1));
  });
  const yTicks = [0, 25, 50, 75, 100];

  const defs = payload.series.map(function (series) {
    return `
      <linearGradient id="overview-area-${series.key}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${series.color}" stop-opacity="0.28"></stop>
        <stop offset="100%" stop-color="${series.color}" stop-opacity="0"></stop>
      </linearGradient>
    `;
  }).join('');

  const yGrid = yTicks.map(function (tick) {
    const y = yScale(tick);
    return `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}"></line>`;
  }).join('');
  const xGrid = xTickIndexes.map(function (idx) {
    const x = xScale(idx);
    return `<line x1="${x}" y1="0" x2="${x}" y2="${chartHeight}"></line>`;
  }).join('');
  const xLabels = xTickIndexes.map(function (idx) {
    const x = xScale(idx);
    return `<text class="chart-label" x="${x}" y="${chartHeight + 18}" text-anchor="middle">${formatSmacaChartAxisLabel(payload.buckets[idx], timeframe)}</text>`;
  }).join('');
  const seriesPaths = payload.series.map(function (series, seriesIndex) {
    const points = pointsBySeries[seriesIndex];
    const linePath = toPath(points);
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;
    return `
      <path class="chart-area" d="${areaPath}" fill="url(#overview-area-${series.key})"></path>
      <path class="chart-line" d="${linePath}" stroke="${series.color}" data-series="${series.key}"></path>
    `;
  }).join('');

  const hitRects = payload.buckets.map(function (_, idx) {
    const center = xScale(idx);
    const nextCenter = idx < bucketCount - 1 ? xScale(idx + 1) : chartWidth;
    const prevCenter = idx > 0 ? xScale(idx - 1) : 0;
    const widthAtIdx = Math.max(14, (nextCenter - prevCenter) / 2);
    const x = Math.max(0, center - widthAtIdx / 2);
    return `<rect class="chart-hit" data-index="${idx}" x="${x}" y="0" width="${widthAtIdx}" height="${chartHeight}"></rect>`;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="presentation" aria-hidden="true">
      <defs>${defs}</defs>
      <g transform="translate(${padding.left}, ${padding.top})">
        <g class="chart-grid">${yGrid}${xGrid}</g>
        <g class="chart-axis">
          <line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}"></line>
          <line x1="0" y1="0" x2="0" y2="${chartHeight}"></line>
        </g>
        ${seriesPaths}
        <line class="chart-focus-line" x1="0" y1="0" x2="0" y2="${chartHeight}"></line>
        <g>${xLabels}</g>
        <g>${hitRects}</g>
      </g>
    </svg>
    <div class="overview-chart-tooltip" aria-hidden="true"></div>
  `;

  const tooltip = container.querySelector('.overview-chart-tooltip');
  const focusLine = container.querySelector('.chart-focus-line');
  const hitTargets = Array.from(container.querySelectorAll('.chart-hit'));

  const setHover = function (index) {
    const x = xScale(index);
    focusLine.setAttribute('x1', x);
    focusLine.setAttribute('x2', x);
    container.classList.add('is-hovering');

    const rows = payload.series.map(function (series, seriesIndex) {
      const value = pointsBySeries[seriesIndex][index]?.raw;
      const formatted = Number.isFinite(value)
        ? (series.key === 'co2'
          ? `${Math.round(value)} ${series.unit}`
          : series.key === 'occupancy'
            ? `${Math.round(value)}${series.unit}`
            : series.key === 'uv'
              ? `${value.toFixed(1)}`
            : `${value.toFixed(1)}${series.unit}`)
        : 'N/A';
      return `
        <div class="overview-chart-tooltip__row">
          <span class="overview-chart-tooltip__label">
            <span class="overview-chart-tooltip__swatch" style="background:${series.color}"></span>${series.label}
          </span>
          <strong>${formatted}</strong>
        </div>
      `;
    }).join('');

    tooltip.innerHTML = `
      <div class="overview-chart-tooltip__time">${formatSmacaChartAxisLabel(payload.buckets[index], timeframe)}</div>
      ${rows}
    `;
    tooltip.classList.add('is-visible');

    const rect = container.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth || 180;
    const tooltipHeight = tooltip.offsetHeight || 88;
    const left = Math.min(
      Math.max(8, padding.left + x + 12),
      rect.width - tooltipWidth - 8
    );
    const top = Math.min(
      Math.max(8, padding.top + 8),
      rect.height - tooltipHeight - 8
    );
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  const clearHover = function () {
    container.classList.remove('is-hovering');
    tooltip.classList.remove('is-visible');
  };

  hitTargets.forEach(function (target) {
    target.addEventListener('mouseenter', function () {
      setHover(Number(target.dataset.index));
    });
    target.addEventListener('mousemove', function () {
      setHover(Number(target.dataset.index));
    });
  });
  container.addEventListener('mouseleave', clearHover);
}

(function (global) {
  'use strict';

  var AUDIT_STORAGE_KEY = 'smaca_legacy_chart_audit_v1';
  var IDLE_MS = 1400;
  var TIMEFRAMES = ['24h', '7d', '30d'];

  var LEGACY_BY_PAGE = {
    overview: ['overview-campus-trend-chart'],
    iaq: ['iaq-co2-band-chart'],
    occupancy: ['occupancy-flow-chart'],
    energy: ['energy-main-combined-chart', 'energy-demand-trend-chart'],
    environmental: ['uv-main-chart', 'uv-daily-comparison-chart']
  };

  function activePage() {
    if (global.SMACA_CURRENT_PAGE) return String(global.SMACA_CURRENT_PAGE);
    var parts = (global.location && global.location.pathname || '').split('/').filter(Boolean);
    return parts.length > 1 ? parts[1] : 'overview';
  }

  function activeTimeframe() {
    if (global.SMACAState && TIMEFRAMES.indexOf(String(global.SMACAState.currentTimeframe)) !== -1) {
      return String(global.SMACAState.currentTimeframe);
    }
    if (TIMEFRAMES.indexOf(String(global.SMACA_TIMEFRAME)) !== -1) {
      return String(global.SMACA_TIMEFRAME);
    }
    return '24h';
  }

  function applyTimeframe(tf) {
    if (TIMEFRAMES.indexOf(tf) === -1) return;
    if (global.lastRenderedTimeframe) global.lastRenderedTimeframe = null;
    global.SMACA_TIMEFRAME = tf;
    if (global.SMACAState && typeof global.SMACAState.setTimeframe === 'function') {
      if (global.SMACAState.currentTimeframe !== tf) {
        global.SMACAState.setTimeframe(tf);
        return;
      }
      if (typeof global.SMACAState.invalidateFilteredCache === 'function') {
        global.SMACAState.invalidateFilteredCache();
      }
      try {
        global.dispatchEvent(new CustomEvent('smaca:timeframe-changed', { detail: { timeframe: tf } }));
      } catch (e) { /* noop */ }
      if (typeof global.SMACAState.notifyListeners === 'function') {
        global.SMACAState.notifyListeners();
      }
      return;
    }
    try {
      global.dispatchEvent(new CustomEvent('smaca:timeframe-changed', { detail: { timeframe: tf } }));
    } catch (e2) { /* noop */ }
  }

  function waitIdle(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, Number.isFinite(ms) ? ms : IDLE_MS);
    });
  }

  function countFinite(values) {
    if (!Array.isArray(values)) return 0;
    return values.filter(function (v) { return Number.isFinite(Number(v)); }).length;
  }

  function inspectChart(chartId) {
    var el = global.document && global.document.getElementById(chartId);
    if (!el) {
      return { chartId: chartId, status: 'missing', bucketCount: null, populated: null, empty: null };
    }
    var empty = !!el.querySelector('.smaca-chart-empty');
    var hasSvg = !!el.querySelector('svg');
    var hasHighcharts = !!el.querySelector('.highcharts-container');
    var status = empty ? 'empty' : ((hasSvg || hasHighcharts) ? 'rendered' : 'blank');
    return {
      chartId: chartId,
      status: status,
      empty: empty,
      bucketCount: null,
      populated: null
    };
  }

  function enrichFromDebug(page, rows) {
    var tf = activeTimeframe();
    if (page === 'overview' && global.__overviewTrendDebug) {
      rows.forEach(function (row) {
        if (row.chartId !== 'overview-campus-trend-chart') return;
        row.bucketCount = global.__overviewTrendDebug.bucketCount;
        row.populated = Number.isFinite(Number(global.__overviewTrendDebug.rawPopulatedCount))
          ? global.__overviewTrendDebug.rawPopulatedCount
          : global.__overviewTrendDebug.populatedCount;
        row.timeframe = global.__overviewTrendDebug.timeframe || tf;
      });
    }
    if (page === 'iaq' && global.__SMACAIaqComputed) {
      rows.forEach(function (row) {
        if (row.chartId !== 'iaq-co2-band-chart') return;
        var computed = global.__SMACAIaqComputed;
        var points = [];
        if (computed.seriesByMetric && Array.isArray(computed.seriesByMetric.co2)) {
          points = computed.seriesByMetric.co2;
        } else if (computed.series && computed.series.co2 && Array.isArray(computed.series.co2.values)) {
          points = computed.series.co2.values;
        }
        row.bucketCount = points.length || null;
        row.populated = points.filter(function (p) {
          return Number.isFinite(Number(p && p.value));
        }).length;
        row.timeframe = computed.timeframe || tf;
      });
    }
    if (page === 'occupancy' && global.__occupancyChartDebug) {
      rows.forEach(function (row) {
        if (row.chartId !== 'occupancy-flow-chart') return;
        var occ = global.__occupancyChartDebug;
        row.bucketCount = occ.pointCount;
        row.populated = Number.isFinite(Number(occ.populatedBuckets))
          ? occ.populatedBuckets
          : (Number.isFinite(Number(occ.peakValue)) ? 1 : 0);
        row.timeframe = occ.timeframe || tf;
      });
    }
    if (page === 'energy' && global.__energyChartDebug) {
      var energy = global.__energyChartDebug;
      var main = energy.mainSeries && Array.isArray(energy.mainSeries.data) ? energy.mainSeries.data : [];
      rows.forEach(function (row) {
        if (row.chartId === 'energy-main-combined-chart') {
          row.bucketCount = main.length || energy.pointCount || null;
          row.populated = Number.isFinite(Number(energy.populatedBuckets))
            ? energy.populatedBuckets
            : countFinite(main);
          row.timeframe = energy.timeframe || tf;
        }
        if (row.chartId === 'energy-demand-trend-chart') {
          var demand = energy.demandTrendSeries && Array.isArray(energy.demandTrendSeries.data)
            ? energy.demandTrendSeries.data
            : main;
          row.bucketCount = demand.length || energy.pointCount || null;
          row.populated = Number.isFinite(Number(energy.populatedBuckets))
            ? energy.populatedBuckets
            : countFinite(demand);
          row.timeframe = energy.timeframe || tf;
        }
      });
    }
    if (page === 'environmental' && global.__uvChartDebug) {
      var uv = global.__uvChartDebug;
      rows.forEach(function (row) {
        if (row.chartId === 'uv-main-chart') {
          row.bucketCount = Array.isArray(uv.mainSeries) ? uv.mainSeries.length : null;
          row.populated = countFinite(uv.mainSeries);
          row.timeframe = uv.timeframe || tf;
        }
        if (row.chartId === 'uv-daily-comparison-chart') {
          row.bucketCount = Array.isArray(uv.dailyComparisonSeries) ? uv.dailyComparisonSeries.length : null;
          row.populated = countFinite(uv.dailyComparisonSeries);
          row.timeframe = uv.timeframe || tf;
        }
      });
    }
    rows.forEach(function (row) {
      if (row.empty) return;
      if (row.status === 'blank' && ((row.populated > 0) || (row.bucketCount > 0))) {
        row.status = 'rendered';
      }
    });
    return rows;
  }

  function collectCurrentPage() {
    var page = activePage();
    var chartIds = LEGACY_BY_PAGE[page] || [];
    var rows = chartIds.map(inspectChart);
    enrichFromDebug(page, rows);
    return {
      page: page,
      timeframe: activeTimeframe(),
      charts: rows
    };
  }

  function refreshForLegacyAudit(tf) {
    var refresh = global.__smacaRefreshDashboardForSelection;
    if (typeof refresh !== 'function') {
      applyTimeframe(tf);
      return Promise.resolve();
    }
    var sensorId = Number.isFinite(Number(global.SMACACurrentSensorId))
      ? Number(global.SMACACurrentSensorId)
      : null;
    return Promise.resolve(refresh(sensorId, tf, { forceRefresh: true }));
  }

  function waitForLegacyCharts(tf) {
    var attempts = 0;
    var maxAttempts = 5;
    return refreshForLegacyAudit(tf).then(function () {
      return new Promise(function (resolve) {
        function tick() {
          var snapshot = collectCurrentPage();
          var pending = (snapshot.charts || []).some(function (chart) {
            return chart.status === 'blank' && !chart.empty && chart.populated === null && chart.bucketCount === null;
          });
          if (!pending || attempts >= maxAttempts) {
            resolve(snapshot);
            return;
          }
          attempts += 1;
          setTimeout(tick, 450);
        }
        setTimeout(tick, IDLE_MS);
      });
    });
  }

  function auditLegacyTimeframes(timeframes) {
    var order = Array.isArray(timeframes) && timeframes.length ? timeframes.slice() : TIMEFRAMES.slice();
    var auditRows = [];
    return order.reduce(function (chain, tf) {
      return chain.then(function () {
        return waitForLegacyCharts(tf).then(function (snapshot) {
          auditRows.push({
            page: snapshot.page,
            timeframe: tf,
            charts: snapshot.charts
          });
          try { console.log('[SMACA_LEGACY]', snapshot); } catch (e) { /* noop */ }
        });
      });
    }, Promise.resolve()).then(function () {
      try {
        console.log('[SMACA_LEGACY] audit complete for', activePage());
        console.table(auditRows.reduce(function (flat, row) {
          (row.charts || []).forEach(function (chart) {
            flat.push({
              page: row.page,
              timeframe: row.timeframe,
              chartId: chart.chartId,
              status: chart.status,
              bucketCount: chart.bucketCount,
              populated: chart.populated
            });
          });
          return flat;
        }, []));
      } catch (e2) { /* noop */ }
      return auditRows;
    });
  }

  function pillarUrl(page) {
    if (page === 'overview') return '/dashboard';
    return '/dashboard/' + page;
  }

  function continueAllLegacyAudit() {
    var raw = null;
    try { raw = global.sessionStorage && global.sessionStorage.getItem(AUDIT_STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) return Promise.resolve(null);
    var state = null;
    try { state = JSON.parse(raw); } catch (e2) { state = null; }
    if (!state || !state.active) return Promise.resolve(state && state.results ? state.results : null);

    var target = state.pages[state.pageIndex];
    if (activePage() !== target) {
      global.location.assign(pillarUrl(target));
      return Promise.resolve({ navigating: target, partial: state.results || [] });
    }

    return auditLegacyTimeframes(state.timeframes).then(function (rows) {
      state.results = state.results || [];
      state.results.push({ page: target, rows: rows });
      state.pageIndex += 1;
      if (state.pageIndex >= state.pages.length) {
        state.active = false;
        try { global.sessionStorage.removeItem(AUDIT_STORAGE_KEY); } catch (e3) { /* noop */ }
        try {
          console.log('[SMACA_LEGACY] all pages audit complete');
          console.table((state.results || []).reduce(function (flat, block) {
            (block.rows || []).forEach(function (row) {
              (row.charts || []).forEach(function (chart) {
                flat.push({
                  page: row.page,
                  timeframe: row.timeframe,
                  chartId: chart.chartId,
                  status: chart.status,
                  bucketCount: chart.bucketCount,
                  populated: chart.populated
                });
              });
            });
            return flat;
          }, []));
        } catch (e4) { /* noop */ }
        return state.results;
      }
      try { global.sessionStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(state)); } catch (e5) { /* noop */ }
      global.location.assign(pillarUrl(state.pages[state.pageIndex]));
      return { navigating: state.pages[state.pageIndex], partial: state.results };
    });
  }

  function auditAllLegacyPages(timeframes) {
    var state = {
      pages: Object.keys(LEGACY_BY_PAGE),
      pageIndex: 0,
      timeframes: Array.isArray(timeframes) && timeframes.length ? timeframes.slice() : TIMEFRAMES.slice(),
      results: [],
      active: true
    };
    try { global.sessionStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* noop */ }
    try {
      console.log('[SMACA_LEGACY] audit started — the browser will visit each dashboard module with legacy charts.');
    } catch (e2) { /* noop */ }
    return continueAllLegacyAudit();
  }

  function cancelAllLegacyAudit() {
    try { global.sessionStorage.removeItem(AUDIT_STORAGE_KEY); } catch (e) { /* noop */ }
  }

  if (global.document) {
    global.document.addEventListener('DOMContentLoaded', function () {
      try {
        if (global.sessionStorage && global.sessionStorage.getItem(AUDIT_STORAGE_KEY)) {
          continueAllLegacyAudit();
        }
      } catch (e) { /* noop */ }
    });
  }

  function flattenLegacyAuditResults(results) {
    return (results || []).reduce(function (flat, block) {
      (block.rows || []).forEach(function (row) {
        (row.charts || []).forEach(function (chart) {
          flat.push({
            page: row.page,
            timeframe: row.timeframe,
            chartId: chart.chartId,
            status: chart.status,
            bucketCount: chart.bucketCount,
            populated: chart.populated
          });
        });
      });
      return flat;
    }, []);
  }

  function auditConnectivityTelemetry(timeframes) {
    var boot = global.SMACATelemetryBootstrap && global.SMACATelemetryBootstrap.debug;
    if (!boot || typeof boot.auditTimeframes !== 'function') {
      return Promise.resolve({ skipped: 'SMACATelemetryBootstrap.debug.auditTimeframes unavailable' });
    }
    var order = Array.isArray(timeframes) && timeframes.length ? timeframes.slice() : TIMEFRAMES.slice();
    return Promise.resolve(boot.auditTimeframes(order));
  }

  global.SMACALegacyCharts = {
    chartsForPage: function (page) { return (LEGACY_BY_PAGE[page || activePage()] || []).slice(); },
    collect: collectCurrentPage,
    auditTimeframes: auditLegacyTimeframes,
    auditConnectivityTelemetry: auditConnectivityTelemetry,
    auditAllPages: auditAllLegacyPages,
    cancelAllPagesAudit: cancelAllLegacyAudit,
    flattenResults: flattenLegacyAuditResults
  };
})(typeof window !== 'undefined' ? window : globalThis);

(function (global) {
  'use strict';

  var TIMEFRAMES = ['24h', '7d', '30d'];
  var MODULE_SPECS = [
    { module: 'iaq', metric: 'co2_ppm', deviceTypes: ['iaq'] },
    { module: 'occupancy', metric: 'people_total_in', deviceTypes: ['occupancy'] },
    { module: 'energy', metric: 'energy_kwh', deviceTypes: ['energy'] },
    { module: 'environmental', metric: 'uv_index', deviceTypes: ['environmental', 'uv'] }
  ];

  function currentPage() {
    if (global.SMACA_CURRENT_PAGE) return String(global.SMACA_CURRENT_PAGE);
    var parts = (global.location && global.location.pathname || '').split('/').filter(Boolean);
    return parts.length > 1 ? parts[1] : 'overview';
  }

  function hydratedBucketsForPage(page) {
    var map = global.SMACA_PAGE_BUCKETS || {
      overview: ['iaq', 'occupancy', 'environmental'],
      iaq: ['iaq'],
      occupancy: ['occupancy'],
      environmental: ['environmental'],
      connectivity: [],
      'ai-insights': [],
      energy: ['energy', 'occupancy'],
      management: []
    };
    return Array.isArray(map[page]) ? map[page].slice() : [];
  }

  function api() {
    return global.SMACAApi || null;
  }

  function stateManager() {
    return global.SMACAState || null;
  }

  function activeTimeframe() {
    var state = stateManager();
    if (state && TIMEFRAMES.indexOf(String(state.currentTimeframe)) !== -1) {
      return String(state.currentTimeframe);
    }
    if (TIMEFRAMES.indexOf(String(global.SMACA_TIMEFRAME)) !== -1) {
      return String(global.SMACA_TIMEFRAME);
    }
    return '24h';
  }

  function activeLocation() {
    try {
      var value = (global.SMACA_LOCATION || '').toString().trim();
      return value || null;
    } catch (e) {
      return null;
    }
  }

  function parseTs(value) {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') return value;
    var raw = String(value).trim();
    if (!raw) return NaN;
    var hasTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(raw);
    var normalized = hasTz ? raw : raw.replace(' ', 'T') + 'Z';
    var ms = Date.parse(normalized);
    return Number.isFinite(ms) ? ms : NaN;
  }

  function distinctDays(times) {
    var days = {};
    (times || []).forEach(function (ms) {
      if (!Number.isFinite(ms)) return;
      days[new Date(ms).toISOString().slice(0, 10)] = true;
    });
    return Object.keys(days).length;
  }

  function pickSensorForModule(sensors, spec) {
    var rows = Array.isArray(sensors) ? sensors : [];
    var types = (spec.deviceTypes || []).map(function (t) { return String(t).toLowerCase(); });
    var matches = rows.filter(function (row) {
      var type = String(row && row.device_type || '').toLowerCase();
      return types.indexOf(type) !== -1 && Number.isFinite(Number(row.id));
    });
    if (spec.module === 'energy' && matches.length) {
      return pickEnergySensorCandidates(matches)[0] || null;
    }
    if (matches.length) return matches[0];
    for (var j = 0; j < rows.length; j++) {
      if (Number.isFinite(Number(rows[j].id))) return rows[j];
    }
    return null;
  }

  function pickEnergySensorCandidates(matches) {
    var pool = Array.isArray(matches) ? matches.slice() : [];
    if (!pool.length) return [];
    var withLatest = pool.filter(function (row) {
      return Number.isFinite(Number(row && row.latest && row.latest.energy_kwh));
    });
    if (withLatest.length) pool = withLatest;
    pool.sort(function (a, b) {
      var aVal = Number(a && a.latest && a.latest.energy_kwh);
      var bVal = Number(b && b.latest && b.latest.energy_kwh);
      return (Number.isFinite(bVal) ? bVal : -1) - (Number.isFinite(aVal) ? aVal : -1);
    });
    return pool;
  }

  function pickSensorForTimeseriesAudit(sensors, spec, timeframe) {
    if (spec.module !== 'energy') {
      return Promise.resolve(pickSensorForModule(sensors, spec));
    }
    var client = api();
    var types = (spec.deviceTypes || []).map(function (t) { return String(t).toLowerCase(); });
    var rows = Array.isArray(sensors) ? sensors : [];
    var matches = rows.filter(function (row) {
      var type = String(row && row.device_type || '').toLowerCase();
      return types.indexOf(type) !== -1 && Number.isFinite(Number(row.id));
    });
    var candidates = pickEnergySensorCandidates(matches);
    if (!client || !candidates.length) {
      return Promise.resolve(pickSensorForModule(sensors, spec));
    }
    var idx = 0;
    function tryNext() {
      if (idx >= candidates.length) {
        return Promise.resolve(candidates[0] || pickSensorForModule(sensors, spec));
      }
      var sensor = candidates[idx];
      idx += 1;
      return client.fetchSensorTimeseries(sensor.id, spec.metric, timeframe).then(function (payload) {
        var points = Array.isArray(payload && payload.points) ? payload.points.length : 0;
        if (points > 0) return sensor;
        return tryNext();
      }).catch(function () {
        return tryNext();
      });
    }
    return tryNext();
  }

  function stateRawCount(module) {
    var state = stateManager();
    if (!state || !state.rawData) return null;
    var raw = state.rawData[module];
    return Array.isArray(raw) ? raw.length : 0;
  }

  function stateFilteredCount(module, timeframe) {
    var state = stateManager();
    if (!state || typeof state.filterByTimeframe !== 'function') return null;
    var raw = state.rawData && state.rawData[module];
    if (!Array.isArray(raw)) return 0;
    return state.filterByTimeframe(raw, timeframe).length;
  }

  function summarizeTimeseries(payload) {
    var points = (payload && Array.isArray(payload.points)) ? payload.points : [];
    var times = points.map(function (p) { return parseTs(p && p.time); }).filter(Number.isFinite);
    var values = points.map(function (p) { return Number(p && p.value); }).filter(Number.isFinite);
    return {
      points: points.length,
      minTs: times.length ? Math.min.apply(null, times) : null,
      maxTs: times.length ? Math.max.apply(null, times) : null,
      distinctDays: distinctDays(times),
      finiteValues: values.length
    };
  }

  function summarizeKpis(payload) {
    var kpis = (payload && Array.isArray(payload.kpis)) ? payload.kpis : [];
    var populated = kpis.filter(function (k) {
      return k && k.value !== null && k.value !== undefined && Number.isFinite(Number(k.value));
    });
    return {
      kpiCount: kpis.length,
      populatedKpis: populated.length,
      emptyKpis: kpis.filter(function (k) {
        return !k || k.value === null || k.value === undefined || !Number.isFinite(Number(k.value));
      }).map(function (k) { return k.key; })
    };
  }

  function auditTimeseriesRow(sensor, spec, timeframe, opts) {
    var auditOpts = opts || {};
    var uiTimeframe = auditOpts.uiTimeframe || activeTimeframe();
    var client = api();
    if (!client || !sensor || !Number.isFinite(Number(sensor.id))) {
      return Promise.resolve({
        kind: 'timeseries',
        module: spec.module,
        timeframe: timeframe,
        uiTimeframe: uiTimeframe,
        sensorId: null,
        metric: spec.metric,
        points: 0,
        finiteValues: 0,
        distinctDays: 0,
        minTs: null,
        maxTs: null,
        rawRows: stateRawCount(spec.module),
        stateRows: stateFilteredCount(spec.module, timeframe),
        note: 'no sensor'
      });
    }
    return client.fetchSensorTimeseries(sensor.id, spec.metric, timeframe).then(function (payload) {
      var summary = summarizeTimeseries(payload);
      var rawRows = stateRawCount(spec.module);
      var stateRows = stateFilteredCount(spec.module, timeframe);
      var page = currentPage();
      var hydratedBuckets = hydratedBucketsForPage(page);
      var note = '';
      if (stateRows === null) {
        note = 'SMACAState unavailable on window';
      } else if (hydratedBuckets.indexOf(spec.module) === -1 && rawRows === 0) {
        note = 'bucket not hydrated on ' + page + ' page (api probe only)';
      } else if (summary.points >= 2 && stateRows === 0) {
        note = 'api has points but SMACAState raw/filter is empty';
      } else if (spec.module === 'energy' && stateRows > 0 && summary.points === 0) {
        note = 'state has rows but probed sensor has no energy_kwh timeseries';
      } else if (summary.points < 2) {
        note = 'fewer than 2 api points';
      } else if (uiTimeframe !== timeframe) {
        note = 'stateRows reflect ui timeframe ' + uiTimeframe + ', not probe ' + timeframe;
      }
      return {
        kind: 'timeseries',
        page: page,
        module: spec.module,
        timeframe: timeframe,
        uiTimeframe: uiTimeframe,
        sensorId: Number(sensor.id),
        metric: spec.metric,
        points: summary.points,
        finiteValues: summary.finiteValues,
        distinctDays: summary.distinctDays,
        minTs: summary.minTs,
        maxTs: summary.maxTs,
        rawRows: rawRows,
        stateRows: stateRows,
        note: note
      };
    }).catch(function (err) {
      return {
        kind: 'timeseries',
        module: spec.module,
        timeframe: timeframe,
        uiTimeframe: uiTimeframe,
        sensorId: Number(sensor.id),
        metric: spec.metric,
        points: 0,
        finiteValues: 0,
        distinctDays: 0,
        minTs: null,
        maxTs: null,
        rawRows: stateRawCount(spec.module),
        stateRows: stateFilteredCount(spec.module, timeframe),
        note: 'request failed: ' + (err && err.message ? err.message : 'unknown')
      };
    });
  }

  function auditKpiRow(module, timeframe) {
    var client = api();
    if (!client || typeof client.fetchKpiSummary !== 'function') {
      return Promise.resolve({
        kind: 'kpi',
        module: module,
        timeframe: timeframe,
        kpiCount: 0,
        populatedKpis: 0,
        emptyKpis: [],
        note: 'SMACAApi.fetchKpiSummary unavailable'
      });
    }
    return client.fetchKpiSummary(module, { timeframe: timeframe, location: activeLocation() }).then(function (payload) {
      var summary = summarizeKpis(payload);
      return {
        kind: 'kpi',
        module: module,
        timeframe: timeframe,
        kpiCount: summary.kpiCount,
        populatedKpis: summary.populatedKpis,
        emptyKpis: summary.emptyKpis,
        note: summary.populatedKpis ? '' : 'no populated KPI values'
      };
    }).catch(function (err) {
      return {
        kind: 'kpi',
        module: module,
        timeframe: timeframe,
        kpiCount: 0,
        populatedKpis: 0,
        emptyKpis: [],
        note: 'request failed: ' + (err && err.message ? err.message : 'unknown')
      };
    });
  }

  function finalizeAuditRows(rows, meta) {
    try {
      console.log('[SMACA_DATA] timeframe audit complete', meta || {
        page: currentPage(),
        hydratedBuckets: hydratedBucketsForPage(currentPage()),
        location: activeLocation(),
        uiTimeframe: activeTimeframe()
      });
      console.table(rows);
    } catch (e) { /* noop */ }
    return rows;
  }

  function auditModulesForTimeframe(tf, auditOpts) {
    var client = api();
    return client.fetchSensors().then(function (payload) {
      var sensors = (payload && Array.isArray(payload.rows)) ? payload.rows : [];
      var tasks = [];
      MODULE_SPECS.forEach(function (spec) {
        tasks.push(
          pickSensorForTimeseriesAudit(sensors, spec, tf).then(function (sensor) {
            return auditTimeseriesRow(sensor, spec, tf, auditOpts);
          })
        );
        tasks.push(auditKpiRow(spec.module, tf));
      });
      return Promise.all(tasks);
    });
  }

  function auditTimeframes(options) {
    var opts = options || {};
    var order = Array.isArray(opts.timeframes) && opts.timeframes.length
      ? opts.timeframes.slice()
      : TIMEFRAMES.slice();
    var client = api();
    if (!client) {
      return Promise.resolve({ skipped: 'SMACAApi missing' });
    }
    var refresh = global.__smacaRefreshDashboardForSelection;
    if (opts.refreshEachTimeframe && typeof refresh === 'function') {
      return order.reduce(function (chain, tf) {
        return chain.then(function (acc) {
          var sensorId = Number.isFinite(Number(global.SMACACurrentSensorId))
            ? Number(global.SMACACurrentSensorId)
            : null;
          return Promise.resolve(refresh(sensorId, tf, { forceRefresh: true }))
            .then(function () {
              return auditModulesForTimeframe(tf, { uiTimeframe: tf });
            })
            .then(function (rows) {
              return acc.concat(rows);
            });
        });
      }, Promise.resolve([])).then(function (rows) {
        return finalizeAuditRows(rows, {
          page: currentPage(),
          hydratedBuckets: hydratedBucketsForPage(currentPage()),
          location: activeLocation(),
          uiTimeframe: 'per-timeframe refresh',
          refreshEachTimeframe: true
        });
      });
    }
    var uiTimeframe = activeTimeframe();
    var tasks = [];
    order.forEach(function (tf) {
      tasks.push(
        auditModulesForTimeframe(tf, { uiTimeframe: uiTimeframe }).then(function (rows) {
          return rows;
        })
      );
    });
    return Promise.all(tasks).then(function (groups) {
      var rows = [];
      groups.forEach(function (group) {
        if (Array.isArray(group)) rows = rows.concat(group);
      });
      return finalizeAuditRows(rows);
    });
  }

  function auditCurrentTimeframe() {
    return auditTimeframes({ timeframes: [activeTimeframe()] });
  }

  function refreshAndAudit(options) {
    var opts = options || {};
    var refresh = global.__smacaRefreshDashboardForSelection;
    if (typeof refresh !== 'function') {
      return auditTimeframes(opts);
    }
    var tf = opts.timeframe || activeTimeframe();
    var sensorId = Number.isFinite(Number(global.SMACACurrentSensorId))
      ? Number(global.SMACACurrentSensorId)
      : null;
    return Promise.resolve(refresh(sensorId, tf, { forceRefresh: true }))
      .then(function () { return auditTimeframes(opts); });
  }

  function refreshAndAuditAllTimeframes(options) {
    return auditTimeframes(Object.assign({}, options || {}, { refreshEachTimeframe: true }));
  }

  function adminWindowRows() {
    var location = activeLocation();
    var url = '/api/admin/timeframe-validate' + (location ? ('?location=' + encodeURIComponent(location)) : '');
    return fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) {
          return {
            skipped: true,
            status: res.status,
            message: res.status === 403 ? 'admin only — sign in as admin or use auditTimeframes()' : 'request failed'
          };
        }
        return res.json();
      })
      .then(function (payload) {
        if (payload && payload.skipped) {
          try { console.warn('[SMACA_DATA] admin timeframe validate skipped', payload); } catch (e) { /* noop */ }
          return payload;
        }
        var rows = Array.isArray(payload) ? payload : (Array.isArray(payload && payload.results) ? payload.results : []);
        try {
          console.log('[SMACA_DATA] admin timeframe validate');
          console.table(rows);
        } catch (e2) { /* noop */ }
        return rows;
      })
      .catch(function (err) {
        return { skipped: true, message: err && err.message ? err.message : 'request failed' };
      });
  }

  function help() {
    try {
      console.log([
        'SMACADataAudit.help()',
        'SMACADataAudit.auditTimeframes().then(console.table)',
        'SMACADataAudit.auditTimeframes({ refreshEachTimeframe: true }).then(console.table)',
        'SMACADataAudit.refreshAndAudit().then(console.table)',
        'SMACADataAudit.refreshAndAuditAllTimeframes().then(console.table)',
        'SMACADataAudit.auditCurrent().then(console.table)',
        'SMACADataAudit.adminWindow().then(console.table)',
        'Connectivity telemetry: SMACALegacyCharts.auditConnectivityTelemetry().then(console.table)',
        'rawRows = SMACAState.rawData[module].length; stateRows = filterByTimeframe for probe timeframe.',
        'Without per-timeframe refresh, stateRows track the active UI timeframe (uiTimeframe column).',
        'Compare api points vs rawRows/stateRows; energy may show stateRows>0 with 0 energy_kwh api points.',
        'adminWindow() is admin-only; non-admin sessions get a skipped warning.'
      ].join('\n'));
    } catch (e) { /* noop */ }
  }

  global.SMACADataAudit = {
    help: help,
    auditTimeframes: auditTimeframes,
    refreshAndAudit: refreshAndAudit,
    refreshAndAuditAllTimeframes: refreshAndAuditAllTimeframes,
    auditCurrent: auditCurrentTimeframe,
    adminWindow: adminWindowRows
  };
})(typeof window !== 'undefined' ? window : globalThis);
