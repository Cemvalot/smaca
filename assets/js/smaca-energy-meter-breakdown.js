/**
 * Energy meter breakdown by floor/location — mirrors IAQ sensor breakdown UX.
 * Data: GET /api/sensors + lazy GET /api/sensors/{id}/timeseries?metric=energy_kwh
 */
(function (global) {
  'use strict';

  var ENERGY_STALE_MS = 2 * 60 * 60 * 1000;
  var MAX_DELTA_CAP = 500000;
  var MIN_READINGS = 2;
  var REFRESH_DEBOUNCE_MS = 220;

  var ICON_ENERGY = '<path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />';

  function t(key, fallback) {
    var map = global.SMACA_TRANSLATIONS || {};
    return map[key] || fallback;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toNum(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function activeLocation() {
    try {
      var v = (global.SMACA_LOCATION || '').toString().trim();
      return v || null;
    } catch (e) {
      return null;
    }
  }

  function activeTimeframe() {
    var allowed = ['24h', '7d', '30d'];
    try {
      var fromState = (global.SMACAState && global.SMACAState.currentTimeframe) || '';
      if (allowed.indexOf(String(fromState)) !== -1) return fromState;
      var fromGlobal = global.SMACA_TIMEFRAME || '';
      if (allowed.indexOf(String(fromGlobal)) !== -1) return fromGlobal;
    } catch (e) {}
    return '24h';
  }

  function sensorMatchesScope(sensor) {
    var scope = activeLocation();
    if (!scope) return true;
    if (!sensor || !sensor.sensor_location) return false;
    return String(sensor.sensor_location).toUpperCase() === String(scope).toUpperCase();
  }

  function normalizeLatest(latest) {
    var fn = global.SMACA_TELEMETRY_METRIC_NORMALIZE && global.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest;
    if (typeof fn === 'function') return fn(latest || {});
    return latest || {};
  }

  function isEnergySensor(s) {
    if (!s) return false;
    if (s.device_type === 'energy') return true;
    var lat = normalizeLatest(s.latest || {});
    return toNum(lat.energy_kwh) !== null;
  }

  function floorSortWeight(code) {
    var key = String(code || '').toUpperCase();
    if (key === '—' || key === '-') return 99;
    if (key === 'AUD') return -2;
    if (key === 'B2') return -1;
    if (key === 'B1') return 0;
    if (key === 'F0') return 1;
    if (key === 'F1') return 2;
    if (key === 'F2') return 3;
    if (key === 'F3') return 4;
    if (key === 'F4') return 5;
    if (key === 'F5') return 6;
    return 50;
  }

  function floorIconSvg(code) {
    var key = String(code || '').toUpperCase();
    if (key === 'AUD') {
      return '<path d="M4 19v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M6 10V8a2 2 0 0 1 2-2h1M18 10V8a2 2 0 0 0-2-2h-1" />';
    }
    if (/^B\d+$/.test(key)) {
      return '<path d="M7 4h10M7 9h10M7 14h6M10 20l4-4 4 4" />';
    }
    if (key === 'F0') {
      return '<path d="M3 10 12 3l9 7M5 9v11h14V9M9 20v-6h6v6" />';
    }
    return '<path d="M7 4h10M7 9h10M7 14h6M10 16l4 4 4-4" />';
  }

  function floorCodeDisplay(code) {
    var key = String(code || '').toUpperCase();
    if (!key || key === '—') return '—';
    return key;
  }

  function floorTitle(code, apiLabel) {
    if (apiLabel && String(apiLabel).trim()) return String(apiLabel).trim();
    var c = String(code || '').trim();
    if (!c || c === '—') return t('energy_meter_breakdown_unknown_location', 'Unassigned location');
    if (global.SMACASpatial && typeof global.SMACASpatial.labelFor === 'function') {
      var resolved = global.SMACASpatial.labelFor(c);
      if (resolved) return resolved;
    }
    return c;
  }

  function formatTimestamp(iso) {
    if (!iso) return t('not_available_label', '—');
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      var loc = global.SMACA_LOCALE || 'en';
      return d.toLocaleString(loc, { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return String(iso);
    }
  }

  function fmtKwh(n, decimals) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
    return Number(n).toFixed(decimals === undefined ? 1 : decimals);
  }

  function measuredAgeMs(latest) {
    if (!latest || !latest.measured_at) return null;
    var ms = Date.parse(latest.measured_at);
    if (!Number.isFinite(ms)) return null;
    return Date.now() - ms;
  }

  function isStaleLatest(latest) {
    var age = measuredAgeMs(latest);
    return age !== null && age > ENERGY_STALE_MS;
  }

  function parsePointValue(p) {
    if (!p) return null;
    if (p.value !== undefined && p.value !== null) return toNum(p.value);
    return toNum(p.energy_kwh);
  }

  function operationalHourLabels() {
    var labels = [];
    for (var h = 0; h < 24; h++) {
      labels.push((h < 10 ? '0' : '') + h + ':00');
    }
    return labels;
  }

  function operationalDayStartMs(atMs) {
    var ref = Number.isFinite(atMs) ? new Date(atMs) : new Date();
    return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0).getTime();
  }

  function operationalHourIndex(tsMs) {
    var dayStart = operationalDayStartMs(tsMs);
    var idx = Math.floor((tsMs - dayStart) / 3600000);
    return Math.max(0, Math.min(23, idx));
  }

  function peakBucketFromPoints(points, timeframe) {
    var tf = timeframe || activeTimeframe();
    if (!Array.isArray(points) || points.length < 2) return { label: null, kwh: null };

    if (tf === '24h') {
      var bins = [];
      for (var h = 0; h < 24; h++) bins.push({ min: null, max: null });
      points.forEach(function (p) {
        var t = Date.parse(p.time || 0);
        var v = parsePointValue(p);
        if (!Number.isFinite(t) || v === null) return;
        var hour = operationalHourIndex(t);
        var b = bins[hour];
        if (b.min === null || v < b.min) b.min = v;
        if (b.max === null || v > b.max) b.max = v;
      });
      var labels = operationalHourLabels();
      var maxKwh = -1;
      var peakLabel = null;
      bins.forEach(function (b, idx) {
        if (b.min === null || b.max === null) return;
        var d = Math.max(0, b.max - b.min);
        if (d > maxKwh) {
          maxKwh = d;
          peakLabel = labels[idx];
        }
      });
      return { label: peakLabel, kwh: maxKwh >= 0 ? maxKwh : null };
    }

    var days = tf === '7d' ? 7 : 30;
    var dayMs = 86400000;
    var endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    var startOfFirstBin = endOfToday.getTime() + 1 - days * dayMs;
    var perBin = [];
    for (var k = 0; k < days; k++) perBin.push({ min: null, max: null, label: '' });
    points.forEach(function (p) {
      var t = Date.parse(p.time || 0);
      var v = parsePointValue(p);
      if (!Number.isFinite(t) || v === null) return;
      var idx = Math.floor((t - startOfFirstBin) / dayMs);
      if (idx < 0 || idx >= days) return;
      var b = perBin[idx];
      if (b.min === null || v < b.min) b.min = v;
      if (b.max === null || v > b.max) b.max = v;
    });
    var maxDayKwh = -1;
    var peakDayLabel = null;
    perBin.forEach(function (b, idx) {
      if (b.min === null || b.max === null) return;
      var d = Math.max(0, b.max - b.min);
      var d0 = new Date(startOfFirstBin + idx * dayMs);
      var lbl = d0.toLocaleDateString(global.SMACA_LOCALE || 'en', { month: 'short', day: '2-digit' });
      if (d > maxDayKwh) {
        maxDayKwh = d;
        peakDayLabel = lbl;
      }
    });
    return { label: peakDayLabel, kwh: maxDayKwh >= 0 ? maxDayKwh : null };
  }

  function computeMeterStats(points) {
    var rows = [];
    if (Array.isArray(points)) {
      points.forEach(function (p) {
        var t = Date.parse(p.time || 0);
        var v = parsePointValue(p);
        if (!Number.isFinite(t) || v === null) return;
        rows.push({ t: t, v: v });
      });
    }
    rows.sort(function (a, b) { return a.t - b.t; });
    var count = rows.length;
    if (count < MIN_READINGS) {
      return {
        insufficient: true,
        readingsCount: count,
        consumedKwh: null,
        minKwh: null,
        maxKwh: null,
        firstKwh: rows.length ? rows[0].v : null,
        lastKwh: rows.length ? rows[rows.length - 1].v : null,
        firstAt: rows.length ? rows[0].t : null,
        lastAt: rows.length ? rows[rows.length - 1].t : null,
        negativeReset: false,
        spikeCapped: false,
        peak: { label: null, kwh: null }
      };
    }
    var vals = rows.map(function (r) { return r.v; });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var rawDelta = max - min;
    var negativeReset = rawDelta < 0;
    var consumed = negativeReset ? 0 : Math.min(MAX_DELTA_CAP, Math.max(0, rawDelta));
    var spikeCapped = !negativeReset && rawDelta > MAX_DELTA_CAP;
    return {
      insufficient: false,
      readingsCount: count,
      consumedKwh: consumed,
      minKwh: min,
      maxKwh: max,
      firstKwh: rows[0].v,
      lastKwh: rows[rows.length - 1].v,
      firstAt: rows[0].t,
      lastAt: rows[rows.length - 1].t,
      negativeReset: negativeReset,
      spikeCapped: spikeCapped,
      peak: peakBucketFromPoints(points, activeTimeframe())
    };
  }

  function meterBadges(latest, stats, loading) {
    var badges = [];
    if (loading) {
      badges.push({ kind: 'loading', text: t('loading_data', 'Loading data...'), sev: 0 });
      return badges;
    }
    if (isStaleLatest(latest)) {
      badges.push({ kind: 'stale', text: t('energy_meter_breakdown_stale_meter', 'Stale meter'), sev: 2 });
    }
    if (!stats || stats.insufficient) {
      badges.push({ kind: 'insufficient', text: t('energy_meter_breakdown_insufficient_readings', 'Insufficient readings'), sev: 3 });
    } else {
      if (stats.negativeReset) {
        badges.push({ kind: 'reset', text: t('energy_meter_breakdown_possible_reset', 'Possible meter reset'), sev: 4 });
      }
      if (stats.spikeCapped) {
        badges.push({ kind: 'capped', text: t('energy_meter_breakdown_spike_capped', 'Spike capped'), sev: 3 });
      }
      if (!badges.length) {
        badges.push({ kind: 'ok', text: t('energy_meter_breakdown_ok', 'OK'), sev: 0 });
      }
    }
    return badges;
  }

  function worstBadge(badges) {
    var worst = null;
    badges.forEach(function (b) {
      if (!worst || b.sev > worst.sev) worst = b;
    });
    return worst;
  }

  function statusChipHtml(badges) {
    var w = worstBadge(badges);
    if (!w) return '';
    if (w.kind === 'ok') {
      return '<span class="energy-meter-card__status-chip energy-meter-card__status-chip--ok">' + escapeHtml(t('energy_meter_breakdown_ok', 'OK')) + '</span>';
    }
    if (w.kind === 'stale' || w.kind === 'insufficient') {
      return '<span class="energy-meter-card__status-chip energy-meter-card__status-chip--warning">' + escapeHtml(w.text) + '</span>';
    }
    return '<span class="energy-meter-card__status-chip energy-meter-card__status-chip--critical">' + escapeHtml(w.text) + '</span>';
  }

  function peakMetricTitle() {
    return activeTimeframe() === '24h'
      ? t('energy_meter_breakdown_peak_hour', 'Peak hour')
      : t('energy_meter_breakdown_peak_day', 'Peak day');
  }

  function peakMetricValue(peakLabel, peakKwh, loading) {
    if (loading) return '…';
    if (!peakLabel) return '—';
    if (peakKwh === null || peakKwh === undefined) return escapeHtml(peakLabel);
    return escapeHtml(peakLabel + ' · ' + fmtKwh(peakKwh, 1) + ' kWh');
  }

  function metricSpan(label, valueHtml) {
    return (
      '<span><small>' + escapeHtml(label) + '</small><strong>' + valueHtml + '</strong></span>'
    );
  }

  function detailRow(label, value) {
    return (
      '<div class="energy-meter-card__detail-row"><span>' + escapeHtml(label) + '</span><strong>' +
      escapeHtml(String(value)) + '</strong></div>'
    );
  }

  function readableMeterName(sensor) {
    var name = (sensor && (sensor.sensor_name || sensor.name) || '').trim();
    var uid = (sensor && sensor.sensor_uid || '').trim();
    if (name && name !== uid) return name;
    return t('energy_meter_default_name', 'Energy Meter');
  }

  function validationStatusText(badges) {
    var w = worstBadge(badges);
    return w ? w.text : t('energy_meter_breakdown_ok', 'OK');
  }

  function floorWorstBadges(sensors, statsById) {
    var all = [];
    sensors.forEach(function (s) {
      var latest = normalizeLatest(s.latest || {});
      var st = statsById[String(s.id)];
      meterBadges(latest, st, false).forEach(function (b) {
        all.push(b);
      });
    });
    return all;
  }

  function floorStatusHtml(sensors, statsById) {
    var badges = floorWorstBadges(sensors, statsById);
    if (!badges.length) {
      badges = [{ kind: 'ok', text: t('energy_meter_breakdown_ok', 'OK'), sev: 0 }];
    }
    return statusChipHtml(badges);
  }

  function buildFloorMetricsHtml(agg, loading) {
    var consumedVal = loading
      ? '…'
      : (agg.totalConsumed === null ? '—' : escapeHtml(fmtKwh(agg.totalConsumed, 1) + ' kWh'));
    var latestVal = agg.latestSum === null
      ? '—'
      : escapeHtml(fmtKwh(agg.latestSum, 1) + ' kWh');
    var freshVal = loading
      ? '…'
      : (agg.freshestAt
        ? escapeHtml(formatTimestamp(new Date(agg.freshestAt).toISOString()))
        : '—');
    return (
      metricSpan(t('energy_meter_breakdown_consumption_timeframe', 'Consumption in timeframe'), consumedVal) +
      metricSpan(t('energy_meter_breakdown_latest_cumulative', 'Latest cumulative reading'), latestVal) +
      metricSpan(peakMetricTitle(), peakMetricValue(agg.peakLabel, agg.peakKwh, loading)) +
      metricSpan(t('energy_meter_breakdown_freshness', 'Data freshness'), freshVal)
    );
  }

  function cacheScopeKey() {
    return (activeLocation() || '__all__') + '\u0001' + activeTimeframe();
  }

  function buildSkeleton() {
    return (
      '<div class="iaq-breakdown-skeleton" aria-hidden="true">' +
      '<div class="iaq-skeleton-row iaq-skeleton-row--wide"></div>' +
      '<div class="iaq-skeleton-row iaq-skeleton-row--mid"></div>' +
      '<div class="iaq-skeleton-row iaq-skeleton-row--wide"></div>' +
      '</div>'
    );
  }

  function buildMeterCardSummary(sensor, stats, loading) {
    var latest = normalizeLatest(sensor.latest || {});
    var locCode = sensor.sensor_location || '—';
    var locLabel = floorTitle(locCode, sensor.sensor_location_label);
    var meterName = readableMeterName(sensor);
    var latestKwh = toNum(latest.energy_kwh);
    var consumedHtml = (stats && !stats.insufficient && stats.consumedKwh !== null)
      ? escapeHtml(fmtKwh(stats.consumedKwh, 1) + ' kWh')
      : (loading ? '…' : '—');
    var latestHtml = latestKwh === null ? '—' : escapeHtml(fmtKwh(latestKwh, 1) + ' kWh');
    var badges = meterBadges(latest, stats, loading);
    var peakLabel = stats && stats.peak ? stats.peak.label : null;
    var peakKwh = stats && stats.peak ? stats.peak.kwh : null;
    var peakHtml = peakMetricValue(peakLabel, peakKwh, loading);
    var secondary = locLabel
      ? '<span class="energy-meter-card__secondary">' + escapeHtml(locCode !== '—' ? locCode : locLabel) + '</span>'
      : '';

    return (
      '<article class="energy-meter-card" data-sensor-id="' + escapeHtml(String(sensor.id)) + '">' +
      '<button type="button" class="energy-meter-card__trigger" aria-expanded="false">' +
      '<span class="energy-meter-card__main">' +
      '<span class="energy-meter-card__identity">' +
      '<span class="energy-meter-card__name">' + escapeHtml(meterName) + '</span>' +
      secondary +
      '</span>' +
      '<span class="energy-meter-card__metrics">' +
      metricSpan(t('energy_meter_breakdown_consumption_timeframe', 'Consumption in timeframe'), consumedHtml) +
      metricSpan(t('energy_meter_breakdown_latest_cumulative', 'Latest cumulative reading'), latestHtml) +
      metricSpan(peakMetricTitle(), peakHtml) +
      '</span>' +
      '<span class="energy-meter-card__side">' + statusChipHtml(badges) +
      '<span class="energy-meter-card__chevron" aria-hidden="true">›</span></span>' +
      '</span>' +
      '</button>' +
      '<div class="energy-meter-card__details" hidden>' +
      '<div class="energy-meter-card__details-inner" data-energy-detail-ready="0"></div>' +
      '</div></article>'
    );
  }

  function buildDetailPanel(sensor, stats, latest) {
    var locCode = sensor.sensor_location || '—';
    var locLabel = floorTitle(locCode, sensor.sensor_location_label);
    var consumedTxt = (stats && !stats.insufficient && stats.consumedKwh !== null)
      ? fmtKwh(stats.consumedKwh, 2) + ' kWh'
      : '—';
    var badges = meterBadges(latest, stats, false);
    var peakTime = (stats && stats.peak && stats.peak.label) ? stats.peak.label : '—';
    var peakVal = (stats && stats.peak && stats.peak.kwh !== null)
      ? fmtKwh(stats.peak.kwh, 2) + ' kWh'
      : '—';
    var peakBucket = peakTime === '—' ? '—' : peakTime + (peakVal !== '—' ? ' · ' + peakVal : '');
    var methodologyNote = '<p class="energy-meter-card__detail-hint">' +
      escapeHtml(t('energy_meter_breakdown_methodology_hint', 'Meter reading range in timeframe')) + '</p>';

    var rows = [
      detailRow(t('energy_meter_breakdown_location', 'Location'), locLabel),
      detailRow(t('energy_meter_breakdown_latest_cumulative', 'Latest cumulative reading'),
        latest.energy_kwh != null ? fmtKwh(latest.energy_kwh, 2) + ' kWh' : '—'),
      detailRow(t('energy_meter_breakdown_calculated_consumption', 'Calculated consumption'), consumedTxt),
      detailRow(t('energy_meter_breakdown_first_reading', 'First reading'),
        stats && stats.firstKwh !== null ? fmtKwh(stats.firstKwh, 2) + ' kWh' : '—'),
      detailRow(t('energy_meter_breakdown_last_reading', 'Last reading'),
        stats && stats.lastKwh !== null ? fmtKwh(stats.lastKwh, 2) + ' kWh' : '—'),
      detailRow(t('energy_meter_breakdown_readings_count', 'Readings count'), stats ? String(stats.readingsCount) : '—'),
      detailRow(t('energy_meter_breakdown_peak_bucket', 'Peak bucket'), peakBucket),
      detailRow(t('energy_meter_breakdown_last_update', 'Last update'), formatTimestamp(latest.measured_at)),
      detailRow(t('energy_meter_breakdown_validation_status', 'Validation status'), validationStatusText(badges))
    ].join('');

    return (
      '<div class="energy-meter-card__details-title">' +
      escapeHtml(t('energy_meter_breakdown_details_title', 'Meter details')) +
      '</div>' + rows + methodologyNote
    );
  }

  function buildFloorTriggerHtml(floorCode, floorLabel, codePill, list, agg, isOpen, statsById) {
    var meterCountLbl = t('energy_meter_breakdown_meters_on_floor', ':count meters')
      .replace(':count', String(list.length));
    return (
      '<section class="energy-meter-floor' + (isOpen ? ' is-open' : '') + '" data-floor-code="' + escapeHtml(floorCode) + '">' +
      '<button type="button" class="energy-meter-floor__trigger" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
      '<span class="energy-meter-floor__left">' +
      '<span class="energy-meter-floor__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + floorIconSvg(floorCode) + '</svg></span>' +
      '<span class="energy-meter-floor__identity">' +
      '<span class="energy-meter-floor__code">' + escapeHtml(codePill) + '</span>' +
      '<span class="energy-meter-floor__title">' + escapeHtml(floorLabel) + '</span>' +
      '<span class="energy-meter-floor__count">' + escapeHtml(meterCountLbl) + '</span>' +
      '</span></span>' +
      '<span class="energy-meter-floor__metrics">' + buildFloorMetricsHtml(agg, false) + '</span>' +
      '<span class="energy-meter-floor__right">' +
      '<span class="energy-meter-floor__status">' + floorStatusHtml(list, statsById || {}) + '</span>' +
      '<span class="energy-meter-floor__chevron" aria-hidden="true">⌄</span>' +
      '</span></button>' +
      '<div class="energy-meter-floor__body"' + (isOpen ? '' : ' hidden') + '>' +
      '<div class="energy-meter-list">' +
      list.map(function (s) {
        var st = statsById && statsById[String(s.id)] ? statsById[String(s.id)] : null;
        return buildMeterCardSummary(s, st, false);
      }).join('') +
      '</div></div></section>'
    );
  }

  function aggregateGroupStats(sensors, statsById) {
    var totalConsumed = 0;
    var hasConsumed = false;
    var latestSum = 0;
    var hasLatest = false;
    var freshestAt = null;
    var peakKwh = null;
    var peakLabel = null;

    sensors.forEach(function (s) {
      var latest = normalizeLatest(s.latest || {});
      var lk = toNum(latest.energy_kwh);
      if (lk !== null) {
        latestSum += lk;
        hasLatest = true;
      }
      var ma = latest.measured_at ? Date.parse(latest.measured_at) : NaN;
      if (Number.isFinite(ma) && (freshestAt === null || ma > freshestAt)) freshestAt = ma;

      var st = statsById[String(s.id)];
      if (st && !st.insufficient && st.consumedKwh !== null) {
        totalConsumed += st.consumedKwh;
        hasConsumed = true;
      }
      if (st && st.peak && st.peak.kwh !== null && (peakKwh === null || st.peak.kwh > peakKwh)) {
        peakKwh = st.peak.kwh;
        peakLabel = st.peak.label;
      }
    });

    return {
      meterCount: sensors.length,
      totalConsumed: hasConsumed ? totalConsumed : null,
      latestSum: hasLatest ? latestSum : null,
      freshestAt: freshestAt,
      peakLabel: peakLabel,
      peakKwh: peakKwh
    };
  }

  function updateFloorHeader(floorEl, sensors, statsById, loading) {
    var agg = aggregateGroupStats(sensors, statsById);
    var metricsEl = floorEl.querySelector('.energy-meter-floor__metrics');
    if (metricsEl) metricsEl.innerHTML = buildFloorMetricsHtml(agg, loading);
    var statusEl = floorEl.querySelector('.energy-meter-floor__status');
    if (statusEl) statusEl.innerHTML = floorStatusHtml(sensors, statsById);
  }

  function fetchMeterTimeseries(api, sensorId, tf) {
    return api.fetchSensorTimeseries(sensorId, 'energy_kwh', tf).then(function (resp) {
      var pts = (resp && Array.isArray(resp.points)) ? resp.points : [];
      return computeMeterStats(pts);
    }).catch(function () {
      return { insufficient: true, readingsCount: 0, consumedKwh: null };
    });
  }

  function floorTimeseriesKey(scopeKey, floorCode) {
    return scopeKey + '\u0001' + floorCode;
  }

  function renderFloorMeters(floorEl, sensors, statsById, loading) {
    var list = floorEl.querySelector('.energy-meter-list');
    if (list) {
      list.innerHTML = sensors.map(function (s) {
        return buildMeterCardSummary(s, statsById[String(s.id)], loading);
      }).join('');
    }
    updateFloorHeader(floorEl, sensors, statsById, loading);
  }

  function loadFloorTimeseries(container, floorEl, sensors) {
    var api = global.SMACAApi;
    if (!api || typeof api.fetchSensorTimeseries !== 'function') return Promise.resolve();
    var tf = activeTimeframe();
    var scopeKey = cacheScopeKey();
    if (!container.__smacaEnergyStatsCache) container.__smacaEnergyStatsCache = {};
    if (!container.__smacaEnergyStatsCache[scopeKey]) {
      container.__smacaEnergyStatsCache[scopeKey] = {};
    }
    var cache = container.__smacaEnergyStatsCache[scopeKey];
    var floorCode = floorEl.getAttribute('data-floor-code') || '';
    var floorKey = floorTimeseriesKey(scopeKey, floorCode);
    var isOpen = floorEl.classList.contains('is-open');

    if (container.__smacaEnergyFloorLoaded &&
      container.__smacaEnergyFloorLoaded[floorKey]) {
      renderFloorMeters(floorEl, sensors, cache, false);
      return Promise.resolve();
    }

    floorEl.classList.add('energy-meter-floor--loading');
    if (isOpen) {
      renderFloorMeters(floorEl, sensors, cache, true);
    } else {
      updateFloorHeader(floorEl, sensors, cache, true);
    }

    var tasks = sensors.map(function (s) {
      var sid = String(s.id);
      if (cache[sid]) return Promise.resolve(cache[sid]);
      return fetchMeterTimeseries(api, s.id, tf).then(function (stats) {
        cache[sid] = stats;
        return stats;
      });
    });

    return Promise.all(tasks).then(function () {
      floorEl.classList.remove('energy-meter-floor--loading');
      if (!container.__smacaEnergyFloorLoaded) container.__smacaEnergyFloorLoaded = {};
      container.__smacaEnergyFloorLoaded[floorKey] = true;
      renderFloorMeters(floorEl, sensors, cache, false);
    });
  }

  function prefetchAllFloorTimeseries(container) {
    var groups = container.__smacaEnergyGroups;
    if (!groups) return;
    Object.keys(groups).forEach(function (floorCode) {
      var sensors = groups[floorCode];
      if (!sensors || !sensors.length) return;
      var floorEl = null;
      var floors = container.querySelectorAll('.energy-meter-floor');
      for (var fi = 0; fi < floors.length; fi++) {
        if (floors[fi].getAttribute('data-floor-code') === floorCode) {
          floorEl = floors[fi];
          break;
        }
      }
      if (floorEl) loadFloorTimeseries(container, floorEl, sensors);
    });
  }

  function ensureMeterDetail(card, container) {
    var inner = card.querySelector('.energy-meter-card__details-inner');
    if (!inner || inner.getAttribute('data-energy-detail-ready') === '1') return;
    var id = String(card.getAttribute('data-sensor-id') || '');
    var sensor = container.__smacaEnergySensorsById && container.__smacaEnergySensorsById[id];
    if (!sensor) return;
    var scopeKey = cacheScopeKey();
    var stats = container.__smacaEnergyStatsCache &&
      container.__smacaEnergyStatsCache[scopeKey] &&
      container.__smacaEnergyStatsCache[scopeKey][id];
    if (!stats) {
      inner.innerHTML = '<p class="overview-live-note">' + escapeHtml(t('energy_meter_breakdown_expand_to_load', 'Open the floor group to load meter timeseries.')) + '</p>';
      inner.setAttribute('data-energy-detail-ready', '1');
      return;
    }
    inner.innerHTML = buildDetailPanel(sensor, stats, normalizeLatest(sensor.latest || {}));
    inner.setAttribute('data-energy-detail-ready', '1');
  }

  function bindInteractions(container) {
    if (!container || container.__smacaEnergyBound) return;
    container.__smacaEnergyBound = true;

    function setFloorState(floor, open) {
      if (!floor) return;
      floor.classList.toggle('is-open', open);
      var trigger = floor.querySelector('.energy-meter-floor__trigger');
      var body = floor.querySelector('.energy-meter-floor__body');
      if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (body) body.hidden = !open;
      var floorCode = floor.getAttribute('data-floor-code');
      if (!floorCode) return;
      if (!container.__smacaFloorState) container.__smacaFloorState = {};
      container.__smacaFloorState[floorCode] = open;
    }

    container.addEventListener('click', function (event) {
      var floorTrigger = event.target.closest('.energy-meter-floor__trigger');
      if (floorTrigger) {
        var floor = floorTrigger.closest('.energy-meter-floor');
        if (floor) {
          var willOpen = !floor.classList.contains('is-open');
          if (willOpen) {
            var openFloors = container.querySelectorAll('.energy-meter-floor.is-open');
            for (var fi = 0; fi < openFloors.length; fi++) {
              if (openFloors[fi] !== floor) setFloorState(openFloors[fi], false);
            }
            var floorCode = floor.getAttribute('data-floor-code');
            var sensors = container.__smacaEnergyGroups && container.__smacaEnergyGroups[floorCode];
            if (sensors && sensors.length) {
              loadFloorTimeseries(container, floor, sensors);
            }
          }
          setFloorState(floor, willOpen);
        }
        return;
      }

      var cardTrigger = event.target.closest('.energy-meter-card__trigger');
      if (!cardTrigger) return;
      var card = cardTrigger.closest('.energy-meter-card');
      if (!card) return;
      var details = card.querySelector('.energy-meter-card__details');
      var open = !card.classList.contains('is-open');
      if (open) {
        var listRoot = card.closest('.energy-meter-list');
        if (listRoot) {
          var openCards = listRoot.querySelectorAll('.energy-meter-card.is-open');
          for (var oci = 0; oci < openCards.length; oci++) {
            var oc = openCards[oci];
            if (oc === card) continue;
            oc.classList.remove('is-open');
            var ot = oc.querySelector('.energy-meter-card__trigger');
            var od = oc.querySelector('.energy-meter-card__details');
            if (ot) ot.setAttribute('aria-expanded', 'false');
            if (od) od.hidden = true;
          }
        }
        ensureMeterDetail(card, container);
      }
      card.classList.toggle('is-open', open);
      cardTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (details) details.hidden = !open;
    });
  }

  var refreshTimer = null;
  var refreshTick = 0;
  var fetchId = 0;

  function refreshExecute() {
    var container = document.getElementById('energy-meter-groups');
    if (!container) return;
    var api = global.SMACAApi;
    if (!api || typeof api.fetchSensors !== 'function') return;

    fetchId += 1;
    var localFetchId = fetchId;
    var refreshScopeKey = cacheScopeKey();
    if (!container.__smacaEnergyStatsCache) container.__smacaEnergyStatsCache = {};
    container.__smacaEnergyStatsCache[refreshScopeKey] = {};
    container.__smacaEnergyFloorLoaded = {};
    container.hidden = false;
    container.innerHTML = buildSkeleton();
    container.classList.add('iaq-sensor-groups--skeleton');
    container.setAttribute('aria-busy', 'true');

    api.fetchSensors().then(function (payload) {
      if (localFetchId !== fetchId) return;
      var rowsAll = (payload && Array.isArray(payload.rows)) ? payload.rows : [];
      var scoped = rowsAll.filter(sensorMatchesScope);
      var meters = scoped.filter(isEnergySensor);

      container.classList.remove('iaq-sensor-groups--skeleton');
      container.removeAttribute('aria-busy');

      if (!meters.length) {
        container.innerHTML = '<p class="overview-live-note">' + escapeHtml(t('energy_meter_breakdown_no_meters', 'No energy meters in this scope')) + '</p>';
        container.__smacaEnergySensorsById = {};
        container.__smacaEnergyGroups = {};
        return;
      }

      var groups = {};
      meters.forEach(function (s) {
        var code = s.sensor_location || '—';
        if (!groups[code]) groups[code] = [];
        groups[code].push(s);
      });

      container.__smacaEnergySensorsById = {};
      meters.forEach(function (s) {
        container.__smacaEnergySensorsById[String(s.id)] = s;
      });
      container.__smacaEnergyGroups = groups;
      container.__smacaEnergyFloorLoaded = {};

      var floorCodes = Object.keys(groups).sort(function (a, b) {
        var w = floorSortWeight(a) - floorSortWeight(b);
        if (w !== 0) return w;
        return String(a).localeCompare(String(b));
      });

      var sections = floorCodes.map(function (floorCode) {
        var list = groups[floorCode];
        var floorLabel = floorTitle(floorCode, list[0] && list[0].sensor_location_label);
        var codePill = floorCodeDisplay(floorCode);
        var isOpen = container.__smacaFloorState &&
          Object.prototype.hasOwnProperty.call(container.__smacaFloorState, floorCode)
          ? Boolean(container.__smacaFloorState[floorCode])
          : false;
        var scopeKey = cacheScopeKey();
        var cache = (container.__smacaEnergyStatsCache && container.__smacaEnergyStatsCache[scopeKey]) || {};
        var aggSnap = aggregateGroupStats(list, cache);
        return buildFloorTriggerHtml(floorCode, floorLabel, codePill, list, aggSnap, isOpen, cache);
      });

      container.innerHTML = sections.join('');
      bindInteractions(container);

      floorCodes.forEach(function (floorCode) {
        if (!container.__smacaFloorState || !container.__smacaFloorState[floorCode]) return;
        var floors = container.querySelectorAll('.energy-meter-floor');
        var floorEl = null;
        for (var fi = 0; fi < floors.length; fi++) {
          if (floors[fi].getAttribute('data-floor-code') === floorCode) {
            floorEl = floors[fi];
            break;
          }
        }
        if (floorEl && groups[floorCode]) loadFloorTimeseries(container, floorEl, groups[floorCode]);
      });
    }).catch(function () {
      if (localFetchId !== fetchId) return;
      container.classList.remove('iaq-sensor-groups--skeleton');
      container.removeAttribute('aria-busy');
      container.innerHTML = '<p class="overview-live-note">' + escapeHtml(t('no_connectivity_data', 'No data')) + '</p>';
    });
  }

  function refresh() {
    refreshTick += 1;
    var tick = refreshTick;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () {
      refreshTimer = null;
      if (tick !== refreshTick) return;
      refreshExecute();
    }, REFRESH_DEBOUNCE_MS);
  }

  global.SMACAEnergyMeterBreakdown = { refresh: refresh };
})(typeof window !== 'undefined' ? window : this);
