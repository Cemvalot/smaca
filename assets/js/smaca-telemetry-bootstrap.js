/**
 * SMACA Telemetry Bootstrap
 * =========================
 *
 * Populates the chart-led telemetry grids on every dashboard module
 * (Overview, IAQ, Occupancy, Energy, Environmental, Connectivity).
 * Each tile answers a unique operational question — duplicates of the
 * KPI summary card or hero counters are intentionally omitted.
 *
 * Data sources (no new endpoints):
 *   - `/api/dashboard/overview`, `/api/sensors`         — cached 12s
 *   - `/api/sensors/{id}/timeseries`                     — cached 30s
 *   - `/api/kpis/summary?module=...`                     — no cache
 *
 * Update lifecycle:
 *   - DOMContentLoaded boot → renders every tile for the active page.
 *   - Re-renders on `smaca:scope-changed`, `smaca:timeframe-changed`,
 *     `smaca:state-updated`. Highcharts instances are tracked and
 *     destroyed via `SMACATelemetry.attachChart`'s WeakMap so charts
 *     never leak across re-renders.
 *
 * Empty states:
 *   - `renderEmptyTile` for value tiles when data is missing.
 *   - `renderChartTile` followed by an explicit empty body for chart
 *     panels when timeseries data is too short or the freshest sensor
 *     can't be resolved. No silent blank cards anywhere.
 */
(function (global) {
  'use strict';

  if (!global) return;

  function api()  { return global.SMACAApi || null; }
  function tile() { return global.SMACATelemetry || null; }

  function activeSection() {
    var el = document.querySelector('.dashboard-section[id]');
    return el ? el.id : null;
  }

  // -----------------------------------------------------------------------
  // Active scope/timeframe accessors. Both are read fresh on every render
  // so timeframe / location switches are always honoured.
  // -----------------------------------------------------------------------
  function activeTimeframe() {
    var allowed = ['24h', '7d', '30d'];
    try {
      var fromState = (global.SMACAState && global.SMACAState.currentTimeframe) || '';
      if (allowed.indexOf(String(fromState)) !== -1) return fromState;
    } catch (e) {}
    var tf = String(global.SMACA_TIMEFRAME || '24h');
    return allowed.indexOf(tf) !== -1 ? tf : '24h';
  }

  function activeLocation() {
    try {
      var loc = (global.SMACA_LOCATION || '').toString().trim();
      return loc || null;
    } catch (e) { return null; }
  }

  function timeframeWindowMs(tf) {
    if (tf === '7d')  return 7 * 24 * 60 * 60 * 1000;
    if (tf === '30d') return 30 * 24 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000;
  }

  function bucketSizeFor(tf) {
    if (tf === '7d')  return 'daily';
    if (tf === '30d') return 'daily';
    return 'hourly';
  }

  // -----------------------------------------------------------------------
  // SMACA_DEBUG_TIMEFRAME helper
  // -----------------------------------------------------------------------
  // Set `window.SMACA_DEBUG_TIMEFRAME = true` in DevTools to enable
  // (or call SMACATelemetryBootstrap.debug.enable()). Each chart logs
  // a structured row with these fields:
  //   chartId        — '<module>:<chart-name>' string
  //   module         — module name (overview/iaq/occupancy/energy/...)
  //   timeframe      — '24h' / '7d' / '30d' (active selection)
  //   location       — selected SMACA_LOCATION code, or null for campus
  //   endpoint       — API endpoint used (e.g. /api/sensors/{id}/timeseries…)
  //   points         — raw point count returned by the endpoint
  //   minTs, maxTs   — first/last timestamp of those raw points (ms)
  //   bucket         — bucket label (e.g. 'hourly × 24', 'daily × 30')
  //   bucketCount    — number of bins after bucketing
  //   seriesLength   — array length of the rendered series
  //   yMin, yMax     — min/max y values in the rendered series
  //   note           — free-text marker (e.g. 'empty-state', 'MAX-MIN delta…')
  // The helper is a no-op when the flag is falsy, so it has zero cost
  // when not actively debugging.
  function debugTfEnabled() {
    return !!global.SMACA_DEBUG_TIMEFRAME;
  }

  var DEBUG_LOG_BUFFER = [];
  var DEBUG_REFRESH_SEQ = 0;
  var DEBUG_REFRESH_IDLE_MS = 1200;
  var DEBUG_LAST_REFRESH = null;
  var REFRESH_IN_FLIGHT = null;
  var REFRESH_ACTIVE_DEBOUNCE_MS = 220;
  var refreshActiveDebounceTimer = null;
  var refreshActiveDebounceTick = 0;
  var AUDIT_ALL_STORAGE_KEY = 'SMACA_TF_AUDIT_ALL';
  var PILLAR_SECTIONS = ['overview', 'iaq', 'occupancy', 'energy', 'environmental', 'connectivity'];

  function resetDebugBuffer(seq) {
    if (!debugTfEnabled()) return;
    DEBUG_LOG_BUFFER = [];
    DEBUG_REFRESH_SEQ = seq;
  }

  function flushDebugBuffer(seq, section) {
    if (!debugTfEnabled() || seq !== DEBUG_REFRESH_SEQ) return;
    try {
      var rows = DEBUG_LOG_BUFFER.slice();
      console.log('[SMACA_TF] refresh complete', {
        section: section,
        timeframe: activeTimeframe(),
        location: activeLocation(),
        entries: rows.length
      });
      if (rows.length && typeof console.table === 'function') {
        console.table(rows.map(function (r) {
          return {
            chartId: r.chartId,
            points: r.points,
            bucket: r.bucket,
            bucketCount: r.bucketCount,
            seriesLength: r.seriesLength,
            yMin: r.yMin,
            yMax: r.yMax,
            note: r.note
          };
        }));
      } else if (!rows.length) {
        console.warn(
          '[SMACA_TF] no telemetry chart rows for this page. ' +
          'IAQ, Occupancy, Energy, and Environmental emit the most rows; ' +
          'Overview and Connectivity are mostly snapshot tiles. ' +
          'The main trend charts (e.g. overview-campus-trend-chart, iaq-co2-band-chart) are rendered by legacy production-features code, not this bootstrap.'
        );
      }
    } catch (e) { /* noop */ }
  }

  function scheduleDebugFlush(seq, section, promise) {
    if (!debugTfEnabled()) return Promise.resolve(promise);
    return Promise.resolve(promise).then(function () {
      return new Promise(function (resolve) {
        setTimeout(function () {
          flushDebugBuffer(seq, section);
          DEBUG_LAST_REFRESH = {
            section: section,
            timeframe: activeTimeframe(),
            location: activeLocation(),
            entries: DEBUG_LOG_BUFFER.length
          };
          resolve(DEBUG_LAST_REFRESH);
        }, DEBUG_REFRESH_IDLE_MS);
      });
    }).catch(function (err) {
      try { console.warn('[SMACA_TF] refresh failed', section, err); } catch (e2) { /* noop */ }
      flushDebugBuffer(seq, section);
      throw err;
    });
  }

  function logChart(chartId, info) {
    if (!debugTfEnabled()) return;
    var i = info || {};
    var entry = {
      chartId: chartId,
      module:    i.module    || '?',
      timeframe: activeTimeframe(),
      location:  activeLocation(),
      endpoint:  i.endpoint || '(snapshot)',
      points:    i.points    !== undefined ? i.points : null,
      minTs:     i.minTs     !== undefined ? i.minTs : null,
      maxTs:     i.maxTs     !== undefined ? i.maxTs : null,
      bucket:    i.bucket   || bucketSizeFor(activeTimeframe()),
      bucketCount:   i.bucketCount   !== undefined ? i.bucketCount : null,
      seriesLength:  i.seriesLength  !== undefined ? i.seriesLength : null,
      yMin:          i.yMin          !== undefined ? i.yMin : null,
      yMax:          i.yMax          !== undefined ? i.yMax : null,
      note:      i.note     || ''
    };
    var replaced = false;
    for (var di = DEBUG_LOG_BUFFER.length - 1; di >= 0; di--) {
      var prior = DEBUG_LOG_BUFFER[di];
      if (prior.chartId === entry.chartId
          && prior.timeframe === entry.timeframe
          && prior.location === entry.location) {
        DEBUG_LOG_BUFFER[di] = entry;
        replaced = true;
        break;
      }
    }
    if (!replaced) DEBUG_LOG_BUFFER.push(entry);
    try { console.log('[SMACA_TF]', entry); } catch (e) { /* noop */ }
  }

  // Compute min/max of a numeric array (or array of {y} or {value}) for
  // debug logs. Returns { yMin, yMax, seriesLength } and skips nulls.
  function seriesStats(arr) {
    if (!Array.isArray(arr) || !arr.length) {
      return { yMin: null, yMax: null, seriesLength: 0 };
    }
    var min = Infinity, max = -Infinity, count = 0;
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      var v = (typeof p === 'number') ? p
            : (p && typeof p.y === 'number') ? p.y
            : (p && typeof p.value === 'number') ? p.value
            : null;
      if (v === null || !Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
      count++;
    }
    return {
      yMin: count ? min : null,
      yMax: count ? max : null,
      seriesLength: arr.length
    };
  }

  // Pretty axis labels for daily buckets (7d / 30d). For 7d we show every
  // bucket; for 30d we step every ~5th label so the axis stays readable.
  // For hourly buckets (24h) we keep showAxis: false and let the tile
  // title tell the user it's hour-of-day.
  function axisOptsForBucket(bucketed) {
    if (!bucketed) return { showAxis: false };
    if (bucketed.bucket !== 'daily') return { showAxis: false };
    var labels = Array.isArray(bucketed.labels) ? bucketed.labels : [];
    var binCount = bucketed.binCount || labels.length;
    var step = (binCount > 14) ? Math.max(1, Math.floor(binCount / 7)) : 1;
    return { showAxis: true, categories: labels, step: step };
  }

  function applyDebugTimeframe(tf) {
    if (global.SMACAState) {
      global.SMACAState.currentTimeframe = tf;
      if (typeof global.SMACAState.invalidateFilteredCache === 'function') {
        global.SMACAState.invalidateFilteredCache();
      }
    }
    global.SMACA_TIMEFRAME = tf;
    try {
      global.dispatchEvent(new CustomEvent('smaca:timeframe-changed', { detail: { timeframe: tf } }));
    } catch (e) { /* noop */ }
  }

  function pillarUrl(section) {
    if (section === 'overview') return '/dashboard';
    return '/dashboard/' + section;
  }

  function primaryStripChartId(section) {
    var map = {
      iaq: 'iaq:hourly-heat',
      occupancy: 'occupancy:hourly-activity',
      energy: 'energy:load-profile',
      environmental: 'environmental:uv-strip'
    };
    return map[section] || null;
  }

  function summarizeAuditRows(auditRows, section) {
    var primaryId = primaryStripChartId(section);
    return auditRows.map(function (row) {
      var primary = null;
      var charts = row.charts || [];
      for (var i = 0; i < charts.length; i++) {
        if (primaryId && charts[i].chartId === primaryId) {
          primary = charts[i];
          break;
        }
      }
      return {
        section: row.section || section,
        timeframe: row.timeframe,
        entries: row.entries,
        primaryChart: primary ? primary.chartId : (section === 'overview' ? 'snapshot grid' : (section === 'connectivity' ? 'connectivity:status-donut' : '—')),
        primaryBucket: primary ? primary.bucket : (section === 'overview' || section === 'connectivity' ? 'snapshot' : '—'),
        primaryBuckets: primary ? primary.bucketCount : null,
        primarySeries: primary ? primary.seriesLength : null,
        primaryPoints: primary ? primary.points : null
      };
    });
  }

  function flattenPillarAudits(results) {
    var flat = [];
    (results || []).forEach(function (pillar) {
      summarizeAuditRows(pillar.rows || [], pillar.section).forEach(function (row) {
        flat.push(row);
      });
    });
    return flat;
  }

  function auditTimeframes(timeframes, opts) {
    var options = opts || {};
    var order = (Array.isArray(timeframes) && timeframes.length)
      ? timeframes.slice()
      : ['24h', '7d', '30d'];
    var prevDebug = !!global.SMACA_DEBUG_TIMEFRAME;
    global.SMACA_DEBUG_TIMEFRAME = true;
    var section = activeSection();
    if (!section) {
      if (!options.keepDebug) global.SMACA_DEBUG_TIMEFRAME = prevDebug;
      return Promise.resolve({ skipped: 'no-section' });
    }

    var auditRows = [];
    return order.reduce(function (chain, tf) {
      return chain.then(function () {
        applyDebugTimeframe(tf);
        return refreshActive().then(function (summary) {
          auditRows.push({
            timeframe: tf,
            section: section,
            location: activeLocation(),
            entries: summary && summary.entries !== undefined ? summary.entries : DEBUG_LOG_BUFFER.length,
            charts: DEBUG_LOG_BUFFER.map(function (r) {
              return {
                chartId: r.chartId,
                bucket: r.bucket,
                bucketCount: r.bucketCount,
                seriesLength: r.seriesLength,
                points: r.points,
                yMin: r.yMin,
                yMax: r.yMax
              };
            })
          });
        });
      });
    }, Promise.resolve()).then(function () {
      try {
        console.log('[SMACA_TF] audit complete for', section);
        console.table(summarizeAuditRows(auditRows, section));
      } catch (e) { /* noop */ }
      if (!options.keepDebug) global.SMACA_DEBUG_TIMEFRAME = prevDebug;
      return auditRows;
    });
  }

  function continueAllPillarsAudit() {
    var raw = null;
    try { raw = global.sessionStorage && global.sessionStorage.getItem(AUDIT_ALL_STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) return Promise.resolve(null);
    var state = null;
    try { state = JSON.parse(raw); } catch (e2) { state = null; }
    if (!state || !state.active) return Promise.resolve(state && state.results ? state.results : null);

    var target = state.pillars[state.pillarIndex];
    var current = activeSection();
    if (current !== target) {
      try { console.log('[SMACA_TF] navigating to pillar', target); } catch (e3) { /* noop */ }
      global.location.assign(pillarUrl(target));
      return Promise.resolve({ navigating: target, partial: state.results || [] });
    }

    global.SMACA_DEBUG_TIMEFRAME = true;
    return auditTimeframes(state.timeframes, { keepDebug: true }).then(function (rows) {
      state.results = state.results || [];
      state.results.push({ section: target, rows: rows });
      state.pillarIndex += 1;
      if (state.pillarIndex >= state.pillars.length) {
        state.active = false;
        try { global.sessionStorage.removeItem(AUDIT_ALL_STORAGE_KEY); } catch (e4) { /* noop */ }
        try {
          console.log('[SMACA_TF] all pillars audit complete');
          console.table(flattenPillarAudits(state.results));
        } catch (e5) { /* noop */ }
        global.SMACA_DEBUG_TIMEFRAME = false;
        return state.results;
      }
      try { global.sessionStorage.setItem(AUDIT_ALL_STORAGE_KEY, JSON.stringify(state)); } catch (e6) { /* noop */ }
      global.location.assign(pillarUrl(state.pillars[state.pillarIndex]));
      return { navigating: state.pillars[state.pillarIndex], partial: state.results };
    });
  }

  function auditAllPillars(timeframes) {
    var pillars = PILLAR_SECTIONS.slice();
    var state = {
      pillars: pillars,
      pillarIndex: 0,
      timeframes: (Array.isArray(timeframes) && timeframes.length) ? timeframes.slice() : ['24h', '7d', '30d'],
      results: [],
      active: true
    };
    try { global.sessionStorage.setItem(AUDIT_ALL_STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* noop */ }
    try {
      console.log('[SMACA_TF] all-pillars audit started — the browser will visit each dashboard module in turn.');
    } catch (e2) { /* noop */ }
    return continueAllPillarsAudit();
  }

  function cancelAllPillarsAudit() {
    try { global.sessionStorage.removeItem(AUDIT_ALL_STORAGE_KEY); } catch (e) { /* noop */ }
    return Promise.resolve({ cancelled: true });
  }

  // -----------------------------------------------------------------------
  // Scope filtering. /api/sensors does not accept a location filter, so
  // when the user picks a specific scope we filter client-side. Sensors
  // whose `sensor_location` doesn't match the selected scope are dropped
  // from snapshot-only tiles (top CO₂, busiest passage, etc).
  // -----------------------------------------------------------------------
  function sensorMatchesScope(sensor) {
    var scope = activeLocation();
    if (!scope) return true; // campus-wide
    if (!sensor || !sensor.sensor_location) return false;
    return String(sensor.sensor_location).toUpperCase() === String(scope).toUpperCase();
  }

  function filterToScope(rows) {
    return Array.isArray(rows) ? rows.filter(sensorMatchesScope) : [];
  }

  function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v); }

  function toNumber(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function avg(values) {
    var nums = values.filter(isFiniteNum);
    if (!nums.length) return null;
    var sum = 0;
    for (var i = 0; i < nums.length; i++) sum += nums[i];
    return sum / nums.length;
  }

  function fmtCompact(value) {
    if (!isFiniteNum(value)) return null;
    var abs = Math.abs(value);
    if (abs >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (abs >= 1000) return (value / 1000).toFixed(1) + 'k';
    if (abs >= 100) return value.toFixed(0);
    if (abs >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }

  function relativeMinutes(isoString) {
    if (!isoString) return null;
    var parsed = Date.parse(isoString);
    if (!Number.isFinite(parsed)) return null;
    var diff = Date.now() - parsed;
    if (diff < 0) return 0;
    return Math.round(diff / 60000);
  }

  function locText(en, el) {
    var locale = (global.SMACA_LOCALE || 'en').toLowerCase();
    return locale.indexOf('el') === 0 ? (el || en) : en;
  }

  function iaqSemantics() {
    return global.SMACA_IAQ_SEMANTICS || {};
  }

  function iaqTrans(key, en, el) {
    var map = global.SMACA_TRANSLATIONS || {};
    if (Object.prototype.hasOwnProperty.call(map, key) && map[key]) {
      return map[key];
    }
    return locText(en, el);
  }

  function iaqTimeframeLabel(tf) {
    var map = global.SMACA_TRANSLATIONS || {};
    var key = (tf === '7d') ? 'time_7d' : ((tf === '30d') ? 'time_30d' : 'time_24h');
    if (Object.prototype.hasOwnProperty.call(map, key) && map[key]) return map[key];
    return tf === '7d' ? '7d' : (tf === '30d' ? '30d' : '24h');
  }

  function iaqTfMetaLine() {
    var line = iaqTrans('iaq_chart_meta_timeframe', 'Timeframe: :tf', 'Χρονικό διάστημα: :tf');
    return line.replace(':tf', iaqTimeframeLabel(activeTimeframe()));
  }

  function labelForLocation(code, fallback) {
    if (global.SMACASpatial && typeof global.SMACASpatial.labelFor === 'function') {
      var label = global.SMACASpatial.labelFor(code);
      if (label) return label;
    }
    return fallback || code || '—';
  }

  function statusOrder(status) {
    var s = String(status || '').toLowerCase();
    if (s === 'critical' || s === 'crowded' || s === 'extreme' || s === 'poor') return 3;
    if (s === 'warning' || s === 'caution' || s === 'needs_calibration') return 2;
    if (s === 'good' || s === 'normal' || s === 'low' || s === 'healthy' || s === 'ok') return 1;
    return 0;
  }

  function isPeopleCounterSensor(s) {
    if (!s) return false;
    var dt = String(s.device_type || '').toLowerCase();
    if (dt === 'occupancy' || dt === 'people_counter' || dt === 'peoplecounter') return true;
    var lat = s.latest || {};
    return lat.people_total_in !== null && lat.people_total_in !== undefined
      || lat.people_in !== null && lat.people_in !== undefined
      || lat.people_out !== null && lat.people_out !== undefined;
  }

  function overviewTr(key, en, el) {
    var map = global.SMACA_TRANSLATIONS || {};
    if (Object.prototype.hasOwnProperty.call(map, key) && map[key]) return map[key];
    return locText(en, el);
  }

  function reportingBarColor(pct, total) {
    if (!total) return '#64748b';
    if (pct >= 80) return '#34d399';
    if (pct >= 50) return '#fbbf24';
    return '#f87171';
  }

  function kpiStatusAccentColor(ord) {
    if (ord >= 3) return '#f87171';
    if (ord >= 2) return '#fbbf24';
    if (ord >= 1) return '#34d399';
    return '#64748b';
  }

  function overviewModuleSourceLabel(moduleKey) {
    var map = {
      iaq: overviewTr('overview_module_iaq', 'Indoor Air Quality', 'Ποιότητα Εσωτερικού Αέρα'),
      energy: overviewTr('overview_module_energy', 'Energy', 'Ενέργεια'),
      occupancy: overviewTr('overview_module_occupancy', 'Occupancy / Movement', 'Κίνηση / Πληρότητα'),
      environmental: overviewTr('overview_module_environmental', 'Environmental / UV', 'Περιβάλλον / UV')
    };
    return map[moduleKey] || moduleKey;
  }

  function overviewKpiStatusLabel(kpi) {
    if (!kpi) return overviewTr('overview_status_normal', 'Normal', 'Κανονική');
    var ord = statusOrder(kpi.status);
    var il = kpi.interpretation_label ? String(kpi.interpretation_label).trim() : '';
    var ilLower = il.toLowerCase();
    if (ord >= 2 && il && ilLower !== 'poor' && ilLower !== 'good' && ilLower !== 'normal' && ilLower !== 'low') {
      return il;
    }
    if (ord >= 3) return overviewTr('overview_status_critical', 'Critical', 'Κρίσιμο');
    if (ord >= 2) return overviewTr('overview_status_warning', 'Warning', 'Προειδοποίηση');
    return overviewTr('overview_status_normal', 'Normal', 'Κανονική');
  }

  /** Softer module-health KPI line when sensors report well but a KPI is elevated. */
  function overviewModuleHealthStatusLine(kpi, reportingPct) {
    var ord = kpi ? statusOrder(kpi.status) : 0;
    var pct = Number(reportingPct);
    if (ord >= 3 && pct >= 80) {
      return {
        statusTag: overviewTr('overview_kpi_status_label', 'KPI status', 'KPI'),
        statusLabel: overviewTr('overview_status_attention_needed', 'Attention needed', 'Χρειάζεται προσοχή')
      };
    }
    return {
      statusTag: overviewTr('overview_status_label', 'Status', 'Κατάσταση'),
      statusLabel: overviewKpiStatusLabel(kpi)
    };
  }

  function overviewWatchReasonPlain(kpi) {
    if (!kpi) return '';
    var key = String(kpi.key || '');
    var il = kpi.interpretation_label ? String(kpi.interpretation_label).trim() : '';
    var ilLower = il.toLowerCase();
    if (key === 'uv_exposure_risk' || ilLower === 'poor') {
      return overviewTr('overview_watch_uv', 'High UV exposure', 'Υψηλή έκθεση UV');
    }
    if (il && ilLower !== 'poor' && ilLower !== 'good' && ilLower !== 'normal') {
      return il;
    }
    var reasons = {
      iaq_thermal_comfort: overviewTr('overview_watch_thermal_comfort', 'Thermal comfort outside optimal range', 'Θερμική άνεση εκτός βέλτιστου εύρους'),
      thermal_comfort_index: overviewTr('overview_watch_thermal_comfort', 'Thermal comfort outside optimal range', 'Θερμική άνεση εκτός βέλτιστου εύρους'),
      iaq_health_index: overviewTr('overview_watch_iaq_health', 'Air quality needs attention', 'Η ποιότητα αέρα χρειάζεται προσοχή'),
      ventilation_quality_index: overviewTr('overview_watch_ventilation', 'Ventilation pressure elevated', 'Αυξημένη πίεση αερισμού'),
      normalized_energy_intensity: overviewTr('overview_watch_energy_intensity', 'Energy intensity elevated', 'Αυξημένη ένταση ενέργειας'),
      base_load_index: overviewTr('overview_watch_base_load', 'Elevated standby load', 'Αυξημένο βασικό φορτίο'),
      movement_activity_index: overviewTr('overview_watch_movement', 'High entry/exit activity', 'Υψηλή δραστηριότητα εισόδων/εξόδων'),
      crowd_density_level: overviewTr('overview_watch_movement', 'High entry/exit activity', 'Υψηλή δραστηριότητα εισόδων/εξόδων'),
      uv_exposure_risk: overviewTr('overview_watch_uv', 'High UV exposure', 'Υψηλή έκθεση UV'),
      environmental_safety_index: overviewTr('overview_watch_environmental', 'Environmental risk elevated', 'Αυξημένος περιβαλλοντικός κίνδυνος')
    };
    if (reasons[key]) return reasons[key];
    if (kpi.label) return String(kpi.label);
    return overviewTr('overview_watch_generic', 'Review module KPIs', 'Ελέγξτε τους δείκτες της ενότητας');
  }

  function overviewWatchTileCopy(kpi) {
    var reasonPrefix = overviewTr('overview_reason_label', 'Reason', 'Λόγος');
    var reason = overviewWatchReasonPlain(kpi);
    var valueLine = '';
    if (kpi && kpi.value_caption) {
      valueLine = String(kpi.value_caption);
    } else if (kpi && kpi.value !== null && kpi.value !== undefined) {
      var unit = kpi.unit_label || kpi.unit || '';
      if (unit && unit !== 'ratio' && String(unit).toLowerCase() !== 'people') {
        valueLine = String(kpi.value) + (unit ? ' ' + unit : '');
      }
    }
    return {
      subtitle: reason ? (reasonPrefix + ': ' + reason) : '',
      meta: valueLine
    };
  }

  function appendDonutCountLegend(hostEl, legendItems) {
    if (!hostEl) return;
    var existing = hostEl.querySelector('.smaca-donut-legend');
    if (existing) existing.remove();
    var rows = (legendItems || []).map(function (item) {
      return ''
        + '<div class="smaca-donut-legend__row">'
        +   '<span class="smaca-donut-legend__swatch" style="background:' + item.color + ';"></span>'
        +   '<span class="smaca-donut-legend__label">' + String(item.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>'
        +   '<span class="smaca-donut-legend__count">' + item.count + '</span>'
        + '</div>';
    }).join('');
    var wrap = document.createElement('div');
    wrap.className = 'smaca-donut-legend';
    wrap.innerHTML = rows;
    hostEl.appendChild(wrap);
  }

  // -----------------------------------------------------------------------
  // Inline SVG icon paths
  // -----------------------------------------------------------------------
  var ICONS = {
    sensor:   '<rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
    co2:      '<path d="M12 3a9 9 0 109 9"/><path d="M12 7a5 5 0 105 5"/><circle cx="12" cy="12" r="1.4"/>',
    bolt:     '<path d="M13 2L3 14h7l-1 8 11-13h-7z"/>',
    sun:      '<circle cx="12" cy="12" r="4"/><line x1="12" y1="3" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21"/><line x1="3" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21" y2="12"/><line x1="5.6" y1="5.6" x2="7" y2="7"/><line x1="17" y1="17" x2="18.4" y2="18.4"/><line x1="5.6" y1="18.4" x2="7" y2="17"/><line x1="17" y1="7" x2="18.4" y2="5.6"/>',
    walk:     '<circle cx="13" cy="4" r="2"/><path d="M9 13l3-3 4 3 2 5"/><path d="M9 21l1-5-3-4"/>',
    flow:     '<path d="M3 12h12"/><path d="M11 6l6 6-6 6"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    alert:    '<path d="M10.3 3.7L1.5 19a2 2 0 001.7 3h17.6a2 2 0 001.7-3L13.7 3.7a2 2 0 00-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.9"/>',
    network:  '<path d="M2 12c4-4 16-4 20 0"/><path d="M5 15c3-3 11-3 14 0"/><path d="M8 18c2-1.5 6-1.5 8 0"/><circle cx="12" cy="20" r="1"/>',
    battery:  '<rect x="3" y="8" width="16" height="9" rx="1.5"/><line x1="20" y1="11" x2="20" y2="14"/>',
    location: '<path d="M12 21s-7-7-7-12a7 7 0 1114 0c0 5-7 12-7 12z"/><circle cx="12" cy="9" r="2.4"/>',
    peak:     '<polyline points="3 17 9 11 13 15 21 6"/>',
    target:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
    trend:    '<polyline points="3 17 9 11 13 15 21 6"/><polyline points="14 6 21 6 21 13"/>'
  };

  // -----------------------------------------------------------------------
  // Tile helpers
  // -----------------------------------------------------------------------
  function renderValueOrEmpty(grid, id, opts, emptyOpts) {
    var el = grid.querySelector('[data-tile="' + id + '"]');
    if (!el || !tile()) return;
    if (!opts || opts.value === undefined || opts.value === null
        || (typeof opts.value === 'number' && !Number.isFinite(opts.value))) {
      tile().renderEmptyTile(el, Object.assign({ icon: opts && opts.icon, label: opts && opts.label }, emptyOpts || {}));
      return;
    }
    tile().renderTile(el, opts);
  }

  function chartHost(grid, id, opts) {
    var el = grid.querySelector('[data-tile="' + id + '"]');
    if (!el || !tile()) return null;
    return tile().renderChartTile(el, opts || {});
  }

  function emptyChart(grid, id, label, message) {
    var el = grid.querySelector('[data-tile="' + id + '"]');
    if (el && tile()) {
      tile().renderEmptyTile(el, {
        label: label,
        message: message || locText('No data available', 'Δεν υπάρχουν δεδομένα')
      });
    }
  }

  // -----------------------------------------------------------------------
  // Common loaders (cached at the SMACAApi level)
  // -----------------------------------------------------------------------
  function loadOverview() { var a = api(); if (!a) return Promise.resolve(null); return a.fetchDashboardOverview().catch(function () { return null; }); }
  function loadSensors()  { var a = api(); if (!a) return Promise.resolve(null); return a.fetchSensors().catch(function () { return null; }); }
  function loadKpiSummary(module) { var a = api(); if (!a) return Promise.resolve(null); return a.fetchKpiSummary(module).catch(function () { return null; }); }
  function loadTimeseries(sensorId, metric) {
    var a = api(); if (!a) return Promise.resolve(null);
    var tf = activeTimeframe();
    return a.fetchSensorTimeseries(sensorId, metric, tf).catch(function () { return null; });
  }

  // Compute timeframe-aware delta (MAX − MIN) for a cumulative metric on
  // a single sensor. Used for People-counter and energy-meter values that
  // are stored as monotonically increasing counters. Returns:
  //   { delta, points, minTs, maxTs } when usable
  //   null                            when fewer than 2 points are inside
  //                                    the active timeframe window.
  function fetchSensorDelta(sensor, metric) {
    if (!sensor || !sensor.id) return Promise.resolve(null);
    return loadTimeseries(sensor.id, metric).then(function (resp) {
      var pts = (resp && Array.isArray(resp.points)) ? resp.points : [];
      // Timeseries responses are already scoped to the requested timeframe.
      var inWindow = pts;
      if (inWindow.length < 2) return null;
      var values = inWindow
        .map(function (p) { return toNumber(p.value); })
        .filter(function (v) { return v !== null; });
      if (values.length < 2) return null;
      var maxV = Math.max.apply(null, values);
      var minV = Math.min.apply(null, values);
      var delta = Math.max(0, maxV - minV);
      var ts = inWindow.map(function (p) { return Date.parse(p.time); }).filter(Number.isFinite);
      return {
        delta: delta,
        points: inWindow.length,
        minTs: ts.length ? Math.min.apply(null, ts) : null,
        maxTs: ts.length ? Math.max.apply(null, ts) : null
      };
    }).catch(function () { return null; });
  }

  // Bilingual "not enough data" message used by every defensive empty
  // state when a chart cannot be honestly computed for the active scope.
  function noTfDataMsg() {
    return locText(
      'Not enough data for the selected timeframe.',
      'Δεν υπάρχουν αρκετά δεδομένα για το επιλεγμένο διάστημα.'
    );
  }

  function operationalDayStartMs() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  }

  function operationalHourIndex(timestampMs) {
    var dayStart = operationalDayStartMs();
    if (!Number.isFinite(timestampMs) || timestampMs < dayStart || timestampMs >= dayStart + 86400000) return -1;
    return Math.floor((timestampMs - dayStart) / 3600000);
  }

  function operationalHourLabels() {
    var labels = [];
    for (var h = 0; h < 24; h++) labels.push(String(h).padStart(2, '0') + ':00');
    return labels;
  }

  function bucketByHour(points, aggregator) {
    var result = new Array(24);
    var counts = new Array(24);
    for (var i = 0; i < 24; i++) { result[i] = 0; counts[i] = 0; }
    if (!Array.isArray(points) || !points.length) {
      return { values: result, hasData: counts.map(function () { return false; }) };
    }
    points.forEach(function (p) {
      var t = Date.parse(p.time || 0);
      var v = toNumber(p.value);
      if (!Number.isFinite(t) || v === null) return;
      var hour = operationalHourIndex(t);
      if (hour < 0) return;
      result[hour] += v;
      counts[hour] += 1;
    });
    var values = aggregator === 'sum'
      ? result
      : result.map(function (v, idx) { return counts[idx] ? v / counts[idx] : 0; });
    var hasData = counts.map(function (c) { return c > 0; });
    return { values: values, hasData: hasData };
  }

  function uvRiskBands() {
    return [
      { from: 0, to: 3, color: '#34d399' },
      { from: 3, to: 6, color: '#fbbf24' },
      { from: 6, to: 8, color: '#f97316' },
      { from: 8, to: 11, color: '#f87171' },
      { from: 11, to: 99, color: '#a855f7' }
    ];
  }

  function uvBulletBands() {
    return [
      { from: 0, to: 3, color: 'rgba(52,211,153,0.30)' },
      { from: 3, to: 6, color: 'rgba(251,191,36,0.30)' },
      { from: 6, to: 8, color: 'rgba(249,115,22,0.40)' },
      { from: 8, to: 11, color: 'rgba(248,113,113,0.45)' },
      { from: 11, to: 11, color: 'rgba(168,85,247,0.50)' }
    ];
  }

  function uvAdvisoryForValue(uv) {
    var v = Number(uv);
    if (!Number.isFinite(v)) return { label: locText('No outdoor data', 'Χωρίς εξωτ. δεδομένα'), status: 'muted' };
    if (v >= 11) return { label: iaqTrans('uv_advisory_extreme', 'Avoid direct sun — full protection essential', 'Αποφύγετε την άμεση έκθεση στον ήλιο'), status: 'critical' };
    if (v >= 8) return { label: iaqTrans('uv_advisory_very_high', 'Minimize midday sun exposure', 'Ελαχιστοποιήστε την έκθεση στο μεσημέρι'), status: 'critical' };
    if (v >= 6) return { label: iaqTrans('uv_advisory_high', 'Protection strongly recommended outdoors', 'Συνιστάται ισχυρή προστασία σε εξωτερικό χώρο'), status: 'warning' };
    if (v >= 3) return { label: iaqTrans('uv_advisory_moderate', 'Use sunscreen and shade for long exposure', 'Χρησιμοποιήστε αντηλιακό και σκιά για μεγάλη διάρκεια'), status: 'warning' };
    return { label: iaqTrans('uv_advisory_low', 'Outdoor activities generally OK', 'Οι εξωτερικές δραστηριότητες είναι γενικά OK'), status: 'good' };
  }

  function bucketDeltasByHour(points) {
    var bins = [];
    for (var h = 0; h < 24; h++) bins.push({ min: null, max: null });
    if (!Array.isArray(points) || !points.length) {
      return {
        values: new Array(24).fill(0),
        hasData: new Array(24).fill(false)
      };
    }
    points.forEach(function (p) {
      var t = Date.parse(p.time || 0);
      var v = toNumber(p.value);
      if (!Number.isFinite(t) || v === null) return;
      var hour = operationalHourIndex(t);
      if (hour < 0) return;
      var b = bins[hour];
      if (b.min === null || v < b.min) b.min = v;
      if (b.max === null || v > b.max) b.max = v;
    });
    var values = [];
    var hasData = [];
    bins.forEach(function (b) {
      var has = b.min !== null && b.max !== null;
      hasData.push(has);
      if (!has) {
        values.push(0);
        return;
      }
      var d = b.max - b.min;
      values.push(d > 0 ? d : 0);
    });
    return { values: values, hasData: hasData };
  }

  function getOperationalCurrentHourIndex24h() {
    var now = Date.now();
    var dayStart = operationalDayStartMs();
    var idx = Math.floor((now - dayStart) / 3600000);
    return Math.max(0, Math.min(23, idx));
  }

  function getCurrentDailyBinIndex(binCount, dayMs) {
    var endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    var startOfFirstBin = endOfToday.getTime() + 1 - (binCount * dayMs);
    var idx = Math.floor((Date.now() - startOfFirstBin) / dayMs);
    return Math.max(0, Math.min(binCount - 1, idx));
  }

  function buildEnergyLoadProfileChartData(loadBucket) {
    var values = Array.isArray(loadBucket.values) ? loadBucket.values : [];
    var hasData = Array.isArray(loadBucket.hasData)
      ? loadBucket.hasData
      : values.map(function () { return true; });
    var labels = Array.isArray(loadBucket.labels) ? loadBucket.labels : [];
    var isHourly = loadBucket.bucket === 'hourly';
    var currentIdx = isHourly
      ? getOperationalCurrentHourIndex24h()
      : getCurrentDailyBinIndex(loadBucket.binCount || values.length, loadBucket.binSpanMs || 86400000);

    var maxReal = 0;
    values.forEach(function (v, i) {
      if (i > currentIdx || !hasData[i]) return;
      if (v > maxReal) maxReal = v;
    });
    var ghostY = maxReal > 0 ? Math.max(maxReal * 0.05, 0.05) : 0.08;

    var chartData = values.map(function (v, i) {
      var bucketLabel = labels[i] != null ? String(labels[i]) : '';
      if (i > currentIdx) {
        return {
          y: ghostY,
          color: 'rgba(148, 163, 184, 0.10)',
          borderColor: 'rgba(148, 163, 184, 0.32)',
          borderWidth: 1,
          dashStyle: 'Dash',
          future: true,
          bucketLabel: bucketLabel
        };
      }
      if (!hasData[i]) {
        return {
          y: 0,
          color: 'rgba(148, 163, 184, 0.06)',
          hasData: false,
          future: false,
          bucketLabel: bucketLabel
        };
      }
      return {
        y: v,
        hasData: true,
        future: false,
        bucketLabel: bucketLabel
      };
    });

    return {
      chartData: chartData,
      currentIdx: currentIdx,
      maxReal: maxReal,
      categories: labels
    };
  }

  // -----------------------------------------------------------------------
  // Adaptive bucketing — picks the right axis grain for the active timeframe.
  //   24h → 24 hourly buckets, labels '00' … '23'
  //    7d → 7 daily buckets, labels 'Mon 04', 'Tue 05', …
  //   30d → 30 daily buckets, labels 'Apr 09', 'Apr 10', …
  // Returns:
  //   { values: number[], labels: string[], bucket: 'hourly'|'daily',
  //     binCount: number, binSpanMs: number }
  // The caller decides whether to display labels (heat strips usually hide
  // them; column / line charts surface them). Aggregator: 'avg' | 'sum' for
  // AVG-of-readings flows; the cumulative-delta variant lives below.
  // -----------------------------------------------------------------------
  function bucketAdaptive(points, aggregator) {
    var tf = activeTimeframe();
    if (tf === '24h') {
      var hourly = bucketByHour(points, aggregator);
      return {
        values: hourly.values,
        hasData: hourly.hasData,
        labels: operationalHourLabels(),
        bucket: 'hourly',
        binCount: 24,
        binSpanMs: 3600000
      };
    }
    var days = (tf === '7d') ? 7 : 30;
    var binCount = days;
    var dayMs = 86400000;
    var endOfToday = (function () {
      var d = new Date();
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    })();
    var startOfFirstBin = endOfToday + 1 - days * dayMs;
    var sums = new Array(binCount);
    var counts = new Array(binCount);
    for (var k = 0; k < binCount; k++) { sums[k] = 0; counts[k] = 0; }
    if (Array.isArray(points)) {
      points.forEach(function (p) {
        var t = Date.parse(p.time || 0);
        var v = toNumber(p.value);
        if (!Number.isFinite(t) || v === null) return;
        var idx = Math.floor((t - startOfFirstBin) / dayMs);
        if (idx < 0 || idx >= binCount) return;
        sums[idx] += v;
        counts[idx] += 1;
      });
    }
    var values = [];
    var hasData = [];
    for (var i = 0; i < binCount; i++) {
      hasData.push(counts[i] > 0);
      if (!counts[i]) {
        values.push(0);
        continue;
      }
      values.push(aggregator === 'sum' ? sums[i] : (sums[i] / counts[i]));
    }
    var labels = [];
    for (var d = 0; d < binCount; d++) {
      var dt = new Date(startOfFirstBin + d * dayMs);
      labels.push(formatDayLabel(dt, days));
    }
    return { values: values, hasData: hasData, labels: labels, bucket: 'daily', binCount: binCount, binSpanMs: dayMs };
  }

  // Adaptive cumulative-delta bucketing for monotonically-increasing meters
  // (energy_kwh, people_total_in / out). Within each bucket: take the first
  // and last reading, take MAX − MIN across the bucket, clamp to ≥ 0.
  function bucketDeltasAdaptive(points) {
    var tf = activeTimeframe();
    if (tf === '24h') {
      var hourly = bucketDeltasByHour(points);
      return {
        values: hourly.values,
        hasData: hourly.hasData,
        labels: operationalHourLabels(),
        bucket: 'hourly',
        binCount: 24,
        binSpanMs: 3600000
      };
    }
    var days = (tf === '7d') ? 7 : 30;
    var dayMs = 86400000;
    var endOfToday = (function () {
      var d = new Date();
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    })();
    var startOfFirstBin = endOfToday + 1 - days * dayMs;
    var perBin = [];
    for (var k = 0; k < days; k++) perBin.push({ min: null, max: null });
    if (Array.isArray(points)) {
      points.forEach(function (p) {
        var t = Date.parse(p.time || 0);
        var v = toNumber(p.value);
        if (!Number.isFinite(t) || v === null) return;
        var idx = Math.floor((t - startOfFirstBin) / dayMs);
        if (idx < 0 || idx >= days) return;
        var b = perBin[idx];
        if (b.min === null || v < b.min) b.min = v;
        if (b.max === null || v > b.max) b.max = v;
      });
    }
    var values = [];
    var hasData = [];
    perBin.forEach(function (b) {
      var has = b.min !== null && b.max !== null;
      hasData.push(has);
      if (!has) {
        values.push(0);
        return;
      }
      values.push(Math.max(0, b.max - b.min));
    });
    var labels = [];
    for (var d = 0; d < days; d++) {
      labels.push(formatDayLabel(new Date(startOfFirstBin + d * dayMs), days));
    }
    return { values: values, hasData: hasData, labels: labels, bucket: 'daily', binCount: days, binSpanMs: dayMs };
  }

  function formatDayLabel(date, days) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    if (days <= 7) {
      var weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      var wd = weekdays[date.getDay()];
      var dd = (date.getDate() < 10 ? '0' : '') + date.getDate();
      return wd + ' ' + dd;
    }
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var m = months[date.getMonth()];
    var dd2 = (date.getDate() < 10 ? '0' : '') + date.getDate();
    return m + ' ' + dd2;
  }

  function freshestSensor(rows, fieldChecker) {
    return rows
      .filter(function (s) { return s && s.latest && s.latest.measured_at && (!fieldChecker || fieldChecker(s)); })
      .sort(function (a, b) {
        return Date.parse(b.latest.measured_at || 0) - Date.parse(a.latest.measured_at || 0);
      })[0] || null;
  }

  // =======================================================================
  // OVERVIEW — module health matrix + status donut + 4 cross-module tiles
  // =======================================================================
  function bootOverview() {
    var grid = document.querySelector('[data-smaca-telemetry="overview"]');
    if (!grid) return Promise.resolve({ skipped: 'no-grid', module: 'overview' });
    return Promise.all([
      loadOverview(),
      loadSensors(),
      loadKpiSummary('iaq'),
      loadKpiSummary('energy'),
      loadKpiSummary('occupancy'),
      loadKpiSummary('environmental')
    ]).then(function (results) {
      var overview = results[0] || {};
      var sensorsAll = (results[1] && Array.isArray(results[1].rows)) ? results[1].rows : [];
      // Scope-filter once and reuse. Snapshot tiles below are still
      // "right now" — they don't need timeframe but they MUST respect
      // the active spatial scope.
      var sensors = filterToScope(sensorsAll);
      var kpiBundles = {
        iaq: results[2], energy: results[3], occupancy: results[4], environmental: results[5]
      };

      // --- 1) Module health matrix — horizontal bars (one per module)
      // showing % of fresh sensors, plus a worst-status indicator dot.
      var overviewWatchKeys = {
        iaq: ['iaq_health_index', 'iaq_thermal_comfort', 'thermal_comfort_index', 'environmental_safety_index', 'ventilation_quality_index'],
        energy: ['normalized_energy_intensity', 'base_load_index'],
        occupancy: ['movement_activity_index', 'crowd_density_level'],
        environmental: ['uv_exposure_risk', 'environmental_safety_index']
      };
      function findWorstWatchKpi(bundle, keys) {
        if (!bundle || !Array.isArray(bundle.kpis) || !keys || !keys.length) return null;
        var best = null;
        var bestOrd = 0;
        keys.forEach(function (key) {
          bundle.kpis.forEach(function (k) {
            if (!k || k.key !== key) return;
            var ord = statusOrder(k.status);
            if (ord > bestOrd) {
              bestOrd = ord;
              best = k;
            }
          });
        });
        return best;
      }
      var moduleDefs = [
        { key: 'iaq',           label: locText('Air quality', 'Ποιότητα αέρα'),       color: '#22d3ee', sensorTypes: ['iaq'] },
        { key: 'occupancy',     label: locText('Movement', 'Κίνηση'),                 color: '#a78bfa', sensorTypes: ['occupancy'] },
        { key: 'energy',        label: locText('Energy', 'Ενέργεια'),                 color: '#fbbf24', sensorTypes: ['energy'] },
        { key: 'environmental', label: locText('Environmental / UV', 'Περιβάλλον / UV'), color: '#f97316', sensorTypes: ['environmental'] }
      ];
      var matrixItems = moduleDefs.map(function (m) {
        var matching = sensors.filter(function (s) {
          if (!s) return false;
          if (m.sensorTypes.indexOf((s.device_type || '').toLowerCase()) !== -1) return true;
          if (m.key === 'iaq' && s.latest && (s.latest.co2_ppm !== null && s.latest.co2_ppm !== undefined)) return true;
          if (m.key === 'occupancy' && isPeopleCounterSensor(s)) return true;
          if (m.key === 'energy' && s.latest && (s.latest.energy_kwh !== null && s.latest.energy_kwh !== undefined)) return true;
          if (m.key === 'environmental' && s.latest && (s.latest.uv_index !== null && s.latest.uv_index !== undefined)) return true;
          return false;
        });
        var fresh = matching.filter(function (s) {
          var min = relativeMinutes(s.latest && s.latest.measured_at);
          return isFiniteNum(min) && min < 30;
        }).length;
        var pct = matching.length ? (fresh / matching.length) * 100 : 0;
        var worstDriver = findWorstWatchKpi(kpiBundles[m.key], overviewWatchKeys[m.key]);
        var worstOrd = worstDriver ? statusOrder(worstDriver.status) : 0;
        var reportingTag = overviewTr('overview_reporting_label', 'Reporting', 'Αναφορά');
        var kpiStatus = overviewModuleHealthStatusLine(worstDriver, pct);
        var reportingLine = matching.length
          ? (reportingTag + ': ' + fresh + '/' + matching.length)
          : (reportingTag + ': —');
        return {
          label: m.label,
          pillar: m.key,
          value: pct,
          color: reportingBarColor(pct, matching.length),
          displayValue: matching.length ? (fresh + '/' + matching.length) : '—',
          subLabel: reportingLine + ' · ' + kpiStatus.statusTag + ': ' + kpiStatus.statusLabel
        };
      });
      var matrixEl = grid.querySelector('[data-tile="module-health"]');
      if (matrixEl && tile()) {
        var hostMatrix = tile().renderChartTile(matrixEl, {
          label: locText('Module health', 'Υγεία μονάδων'),
          pillar: 'system',
          subtitle: overviewTr(
            'overview_module_health_subtitle',
            'Green bar = sensors reporting in the last 30 min. Status line shows the worst KPI for that module.',
            'Πράσινη μπάρα = αισθητήρες που αναφέρουν (30 λεπτά). Η γραμμή κατάστασης δείχνει το χειρότερο KPI.'
          ),
          unit: '%',
          meta: overviewTr('overview_module_health_meta', 'Per module · live sensor streams', 'Ανά ενότητα · ζωντανές ροές')
        });
        if (hostMatrix) {
          tile().renderHorizontalBars(hostMatrix, { items: matrixItems, max: 100 });
        }
      }

      // --- 2) Sensor status donut with count legend
      var counts = { online: 0, delayed: 0, offline: 0 };
      sensors.forEach(function (s) {
        if (!s) return;
        if (!s.is_active) { counts.offline += 1; return; }
        var min = relativeMinutes(s.last_seen_at || (s.latest && s.latest.measured_at));
        if (!isFiniteNum(min)) { counts.offline += 1; return; }
        if (min < 5) counts.online += 1;
        else counts.delayed += 1;
      });
      var donutEl = grid.querySelector('[data-tile="status-donut"]');
      if (donutEl && tile()) {
        if (!sensors.length) {
          tile().renderEmptyTile(donutEl, {
            label: locText('Sensor status', 'Κατάσταση αισθητήρων'),
            message: locText('No sensors registered', 'Χωρίς αισθητήρες')
          });
        } else {
          var onlineLabel = overviewTr('overview_sensor_online', 'Online / reporting', 'Σε σύνδεση / αναφορά');
          var delayedLabel = overviewTr('overview_sensor_warning_stale', 'Warning / stale', 'Προειδοποίηση / παλιά');
          var offlineLabel = overviewTr('overview_sensor_offline', 'Offline / no data', 'Εκτός σύνδεσης / χωρίς δεδομένα');
          var hostDonut = tile().renderChartTile(donutEl, {
            label: locText('Sensor status', 'Κατάσταση αισθητήρων'),
            pillar: 'system',
            subtitle: overviewTr(
              'overview_sensor_donut_subtitle',
              'Freshness of sensor streams in the current scope.',
              'Φρεσκάδα ροών αισθητήρων στο τρέχον εύρος.'
            ),
            meta: locText(sensors.length + ' total', 'Σύνολο: ' + sensors.length)
          });
          if (hostDonut) {
            tile().renderDonut(hostDonut, {
              data: [
                { name: onlineLabel,  y: counts.online,  color: '#34d399' },
                { name: delayedLabel, y: counts.delayed, color: '#fbbf24' },
                { name: offlineLabel, y: counts.offline, color: '#94a3b8' }
              ],
              centerLabel: counts.online + counts.delayed,
              centerSubLabel: overviewTr('overview_reporting_short', 'reporting', 'αναφορά'),
              showLegend: false,
              height: 160
            });
            appendDonutCountLegend(hostDonut, [
              { label: onlineLabel, count: counts.online, color: '#34d399' },
              { label: delayedLabel, count: counts.delayed, color: '#fbbf24' },
              { label: offlineLabel, count: counts.offline, color: '#94a3b8' }
            ]);
          }
        }
      }

      // --- 3) Top module to watch (worst active KPI among module watchlist) ---
      var worstModule = null;
      var worstOrd = 0;
      var worstDriver = null;
      moduleDefs.forEach(function (m) {
        var driver = findWorstWatchKpi(kpiBundles[m.key], overviewWatchKeys[m.key]);
        if (!driver) return;
        var ord = statusOrder(driver.status);
        if (ord > worstOrd) {
          worstOrd = ord;
          worstModule = m;
          worstDriver = driver;
        }
      });
      var topWatchLabel = overviewTr('overview_top_module_to_watch', 'Top module to watch', 'Ενότητα προς παρακολούθηση');
      if (worstModule && worstOrd >= 2 && worstDriver) {
        var watchCopy = overviewWatchTileCopy(worstDriver);
        renderValueOrEmpty(grid, 'worst-module', {
          label: topWatchLabel,
          value: worstModule.label,
          subtitle: watchCopy.subtitle,
          status: worstDriver.status || 'warning',
          accent: 'warning',
          icon: ICONS.alert,
          meta: watchCopy.meta || overviewModuleSourceLabel(worstModule.key)
        });
      } else {
        renderValueOrEmpty(grid, 'worst-module', {
          label: topWatchLabel,
          value: overviewTr('overview_all_modules_stable', 'All modules stable', 'Όλες οι ενότητες σταθερές'),
          subtitle: overviewTr('overview_all_modules_stable_hint', 'No elevated KPI warnings in the current scope.', 'Χωρίς αυξημένες προειδοποιήσεις KPI στο τρέχον εύρος.'),
          status: 'good',
          icon: ICONS.target
        });
      }

      // --- 4) Live alerts ---
      var alerts = (overview.totals && overview.totals.active_alerts) || 0;
      renderValueOrEmpty(grid, 'alerts', {
        label: locText('Live alerts', 'Ζωντανά συμβάντα'),
        value: alerts,
        status: !alerts ? 'good' : (alerts < 3 ? 'warning' : 'critical'),
        icon: ICONS.alert,
        meta: !alerts ? locText('Operational', 'Σε λειτουργία') : locText(alerts + ' open', alerts + ' ανοικτά')
      });

      // --- 5) Highest CO₂ now ---
      var topCo2 = sensors
        .filter(function (s) { return s && s.latest && isFiniteNum(toNumber(s.latest.co2_ppm)); })
        .map(function (s) { return { sensor: s, value: toNumber(s.latest.co2_ppm) }; })
        .sort(function (a, b) { return b.value - a.value; })[0];
      if (topCo2) {
        renderValueOrEmpty(grid, 'top-co2', {
          label: locText('Highest CO₂ now', 'Υψηλότερο CO₂ τώρα'),
          value: Math.round(topCo2.value),
          unit: 'ppm',
          status: topCo2.value <= 800 ? 'good' : (topCo2.value <= 1200 ? 'warning' : 'critical'),
          icon: ICONS.co2,
          meta: labelForLocation(topCo2.sensor.sensor_location, topCo2.sensor.name || topCo2.sensor.sensor_uid)
        });
      } else {
        renderValueOrEmpty(grid, 'top-co2', {
          label: locText('Highest CO₂ now', 'Υψηλότερο CO₂ τώρα'),
          icon: ICONS.co2
        }, { message: locText('No IAQ readings', 'Χωρίς δεδομένα IAQ') });
      }

      // --- 6) Stalest stream ---
      var stalest = sensors
        .filter(function (s) { return s && s.last_seen_at; })
        .sort(function (a, b) { return Date.parse(a.last_seen_at) - Date.parse(b.last_seen_at); })[0];
      if (stalest) {
        var staleMin = relativeMinutes(stalest.last_seen_at);
        renderValueOrEmpty(grid, 'stalest', {
          label: locText('Stalest stream', 'Πιο παλιά ροή'),
          value: isFiniteNum(staleMin) ? staleMin : null,
          unit: locText('min ago', 'λ. πριν'),
          status: !isFiniteNum(staleMin) ? 'muted'
            : (staleMin < 5 ? 'good' : (staleMin < 30 ? 'warning' : 'critical')),
          icon: ICONS.clock,
          meta: labelForLocation(stalest.sensor_location, stalest.name || stalest.sensor_uid)
        });
      } else {
        renderValueOrEmpty(grid, 'stalest', {
          label: locText('Stalest stream', 'Πιο παλιά ροή'),
          icon: ICONS.clock
        }, { message: locText('No timestamps', 'Χωρίς timestamp') });
      }

      logChart('overview:module-health', {
        module: 'overview',
        endpoint: '/api/dashboard/overview + /api/sensors',
        points: sensors.length,
        bucket: 'snapshot',
        note: 'snapshot telemetry grid'
      });
      logChart('overview:status-donut', {
        module: 'overview',
        endpoint: '/api/sensors',
        points: sensors.length,
        bucket: 'snapshot',
        note: 'snapshot status counts'
      });
      logChart('overview:worst-module', {
        module: 'overview',
        endpoint: '/api/kpis/summary (module KPIs)',
        points: worstModule ? 1 : 0,
        bucket: 'snapshot',
        note: worstModule ? worstModule.label : 'all operational'
      });
      logChart('overview:alerts', {
        module: 'overview',
        endpoint: '/api/dashboard/overview',
        points: alerts,
        bucket: 'snapshot',
        note: 'live alert count'
      });
      logChart('overview:top-co2', {
        module: 'overview',
        endpoint: '/api/sensors (latest snapshot)',
        points: topCo2 ? 1 : 0,
        bucket: 'snapshot',
        seriesLength: topCo2 ? 1 : 0,
        yMin: topCo2 ? topCo2.value : null,
        yMax: topCo2 ? topCo2.value : null,
        note: topCo2 ? labelForLocation(topCo2.sensor.sensor_location, topCo2.sensor.name || topCo2.sensor.sensor_uid) : 'no IAQ readings'
      });
      logChart('overview:stalest', {
        module: 'overview',
        endpoint: '/api/sensors (latest snapshot)',
        points: stalest ? 1 : 0,
        bucket: 'snapshot',
        note: stalest ? labelForLocation(stalest.sensor_location, stalest.name || stalest.sensor_uid) : 'no timestamps'
      });
    });
  }

  // =======================================================================
  // IAQ — pollutant comparison + threshold ranking + hourly heat + tiles
  // =======================================================================
  function bootIaq() {
    var grid = document.querySelector('[data-smaca-telemetry="iaq"]');
    if (!grid) return Promise.resolve({ skipped: 'no-grid', module: 'iaq' });
    return loadSensors().then(function (sensorsResp) {
      var rowsAll = (sensorsResp && Array.isArray(sensorsResp.rows)) ? sensorsResp.rows : [];
      var rows = filterToScope(rowsAll);
      var iaq = rows.filter(function (s) {
        return s && (s.device_type === 'iaq' || (s.latest && (
          isFiniteNum(toNumber(s.latest.co2_ppm))
          || isFiniteNum(toNumber(s.latest.pm2_5_ugm3))
          || isFiniteNum(toNumber(s.latest.tvoc_index))
        )));
      });

      var co2Avg  = avg(iaq.map(function (s) { return toNumber(s.latest && s.latest.co2_ppm); }));
      var pmAvg   = avg(iaq.map(function (s) { return toNumber(s.latest && s.latest.pm2_5_ugm3); }));
      var pm10Avg = avg(iaq.map(function (s) { return toNumber(s.latest && s.latest.pm10_ugm3); }));
      var tvocAvg = avg(iaq.map(function (s) { return toNumber(s.latest && s.latest.tvoc_index); }));

      var sem = iaqSemantics();
      var tvocMode = String(sem.tvoc_semantic_mode || 'iaq_rating_level');
      var tvocUnitDisplay = tvocMode === 'raw_tvoc_ugm3'
        ? 'µg/m³'
        : String(sem.tvoc_mode_label || locText('IAQ rating level', 'Επίπεδο IAQ rating'));
      var tvocDecimals = tvocMode === 'raw_tvoc_ugm3' ? 1 : 2;

      var compareItems = [];
      function pushCompare(label, value, max, threshold, decimals, unit) {
        if (!isFiniteNum(value)) return;
        compareItems.push({
          label: label, value: value, max: max, threshold: threshold,
          unit: unit, decimals: decimals,
          tone: value <= threshold * 0.6 ? 'good'
            : (value <= threshold ? 'warning' : 'critical')
        });
      }
      pushCompare('CO₂',   co2Avg,  1500, 1000, 0, 'ppm');
      pushCompare('PM2.5', pmAvg,   50,   35,   1, 'µg');
      pushCompare('PM10',  pm10Avg, 100,  50,   1, 'µg');
      pushCompare('TVOC',  tvocAvg, 400,  200,  tvocDecimals, tvocUnitDisplay);
      var seriesTasks = Promise.resolve();

      // --- Pollutant compare (vs limit) ---
      var compareEl = grid.querySelector('[data-tile="pollutant-compare"]');
      if (compareEl && tile()) {
        if (!compareItems.length) {
          tile().renderEmptyTile(compareEl, {
            label: locText('Pollutant vs limit', 'Ρύποι vs όριο'),
            message: locText('No pollutant readings', 'Χωρίς δεδομένα ρύπων')
          });
        } else {
          var pollutantSubParts = [
            locText(
              'How close each pollutant is to its reference limit right now.',
              'Πόσο κοντά είναι κάθε ρύπος στο όριο αναφοράς.'
            )
          ];
          if (tvocMode !== 'raw_tvoc_ugm3') {
            pollutantSubParts.push(iaqTrans(
              'iaq_pollutant_subtitle_tvoc_semantic',
              'TVOC uses the sensor’s IAQ rating scale in this deployment; bar fill is not raw µg/m³.',
              'Σε αυτή την εγκατάσταση το TVOC χρησιμοποιεί την κλίμακα IAQ rating του αισθητήρα· η πλήρωση της μπάρας δεν είναι ακατέργαστο µg/m³.'
            ));
          }
          pollutantSubParts.push(iaqTfMetaLine());
          pollutantSubParts.push(iaqTrans(
            'iaq_chart_snapshot_mode_mix',
            'CO₂ and PM: direct measurements. TVOC follows the configured semantic scale unless raw µg/m³ mode is active.',
            'CO₂ και PM: άμεσες μετρήσεις. Το TVOC ακολουθεί τη ρυθμισμένη σημασιολογική κλίμακα, εκτός αν είναι ενεργή λειτουργία ακατέργαστου µg/m³.'
          ));
          var host = tile().renderChartTile(compareEl, {
            label: locText('Pollutant vs limit', 'Ρύποι vs όριο'),
            subtitle: pollutantSubParts.filter(Boolean).join(' '),
            legend: locText('| = WHO limit', '| = όριο WHO'),
            meta: locText('Latest readings · campus average', 'Τελ. ενδείξεις · μέσος όρος πανεπιστημιούπολης')
          });
          if (host) tile().renderComparisonBars(host, { items: compareItems });
        }
        logChart('iaq:pollutant-compare', {
          module: 'iaq',
          endpoint: '/api/sensors (latest snapshot)',
          points: compareItems.length,
          bucket: 'snapshot',
          seriesLength: compareItems.length,
          note: compareItems.length ? 'current pollutants vs limits' : 'empty-state'
        });
      }

      // --- Threshold ranking — Highcharts horizontal bar showing
      //     % of each pollutant's threshold currently consumed.
      var thrEl = grid.querySelector('[data-tile="threshold-rank"]');
      if (thrEl && tile()) {
        if (!compareItems.length) {
          tile().renderEmptyTile(thrEl, {
            label: locText('% of limit consumed', '% του ορίου'),
            message: locText('No data', 'Χωρίς δεδομένα')
          });
        } else {
          var sorted = compareItems.slice().sort(function (a, b) {
            return (b.value / b.threshold) - (a.value / a.threshold);
          });
          var thrSubParts = [
            locText(
              '100 % means the pollutant has reached its reference limit.',
              '100% σημαίνει ότι ο ρύπος έφτασε το όριο.'
            ),
            iaqTfMetaLine(),
            iaqTrans(
              'iaq_chart_snapshot_mode_mix',
              'CO₂ and PM: direct measurements. TVOC follows the configured semantic scale unless raw µg/m³ mode is active.',
              'CO₂ και PM: άμεσες μετρήσεις. Το TVOC ακολουθεί τη ρυθμισμένη σημασιολογική κλίμακα, εκτός αν είναι ενεργή λειτουργία ακατέργαστου µg/m³.'
            )
          ];
          var hostThr = tile().renderChartTile(thrEl, {
            label: locText('% of limit consumed', '% του ορίου'),
            subtitle: thrSubParts.filter(Boolean).join(' '),
            unit: '%',
            meta: locText('Ranked by proximity to limit', 'Ταξινόμηση κατά προσέγγιση στο όριο')
          });
          if (hostThr) {
            tile().renderRankedBarChart(hostThr, {
              categories: sorted.map(function (c) { return c.label; }),
              values: sorted.map(function (c) {
                var pct = (c.value / c.threshold) * 100;
                var color = pct <= 60 ? '#34d399' : (pct <= 100 ? '#fbbf24' : '#f87171');
                return { y: Number(pct.toFixed(0)), color: color };
              }),
              unit: '%',
              showLabels: true,
              height: 30 + sorted.length * 24
            });
          }
        }
        logChart('iaq:threshold-rank', {
          module: 'iaq',
          endpoint: '/api/sensors (latest snapshot)',
          points: compareItems.length,
          bucket: 'snapshot',
          seriesLength: compareItems.length,
          note: compareItems.length ? '% of limit consumed' : 'empty-state'
        });
      }

      // --- Top concern KPI tile ---
      var ranked = compareItems.slice().sort(function (a, b) {
        return (b.value / b.threshold) - (a.value / a.threshold);
      });
      var top = ranked[0];
      if (top) {
        renderValueOrEmpty(grid, 'top-concern', {
          label: locText('Top concern', 'Κύρια ανησυχία'),
          value: top.label,
          status: top.tone,
          icon: ICONS.alert,
          meta: locText(((top.value / top.threshold) * 100).toFixed(0) + '% of limit',
                        ((top.value / top.threshold) * 100).toFixed(0) + '% του ορίου')
        });
      } else {
        renderValueOrEmpty(grid, 'top-concern', {
          label: locText('Top concern', 'Κύρια ανησυχία'),
          icon: ICONS.alert
        }, { message: locText('No pollutants', 'Χωρίς ρύπους') });
      }
      logChart('iaq:top-concern', {
        module: 'iaq',
        endpoint: '/api/sensors (latest snapshot)',
        points: top ? 1 : 0,
        bucket: 'snapshot',
        note: top ? top.label : 'no pollutants'
      });

      // --- Hot location ---
      var hotLocation = iaq
        .filter(function (s) { return s && s.latest && isFiniteNum(toNumber(s.latest.co2_ppm)); })
        .map(function (s) { return { sensor: s, value: toNumber(s.latest.co2_ppm) }; })
        .sort(function (a, b) { return b.value - a.value; })[0];
      if (hotLocation) {
        renderValueOrEmpty(grid, 'hot-location', {
          label: locText('Hottest CO₂ area', 'Υψηλότερο CO₂'),
          value: labelForLocation(hotLocation.sensor.sensor_location, hotLocation.sensor.name || hotLocation.sensor.sensor_uid),
          status: hotLocation.value <= 800 ? 'good' : (hotLocation.value <= 1200 ? 'warning' : 'critical'),
          icon: ICONS.location,
          meta: Math.round(hotLocation.value) + ' ppm'
        });
      } else {
        renderValueOrEmpty(grid, 'hot-location', {
          label: locText('Hottest CO₂ area', 'Υψηλότερο CO₂'),
          icon: ICONS.location
        }, { message: locText('No data', 'Χωρίς δεδομένα') });
      }
      logChart('iaq:hot-location', {
        module: 'iaq',
        endpoint: '/api/sensors (latest snapshot)',
        points: hotLocation ? 1 : 0,
        bucket: 'snapshot',
        seriesLength: hotLocation ? 1 : 0,
        yMin: hotLocation ? hotLocation.value : null,
        yMax: hotLocation ? hotLocation.value : null,
        note: hotLocation ? labelForLocation(hotLocation.sensor.sensor_location, hotLocation.sensor.name || hotLocation.sensor.sensor_uid) : 'no IAQ readings'
      });

      // --- Coverage ---
      var freshSensors = iaq.filter(function (s) {
        var min = relativeMinutes(s.latest && s.latest.measured_at);
        return isFiniteNum(min) && min < 30;
      }).length;
      if (iaq.length) {
        renderValueOrEmpty(grid, 'coverage', {
          label: locText('Sensor coverage', 'Κάλυψη αισθητήρων'),
          value: freshSensors + '/' + iaq.length,
          status: freshSensors === iaq.length ? 'good'
            : (freshSensors >= iaq.length * 0.6 ? 'warning' : 'critical'),
          icon: ICONS.sensor,
          meta: locText('Reporting in last 30 min', 'Ενημέρωση τελ. 30 λ.')
        });
      } else {
        renderValueOrEmpty(grid, 'coverage', {
          label: locText('Sensor coverage', 'Κάλυψη αισθητήρων'),
          icon: ICONS.sensor
        }, { message: locText('No IAQ sensors', 'Χωρίς αισθητήρες IAQ') });
      }
      logChart('iaq:coverage', {
        module: 'iaq',
        endpoint: '/api/sensors (latest snapshot)',
        points: iaq.length,
        bucket: 'snapshot',
        note: iaq.length ? (freshSensors + '/' + iaq.length + ' reporting in last 30 min') : 'no IAQ sensors'
      });

      // --- Freshest IAQ sensor ---
      var freshest = freshestSensor(iaq, function (s) { return isFiniteNum(toNumber(s.latest.co2_ppm)); });
      if (freshest) {
        var min = relativeMinutes(freshest.latest && freshest.latest.measured_at);
        renderValueOrEmpty(grid, 'freshness', {
          label: locText('Freshest IAQ stream', 'Πιο φρέσκια ροή IAQ'),
          value: isFiniteNum(min) ? min : null,
          unit: locText('min ago', 'λ. πριν'),
          status: !isFiniteNum(min) ? 'muted'
            : (min < 5 ? 'good' : (min < 30 ? 'warning' : 'critical')),
          icon: ICONS.clock,
          meta: labelForLocation(freshest.sensor_location, freshest.name || freshest.sensor_uid)
        });
      } else {
        renderValueOrEmpty(grid, 'freshness', {
          label: locText('Freshest IAQ stream', 'Πιο φρέσκια ροή IAQ'),
          icon: ICONS.clock
        }, { message: locText('No data', 'Χωρίς δεδομένα') });
      }
      logChart('iaq:freshness', {
        module: 'iaq',
        endpoint: '/api/sensors (latest snapshot)',
        points: freshest ? 1 : 0,
        bucket: 'snapshot',
        note: freshest ? labelForLocation(freshest.sensor_location, freshest.name || freshest.sensor_uid) : 'no data'
      });

      // --- Hourly CO₂ heat strip (from freshest IAQ sensor) ---
      var heatHostEl = grid.querySelector('[data-tile="hourly-heat"]');
      if (!freshest || !heatHostEl) {
        if (heatHostEl) {
          emptyChart(grid, 'hourly-heat', locText('Hourly CO₂ pattern', 'Ωριαίο μοτίβο CO₂'), noTfDataMsg());
          logChart('iaq:hourly-heat', { module: 'iaq', endpoint: '/api/sensors/{id}/timeseries (no freshest)', points: 0, note: 'empty-state' });
        }
      } else if (tile()) {
        seriesTasks = loadTimeseries(freshest.id, 'co2_ppm').then(function (resp) {
          var pts = (resp && Array.isArray(resp.points)) ? resp.points : [];
          if (pts.length < 4) {
            emptyChart(grid, 'hourly-heat', locText('Hourly CO₂ pattern', 'Ωριαίο μοτίβο CO₂'), noTfDataMsg());
            logChart('iaq:hourly-heat', { module: 'iaq', endpoint: '/api/sensors/' + freshest.id + '/timeseries?metric=co2_ppm&timeframe=' + activeTimeframe(), points: pts.length, note: 'insufficient points' });
            return;
          }
          var bucketed = bucketAdaptive(pts, 'avg');
          var bands = [
            { from: 0, to: 800,  color: '#34d399' },
            { from: 800, to: 1200, color: '#fbbf24' },
            { from: 1200, to: 1e6, color: '#f87171' }
          ];
          var subtitleText = [
            iaqTfMetaLine(),
            bucketed.bucket === 'hourly'
              ? locText('Average CO₂ per hour over the last 24 hours.', 'Μέση τιμή CO₂ ανά ώρα τις τελευταίες 24 ώρες.')
              : locText('Daily average CO₂ across the selected window.', 'Ημερήσιος μέσος CO₂ στο επιλεγμένο διάστημα.'),
            iaqTrans('iaq_chart_co2_heat_sub', 'Hourly CO₂ pattern — direct ppm readings.', 'Ωριαίο μοτίβο CO₂ — άμεσες αναγνώσεις ppm.')
          ].filter(Boolean).join(' ');
          var legendText = bucketed.bucket === 'hourly'
            ? '0–23 h'
            : (bucketed.labels[0] + ' → ' + bucketed.labels[bucketed.labels.length - 1]);
          var host = tile().renderChartTile(heatHostEl, {
            label: locText('CO₂ pattern', 'Μοτίβο CO₂'),
            subtitle: subtitleText,
            unit: 'ppm',
            legend: legendText,
            meta: labelForLocation(freshest.sensor_location, freshest.name) + ' · ' + iaqTimeframeLabel(activeTimeframe())
          });
          if (host) {
            var axisOpts = axisOptsForBucket(bucketed);
            tile().renderHeatStripColumn(host, Object.assign({
              data: bucketed.values, bands: bands, height: 90
            }, axisOpts));
          }
          var tsList = pts.map(function (p) { return Date.parse(p.time); }).filter(Number.isFinite);
          var sStats = seriesStats(bucketed.values);
          logChart('iaq:hourly-heat', {
            module: 'iaq',
            endpoint: '/api/sensors/' + freshest.id + '/timeseries?metric=co2_ppm&timeframe=' + activeTimeframe(),
            points: pts.length,
            minTs: tsList.length ? Math.min.apply(null, tsList) : null,
            maxTs: tsList.length ? Math.max.apply(null, tsList) : null,
            bucket: bucketed.bucket + ' × ' + bucketed.binCount,
            bucketCount: bucketed.binCount,
            seriesLength: sStats.seriesLength,
            yMin: sStats.yMin,
            yMax: sStats.yMax
          });
        });
      }

      return seriesTasks;
    });
  }

  // =======================================================================
  // OCCUPANCY — stacked + ranked + hourly heat + flow donut + 4 tiles
  // =======================================================================
  function occupancyLabel(key, fallbackEn, fallbackEl) {
    var map = global.SMACA_TRANSLATIONS || {};
    if (Object.prototype.hasOwnProperty.call(map, key) && map[key]) {
      return map[key];
    }
    return locText(fallbackEn, fallbackEl);
  }

  function bootOccupancy() {
    var grid = document.querySelector('[data-smaca-telemetry="occupancy"]');
    if (!grid) return Promise.resolve({ skipped: 'no-grid', module: 'occupancy' });
    return Promise.all([loadSensors(), loadKpiSummary('occupancy')]).then(function (results) {
      var sensorsResp = results[0];
      var occupancyMetrics = results[1] && results[1].occupancy_metrics ? results[1].occupancy_metrics : null;
      var rowsAll = (sensorsResp && Array.isArray(sensorsResp.rows)) ? sensorsResp.rows : [];
      var rows = filterToScope(rowsAll);
      var occ = rows.filter(function (s) {
        return s && (s.device_type === 'occupancy' || (s.latest && (
          isFiniteNum(toNumber(s.latest.people_in))
          || isFiniteNum(toNumber(s.latest.people_total_in))
        )));
      });

      var latestEvents = 0;
      occ.forEach(function (s) {
        latestEvents += (toNumber(s.latest && s.latest.people_in) || 0) + (toNumber(s.latest && s.latest.people_out) || 0);
      });

      // Fetch timeframe-aware MAX−MIN deltas for every passage in scope.
      var passageSensors = occ.slice().sort(function (a, b) {
        var aw = (toNumber(a.latest && a.latest.people_in) || 0)
          + (toNumber(a.latest && a.latest.people_out) || 0);
        var bw = (toNumber(b.latest && b.latest.people_in) || 0)
          + (toNumber(b.latest && b.latest.people_out) || 0);
        return bw - aw;
      });

      var PASSAGE_DELTA_CAP = 14;
      var PASSAGE_FETCH_CONCURRENCY = 4;
      var passageFetchList = passageSensors.slice(0, PASSAGE_DELTA_CAP);
      var mapPoolFn = scheduler() && typeof scheduler().mapPool === 'function'
        ? scheduler().mapPool
        : function (items, worker) {
          return Promise.all(items.map(worker));
        };

      mapPoolFn(passageFetchList, function (s) {
        return Promise.all([
          fetchSensorDelta(s, 'people_total_in'),
          fetchSensorDelta(s, 'people_total_out')
        ]).then(function (pair) {
          var inDelta  = pair[0] ? pair[0].delta : null;
          var outDelta = pair[1] ? pair[1].delta : null;
          return {
            sensor: s,
            label: labelForLocation(s.sensor_location, s.name || s.sensor_uid),
            inV:  inDelta  || 0,
            outV: outDelta || 0,
            usable: (inDelta !== null) || (outDelta !== null),
            minTs: pair[0] && pair[0].minTs,
            maxTs: pair[0] && pair[0].maxTs,
            points: (pair[0] && pair[0].points) || (pair[1] && pair[1].points) || 0
          };
        });
      }, PASSAGE_FETCH_CONCURRENCY).then(function (perPassage) {
        var usable = perPassage.filter(function (p) { return p.usable && (p.inV + p.outV) > 0; });
        usable.sort(function (a, b) { return (b.inV + b.outV) - (a.inV + a.outV); });
        var stackedPassages = usable.slice(0, 5);
        var totalIn  = usable.reduce(function (a, p) { return a + p.inV; }, 0);
        var totalOut = usable.reduce(function (a, p) { return a + p.outV; }, 0);

        var topRanked = usable
          .map(function (p) {
            return { label: p.label, value: p.inV + p.outV };
          })
          .sort(function (a, b) { return b.value - a.value; })
          .slice(0, 6);

        staggerPaint([
          function () {
            var stackedEl = grid.querySelector('[data-tile="in-out-stacked"]');
            if (!stackedEl || !tile()) return;
            if (!stackedPassages.length) {
              tile().renderEmptyTile(stackedEl, {
                label: occupancyLabel('occupancy_chart_in_out_top_title', 'In vs Out · Top Passages', 'Είσοδοι vs Έξοδοι · Κορυφαία περάσματα'),
                message: noTfDataMsg()
              });
              logChart('occupancy:in-out-stacked', { module: 'occupancy', endpoint: '/api/sensors/{id}/timeseries (no usable data)', points: 0, note: 'empty-state' });
              return;
            }
            var hostStacked = tile().renderChartTile(stackedEl, {
              label: occupancyLabel('occupancy_chart_in_out_top_title', 'In vs Out · Top Passages', 'Είσοδοι vs Έξοδοι · Κορυφαία περάσματα'),
              subtitle: occupancyLabel('occupancy_chart_in_out_top_subtitle', 'Entries and exits per passage in the selected timeframe.', 'Είσοδοι και έξοδοι ανά πέρασμα στο επιλεγμένο διάστημα.'),
              unit: locText('events', 'συμβ.'),
              meta: occupancyLabel('occupancy_chart_in_out_top_meta_top5', 'Top 5 passages shown; totals use all passages in scope.', 'Εμφανίζονται τα 5 κορυφαία περάσματα· τα σύνολα χρησιμοποιούν όλα τα περάσματα στην εμβέλεια.')
            });
            if (hostStacked) {
              tile().renderStackedColumn(hostStacked, {
                categories: stackedPassages.map(function (p) { return p.label; }),
                showLegend: true,
                height: 180,
                series: [
                  { name: locText('In', 'Είσ.'),  color: '#34d399', data: stackedPassages.map(function (p) { return Math.round(p.inV); }) },
                  { name: locText('Out', 'Έξ.'), color: '#60a5fa', data: stackedPassages.map(function (p) { return Math.round(p.outV); }) }
                ]
              });
            }
            logChart('occupancy:in-out-stacked', {
              module: 'occupancy',
              endpoint: '/api/sensors/{id}/timeseries?metric=people_total_in|out',
              points: stackedPassages.reduce(function (a, p) { return a + p.points; }, 0),
              minTs: Math.min.apply(null, usable.map(function (p) { return p.minTs; }).filter(Number.isFinite)) || null,
              maxTs: Math.max.apply(null, usable.map(function (p) { return p.maxTs; }).filter(Number.isFinite)) || null,
              note: 'MAX-MIN delta per passage'
            });
          },
          function () {
            var rankEl = grid.querySelector('[data-tile="busiest-rank"]');
            if (!rankEl || !tile()) return;
            if (!topRanked.length) {
              tile().renderEmptyTile(rankEl, {
                label: occupancyLabel('occupancy_chart_busiest_title', 'Busiest Passages', 'Πιο κινητικά περάσματα'),
                message: noTfDataMsg()
              });
              return;
            }
            var hostRank = tile().renderChartTile(rankEl, {
              label: occupancyLabel('occupancy_chart_busiest_title', 'Busiest Passages', 'Πιο κινητικά περάσματα'),
              subtitle: occupancyLabel('occupancy_chart_busiest_subtitle', 'Top passages by movement events in the selected timeframe.', 'Κορυφαία περάσματα βάσει γεγονότων κίνησης στο επιλεγμένο διάστημα.'),
              unit: locText('events', 'συμβ.'),
              meta: locText('Selected timeframe · top passages', 'Επιλεγμένο διάστημα · κορυφαία περάσματα')
            });
            if (hostRank) {
              tile().renderRankedBarChart(hostRank, {
                categories: topRanked.map(function (e) { return e.label; }),
                values: topRanked.map(function (e) { return e.value; }),
                color: '#a78bfa',
                showLabels: true,
                height: 30 + topRanked.length * 22
              });
            }
            logChart('occupancy:busiest-rank', { module: 'occupancy', endpoint: '/api/sensors/{id}/timeseries?metric=people_total_in|out', points: topRanked.length, note: 'timeframe movement events per passage' });
          },
          function () {
            var donutEl = grid.querySelector('[data-tile="flow-donut"]');
            if (!donutEl || !tile()) return;
            if ((totalIn + totalOut) <= 0) {
              tile().renderEmptyTile(donutEl, {
                label: occupancyLabel('occupancy_chart_share_title', 'Entry/Exit Share', 'Μερίδιο εισόδων/εξόδων'),
                message: noTfDataMsg()
              });
              logChart('occupancy:flow-donut', { module: 'occupancy', endpoint: '/api/sensors/{id}/timeseries (no usable data)', points: 0, note: 'empty-state' });
              return;
            }
            var balancePct = ((totalIn / (totalIn + totalOut)) * 100).toFixed(0);
            var hostDonut = tile().renderChartTile(donutEl, {
              label: occupancyLabel('occupancy_chart_share_title', 'Entry/Exit Share', 'Μερίδιο εισόδων/εξόδων'),
              subtitle: occupancyLabel('occupancy_chart_share_subtitle', 'Share of entries vs exits in the selected timeframe. This is movement share, not live occupancy.', 'Μερίδιο εισόδων και εξόδων στο επιλεγμένο διάστημα. Είναι μερίδιο κίνησης, όχι ζωντανό headcount.'),
              meta: occupancyLabel('occupancy_chart_share_scope_note', 'Share uses all passages in the current scope.', 'Το μερίδιο βασίζεται σε όλα τα περάσματα της τρέχουσας εμβέλειας.')
            });
            if (hostDonut) {
              tile().renderDonut(hostDonut, {
                data: [
                  { name: locText('In', 'Είσ.'),  y: totalIn,  color: '#34d399' },
                  { name: locText('Out', 'Έξ.'), y: totalOut, color: '#60a5fa' }
                ],
                centerLabel: balancePct + '%',
                centerSubLabel: locText('inbound', 'είσοδοι'),
                showLegend: true,
                height: 180
              });
            }
            logChart('occupancy:flow-donut', { module: 'occupancy', endpoint: '/api/sensors/{id}/timeseries?metric=people_total_in|out', points: usable.length, note: 'aggregated MAX-MIN deltas' });
          }
        ], 56);

        // --- 4) Daily remaining inside (occupancy_metrics) ---
        var netEl = grid.querySelector('[data-tile="net-balance"]');
        if (netEl && tile()) {
          var remainingLabel = occupancyLabel('occupancy_tile_daily_remaining_title', 'Remaining inside (daily)', 'Παραμένοντες εντός (ημερήσιο)');
          var remainingSubtitle = occupancyLabel('occupancy_tile_daily_remaining_subtitle', 'Net result of today’s entry/exit counters for scope (Athens day).', 'Καθαρό αποτέλεσμα των σημερινών μετρητών εισόδου/εξόδου για την εμβέλεια (ημέρα Athens).');
          var remainingMeta = occupancyLabel('occupancy_tile_daily_remaining_meta', 'Resets at midnight. Not the same as total movement events.', 'Μηδενίζεται τα μεσάνυχτα. Δεν είναι το ίδιο με τα συνολικά γεγονότα κίνησης.');
          var backendRemaining = occupancyMetrics && occupancyMetrics.remaining_inside;
          if (backendRemaining !== null && backendRemaining !== undefined && Number.isFinite(Number(backendRemaining))) {
            tile().renderTile(netEl, {
              label: remainingLabel,
              subtitle: remainingSubtitle,
              value: String(Math.round(Number(backendRemaining))),
              status: Math.abs(Number(backendRemaining)) < 5 ? 'good' : 'warning',
              icon: ICONS.flow,
              meta: remainingMeta
            });
          } else {
            tile().renderEmptyTile(netEl, {
              label: remainingLabel,
              subtitle: remainingSubtitle,
              icon: ICONS.flow,
              message: noTfDataMsg()
            });
          }
          logChart('occupancy:net-balance', { module: 'occupancy', endpoint: '/api/kpis/summary?module=occupancy', points: usable.length });
        }

        // --- 5) Total events — timeframe-aware sum ---
        var totalEl = grid.querySelector('[data-tile="total-events"]');
        if (totalEl && tile()) {
          var totalEvents = totalIn + totalOut;
          var totalSubtitle = occupancyLabel('occupancy_tile_total_movement_subtitle', 'Every entry and exit at passage counters in scope, added together for the selected timeframe.', 'Κάθε είσοδος και έξοδος στα περάσματα της εμβέλειας, αθροισμένα για το επιλεγμένο διάστημα.');
          var totalMeta = occupancyLabel('occupancy_tile_total_movement_tooltip', 'Counts traffic volume, not people currently inside a room. Separate from the daily remaining-inside card.', 'Μετρά όγκο κίνησης, όχι άτομα που είναι μέσα σε χώρο τώρα. Ξεχωριστό από το ημερήσιο «παραμένοντες εντός».');
          if (!usable.length || totalEvents <= 0) {
            tile().renderEmptyTile(totalEl, {
              label: occupancyLabel('occupancy_tile_total_movement_title', 'Total Movement Events', 'Συνολικά γεγονότα κίνησης'),
              subtitle: totalSubtitle,
              icon: ICONS.walk,
              message: noTfDataMsg()
            });
          } else {
            tile().renderTile(totalEl, {
              label: occupancyLabel('occupancy_tile_total_movement_title', 'Total Movement Events', 'Συνολικά γεγονότα κίνησης'),
              subtitle: totalSubtitle,
              value: fmtCompact(totalEvents),
              unit: locText('events', 'συμβ.'),
              status: 'accent',
              icon: ICONS.walk,
              meta: totalMeta
            });
          }
          logChart('occupancy:total-events', { module: 'occupancy', endpoint: '/api/sensors/{id}/timeseries?metric=people_total_in|out', points: usable.length, note: 'sum of MAX-MIN deltas' });
        }
      });

      // --- Hourly activity heat strip + peak hour (aggregated across scope) ---
      var heatEl = grid.querySelector('[data-tile="hourly-activity"]');
      if (!occ.length || !heatEl) {
        if (heatEl) {
          emptyChart(grid, 'hourly-activity', occupancyLabel('occupancy_chart_hourly_title', 'Hourly Movement Pattern', 'Ωριαίο μοτίβο κίνησης'), noTfDataMsg());
          logChart('occupancy:hourly-activity', { module: 'occupancy', endpoint: '/api/sensors/{id}/timeseries (no scope passages)', points: 0, note: 'empty-state' });
        }
        renderValueOrEmpty(grid, 'peak-hour', {
          label: occupancyLabel('occupancy_tile_peak_hour_title', 'Peak Hour', 'Ώρα αιχμής'), icon: ICONS.peak
        }, { message: locText('No data', 'Χωρίς δεδομένα') });
      } else if (tile()) {
        mapPoolFn(occ.slice(0, PASSAGE_DELTA_CAP), function (s) {
          return Promise.all([
            loadTimeseries(s.id, 'people_in'),
            loadTimeseries(s.id, 'people_out')
          ]);
        }, PASSAGE_FETCH_CONCURRENCY).then(function (perSensorSeries) {
          var inPts = [];
          var outPts = [];
          perSensorSeries.forEach(function (pair) {
            var inSeries = (pair[0] && Array.isArray(pair[0].points)) ? pair[0].points : [];
            var outSeries = (pair[1] && Array.isArray(pair[1].points)) ? pair[1].points : [];
            inPts = inPts.concat(inSeries);
            outPts = outPts.concat(outSeries);
          });
          if (inPts.length < 1 && outPts.length < 1) {
            emptyChart(grid, 'hourly-activity', occupancyLabel('occupancy_chart_hourly_title', 'Hourly Movement Pattern', 'Ωριαίο μοτίβο κίνησης'), noTfDataMsg());
            logChart('occupancy:hourly-activity', {
              module: 'occupancy',
              endpoint: '/api/sensors/{id}/timeseries?metric=people_in|out&timeframe=' + activeTimeframe(),
              points: 0,
              note: 'insufficient points'
            });
            renderValueOrEmpty(grid, 'peak-hour', {
              label: occupancyLabel('occupancy_tile_peak_hour_title', 'Peak Hour', 'Ώρα αιχμής'), icon: ICONS.peak
            }, { message: locText('No data', 'Χωρίς δεδομένα') });
            return;
          }
          var inBucket  = bucketAdaptive(inPts,  'sum');
          var outBucket = bucketAdaptive(outPts, 'sum');
          var combined = inBucket.values.map(function (v, idx) { return v + (outBucket.values[idx] || 0); });
          var maxVal = Math.max.apply(null, combined) || 1;
          var peakIdxForTile = combined.indexOf(maxVal);
          var chartCategories = (inBucket.labels || []).slice();
          var chartData = combined.slice();
          if (inBucket.bucket === 'hourly' && chartData.length === 24 && maxVal > 0 && peakIdxForTile >= 0) {
            var half = 11;
            var rotC = [];
            var rotL = [];
            for (var ri = 0; ri < 24; ri++) {
              var si = (peakIdxForTile - half + ri + 240) % 24;
              rotC.push(combined[si]);
              rotL.push((inBucket.labels && inBucket.labels[si]) ? String(inBucket.labels[si]) : String(si));
            }
            chartData = rotC;
            chartCategories = rotL;
          }
          var bands = [
            { from: 0,             to: maxVal * 0.33, color: '#3b82f6' },
            { from: maxVal * 0.33, to: maxVal * 0.66, color: '#a78bfa' },
            { from: maxVal * 0.66, to: maxVal + 1,    color: '#f97316' }
          ];
          var subtitleText = occupancyLabel('occupancy_chart_hourly_subtitle', 'When entries and exits are busiest by hour across all passages in scope.', 'Πότε είναι πιο έντονες οι είσοδοι και οι έξοδοι ανά ώρα, σε όλα τα περάσματα της εμβέλειας.');
          var hourlyHelp = occupancyLabel('occupancy_chart_hourly_help', 'Use this to spot peak hours and quieter periods. It does not show how many people are inside right now.', 'Βοηθά να εντοπίζεις ώρες αιχμής και ήσυχες περιόδους. Δεν δείχνει πόσα άτομα είναι μέσα τώρα.');
          var legendText = inBucket.bucket === 'hourly'
            ? '0–23 h'
            : (inBucket.labels[0] + ' → ' + inBucket.labels[inBucket.labels.length - 1]);
          var heatHost = tile().renderChartTile(heatEl, {
            label: occupancyLabel('occupancy_chart_hourly_title', 'Hourly Movement Pattern', 'Ωριαίο μοτίβο κίνησης'),
            subtitle: subtitleText,
            unit: locText('events', 'συμβ.'),
            legend: legendText,
            meta: hourlyHelp + ' · ' + occupancyLabel('occupancy_chart_hourly_scope_meta', 'All passages in current scope', 'Όλα τα περάσματα στην τρέχουσα εμβέλεια') + ' · ' + activeTimeframe()
          });
          if (heatHost) {
            var axisOptsOcc = axisOptsForBucket(inBucket);
            var hourlyXTitle = locText(
              'Clock hour — bar in the middle is the busiest hour (peak).',
              'Ώρα ρολογιού — η κεντρική στήλη είναι η πιο «φορτωμένη» ώρα (αιχμή).'
            );
            tile().renderHeatStripColumn(heatHost, Object.assign({}, axisOptsOcc, {
              data: chartData,
              bands: bands,
              height: 156,
              showAxis: true,
              showYAxis: true,
              categories: chartCategories,
              xAxisLabelStep: inBucket.bucket === 'hourly' ? 1 : undefined,
              xAxisTitle: inBucket.bucket === 'hourly' ? hourlyXTitle : locText('Peak hours (X)', 'Ώρες αιχμής (Χ)'),
              yAxisTitle: locText('People', 'Άτομα')
            }));
          }
          var peakIdx = peakIdxForTile;
          var peakLabel = (peakIdx >= 0 && maxVal > 0)
            ? (inBucket.bucket === 'hourly' ? inBucket.labels[peakIdx] + ':00' : inBucket.labels[peakIdx])
            : null;
          renderValueOrEmpty(grid, 'peak-hour', {
            label: occupancyLabel('occupancy_tile_peak_hour_title', 'Peak Hour', 'Ώρα αιχμής'),
            subtitle: occupancyLabel('occupancy_tile_peak_hour_subtitle', 'The hour with the most entry + exit movement across all passages in scope.', 'Η ώρα με τα περισσότερα γεγονότα εισόδου + εξόδου σε όλα τα περάσματα της εμβέλειας.'),
            value: peakLabel,
            status: 'accent',
            icon: ICONS.peak,
            meta: occupancyLabel('occupancy_tile_peak_hour_meta', 'Taken from the hourly movement pattern for the selected timeframe.', 'Προκύπτει από το ωριαίο μοτίβο κίνησης στο επιλεγμένο διάστημα.')
          });
          var allTs = inPts.concat(outPts).map(function (p) { return Date.parse(p.time); }).filter(Number.isFinite);
          var combinedStats = seriesStats(combined);
          logChart('occupancy:hourly-activity', {
            module: 'occupancy',
            endpoint: '/api/sensors/{id}/timeseries?metric=people_in|out&timeframe=' + activeTimeframe(),
            points: inPts.length + outPts.length,
            minTs: allTs.length ? Math.min.apply(null, allTs) : null,
            maxTs: allTs.length ? Math.max.apply(null, allTs) : null,
            bucket: inBucket.bucket + ' × ' + inBucket.binCount,
            bucketCount: inBucket.binCount,
            seriesLength: combinedStats.seriesLength,
            yMin: combinedStats.yMin,
            yMax: combinedStats.yMax,
            note: 'aggregated across scope'
          });
        });
      }

      // (daily remaining + total-events are populated inside the Promise.all
      // above with timeframe-aware MAX-MIN deltas — no duplicate snapshot
      // tiles here.)

      // --- Freshness — newest passage reading in scope ---
      var freshest = freshestSensor(occ, function (s) { return s && s.latest && s.latest.measured_at; });
      if (freshest) {
        var fmin = relativeMinutes(freshest.latest && freshest.latest.measured_at);
        renderValueOrEmpty(grid, 'freshness', {
          label: occupancyLabel('occupancy_tile_latest_passage_update_title', 'Latest passage update', 'Τελευταία ενημέρωση περάσματος'),
          subtitle: occupancyLabel('occupancy_tile_latest_passage_update_subtitle', 'How fresh the newest passage reading is.', 'Πόσο πρόσφατη είναι η νεότερη ανάγνωση περάσματος.'),
          value: isFiniteNum(fmin) ? fmin : null,
          unit: locText('min ago', 'λ. πριν'),
          status: !isFiniteNum(fmin) ? 'muted'
            : (fmin < 5 ? 'good' : (fmin < 30 ? 'warning' : 'critical')),
          icon: ICONS.clock,
          meta: occupancyLabel('occupancy_tile_latest_passage_update_meta', 'Shows data latency only, not occupancy or headcount.', 'Δείχνει μόνο φρεσκάδα δεδομένων, όχι occupancy ή headcount.') + ' · ' + labelForLocation(freshest.sensor_location, freshest.name)
        });
        logChart('occupancy:freshness', { module: 'occupancy', endpoint: '/api/sensors (latest snapshot)', points: 1 });
      } else {
        renderValueOrEmpty(grid, 'freshness', {
          label: occupancyLabel('occupancy_tile_latest_passage_update_title', 'Latest passage update', 'Τελευταία ενημέρωση περάσματος'),
          icon: ICONS.clock
        }, { message: locText('No data', 'Χωρίς δεδομένα') });
      }
    });
  }

  // =======================================================================
  // ENERGY — ranked + load profile + share donut + base-load + peak hour
  // =======================================================================
  function bootEnergy() {
    var grid = document.querySelector('[data-smaca-telemetry="energy"]');
    if (!grid) return Promise.resolve({ skipped: 'no-grid', module: 'energy' });
    return Promise.all([loadSensors(), loadKpiSummary('energy')]).then(function (results) {
      var rowsAll = (results[0] && Array.isArray(results[0].rows)) ? results[0].rows : [];
      var rows = filterToScope(rowsAll);
      var kpis = (results[1] && Array.isArray(results[1].kpis)) ? results[1].kpis : [];
      var energy = rows.filter(function (s) {
        return s && (s.device_type === 'energy' || (s.latest && isFiniteNum(toNumber(s.latest.energy_kwh))));
      });

      // Top 6 candidate energy meters by latest cumulative reading. We
      // need MAX−MIN deltas over the active timeframe — `latest.energy_kwh`
      // is a cumulative meter reading, NOT consumption inside a window.
      var candidateMeters = energy
        .filter(function (s) { return isFiniteNum(toNumber(s.latest && s.latest.energy_kwh)); })
        .sort(function (a, b) {
          return toNumber(b.latest.energy_kwh) - toNumber(a.latest.energy_kwh);
        })
        .slice(0, 6);

      var rankEl = grid.querySelector('[data-tile="energy-by-area"]');
      var shareEl = grid.querySelector('[data-tile="energy-share"]');
      var loadTask = Promise.resolve();

      var areaTask = Promise.all(candidateMeters.map(function (s) {
        return fetchSensorDelta(s, 'energy_kwh').then(function (d) {
          return {
            sensor: s,
            label: labelForLocation(s.sensor_location, s.name || s.sensor_uid),
            delta: d ? d.delta : null,
            points: d ? d.points : 0,
            minTs: d ? d.minTs : null,
            maxTs: d ? d.maxTs : null
          };
        });
      })).then(function (perMeter) {
        // Aggregate by human-readable location label so rooms in the same
        // area collapse into one bar.
        var byLabel = {};
        perMeter.forEach(function (m) {
          if (m.delta === null || m.delta <= 0) return;
          byLabel[m.label] = (byLabel[m.label] || 0) + m.delta;
        });
        var rankItems = Object.keys(byLabel)
          .map(function (k) { return { label: k, value: byLabel[k] }; })
          .sort(function (a, b) { return b.value - a.value; })
          .slice(0, 6);

        // --- 1) Energy by area — timeframe-aware ranked bar chart ---
        if (rankEl && tile()) {
          if (!rankItems.length) {
            tile().renderEmptyTile(rankEl, {
              label: locText('Energy by area', 'Ενέργεια ανά περιοχή'),
              message: noTfDataMsg()
            });
            logChart('energy:energy-by-area', { module: 'energy', endpoint: '/api/sensors/{id}/timeseries (no usable data)', points: 0, note: 'empty-state' });
          } else {
            var host = tile().renderChartTile(rankEl, {
              label: locText('Energy by area', 'Ενέργεια ανά περιοχή'),
              subtitle: locText(
                'kWh consumed per area in the selected timeframe (cumulative meter deltas, not latest reading).',
                'kWh ανά περιοχή στο επιλεγμένο διάστημα (deltas αθροιστικών μετρητών, όχι τελευταία ένδειξη).'
              ),
              unit: 'kWh',
              meta: locText('MAX−MIN per meter · top 6 areas', 'MAX−MIN ανά μετρητή · κορυφαίοι 6')
            });
            if (host) {
              tile().renderRankedBarChart(host, {
                categories: rankItems.map(function (i) { return i.label; }),
                values: rankItems.map(function (i) { return Number(i.value.toFixed(1)); }),
                color: '#fbbf24',
                unit: 'kWh',
                showLabels: true,
                height: 30 + rankItems.length * 24
              });
            }
            logChart('energy:energy-by-area', {
              module: 'energy',
              endpoint: '/api/sensors/{id}/timeseries?metric=energy_kwh',
              points: perMeter.reduce(function (a, m) { return a + (m.points || 0); }, 0),
              minTs: Math.min.apply(null, perMeter.map(function (m) { return m.minTs; }).filter(Number.isFinite)) || null,
              maxTs: Math.max.apply(null, perMeter.map(function (m) { return m.maxTs; }).filter(Number.isFinite)) || null,
              note: 'MAX-MIN deltas, aggregated by area'
            });
          }
        }

        // --- 3) Energy share donut — same timeframe-aware data ---
        if (shareEl && tile()) {
          if (!rankItems.length) {
            tile().renderEmptyTile(shareEl, {
              label: locText('Energy share', 'Μερίδιο ενέργειας'),
              message: noTfDataMsg()
            });
            logChart('energy:energy-share', { module: 'energy', endpoint: '/api/sensors/{id}/timeseries (no usable data)', points: 0, note: 'empty-state' });
          } else {
            var totalEnergy = rankItems.reduce(function (a, b) { return a + b.value; }, 0);
            var palette = ['#fbbf24', '#f97316', '#a78bfa', '#22d3ee', '#34d399', '#60a5fa'];
            var hostShare = tile().renderChartTile(shareEl, {
              label: locText('Energy share', 'Μερίδιο ενέργειας'),
              subtitle: locText(
                'Share of kWh consumed in the timeframe (meter deltas, not cumulative reading).',
                'Μερίδιο kWh στο διάστημα (deltas μετρητών, όχι αθροιστική ένδειξη).'
              ),
              meta: locText('% by area · centre = total kWh consumed', '% ανά περιοχή · κέντρο = σύνολο kWh')
            });
            if (hostShare) {
              tile().renderDonut(hostShare, {
                data: rankItems.map(function (i, idx) {
                  return { name: i.label, y: i.value, color: palette[idx % palette.length] };
                }),
                centerLabel: fmtCompact(totalEnergy),
                centerSubLabel: 'kWh',
                showLegend: false,
                height: 180
              });
            }
            logChart('energy:energy-share', {
              module: 'energy',
              endpoint: '/api/sensors/{id}/timeseries?metric=energy_kwh',
              points: perMeter.reduce(function (a, m) { return a + (m.points || 0); }, 0),
              note: 'donut of MAX-MIN delta proportions'
            });
          }
        }
      });

      // --- 2) Hourly load profile (heat strip of Δ kWh) ---
      var freshest = freshestSensor(energy, function (s) { return isFiniteNum(toNumber(s.latest.energy_kwh)); });
      var loadEl = grid.querySelector('[data-tile="load-profile"]');
      if (!freshest || !loadEl) {
        if (loadEl) {
          emptyChart(grid, 'load-profile', locText('Hourly load profile', 'Ωριαίο προφίλ φορτίου'), noTfDataMsg());
          logChart('energy:load-profile', { module: 'energy', endpoint: '/api/sensors/{id}/timeseries (no freshest meter)', points: 0, note: 'empty-state' });
        }
        renderValueOrEmpty(grid, 'peak-hour', {
          label: locText('Peak hour today', 'Ώρα αιχμής'), icon: ICONS.peak
        }, { message: locText('No load data', 'Χωρίς φορτίο') });
        logChart('energy:peak-hour', {
          module: 'energy',
          endpoint: '/api/sensors/{id}/timeseries (no freshest meter)',
          points: 0,
          bucket: 'snapshot',
          note: 'empty-state'
        });
      } else if (tile()) {
        loadTask = loadTimeseries(freshest.id, 'energy_kwh').then(function (resp) {
          var pts = (resp && Array.isArray(resp.points)) ? resp.points : [];
          if (pts.length < 3) {
            emptyChart(grid, 'load-profile', locText('Hourly load profile', 'Ωριαίο προφίλ φορτίου'), noTfDataMsg());
            logChart('energy:load-profile', {
              module: 'energy',
              endpoint: '/api/sensors/' + freshest.id + '/timeseries?metric=energy_kwh&timeframe=' + activeTimeframe(),
              points: pts.length,
              note: 'insufficient points'
            });
            renderValueOrEmpty(grid, 'peak-hour', {
              label: locText('Peak hour today', 'Ώρα αιχμής'), icon: ICONS.peak
            }, { message: locText('No load data', 'Χωρίς φορτίο') });
            logChart('energy:peak-hour', {
              module: 'energy',
              endpoint: '/api/sensors/' + freshest.id + '/timeseries?metric=energy_kwh&timeframe=' + activeTimeframe(),
              points: pts.length,
              bucket: 'snapshot',
              note: 'insufficient points'
            });
            return;
          }
          var loadBucket = bucketDeltasAdaptive(pts);
          var loadSeries = buildEnergyLoadProfileChartData(loadBucket);
          var chartData = loadSeries.chartData;
          var maxVal = 0;
          var peakIdx = -1;
          var realKwh = [];
          chartData.forEach(function (pt, idx) {
            if (pt.future || pt.hasData === false) return;
            realKwh.push(Number(pt.y) || 0);
            if (pt.y > maxVal) {
              maxVal = pt.y;
              peakIdx = idx;
            }
          });
          var avgVal = realKwh.length
            ? (realKwh.reduce(function (a, b) { return a + b; }, 0) / realKwh.length)
            : 0;
          var bands = [
            { from: 0,             to: avgVal * 0.8, color: '#34d399' },
            { from: avgVal * 0.8,  to: avgVal * 1.4, color: '#fbbf24' },
            { from: avgVal * 1.4,  to: maxVal + 1,   color: '#f97316' }
          ];
          var loadSubtitle = loadBucket.bucket === 'hourly'
            ? locText(
              'kWh per hour for today\'s operational day (00:00–23:59 local, meter deltas).',
              'kWh ανά ώρα για τη σημερινή λειτουργική ημέρα (00:00–23:59 τοπική ώρα, deltas μετρητών).'
            )
            : locText('kWh consumed per day (meter deltas, selected timeframe).', 'kWh ανά ημέρα (deltas μετρητών, επιλεγμένο διάστημα).');
          var loadLegend = loadBucket.bucket === 'hourly'
            ? '00:00 → 23:00'
            : (loadBucket.labels[0] + ' → ' + loadBucket.labels[loadBucket.labels.length - 1]);
          var hostLoad = tile().renderChartTile(loadEl, {
            label: locText('Load profile', 'Προφίλ φορτίου'),
            subtitle: loadSubtitle,
            unit: 'kWh',
            legend: loadLegend,
            meta: labelForLocation(freshest.sensor_location, freshest.name) + ' · ' + activeTimeframe() + ' · Δ kWh'
          });
          if (hostLoad) {
            var yMax = loadSeries.maxReal > 0 ? loadSeries.maxReal * 1.12 : 1;
            var yMid = yMax / 2;
            var loadTooltipHour = iaqTrans('energy_load_profile_hour', 'Hour', 'Ώρα');
            var loadTooltipConsumption = iaqTrans('energy_load_profile_consumption', 'Consumption', 'Κατανάλωση');
            var loadNoDataYet = iaqTrans('energy_no_data_yet', 'No data yet', 'Δεν υπάρχουν ακόμη δεδομένα');
            var loadYAxisTitle = iaqTrans('energy_load_profile_kwh_axis', 'kWh', 'kWh');
            tile().renderHeatStripColumn(hostLoad, {
              data: chartData,
              bands: bands,
              height: loadBucket.bucket === 'hourly' ? 148 : 132,
              showAxis: true,
              showYAxis: true,
              categories: loadSeries.categories,
              yAxisMax: yMax,
              yAxisTickPositions: [0, yMid, yMax],
              yAxisTitle: loadYAxisTitle,
              xAxisLabelStep: 1,
              xAxisLabelFormatter: loadBucket.bucket === 'hourly'
                ? function (idx) {
                  var ticks = [0, 6, 12, 18, 23];
                  return ticks.indexOf(idx) >= 0 ? String(idx).padStart(2, '0') : '';
                }
                : function (idx) {
                  var step = loadBucket.binCount > 14
                    ? Math.max(1, Math.floor(loadBucket.binCount / 7))
                    : 1;
                  if (idx % step !== 0 && idx !== (loadBucket.binCount - 1)) return '';
                  return loadSeries.categories[idx] || '';
                },
              tooltipFormatter: function () {
                var pt = this.point || {};
                var label = pt.bucketLabel || pt.category || '';
                if (pt.future) {
                  return (
                    '<div style="min-width:150px;">' +
                    '<div style="margin-bottom:6px;color:#93a7bf;font-size:10px;">' + label + '</div>' +
                    '<div style="color:#dbe7f5;font-size:11px;">' + loadNoDataYet + '</div>' +
                    '</div>'
                  );
                }
                if (pt.hasData === false) {
                  return (
                    '<div style="min-width:150px;">' +
                    '<div style="margin-bottom:6px;color:#93a7bf;font-size:10px;">' +
                    loadTooltipHour + ': ' + label +
                    '</div>' +
                    '<div style="color:#dbe7f5;font-size:11px;">' + loadNoDataYet + '</div>' +
                    '</div>'
                  );
                }
                var kwh = Number.isFinite(Number(this.y)) ? Number(this.y).toFixed(2) : '—';
                return (
                  '<div style="min-width:150px;">' +
                  '<div style="margin-bottom:6px;color:#93a7bf;font-size:10px;">' +
                  loadTooltipHour + ': ' + label +
                  '</div>' +
                  '<div style="color:#f8fbff;font-size:11px;font-weight:600;">' +
                  loadTooltipConsumption + ': ' + kwh + ' kWh' +
                  '</div>' +
                  '</div>'
                );
              }
            });
          }
          var peakLabel = (peakIdx >= 0 && maxVal > 0)
            ? loadBucket.labels[peakIdx]
            : null;
          renderValueOrEmpty(grid, 'peak-hour', {
            label: loadBucket.bucket === 'hourly'
              ? locText('Peak hour (today)', 'Ώρα αιχμής (σήμερα)')
              : locText('Peak day', 'Ημέρα αιχμής'),
            value: peakLabel,
            status: 'warning',
            icon: ICONS.peak,
            meta: maxVal > 0
              ? (maxVal.toFixed(2) + ' kWh · ' + (loadBucket.bucket === 'hourly' ? 'operational day' : activeTimeframe()))
              : null
          });
          var loadTs = pts.map(function (p) { return Date.parse(p.time); }).filter(Number.isFinite);
          var loadStats = seriesStats(realKwh);
          logChart('energy:load-profile', {
            module: 'energy',
            endpoint: '/api/sensors/' + freshest.id + '/timeseries?metric=energy_kwh&timeframe=' + activeTimeframe(),
            points: pts.length,
            minTs: loadTs.length ? Math.min.apply(null, loadTs) : null,
            maxTs: loadTs.length ? Math.max.apply(null, loadTs) : null,
            bucket: loadBucket.bucket + ' × ' + loadBucket.binCount + ' (Δ kWh)',
            bucketCount: loadBucket.binCount,
            seriesLength: loadStats.seriesLength,
            yMin: loadStats.yMin,
            yMax: loadStats.yMax
          });
          logChart('energy:peak-hour', {
            module: 'energy',
            endpoint: '/api/sensors/' + freshest.id + '/timeseries?metric=energy_kwh&timeframe=' + activeTimeframe(),
            points: pts.length,
            bucket: loadBucket.bucket,
            bucketCount: loadBucket.binCount,
            seriesLength: loadStats.seriesLength,
            yMin: loadStats.yMin,
            yMax: loadStats.yMax,
            note: peakLabel ? ('peak ' + peakLabel + ' · ' + maxVal.toFixed(2) + ' kWh') : 'no peak'
          });
        });
      }

      // (energy-share donut is populated inside the Promise.all above
      //  with timeframe-aware MAX-MIN deltas — no duplicate snapshot
      //  donut here.)

      // --- Base-load bullet ---
      var baseLoad = kpis.find(function (k) { return k.key === 'base_load_index'; });
      var baseEl = grid.querySelector('[data-tile="base-load"]');
      if (baseEl && tile()) {
        var baseVal = baseLoad ? toNumber(baseLoad.value) : null;
        if (!isFiniteNum(baseVal)) {
          tile().renderEmptyTile(baseEl, {
            label: baseLoad ? baseLoad.label : locText('Base load', 'Βασικό φορτίο'),
            icon: ICONS.battery,
            message: locText('No base-load data', 'Χωρίς δεδομένα')
          });
        } else {
          tile().renderTile(baseEl, {
            label: baseLoad.label || locText('Base Load Index', 'Δείκτης Φορτίου Βάσης'),
            value: baseVal.toFixed(2),
            unit: baseLoad.unit || 'ratio',
            status: baseLoad.status,
            icon: ICONS.battery,
            subtitle: locText(
              'Baseline share from off-hours / low-movement windows (7d, meter deltas).',
              'Μερίδιο baseline από εκτός ωρών / χαμηλή κίνηση (7ημέρο, deltas μετρητών).'
            ),
            meta: baseLoad.status_meaning || null
          });
          var bulletNode = document.createElement('div');
          baseEl.appendChild(bulletNode);
          tile().renderBullet(bulletNode, {
            value: baseVal,
            max: 1.0,
            target: 0.6,
            status: baseLoad.status,
            bands: [
              { from: 0,    to: 0.4, color: 'rgba(52,211,153,0.30)' },
              { from: 0.4,  to: 0.7, color: 'rgba(251,191,36,0.30)' },
              { from: 0.7,  to: 1.0, color: 'rgba(248,113,113,0.30)' }
            ],
            legend: locText('| target 0.60', '| στόχος 0.60')
          });
        }
        logChart('energy:base-load', {
          module: 'energy',
          endpoint: '/api/kpis/summary?module=energy',
          points: isFiniteNum(baseVal) ? 1 : 0,
          bucket: 'kpi',
          seriesLength: isFiniteNum(baseVal) ? 1 : 0,
          yMin: isFiniteNum(baseVal) ? baseVal : null,
          yMax: isFiniteNum(baseVal) ? baseVal : null,
          note: isFiniteNum(baseVal) ? 'timeframe-scoped KPI' : 'empty-state'
        });
      }

      return Promise.all([areaTask, loadTask]);
    });
  }

  // =======================================================================
  // ENVIRONMENTAL — UV bands bullet + hourly UV strip + 4 tiles
  // =======================================================================
  function bootEnvironmental() {
    var grid = document.querySelector('[data-smaca-telemetry="environmental"]');
    if (!grid) return Promise.resolve({ skipped: 'no-grid', module: 'environmental' });
    return Promise.all([loadSensors(), loadKpiSummary('environmental')]).then(function (results) {
      var rowsAll = (results[0] && Array.isArray(results[0].rows)) ? results[0].rows : [];
      var rows = filterToScope(rowsAll);
      var kpis = (results[1] && Array.isArray(results[1].kpis)) ? results[1].kpis : [];
      var env = rows.filter(function (s) { return s && s.latest && isFiniteNum(toNumber(s.latest.uv_index)); });
      var uvVals = env.map(function (s) { return toNumber(s.latest.uv_index); }).filter(isFiniteNum);
      var uvAvg = avg(uvVals);
      var freshestEnv = freshestSensor(env);
      var latestUvReading = freshestEnv && freshestEnv.latest ? toNumber(freshestEnv.latest.uv_index) : null;
      var displayUv = isFiniteNum(latestUvReading) ? latestUvReading : uvAvg;
      var seriesTasks = Promise.resolve();

      // --- UV bands bullet ---
      var bulletEl = grid.querySelector('[data-tile="uv-bands"]');
      if (bulletEl && tile()) {
        if (!isFiniteNum(displayUv)) {
          tile().renderEmptyTile(bulletEl, {
            label: locText('UV exposure bands', 'Ζώνες έκθεσης UV'),
            message: locText('No outdoor data', 'Χωρίς εξωτ. δεδομένα')
          });
          logChart('environmental:uv-bands', {
            module: 'environmental',
            endpoint: '/api/sensors (latest snapshot)',
            points: 0,
            bucket: 'snapshot',
            note: 'empty-state'
          });
        } else {
          var hostBullet = tile().renderChartTile(bulletEl, {
            label: locText('UV exposure bands', 'Ζώνες έκθεσης UV'),
            subtitle: locText(
              'Which risk band the current UV reading falls into.',
              'Σε ποια ζώνη κινδύνου βρίσκεται η τρέχουσα ένδειξη UV.'
            ),
            unit: 'UVI',
            legend: locText('Low · Mod · High · V.High · Extreme', 'Χαμ. · Μέτρ. · Υψ. · Π.Υψ. · Ακραίο'),
            meta: locText('Latest ' + displayUv.toFixed(1), 'Τελευταία ' + displayUv.toFixed(1)),
            accent: displayUv < 3 ? 'good' : (displayUv < 6 ? 'warning' : (displayUv < 8 ? 'warning' : 'critical'))
          });
          if (hostBullet) {
            tile().renderBullet(hostBullet, {
              value: displayUv, max: 11,
              status: displayUv < 3 ? 'good' : (displayUv < 6 ? 'warning' : (displayUv < 8 ? 'warning' : 'critical')),
              bands: uvBulletBands()
            });
          }
          logChart('environmental:uv-bands', {
            module: 'environmental',
            endpoint: '/api/sensors (latest snapshot)',
            points: uvVals.length,
            bucket: 'snapshot',
            seriesLength: 1,
            yMin: displayUv,
            yMax: displayUv,
            note: 'latest outdoor UV reading vs WHO bands'
          });
        }
      }

      // --- Hourly UV strip + peak window + UV trend ---
      var freshest = freshestEnv;
      var stripEl = grid.querySelector('[data-tile="uv-strip"]');
      if (!freshest || !stripEl) {
        if (stripEl) {
          emptyChart(grid, 'uv-strip', locText('Hourly UV pattern', 'Ωριαίο μοτίβο UV'), noTfDataMsg());
          logChart('environmental:uv-strip', { module: 'environmental', endpoint: '/api/sensors/{id}/timeseries (no UV sensor)', points: 0, note: 'empty-state' });
        }
        renderValueOrEmpty(grid, 'peak-window', { label: locText('Peak exposure window', 'Παράθυρο έκθεσης'), icon: ICONS.peak },
          { message: locText('No outdoor data', 'Χωρίς δεδομένα') });
        logChart('environmental:peak-window', {
          module: 'environmental',
          endpoint: '(derived from uv-strip)',
          points: 0,
          note: 'empty-state'
        });
        renderValueOrEmpty(grid, 'uv-trend', { label: locText('UV trend', 'Τάση UV'), icon: ICONS.trend },
          { message: locText('No outdoor data', 'Χωρίς δεδομένα') });
        logChart('environmental:uv-trend', {
          module: 'environmental',
          endpoint: '(derived from uv-strip)',
          points: 0,
          note: 'empty-state'
        });
      } else if (tile()) {
        seriesTasks = loadTimeseries(freshest.id, 'uv_index').then(function (resp) {
          var pts = (resp && Array.isArray(resp.points)) ? resp.points : [];
          if (pts.length < 3) {
            emptyChart(grid, 'uv-strip', locText('Hourly UV pattern', 'Ωριαίο μοτίβο UV'), noTfDataMsg());
            logChart('environmental:uv-strip', {
              module: 'environmental',
              endpoint: '/api/sensors/' + freshest.id + '/timeseries?metric=uv_index&timeframe=' + activeTimeframe(),
              points: pts.length,
              note: 'insufficient points'
            });
            renderValueOrEmpty(grid, 'peak-window', { label: locText('Peak exposure window', 'Παράθυρο έκθεσης'), icon: ICONS.peak },
              { message: locText('No outdoor data', 'Χωρίς δεδομένα') });
            renderValueOrEmpty(grid, 'uv-trend', { label: locText('UV trend', 'Τάση UV'), icon: ICONS.trend },
              { message: locText('No outdoor data', 'Χωρίς δεδομένα') });
            return;
          }
          var uvBucket = bucketAdaptive(pts, 'avg');
          var uvStripSeries = buildEnergyLoadProfileChartData(uvBucket);
          var bands = uvRiskBands();
          var uvSubtitle = uvBucket.bucket === 'hourly'
            ? locText('Measured UV per hour for today\'s operational day (00:00–23:59 local).', 'Μετρημένο UV ανά ώρα για τη σημερινή λειτουργική ημέρα (00:00–23:59 τοπική ώρα).')
            : locText('Measured UV per day in the selected window.', 'Μετρημένο UV ανά ημέρα στο επιλεγμένο διάστημα.');
          var uvLegend = uvBucket.bucket === 'hourly'
            ? '00:00 → 23:00'
            : (uvBucket.labels[0] + ' → ' + uvBucket.labels[uvBucket.labels.length - 1]);
          var hostStrip = tile().renderChartTile(stripEl, {
            label: locText('UV pattern', 'Μοτίβο UV'),
            subtitle: uvSubtitle,
            unit: 'UVI',
            legend: uvLegend,
            meta: labelForLocation(freshest.sensor_location, freshest.name) + ' · ' + activeTimeframe()
          });
          if (hostStrip) {
            var yMaxUv = uvStripSeries.maxReal > 0 ? Math.max(3, uvStripSeries.maxReal * 1.12) : 3;
            var stripHourLbl = iaqTrans('uv_strip_tooltip_hour', 'Hour', 'Ώρα');
            var stripUvLbl = iaqTrans('uv_strip_tooltip_index', 'UV Index', 'Δείκτης UV');
            var stripNoData = iaqTrans('energy_no_data_yet', 'No data yet', 'Δεν υπάρχουν ακόμη δεδομένα');
            tile().renderHeatStripColumn(hostStrip, {
              data: uvStripSeries.chartData,
              bands: bands,
              height: uvBucket.bucket === 'hourly' ? 148 : 132,
              showAxis: true,
              showYAxis: true,
              categories: uvStripSeries.categories,
              yAxisMax: yMaxUv,
              yAxisTickPositions: [0, yMaxUv / 2, yMaxUv],
              yAxisTitle: 'UVI',
              xAxisLabelStep: 1,
              xAxisLabelFormatter: uvBucket.bucket === 'hourly'
                ? function (idx) {
                  var ticks = [0, 6, 12, 18, 23];
                  return ticks.indexOf(idx) >= 0 ? String(idx).padStart(2, '0') : '';
                }
                : function (idx) {
                  var step = uvBucket.binCount > 14 ? Math.max(1, Math.floor(uvBucket.binCount / 7)) : 1;
                  if (idx % step !== 0 && idx !== (uvBucket.binCount - 1)) return '';
                  return uvStripSeries.categories[idx] || '';
                },
              tooltipFormatter: function () {
                var pt = this.point || {};
                var label = pt.bucketLabel || '';
                if (pt.future || pt.hasData === false) {
                  return (
                    '<div style="min-width:150px;">' +
                    '<div style="margin-bottom:6px;color:#93a7bf;font-size:10px;">' + label + '</div>' +
                    '<div style="color:#dbe7f5;font-size:11px;">' + stripNoData + '</div>' +
                    '</div>'
                  );
                }
                var uvi = Number.isFinite(Number(this.y)) ? Number(this.y).toFixed(1) : '—';
                return (
                  '<div style="min-width:150px;">' +
                  '<div style="margin-bottom:6px;color:#93a7bf;font-size:10px;">' + stripHourLbl + ': ' + label + '</div>' +
                  '<div style="color:#f8fbff;font-size:11px;font-weight:600;">' + stripUvLbl + ': ' + uvi + '</div>' +
                  '</div>'
                );
              }
            });
          }
          var uvTs = pts.map(function (p) { return Date.parse(p.time); }).filter(Number.isFinite);
          var uvStats = seriesStats(uvBucket.values);
          logChart('environmental:uv-strip', {
            module: 'environmental',
            endpoint: '/api/sensors/' + freshest.id + '/timeseries?metric=uv_index&timeframe=' + activeTimeframe(),
            points: pts.length,
            minTs: uvTs.length ? Math.min.apply(null, uvTs) : null,
            maxTs: uvTs.length ? Math.max.apply(null, uvTs) : null,
            bucket: uvBucket.bucket + ' × ' + uvBucket.binCount,
            bucketCount: uvBucket.binCount,
            seriesLength: uvStats.seriesLength,
            yMin: uvStats.yMin,
            yMax: uvStats.yMax
          });

          // Peak window — scan whichever bucket grain we got from
          // bucketAdaptive. For 24h we report a clock-hour window (e.g.
          // "11–14h"); for 7d / 30d we report the date span where UV
          // sustained ≥ 6 (e.g. "Apr 14 → Apr 18").
          var firstHigh = -1, lastHigh = -1;
          var stripCurrentIdx = uvBucket.bucket === 'hourly' ? getOperationalCurrentHourIndex24h() : getCurrentDailyBinIndex(uvBucket.binCount, uvBucket.binSpanMs);
          for (var i = 0; i < uvBucket.values.length; i++) {
            if (i > stripCurrentIdx) continue;
            if (!uvBucket.hasData || !uvBucket.hasData[i]) continue;
            if (uvBucket.values[i] >= 6) {
              if (firstHigh === -1) firstHigh = i;
              lastHigh = i;
            }
          }
          var hasWindow = firstHigh !== -1;
          var windowText = null;
          if (hasWindow) {
            if (uvBucket.bucket === 'hourly') {
              windowText = (firstHigh < 10 ? '0' : '') + firstHigh + '–' + (lastHigh < 10 ? '0' : '') + lastHigh + 'h';
            } else {
              windowText = uvBucket.labels[firstHigh] + (firstHigh === lastHigh ? '' : ' → ' + uvBucket.labels[lastHigh]);
            }
          }
          renderValueOrEmpty(grid, 'peak-window', {
            label: locText('Peak exposure window', 'Παράθυρο μέγ. έκθεσης'),
            value: hasWindow ? windowText : locText('No peak today', 'Χωρίς αιχμή'),
            status: hasWindow ? 'critical' : 'good',
            icon: ICONS.peak,
            meta: hasWindow ? locText('UV ≥ 6 sustained', 'UV ≥ 6 σταθερά') : locText('UV moderate', 'UV μέτριο')
          });

          var uvTrendCount = pts.length;
          // UV trend (last quarter vs previous quarter inside timeframe)
          var tail = pts.slice(-Math.max(2, Math.floor(pts.length / 4)));
          var prev = pts.slice(-Math.max(4, Math.floor(pts.length / 2)), -tail.length);
          var tailAvg = avg(tail.map(function (p) { return toNumber(p.value); }));
          var prevAvg = avg(prev.map(function (p) { return toNumber(p.value); }));
          if (isFiniteNum(tailAvg) && isFiniteNum(prevAvg) && prevAvg !== 0) {
            var diff = tailAvg - prevAvg;
            var dir = Math.abs(diff) < 0.2 ? 'flat' : (diff > 0 ? 'rising' : 'falling');
            var label = dir === 'rising' ? locText('Rising', 'Ανοδική')
              : (dir === 'falling' ? locText('Falling', 'Καθοδική') : locText('Stable', 'Σταθερή'));
            renderValueOrEmpty(grid, 'uv-trend', {
              label: locText('UV trend', 'Τάση UV'),
              value: label,
              status: dir === 'rising' ? 'warning' : (dir === 'falling' ? 'good' : 'muted'),
              icon: ICONS.trend,
              meta: locText('Δ ' + diff.toFixed(1) + ' · ' + activeTimeframe(), 'Δ ' + diff.toFixed(1) + ' · ' + activeTimeframe())
            });
          } else {
            renderValueOrEmpty(grid, 'uv-trend', {
              label: locText('UV trend', 'Τάση UV'),
              icon: ICONS.trend
            }, { message: locText('Insufficient series', 'Ανεπαρκείς ενδείξεις') });
          }
          logChart('environmental:peak-window', {
            module: 'environmental',
            endpoint: 'derived from uv-strip timeseries',
            points: uvTrendCount,
            minTs: uvTs.length ? Math.min.apply(null, uvTs) : null,
            maxTs: uvTs.length ? Math.max.apply(null, uvTs) : null,
            bucket: uvBucket.bucket + ' × ' + uvBucket.binCount,
            bucketCount: uvBucket.binCount,
            seriesLength: uvStats.seriesLength,
            yMin: uvStats.yMin,
            yMax: uvStats.yMax,
            note: hasWindow ? 'high-UV window (UV ≥ 6)' : 'no sustained high-UV window'
          });
          var trendYMin = null;
          var trendYMax = null;
          if (isFiniteNum(tailAvg) && isFiniteNum(prevAvg)) {
            trendYMin = Math.min(tailAvg, prevAvg);
            trendYMax = Math.max(tailAvg, prevAvg);
          }
          logChart('environmental:uv-trend', {
            module: 'environmental',
            endpoint: 'derived from uv-strip timeseries',
            points: uvTrendCount,
            minTs: uvTs.length ? Math.min.apply(null, uvTs) : null,
            maxTs: uvTs.length ? Math.max.apply(null, uvTs) : null,
            bucket: uvBucket.bucket + ' × ' + uvBucket.binCount,
            bucketCount: uvBucket.binCount,
            seriesLength: uvStats.seriesLength,
            yMin: trendYMin,
            yMax: trendYMax,
            note: isFiniteNum(tailAvg) && isFiniteNum(prevAvg) ? 'tail vs previous quarter inside timeframe' : 'insufficient trend window'
          });
        });
      }

      // --- Exposure-risk KPI ---
      var uvKpi = kpis.find(function (k) { return k.key === 'uv_exposure_risk'; });
      var riskEl = grid.querySelector('[data-tile="exposure-risk"]');
      if (riskEl && tile()) {
        if (!uvKpi || !isFiniteNum(toNumber(uvKpi.value))) {
          tile().renderEmptyTile(riskEl, {
            label: uvKpi ? uvKpi.label : locText('UV exposure risk', 'Κίνδυνος έκθεσης UV'),
            icon: ICONS.target,
            message: locText('No KPI data', 'Χωρίς KPI')
          });
          logChart('environmental:exposure-risk', {
            module: 'environmental',
            endpoint: '/api/kpis/summary?module=environmental',
            points: 0,
            bucket: 'kpi',
            note: 'empty-state'
          });
        } else {
          var riskVal = toNumber(uvKpi.value);
          tile().renderTile(riskEl, {
            label: uvKpi.label,
            value: riskVal.toFixed(1),
            unit: uvKpi.unit,
            status: uvKpi.status,
            icon: ICONS.target,
            meta: uvKpi.status_meaning || null
          });
          logChart('environmental:exposure-risk', {
            module: 'environmental',
            endpoint: '/api/kpis/summary?module=environmental',
            points: 1,
            bucket: 'kpi',
            seriesLength: 1,
            yMin: riskVal,
            yMax: riskVal,
            note: 'timeframe-scoped KPI'
          });
        }
      }

      // --- Advisory tile ---
      var advisoryEl = grid.querySelector('[data-tile="advisory"]');
      if (advisoryEl && tile()) {
        if (!isFiniteNum(displayUv)) {
          tile().renderEmptyTile(advisoryEl, {
            label: locText('Advisory', 'Σύσταση'),
            icon: ICONS.alert,
            message: locText('No outdoor data', 'Χωρίς εξωτ. δεδομένα')
          });
          logChart('environmental:advisory', {
            module: 'environmental',
            endpoint: '/api/sensors (latest snapshot)',
            points: 0,
            bucket: 'snapshot',
            note: 'empty-state'
          });
        } else {
          var adv = uvAdvisoryForValue(displayUv);
          tile().renderTile(advisoryEl, {
            label: locText('Advisory', 'Σύσταση'),
            value: adv.label,
            status: adv.status,
            icon: ICONS.alert,
            meta: locText(uvVals.length + ' outdoor sensors', uvVals.length + ' εξωτ. αισθ.')
          });
          logChart('environmental:advisory', {
            module: 'environmental',
            endpoint: '/api/sensors (latest snapshot)',
            points: uvVals.length,
            bucket: 'snapshot',
            seriesLength: 1,
            yMin: displayUv,
            yMax: displayUv,
            note: 'WHO advisory from latest outdoor UV reading'
          });
        }
      }

      return seriesTasks;
    });
  }

  // =======================================================================
  // CONNECTIVITY — status donut + battery dist + device mix + freshness hist
  // =======================================================================
  function bootConnectivity() {
    var grid = document.querySelector('[data-smaca-telemetry="connectivity"]');
    if (!grid) return Promise.resolve({ skipped: 'no-grid', module: 'connectivity' });
    return loadSensors().then(function (sensorsResp) {
      var rowsAll = (sensorsResp && Array.isArray(sensorsResp.rows)) ? sensorsResp.rows : [];
      var rows = filterToScope(rowsAll);
      var total = rows.length;
      var stale = rows.filter(function (s) {
        var min = relativeMinutes(s.last_seen_at || (s.latest && s.latest.measured_at));
        return !isFiniteNum(min) || min > 15;
      }).length;

      // --- Status donut: Online / Warning / Stale / Offline ---
      var counts = { good: 0, warning: 0, stale: 0, offline: 0 };
      rows.forEach(function (s) {
        if (!s) return;
        if (!s.is_active) { counts.offline += 1; return; }
        var min = relativeMinutes(s.last_seen_at || (s.latest && s.latest.measured_at));
        if (!isFiniteNum(min)) { counts.offline += 1; return; }
        if (min < 5) counts.good += 1;
        else if (min < 30) counts.warning += 1;
        else counts.stale += 1;
      });
      var statusEl = grid.querySelector('[data-tile="status-donut"]');
      if (statusEl && tile()) {
        if (!total) {
          tile().renderEmptyTile(statusEl, {
            label: locText('Connection status', 'Κατάσταση σύνδεσης'),
            message: locText('No sensors', 'Χωρίς αισθητήρες')
          });
        } else {
          var hostStatus = tile().renderChartTile(statusEl, {
            label: locText('Connection status', 'Κατάσταση σύνδεσης'),
            subtitle: locText(
              'How recently each sensor reported (online · warning · stale · offline).',
              'Πόσο πρόσφατα ανέφερε κάθε αισθητήρας.'
            ),
            meta: locText(total + ' sensors total', 'Σύνολο: ' + total)
          });
          if (hostStatus) {
            tile().renderDonut(hostStatus, {
              data: [
                { name: locText('Online', 'Σε σύνδεση'),       y: counts.good,    color: '#34d399' },
                { name: locText('Warning', 'Προειδοποίηση'),   y: counts.warning, color: '#fbbf24' },
                { name: locText('Stale', 'Παλιά'),             y: counts.stale,   color: '#f97316' },
                { name: locText('Offline', 'Εκτός σύνδεσης'),  y: counts.offline, color: '#94a3b8' }
              ],
              centerLabel: counts.good + counts.warning,
              centerSubLabel: locText('reporting', 'ενημ.'),
              showLegend: true,
              height: 180
            });
          }
        }
      }

      // --- Battery distribution column chart ---
      var batteryVals = rows.map(function (s) { return toNumber(s.latest && s.latest.battery_pct); }).filter(isFiniteNum);
      var battEl = grid.querySelector('[data-tile="battery-dist"]');
      if (battEl && tile()) {
        if (!batteryVals.length) {
          tile().renderEmptyTile(battEl, {
            label: locText('Battery distribution', 'Κατανομή μπαταρίας'),
            message: locText('No battery telemetry', 'Χωρίς δεδομένα')
          });
        } else {
          var buckets = [0, 0, 0, 0, 0];
          batteryVals.forEach(function (v) {
            var idx = Math.min(4, Math.max(0, Math.floor(v / 20)));
            buckets[idx] += 1;
          });
          var hostBatt = tile().renderChartTile(battEl, {
            label: locText('Battery distribution', 'Κατανομή μπαταρίας'),
            subtitle: locText(
              'How sensors are spread across battery-level brackets.',
              'Πώς κατανέμονται οι αισθητήρες στα επίπεδα μπαταρίας.'
            ),
            unit: '%',
            meta: locText(batteryVals.length + ' sensors with battery telemetry', batteryVals.length + ' αισθ. με δεδομένα μπαταρίας')
          });
          if (hostBatt) {
            var data = buckets.map(function (count, idx) {
              var color;
              if (idx === 0) color = '#f87171';
              else if (idx === 1) color = '#f97316';
              else if (idx === 2) color = '#fbbf24';
              else if (idx === 3) color = '#a3e635';
              else color = '#34d399';
              return { y: count, color: color };
            });
            tile().renderHeatStripColumn(hostBatt, {
              data: data,
              categories: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'],
              showAxis: true,
              height: 130,
              tooltipFormatter: function () {
                return '<b>' + this.x + '</b>: ' + this.y + ' ' + locText('sensors', 'αισθητήρες');
              }
            });
          }
        }
      }

      // --- Device mix donut ---
      var byType = {};
      rows.forEach(function (s) {
        var t = (s.device_type || 'unknown');
        byType[t] = (byType[t] || 0) + 1;
      });
      var typeItems = Object.keys(byType).map(function (k) {
        return { name: k, y: byType[k], color: deviceTypeColor(k) };
      }).sort(function (a, b) { return b.y - a.y; });
      var devEl = grid.querySelector('[data-tile="device-mix"]');
      if (devEl && tile()) {
        if (!typeItems.length) {
          tile().renderEmptyTile(devEl, {
            label: locText('Device mix', 'Σύνθεση συσκευών'),
            message: locText('No sensors', 'Χωρίς αισθητήρες')
          });
        } else {
          var hostDev = tile().renderChartTile(devEl, {
            label: locText('Device mix', 'Σύνθεση συσκευών'),
            subtitle: locText(
              'Composition of the sensor fleet by device type.',
              'Σύνθεση του στόλου αισθητήρων ανά τύπο.'
            ),
            meta: locText('Centre = total devices', 'Κέντρο = σύνολο συσκευών')
          });
          if (hostDev) {
            tile().renderDonut(hostDev, {
              data: typeItems,
              centerLabel: total,
              centerSubLabel: locText('total', 'σύνολο'),
              showLegend: true,
              height: 180
            });
          }
        }
      }

      // --- Freshness histogram (column chart of how many sensors fall in each freshness bucket) ---
      var freshEl = grid.querySelector('[data-tile="freshness-hist"]');
      if (freshEl && tile()) {
        if (!total) {
          tile().renderEmptyTile(freshEl, {
            label: locText('Freshness distribution', 'Κατανομή ενημερότητας'),
            message: locText('No sensors', 'Χωρίς αισθητήρες')
          });
        } else {
          var freshBuckets = [0, 0, 0, 0, 0];
          rows.forEach(function (s) {
            var min = relativeMinutes(s.last_seen_at || (s.latest && s.latest.measured_at));
            if (!isFiniteNum(min)) { freshBuckets[4] += 1; return; }
            if (min < 5)       freshBuckets[0] += 1;
            else if (min < 15) freshBuckets[1] += 1;
            else if (min < 60) freshBuckets[2] += 1;
            else if (min < 1440) freshBuckets[3] += 1;
            else freshBuckets[4] += 1;
          });
          var hostFresh = tile().renderChartTile(freshEl, {
            label: locText('Freshness distribution', 'Κατανομή ενημερότητας'),
            subtitle: locText(
              'How recently each sensor reported, grouped into time buckets.',
              'Πόσο πρόσφατα ανέφερε κάθε αισθητήρας, ομαδοποιημένα.'
            ),
            unit: locText('sensors', 'αισθ.'),
            meta: locText('< 5 m / 15 m / 1 h / 1 d / older', '< 5λ / 15λ / 1ω / 1μ / παλαιότερα')
          });
          if (hostFresh) {
            tile().renderHeatStripColumn(hostFresh, {
              data: freshBuckets.map(function (count, idx) {
                var color;
                if (idx === 0) color = '#34d399';
                else if (idx === 1) color = '#a3e635';
                else if (idx === 2) color = '#fbbf24';
                else if (idx === 3) color = '#f97316';
                else color = '#f87171';
                return { y: count, color: color };
              }),
              categories: ['<5m', '<15m', '<1h', '<1d', 'older'],
              showAxis: true,
              height: 130,
              tooltipFormatter: function () {
                return '<b>' + this.x + '</b>: ' + this.y + ' ' + locText('sensors', 'αισθητήρες');
              }
            });
          }
        }
      }

      // --- Stale tile ---
      renderValueOrEmpty(grid, 'stale', {
        label: locText('Stale (>15 min)', 'Παλιά (>15 λ.)'),
        value: total ? stale : null,
        status: !total ? 'muted' : (stale === 0 ? 'good' : (stale < total * 0.2 ? 'warning' : 'critical')),
        icon: ICONS.clock,
        meta: total ? locText('of ' + total + ' sensors', 'από ' + total) : null
      });

      // --- Lowest battery ---
      var lowestSensor = rows
        .filter(function (s) { return s.latest && isFiniteNum(toNumber(s.latest.battery_pct)); })
        .sort(function (a, b) { return toNumber(a.latest.battery_pct) - toNumber(b.latest.battery_pct); })[0];
      if (lowestSensor) {
        var batt = toNumber(lowestSensor.latest.battery_pct);
        renderValueOrEmpty(grid, 'lowest-battery', {
          label: locText('Weakest battery', 'Ασθενέστερη μπαταρία'),
          value: Math.round(batt),
          unit: '%',
          status: batt >= 50 ? 'good' : (batt >= 20 ? 'warning' : 'critical'),
          icon: ICONS.battery,
          meta: labelForLocation(lowestSensor.sensor_location, lowestSensor.name || lowestSensor.sensor_uid)
        });
      } else {
        renderValueOrEmpty(grid, 'lowest-battery', {
          label: locText('Weakest battery', 'Ασθενέστερη μπαταρία'),
          icon: ICONS.battery
        }, { message: locText('No battery telemetry', 'Χωρίς δεδομένα') });
      }

      // --- Oldest signal ---
      var oldest = rows
        .filter(function (s) { return s.last_seen_at; })
        .sort(function (a, b) { return Date.parse(a.last_seen_at) - Date.parse(b.last_seen_at); })[0];
      if (oldest) {
        var oldMin = relativeMinutes(oldest.last_seen_at);
        renderValueOrEmpty(grid, 'oldest-seen', {
          label: locText('Oldest signal', 'Παλαιότερο σήμα'),
          value: isFiniteNum(oldMin) ? oldMin : null,
          unit: locText('min ago', 'λ. πριν'),
          status: !isFiniteNum(oldMin) ? 'muted'
            : (oldMin < 5 ? 'good' : (oldMin < 30 ? 'warning' : 'critical')),
          icon: ICONS.clock,
          meta: labelForLocation(oldest.sensor_location, oldest.name || oldest.sensor_uid)
        });
      } else {
        renderValueOrEmpty(grid, 'oldest-seen', {
          label: locText('Oldest signal', 'Παλαιότερο σήμα'),
          icon: ICONS.clock
        }, { message: locText('No timestamps', 'Χωρίς timestamp') });
      }

      // --- Uptime % tile ---
      var pct = total ? ((total - counts.offline) / total) * 100 : null;
      renderValueOrEmpty(grid, 'uptime-pct', {
        label: locText('Active uptime', 'Ενεργή λειτουργία'),
        value: isFiniteNum(pct) ? pct.toFixed(0) : null,
        unit: '%',
        status: !isFiniteNum(pct) ? 'muted' : (pct >= 95 ? 'good' : (pct >= 80 ? 'warning' : 'critical')),
        icon: ICONS.target,
        meta: locText('Active sensors / total', 'Ενεργοί / Σύνολο')
      });

      logChart('connectivity:status-donut', {
        module: 'connectivity',
        endpoint: '/api/sensors',
        points: total,
        bucket: 'snapshot',
        seriesLength: 4,
        note: 'snapshot status counts'
      });
      logChart('connectivity:battery-dist', {
        module: 'connectivity',
        endpoint: '/api/sensors',
        points: batteryVals.length,
        bucket: 'snapshot',
        seriesLength: 5,
        note: 'snapshot battery brackets'
      });
      logChart('connectivity:device-mix', {
        module: 'connectivity',
        endpoint: '/api/sensors',
        points: total,
        bucket: 'snapshot',
        seriesLength: typeItems.length,
        note: typeItems.length ? 'device type mix' : 'empty-state'
      });
      logChart('connectivity:freshness-hist', {
        module: 'connectivity',
        endpoint: '/api/sensors',
        points: total,
        bucket: 'snapshot',
        seriesLength: 5,
        note: total ? 'freshness brackets' : 'empty-state'
      });
      logChart('connectivity:stale', {
        module: 'connectivity',
        endpoint: '/api/sensors',
        points: total,
        bucket: 'snapshot',
        note: total ? (stale + ' stale of ' + total) : 'no sensors'
      });
      logChart('connectivity:lowest-battery', {
        module: 'connectivity',
        endpoint: '/api/sensors',
        points: lowestSensor ? 1 : 0,
        bucket: 'snapshot',
        seriesLength: lowestSensor ? 1 : 0,
        yMin: lowestSensor ? toNumber(lowestSensor.latest.battery_pct) : null,
        yMax: lowestSensor ? toNumber(lowestSensor.latest.battery_pct) : null,
        note: lowestSensor ? labelForLocation(lowestSensor.sensor_location, lowestSensor.name || lowestSensor.sensor_uid) : 'no battery telemetry'
      });
      logChart('connectivity:oldest-seen', {
        module: 'connectivity',
        endpoint: '/api/sensors',
        points: oldest ? 1 : 0,
        bucket: 'snapshot',
        note: oldest ? labelForLocation(oldest.sensor_location, oldest.name || oldest.sensor_uid) : 'no timestamps'
      });
      logChart('connectivity:uptime-pct', {
        module: 'connectivity',
        endpoint: '/api/sensors',
        points: total,
        bucket: 'snapshot',
        seriesLength: isFiniteNum(pct) ? 1 : 0,
        yMin: isFiniteNum(pct) ? pct : null,
        yMax: isFiniteNum(pct) ? pct : null,
        note: isFiniteNum(pct) ? 'active sensors / total' : 'no sensors'
      });
    });
  }

  function deviceTypeColor(type) {
    switch (String(type || '').toLowerCase()) {
      case 'iaq':           return '#22d3ee';
      case 'occupancy':     return '#a78bfa';
      case 'energy':        return '#fbbf24';
      case 'environmental': return '#f97316';
      case 'gateway':       return '#94a3b8';
      default:              return '#60a5fa';
    }
  }

  // -----------------------------------------------------------------------
  // Routing
  // -----------------------------------------------------------------------
  function scheduler() {
    return global.SMACATelemetryScheduler || null;
  }

  function staggerPaint(tasks, gapMs) {
    var steps = Array.isArray(tasks) ? tasks : [];
    var sched = scheduler();
    if (sched && typeof sched.stagger === 'function') {
      return sched.stagger(steps, gapMs || 52);
    }
    steps.forEach(function (step) {
      try { step(); } catch (e) { /* noop */ }
    });
    return Promise.resolve();
  }

  function setChartRefreshMode(on) {
    if (tile() && typeof tile().setChartRefreshMode === 'function') {
      tile().setChartRefreshMode(on);
    } else if (scheduler() && typeof scheduler().setChartRefreshMode === 'function') {
      scheduler().setChartRefreshMode(on);
    } else {
      global.SMACA_CHART_REFRESH = !!on;
    }
  }

  function refreshActiveImmediate() {
    if (REFRESH_IN_FLIGHT) return REFRESH_IN_FLIGHT;
    setChartRefreshMode(true);
    var section = activeSection();
    var seq = ++DEBUG_REFRESH_SEQ;
    if (debugTfEnabled()) {
      resetDebugBuffer(seq);
      try {
        console.log('[SMACA_TF] refresh start', {
          seq: seq,
          section: section || null,
          timeframe: activeTimeframe(),
          location: activeLocation()
        });
        if (!api()) console.warn('[SMACA_TF] SMACAApi is missing — telemetry tiles will not load.');
        if (!tile()) console.warn('[SMACA_TF] SMACATelemetry is missing — chart tiles will not render.');
      } catch (e) { /* noop */ }
    }
    if (!section) {
      if (debugTfEnabled()) {
        try {
          console.warn('[SMACA_TF] refresh skipped — open a dashboard module page (overview, iaq, occupancy, energy, environmental, connectivity).');
        } catch (e2) { /* noop */ }
      }
      return Promise.resolve({ skipped: 'no-section' });
    }

    var bootPromise;
    if (section === 'overview')           bootPromise = bootOverview();
    else if (section === 'iaq')           bootPromise = bootIaq();
    else if (section === 'occupancy')     bootPromise = bootOccupancy();
    else if (section === 'energy')        bootPromise = bootEnergy();
    else if (section === 'environmental') bootPromise = bootEnvironmental();
    else if (section === 'connectivity')  bootPromise = bootConnectivity();
    else {
      if (debugTfEnabled()) {
        try { console.warn('[SMACA_TF] refresh skipped — unknown section', section); } catch (e3) { /* noop */ }
      }
      return Promise.resolve({ skipped: section });
    }

    REFRESH_IN_FLIGHT = scheduleDebugFlush(seq, section, bootPromise).finally(function () {
      REFRESH_IN_FLIGHT = null;
      setChartRefreshMode(false);
    });
    return REFRESH_IN_FLIGHT;
  }

  function refreshActive() {
    refreshActiveDebounceTick += 1;
    var tick = refreshActiveDebounceTick;
    return new Promise(function (resolve) {
      if (refreshActiveDebounceTimer) clearTimeout(refreshActiveDebounceTimer);
      refreshActiveDebounceTimer = setTimeout(function () {
        refreshActiveDebounceTimer = null;
        if (tick !== refreshActiveDebounceTick) {
          resolve({ skipped: 'superseded' });
          return;
        }
        refreshActiveImmediate().then(resolve, function () {
          resolve({ skipped: 'error' });
        });
      }, REFRESH_ACTIVE_DEBOUNCE_MS);
    });
  }

  function bootCharts() {
    if (!api() || !tile()) return;
    if (debugTfEnabled()) {
      try { console.log('[SMACA_TF] debug logger active — every chart will report timeframe/scope/endpoint metadata.'); } catch (e) {}
    }
    var auditAllPending = false;
    try { auditAllPending = !!(global.sessionStorage && global.sessionStorage.getItem(AUDIT_ALL_STORAGE_KEY)); } catch (e0) { auditAllPending = false; }
    if (auditAllPending) {
      continueAllPillarsAudit();
    } else {
      refreshActive();
    }
    /* Spatial dispatches both scope events; listen once to avoid duplicate chart rebuilds. */
    document.addEventListener('smaca:scope-changed', refreshActive);
    document.addEventListener('smaca:timeframe-changed', refreshActive);
  }

  function boot() {
    var loader = global.SMACAHighchartsLoader;
    if (loader && typeof loader.load === 'function') {
      loader.load().then(bootCharts, bootCharts);
      return;
    }
    bootCharts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Helpers retained for future tile additions but not always used.
  void [chartHost];

  global.SMACATelemetryBootstrap = {
    refresh: refreshActive,
    bootOverview: bootOverview,
    bootIaq: bootIaq,
    bootOccupancy: bootOccupancy,
    bootEnergy: bootEnergy,
    bootEnvironmental: bootEnvironmental,
    bootConnectivity: bootConnectivity,
    // Debug helpers — surface logChart so external callers / DevTools
    // snippets can use the same shape.
    debug: {
      enable:  function () {
        global.SMACA_DEBUG_TIMEFRAME = true;
        try {
          console.log('[SMACA_TF] enabled.');
          console.log('[SMACA_TF] Each chart logs: chartId, module, timeframe, location, endpoint, points, minTs, maxTs, bucket, bucketCount, seriesLength, yMin, yMax, note.');
          console.log('[SMACA_TF] Re-rendering the active dashboard page now; per-chart rows arrive as async tiles finish, then a summary table prints.');
        } catch (e) { /* noop */ }
        return refreshActive();
      },
      disable: function () {
        global.SMACA_DEBUG_TIMEFRAME = false;
        DEBUG_LOG_BUFFER = [];
        try { console.log('[SMACA_TF] disabled.'); } catch (e) { /* noop */ }
        return Promise.resolve({ disabled: true });
      },
      dump: function () {
        if (!debugTfEnabled()) {
          try { console.warn('[SMACA_TF] debug is off — call SMACATelemetryBootstrap.debug.enable() first.'); } catch (e) { /* noop */ }
          return [];
        }
        flushDebugBuffer(DEBUG_REFRESH_SEQ, activeSection());
        return DEBUG_LOG_BUFFER.slice();
      },
      log:     logChart,
      stats:   seriesStats,
      isEnabled: debugTfEnabled,
      activeTimeframe: activeTimeframe,
      activeLocation:  activeLocation,
      bucketSizeFor:   bucketSizeFor,
      buffer: function () { return DEBUG_LOG_BUFFER.slice(); },
      lastRefresh: function () { return DEBUG_LAST_REFRESH; },
      auditTimeframes: auditTimeframes,
      auditAllPillars: auditAllPillars,
      cancelAllPillarsAudit: cancelAllPillarsAudit,
      pillars: function () { return PILLAR_SECTIONS.slice(); }
    }
  };
})(typeof window !== 'undefined' ? window : this);
