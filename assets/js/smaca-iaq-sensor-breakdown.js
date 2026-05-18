/**
 * IAQ sensor breakdown by floor/location — mirrors occupancy sensor groups UX.
 * Data: GET /api/sensors (client-side scope filter via SMACA_LOCATION).
 */
(function (global) {
  'use strict';

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

  function isFiniteNum(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }

  function activeLocation() {
    try {
      var v = (global.SMACA_LOCATION || '').toString().trim();
      return v || null;
    } catch (e) {
      return null;
    }
  }

  function sensorMatchesScope(sensor) {
    var scope = activeLocation();
    if (!scope) return true;
    if (!sensor || !sensor.sensor_location) return false;
    return String(sensor.sensor_location).toUpperCase() === String(scope).toUpperCase();
  }

  function iaqSemantics() {
    return global.SMACA_IAQ_SEMANTICS || {};
  }

  function normalizeLatestLocal(latest) {
    var fn = global.SMACA_TELEMETRY_METRIC_NORMALIZE && global.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest;
    if (typeof fn === 'function') return fn(latest || {});
    return latest || {};
  }

  /** --------- IAQ-6: telemetry validation (client-side; reflects /api/sensors latest payload) --------- */
  var IAQ_STALE_MS = 90 * 60 * 1000;
  var IAQ_DEBUG = false;
  try {
    IAQ_DEBUG = Boolean(global.SMACA_DEBUG_IAQ)
      || (global.localStorage && String(global.localStorage.getItem('smaca_debug_iaq') || '') === '1');
  } catch (eDbg) { /* noop */ }

  function naLabel() {
    return t('iaq_metric_na', 'N/A');
  }

  function hasLatestKey(latest, key) {
    return Boolean(latest && Object.prototype.hasOwnProperty.call(latest, key));
  }

  /** Raw presence: missing key vs null vs present non-null. */
  function rawMetricPresence(latest, key) {
    if (!latest) return 'missing';
    if (!hasLatestKey(latest, key)) return 'missing';
    var v = latest[key];
    if (v === null || v === undefined || v === '') return 'null';
    return 'present';
  }

  var METRIC_FALLBACK_KEYS = {
    pm25: ['pm25', 'pm2_5_ugm3', 'pm2_5ugm3'],
    pm10: ['pm10', 'pm10_ugm3', 'pm10ugm3'],
    tvoc: ['tvoc', 'tvoc_index'],
    lighting: ['lighting', 'light_level'],
    temperature: ['temperature', 'temperature_c'],
    humidity: ['humidity', 'humidity_rh']
  };

  /**
   * Effective numeric for dashboards: optional treatZeroAsAbsent (PM, CO₂, TVOC, etc.).
   * Returns null when value should not be shown as a real measurement.
   */
  function effectiveNumeric(latest, key, treatZeroAsAbsent) {
    var pr = rawMetricPresence(latest, key);
    if (pr === 'missing' || pr === 'null') return null;
    var n = Number(latest[key]);
    if (!Number.isFinite(n)) return null;
    if (treatZeroAsAbsent && n === 0) return null;
    return n;
  }

  /**
   * Resolve a canonical metric from API-normalized keys first, then legacy DB fields.
   * @param {boolean} treatZeroAsAbsent when true, numeric 0 is treated as absent (CO₂ only).
   */
  function effectiveNumericCanonical(latest, canonicalKey, treatZeroAsAbsent) {
    if (!latest) return null;
    var keys = METRIC_FALLBACK_KEYS[canonicalKey] || [canonicalKey];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!hasLatestKey(latest, k)) continue;
      var v = latest[k];
      if (v === null || v === undefined || v === '') continue;
      var n = Number(v);
      if (!Number.isFinite(n)) continue;
      if (treatZeroAsAbsent && n === 0) continue;
      return n;
    }
    return null;
  }

  /** Explicit debug only — never shown in normal admin/user UI. */
  function isIaqDebugMode() {
    if (IAQ_DEBUG) return true;
    try {
      if (global.SMACA_DEBUG !== true) return false;
      var u = global.SMACA_USER || {};
      return Boolean(u.isAdmin) || String(u.role || '').toLowerCase() === 'admin';
    } catch (e) {
      return false;
    }
  }

  function readingsFallbackBadgeHtml(latest) {
    if (!latest || !latest.fallback_from_readings || !isIaqDebugMode()) return '';
    return (
      '<span class="iaq-sensor-card__fallback-badge" title="' +
      escapeHtml(t('iaq_readings_fallback_badge_hint', 'TVOC/light from readings; not stored on sensor_latest')) +
      '">' + escapeHtml(t('iaq_readings_fallback_badge', 'readings fallback')) + '</span>'
    );
  }

  function measuredAgeMs(latest) {
    if (!latest || !latest.measured_at) return null;
    try {
      var d = new Date(latest.measured_at);
      if (Number.isNaN(d.getTime())) return null;
      return Date.now() - d.getTime();
    } catch (e) {
      return null;
    }
  }

  function isStaleLatest(latest) {
    var age = measuredAgeMs(latest);
    if (age === null) return true;
    return age > IAQ_STALE_MS;
  }

  function effectiveCo2(l) { return effectiveNumeric(l, 'co2_ppm', true); }
  function effectivePm25(l) { return effectiveNumericCanonical(l, 'pm25', false); }
  function effectivePm10(l) { return effectiveNumericCanonical(l, 'pm10', false); }
  function effectiveTvoc(l) { return effectiveNumericCanonical(l, 'tvoc', false); }
  function effectiveTemp(l) { return effectiveNumericCanonical(l, 'temperature', false); }
  function effectiveRh(l) { return effectiveNumericCanonical(l, 'humidity', false); }

  /** Light: semantic-mode aware; normalized mode uses `lighting` only (no lux substitution). */
  function effectiveLightForDisplay(latest, semLight) {
    var mode = String(semLight || 'normalized_level_0_5');
    if (mode === 'raw_lux') {
      var lx = effectiveNumeric(latest, 'lux', false);
      if (lx !== null) return { primary: lx, unit: 'lx', hint: '', source: 'lux' };
      return { primary: null, unit: '', hint: '', source: 'none' };
    }
    var ll2 = effectiveNumericCanonical(latest, 'lighting', false);
    if (ll2 !== null) return { primary: ll2, unit: '', hint: '', source: 'level' };
    return { primary: null, unit: '', hint: '', source: 'none' };
  }

  function metricAvailabilityMap(latest, semLight) {
    var sem = String(semLight || 'normalized_level_0_5');
    var stale = isStaleLatest(latest);
    function cell(key, treatZero, lightKind) {
      var pr = rawMetricPresence(latest, key);
      var eff = effectiveNumeric(latest, key, treatZero);
      var state = 'missing';
      if (pr === 'missing') state = 'missing';
      else if (pr === 'null') state = 'null';
      else if (eff === null) state = treatZero && Number(latest[key]) === 0 ? 'ambiguous_zero' : 'null';
      else if (stale) state = 'stale_value';
      else state = 'ok';
      return { presence: pr, effective: eff, state: state, stale: stale, lightKind: lightKind || null };
    }
    function cellCanonical(canonicalKey, treatZero, lightKind) {
      var keys = METRIC_FALLBACK_KEYS[canonicalKey] || [canonicalKey];
      var pr = 'missing';
      var ki;
      for (ki = 0; ki < keys.length; ki++) {
        var p = rawMetricPresence(latest, keys[ki]);
        if (p === 'present') { pr = 'present'; break; }
        if (p === 'null') pr = 'null';
      }
      var eff = effectiveNumericCanonical(latest, canonicalKey, treatZero);
      var state = 'missing';
      if (pr === 'missing') state = 'missing';
      else if (eff === null) state = pr === 'null' ? 'null' : 'missing';
      else if (stale) state = 'stale_value';
      else state = 'ok';
      return { presence: pr, effective: eff, state: state, stale: stale, lightKind: lightKind || null };
    }
    var lightPrimary = effectiveLightForDisplay(latest, sem);
    var lightPresenceKey = sem === 'raw_lux' ? 'lux' : 'lighting';
    return {
      co2_ppm: cell('co2_ppm', true, null),
      temperature: cellCanonical('temperature', false, null),
      humidity: cellCanonical('humidity', false, null),
      pm25: cellCanonical('pm25', false, null),
      pm10: cellCanonical('pm10', false, null),
      tvoc: cellCanonical('tvoc', false, null),
      light: {
        mode: sem,
        source: lightPrimary.source,
        primary: lightPrimary.primary,
        stale: stale,
        presenceKey: lightPresenceKey
      }
    };
  }

  function collectThermalWarningsDetailed(latest) {
    var out = [];
    var temp = effectiveTemp(latest);
    var rh = effectiveRh(latest);
    if (temp !== null && temp < 20) {
      out.push({ sev: 2, kind: 'thermal', text: t('iaq_warn_temp_low', 'Temperature below comfort band (<20 °C)') });
    }
    if (temp !== null && temp > 24) {
      out.push({ sev: 2, kind: 'thermal', text: t('iaq_warn_temp_high', 'Temperature above comfort band (>24 °C)') });
    }
    if (rh !== null && rh < 40) {
      out.push({ sev: 2, kind: 'thermal', text: t('iaq_warn_rh_low', 'Humidity below comfort band (<40 % RH)') });
    }
    if (rh !== null && rh > 60) {
      out.push({ sev: 2, kind: 'thermal', text: t('iaq_warn_rh_high', 'Humidity above comfort band (>60 % RH)') });
    }
    return out;
  }

  var IAQ_CONCERN_RANK = {
    tvoc_bad: 1,
    tvoc_poor: 2,
    co2_critical: 3,
    co2_high: 4,
    pm_unhealthy: 5,
    thermal: 6,
    lighting: 7
  };

  function warningConcernRank(warning) {
    if (!warning) return 99;
    return IAQ_CONCERN_RANK[warning.kind] || 99;
  }

  function telemetryHealthLabel(latest, availability) {
    if (isStaleLatest(latest)) return { key: 'stale', label: t('iaq_health_stale', 'Stale data') };
    var slots = 0;
    var ok = 0;
    function score(m) {
      if (!m || m.state === 'missing') return;
      slots += 1;
      if (m.state === 'ok' && m.effective !== null) ok += 1;
    }
    score(availability.co2_ppm);
    score(availability.temperature);
    score(availability.humidity);
    score(availability.pm25);
    score(availability.pm10);
    score(availability.tvoc);
    if (availability.light && availability.light.primary !== null) {
      slots += 1;
      if (!availability.light.stale) ok += 1;
    }
    if (slots === 0) return { key: 'limited', label: t('iaq_health_missing_metrics', 'Missing metrics') };
    var ratio = ok / slots;
    if (ratio >= 0.95) return { key: 'healthy', label: t('iaq_health_healthy', 'Healthy telemetry') };
    if (ratio >= 0.55) return { key: 'partial', label: t('iaq_health_partial', 'Partial telemetry') };
    return { key: 'limited', label: t('iaq_health_limited_telemetry', 'Limited telemetry') };
  }

  function semanticCoverageLabel(availability) {
    var hasCo2 = availability.co2_ppm && availability.co2_ppm.effective !== null;
    var hasThermal = (availability.temperature && availability.temperature.effective !== null)
      || (availability.humidity && availability.humidity.effective !== null);
    var hasPm = (availability.pm25 && availability.pm25.effective !== null)
      || (availability.pm10 && availability.pm10.effective !== null);
    var hasTvoc = availability.tvoc && availability.tvoc.effective !== null;
    var hasLight = availability.light && availability.light.primary !== null;
    var score = 0;
    if (hasCo2) score += 1;
    if (hasThermal) score += 1;
    if (hasPm) score += 1;
    if (hasTvoc) score += 1;
    if (hasLight) score += 1;
    if (score >= 5) return t('iaq_semantic_coverage_full', 'Full semantic coverage');
    if (score >= 3) return t('iaq_semantic_coverage_partial', 'Partial semantic coverage');
    return t('iaq_semantic_coverage_limited', 'Limited semantic coverage');
  }

  function debugIaqTvocLight(sensor, latest, semTvoc, semLight) {
    if (!IAQ_DEBUG) return;
    try {
      /* eslint-disable no-console */
      console.info('[SMACA IAQ validation]', {
        sensor_id: sensor && sensor.id,
        sensor_uid: sensor && sensor.sensor_uid,
        device_type: sensor && sensor.device_type,
        tvoc_semantic_mode: semTvoc,
        light_semantic_mode: semLight,
        measured_at: latest && latest.measured_at,
        age_ms: measuredAgeMs(latest),
        stale: isStaleLatest(latest),
        tvoc_raw: latest && latest.tvoc,
        tvoc_effective: effectiveTvoc(latest || {}),
        lighting_raw: latest && latest.lighting,
        lux_raw: latest && latest.lux,
        light_resolution: effectiveLightForDisplay(latest || {}, semLight),
        metric_availability: metricAvailabilityMap(latest || {}, semLight)
      });
      /* eslint-enable no-console */
    } catch (eLog) { /* noop */ }
  }
  function isIaqSensor(s) {
    if (!s) return false;
    if (s.device_type === 'iaq') return true;
    var lat = normalizeLatestLocal(s.latest || {});
    return isFiniteNum(toNum(lat.co2_ppm))
      || isFiniteNum(toNum(lat.pm25))
      || isFiniteNum(toNum(lat.tvoc));
  }

  function floorSortWeight(code) {
    var key = String(code || '').toUpperCase();
    if (key === '—' || key === '-') return 99;
    if (key === 'AUD') return -2;
    if (key === 'B2') return -1;
    if (key === 'B1') return 0;
    if (key === 'F0') return 1;
    if (key === 'F1') return 2;
    return 50;
  }

  function floorIconSvg(code) {
    var key = String(code || '').toUpperCase();
    if (key === 'AUD') {
      return '<path d="M4 19v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M6 10V8a2 2 0 0 1 2-2h1M18 10V8a2 2 0 0 0-2-2h-1M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01" />';
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
    if (!c || c === '—') return t('iaq_sensor_breakdown_unknown_location', 'Unassigned location');
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

  function avgNums(values) {
    var nums = [];
    for (var i = 0; i < values.length; i++) {
      var n = toNum(values[i]);
      if (n !== null) nums.push(n);
    }
    if (!nums.length) return null;
    var sum = 0;
    for (var j = 0; j < nums.length; j++) sum += nums[j];
    return sum / nums.length;
  }

  function fmtFixed(n, decimals) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
    var d = decimals === undefined ? 1 : decimals;
    return String(Number(n).toFixed(d));
  }

  function ventilationBandFromCo2(ppm) {
    var p = toNum(ppm);
    if (p === null) return null;
    if (p <= 400) return t('iaq_co2_band_outdoor_normal', 'Normal outdoor air (≤400 ppm)');
    if (p <= 1000) return t('iaq_co2_band_good_ventilation', 'Good ventilation');
    if (p <= 2000) return t('iaq_co2_band_poor_ventilation', 'Poor air quality — ventilation required (1000–2000 ppm)');
    if (p <= 5000) return t('iaq_co2_band_high_discomfort', 'High discomfort / possible symptoms (2000–5000 ppm)');
    if (p <= 40000) return t('iaq_co2_band_workplace_limit', 'Workplace exposure limit band (5000–40000 ppm)');
    return t('iaq_co2_band_dangerous', 'Dangerous exposure (>40000 ppm)');
  }

  function thermalComfortState(latest) {
    var tC = effectiveTemp(latest || {});
    var rH = effectiveRh(latest || {});
    var hasT = tC !== null;
    var hasH = rH !== null;
    if (!hasT && !hasH) return null;
    var okT = !hasT || (tC >= 20 && tC <= 24);
    var okH = !hasH || (rH >= 40 && rH <= 60);
    if (okT && okH) return t('iaq_sensor_breakdown_thermal_comfortable', 'Within comfort range');
    return t('iaq_sensor_breakdown_thermal_uncomfortable', 'Outside comfort range');
  }

  function environmentalSafetyNarrative(latest, tvocMode) {
    var pm25U = (function () {
      var v = effectivePm25(latest || {});
      return v !== null && v > 35.4;
    })();
    var pm10U = (function () {
      var v = effectivePm10(latest || {});
      return v !== null && v > 154;
    })();
    var tv = effectiveTvoc(latest || {});
    var mode = String(tvocMode || 'iaq_rating_level');
    var tvBad = false;
    if (tv !== null) {
      if (mode === 'raw_tvoc_ugm3') {
        tvBad = tv >= 250;
      } else {
        tvBad = tv >= 3.99;
      }
    }
    if (pm25U || pm10U || tvBad) {
      return t('iaq_sensor_breakdown_env_elevated', 'Elevated particulates or TVOC — monitor ventilation');
    }
    return t('iaq_sensor_breakdown_env_acceptable', 'No major particulate / TVOC flags from latest snapshot');
  }

  function lightingNarrative(latest, lightMode) {
    var mode = String(lightMode || 'normalized_level_0_5');
    var r = effectiveLightForDisplay(latest || {}, lightMode);
    if (r.primary === null) return t('insufficient_data', 'insufficient data');
    if (mode === 'raw_lux' && r.source === 'lux') {
      var lx = r.primary;
      if (lx < 80) return t('iaq_lighting_level_minimal', 'Minimal light');
      if (lx > 2500) return t('iaq_lighting_level_intense', 'Intense lighting');
      return t('iaq_lighting_level_office', 'Office lighting');
    }
    var lv = r.primary;
    var labels = ['minimal', 'dim_indoor', 'residential', 'office', 'detailed_work', 'intense'];
    var idx = Math.round(lv);
    if (idx < 0) idx = 0;
    if (idx > 5) idx = 5;
    var k = labels[idx];
    return t('iaq_lighting_level_' + k, k);
  }

  function tvocRatingLabel(v) {
    var x = toNum(v);
    if (x === null) return naLabel();
    if (x <= 1.99) return t('iaq_tvoc_rating_very_good', 'Very Good');
    if (x <= 2.99) return t('iaq_tvoc_rating_good', 'Good');
    if (x <= 3.99) return t('iaq_tvoc_rating_medium', 'Medium');
    if (x <= 4.99) return t('iaq_tvoc_rating_poor', 'Poor');
    return t('iaq_tvoc_rating_bad', 'Bad');
  }

  function tvocColumnTitle() {
    var sem = iaqSemantics();
    return String(sem.tvoc_semantic_mode || 'iaq_rating_level') === 'raw_tvoc_ugm3'
      ? t('iaq_sensor_breakdown_tvoc_raw_label', 'TVOC µg/m³')
      : t('iaq_sensor_breakdown_tvoc_iaq_rating_label', 'TVOC IAQ rating');
  }

  function lightColumnTitle() {
    var sem = iaqSemantics();
    return String(sem.light_semantic_mode || 'normalized_level_0_5') === 'raw_lux'
      ? t('iaq_sensor_breakdown_lux_label', 'Lux')
      : t('iaq_sensor_breakdown_light_level_label', 'Light level 0–5');
  }

  function collectWarnings(latest, tvocMode, lightMode) {
    var w = [];
    var co2 = effectiveCo2(latest || {});
    if (co2 !== null) {
      if (co2 >= 2000) {
        w.push({ sev: 4, kind: 'co2_critical', text: t('iaq_sensor_breakdown_warn_co2_critical', 'CO₂ critical (≥2000 ppm)') });
      } else if (co2 >= 1000) {
        w.push({ sev: 3, kind: 'co2_high', text: t('iaq_sensor_breakdown_warn_co2_high', 'CO₂ elevated (≥1000 ppm)') });
      }
    }
    var pm25 = effectivePm25(latest || {});
    if (pm25 !== null && pm25 > 35.4) {
      w.push({ sev: 3, kind: 'pm_unhealthy', text: t('iaq_sensor_breakdown_warn_pm25', 'PM2.5 unhealthy (>35.4 µg/m³)') });
    }
    var pm10 = effectivePm10(latest || {});
    if (pm10 !== null && pm10 > 154) {
      w.push({ sev: 3, kind: 'pm_unhealthy', text: t('iaq_sensor_breakdown_warn_pm10', 'PM10 unhealthy (>154 µg/m³)') });
    }
    var tvoc = effectiveTvoc(latest || {});
    if (tvoc !== null) {
      if (String(tvocMode || '') === 'raw_tvoc_ugm3') {
        if (tvoc >= 1000) {
          w.push({ sev: 4, kind: 'tvoc_bad', text: t('iaq_sensor_breakdown_warn_tvoc_critical', 'TVOC high') });
        } else if (tvoc >= 250) {
          w.push({ sev: 2, kind: 'tvoc_poor', text: t('iaq_sensor_breakdown_warn_tvoc', 'TVOC elevated') });
        }
      } else if (tvoc >= 4.99) {
        w.push({ sev: 4, kind: 'tvoc_bad', text: t('iaq_sensor_breakdown_warn_tvoc_critical', 'TVOC high') });
      } else if (tvoc >= 4) {
        w.push({ sev: 2, kind: 'tvoc_poor', text: t('iaq_warn_tvoc_poor', 'Poor TVOC rating') });
      }
    }
    var tw = collectThermalWarningsDetailed(latest || {});
    for (var ti = 0; ti < tw.length; ti++) w.push(tw[ti]);
    var le = effectiveLightForDisplay(latest || {}, lightMode);
    if (le.primary !== null) {
      if (String(lightMode || '') === 'raw_lux' && le.source === 'lux') {
        var lx = le.primary;
        if (lx <= 0) {
          w.push({ sev: 2, kind: 'lighting', text: t('iaq_warn_light_minimal', 'Minimal lighting detected') });
        } else if (lx < 80) {
          w.push({ sev: 2, kind: 'lighting', text: t('iaq_sensor_breakdown_warn_lighting', 'Lighting outside comfortable range') });
        } else if (lx > 2500) {
          w.push({ sev: 2, kind: 'lighting', text: t('iaq_warn_light_intense', 'Intense lighting detected') });
        }
      } else {
        var ll = le.primary;
        if (ll === 0) {
          w.push({ sev: 2, kind: 'lighting', text: t('iaq_warn_light_minimal', 'Minimal lighting detected') });
        } else if (ll <= 1) {
          w.push({ sev: 2, kind: 'lighting', text: t('iaq_sensor_breakdown_warn_lighting', 'Lighting outside comfortable range') });
        } else if (ll >= 5) {
          w.push({ sev: 2, kind: 'lighting', text: t('iaq_warn_light_intense', 'Intense lighting detected') });
        }
      }
    }
    return w;
  }

  function worstSeverity(warnings) {
    var m = 0;
    for (var i = 0; i < warnings.length; i++) {
      if (warnings[i].sev > m) m = warnings[i].sev;
    }
    return m;
  }

  function topConcernFromWarnings(warnings) {
    if (!warnings.length) return t('iaq_sensor_breakdown_ok', 'OK');
    var sorted = warnings.slice().sort(function (a, b) {
      var ra = warningConcernRank(a);
      var rb = warningConcernRank(b);
      if (ra !== rb) return ra - rb;
      return b.sev - a.sev;
    });
    return sorted[0].text;
  }

  function statusChipForSeverity(sev) {
    if (sev >= 4) {
      return '<span class="iaq-sensor-card__status-chip iaq-sensor-card__status-chip--critical">' + escapeHtml(t('iaq_sensor_breakdown_status_critical', 'Critical')) + '</span>';
    }
    if (sev >= 2) {
      return '<span class="iaq-sensor-card__status-chip iaq-sensor-card__status-chip--warning">' + escapeHtml(t('warning', 'Warning')) + '</span>';
    }
    return '<span class="iaq-sensor-card__status-chip iaq-sensor-card__status-chip--ok">' + escapeHtml(t('iaq_sensor_breakdown_ok', 'OK')) + '</span>';
  }

  /** Display-only CO₂ band for chip tint (aligned with existing ppm breakpoints). */
  function co2SeverityMod(latest) {
    var p = effectiveCo2(latest || {});
    if (p === null) return 'iaq-sev--na';
    if (p >= 2000) return 'iaq-sev--co2-critical';
    if (p >= 1000) return 'iaq-sev--co2-warning';
    return 'iaq-sev--co2-good';
  }

  function pm25SeverityMod(latest) {
    var x = effectivePm25(latest || {});
    if (x === null) return 'iaq-sev--na';
    if (x > 35.4) return 'iaq-sev--pm-unhealthy';
    if (x > 12) return 'iaq-sev--pm-elevated';
    return 'iaq-sev--pm-healthy';
  }

  function pm10SeverityMod(latest) {
    var x = effectivePm10(latest || {});
    if (x === null) return 'iaq-sev--na';
    if (x > 154) return 'iaq-sev--pm-unhealthy';
    if (x > 54) return 'iaq-sev--pm-elevated';
    return 'iaq-sev--pm-healthy';
  }

  function thermalSeverityMod(latest) {
    var tC = effectiveTemp(latest || {});
    var rH = effectiveRh(latest || {});
    var hasT = tC !== null;
    var hasH = rH !== null;
    if (!hasT && !hasH) return 'iaq-sev--na';
    var okT = !hasT || (tC >= 20 && tC <= 24);
    var okH = !hasH || (rH >= 40 && rH <= 60);
    return okT && okH ? 'iaq-sev--thermal-ok' : 'iaq-sev--thermal-bad';
  }

  function lightingSeverityFromLatest(latest, lightMode) {
    var mode = String(lightMode || 'normalized_level_0_5');
    var r = effectiveLightForDisplay(latest || {}, lightMode);
    if (r.primary === null) return 'iaq-sev--na';
    if (mode === 'raw_lux' && r.source === 'lux') {
      var lx = r.primary;
      if (lx < 80) return 'iaq-sev--light-minimal';
      if (lx > 2500) return 'iaq-sev--light-intense';
      return 'iaq-sev--light-office';
    }
    var lv = r.primary;
    if (lv <= 1) return 'iaq-sev--light-minimal';
    if (lv >= 5) return 'iaq-sev--light-intense';
    return 'iaq-sev--light-office';
  }

  function tvocSeverityMod(latest, tvocMode) {
    var x = effectiveTvoc(latest || {});
    if (x === null) return 'iaq-sev--na';
    if (String(tvocMode || '') === 'raw_tvoc_ugm3') {
      if (x >= 1000) return 'iaq-sev--tvoc-bad';
      if (x >= 250) return 'iaq-sev--tvoc-warn';
      return 'iaq-sev--tvoc-ok';
    }
    if (x >= 4.99) return 'iaq-sev--tvoc-bad';
    if (x >= 3.99) return 'iaq-sev--tvoc-warn';
    return 'iaq-sev--tvoc-ok';
  }

  function miniMetricCollapsed(label, valueHtml, iconSvg, sevMod) {
    var mod = sevMod || 'iaq-sev--na';
    return (
      '<span class="iaq-mini-metric iaq-mini-metric--collapsed ' + mod + '">' +
      (iconSvg ? '<span class="iaq-mini-metric__icon" aria-hidden="true">' + iconSvg + '</span>' : '') +
      '<span class="iaq-mini-metric__stack">' +
      '<span class="iaq-mini-metric__value">' + valueHtml + '</span>' +
      '<span class="iaq-mini-metric__label">' + escapeHtml(label) + '</span>' +
      '</span></span>'
    );
  }

  function miniMetricDetail(label, valueMainHtml, unitHtml, hintText, sevMod) {
    var hint = hintText
      ? '<span class="iaq-mini-metric__hint">' + escapeHtml(hintText) + '</span>'
      : '';
    var unit = unitHtml || '';
    return (
      '<div class="iaq-mini-metric iaq-mini-metric--detail ' + (sevMod || 'iaq-sev--na') + '">' +
      '<span class="iaq-mini-metric__value-row">' +
      '<span class="iaq-mini-metric__value">' + valueMainHtml + '</span>' +
      (unit ? '<span class="iaq-mini-metric__unit">' + unit + '</span>' : '') +
      '</span>' +
      hint +
      '<span class="iaq-mini-metric__label">' + escapeHtml(label) + '</span>' +
      '</div>'
    );
  }

  function semanticPill(title, bodyText) {
    return (
      '<div class="iaq-semantic-pill">' +
      '<span class="iaq-semantic-pill__body">' + escapeHtml(bodyText) + '</span>' +
      '<span class="iaq-semantic-pill__title">' + escapeHtml(title) + '</span>' +
      '</div>'
    );
  }

  var ICON_CO2 = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 109 9"/><path d="M12 7a5 5 0 105 5"/><circle cx="12" cy="12" r="1.4"/></svg>';
  var ICON_TEMP = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4v10.5a4 4 0 11-4 0V4a2 2 0 114 0z"/></svg>';
  var ICON_HUM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>';
  var ICON_PM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="2"/><path d="M4 20c2-4 6-6 10-6s8 2 10 6"/></svg>';
  var ICON_TVOC = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16c2-6 6-10 8-12 2 2 6 6 8 12"/><path d="M8 16h8"/></svg>';
  var ICON_LUX = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"/></svg>';

  function formatTvocDisplay(latest, tvocMode) {
    var v = effectiveTvoc(latest || {});
    if (v === null) return escapeHtml(naLabel());
    if (String(tvocMode || '') === 'raw_tvoc_ugm3') {
      return escapeHtml(fmtFixed(v, 1)) + ' <span class="iaq-sensor-card__unit">µg/m³</span>';
    }
    return escapeHtml(fmtFixed(v, 2)) + ' <span class="iaq-sensor-card__unit">(' + escapeHtml(tvocRatingLabel(v)) + ')</span>';
  }

  function lightDisplayDecimals(lightMode) {
    return String(lightMode || '') === 'raw_lux' ? 0 : 2;
  }

  function formatLightDisplay(latest, lightMode) {
    var r = effectiveLightForDisplay(latest || {}, lightMode);
    if (r.primary === null) return escapeHtml(naLabel());
    var dec = lightDisplayDecimals(lightMode);
    if (r.unit === 'lx' || (String(lightMode || '') === 'raw_lux' && r.source === 'lux')) {
      return escapeHtml(fmtFixed(r.primary, dec)) + ' <span class="iaq-sensor-card__unit">lx</span>';
    }
    return escapeHtml(fmtFixed(r.primary, dec));
  }

  function pmBandHint(latest, kind) {
    var x = kind === 'pm25' ? effectivePm25(latest || {}) : effectivePm10(latest || {});
    if (x === null) return '';
    var m = kind === 'pm25' ? pm25SeverityMod(latest) : pm10SeverityMod(latest);
    if (m.indexOf('unhealthy') !== -1) return t('poor', 'Poor');
    if (m.indexOf('elevated') !== -1) return t('moderate', 'Moderate');
    return t('good', 'Good');
  }

  function buildDetailPanel(sensor, latest, semTvoc, semLight, sev, warnsOpt) {
    latest = latest || {};
    var warns = Array.isArray(warnsOpt) ? warnsOpt : collectWarnings(latest, semTvoc, semLight);
    var availability = metricAvailabilityMap(latest, semLight);
    var healthMeta = telemetryHealthLabel(latest, availability);
    var coverageMeta = semanticCoverageLabel(availability);
    var primary = sensor.sensor_name || sensor.name || t('not_available_label', '—');
    var uid = sensor.sensor_uid || '—';
    var floorCode = sensor.sensor_location || '—';
    var floorLbl = floorTitle(floorCode, sensor.sensor_location_label);
    var fresh = formatTimestamp(latest && latest.measured_at);
    var vent = ventilationBandFromCo2(effectiveCo2(latest)) || '';
    var thermal = thermalComfortState(latest) || '';
    var env = environmentalSafetyNarrative(latest, semTvoc);
    var lightN = lightingNarrative(latest, semLight);

    var lblCo2 = t('labels_co2', 'CO₂');
    var lblT = t('temperature_label', 'Temperature');
    var lblH = t('humidity_label', 'Humidity');
    var lblPm25 = t('labels_pm25', 'PM2.5');
    var lblPm10 = t('labels_pm10', 'PM10');

    var co2Val = effectiveCo2(latest);
    var co2Main = co2Val === null ? escapeHtml(naLabel()) : escapeHtml(fmtFixed(co2Val, 0));

    var tVal = effectiveTemp(latest);
    var tMain = tVal === null ? escapeHtml(naLabel()) : escapeHtml(fmtFixed(tVal, 1));
    var tHint = thermal || '';

    var hVal = effectiveRh(latest);
    var hMain = hVal === null ? escapeHtml(naLabel()) : escapeHtml(fmtFixed(hVal, 0));

    var ep25 = effectivePm25(latest);
    var p25Main = ep25 === null ? escapeHtml(naLabel()) : escapeHtml(fmtFixed(ep25, 1));
    var p25Hint = pmBandHint(latest, 'pm25');

    var ep10 = effectivePm10(latest);
    var p10Main = ep10 === null ? escapeHtml(naLabel()) : escapeHtml(fmtFixed(ep10, 1));
    var p10Hint = pmBandHint(latest, 'pm10');

    var tvVal = effectiveTvoc(latest);
    var tvMain = escapeHtml(naLabel());
    var tvUnit = '';
    var tvHint = '';
    if (tvVal !== null) {
      if (String(semTvoc) === 'raw_tvoc_ugm3') {
        tvMain = escapeHtml(fmtFixed(tvVal, 1));
        tvUnit = 'µg/m³';
      } else {
        tvMain = escapeHtml(fmtFixed(tvVal, 2));
        tvHint = tvocRatingLabel(tvVal);
      }
    }

    var lightRes = effectiveLightForDisplay(latest, semLight);
    var lMain = lightRes.primary === null
      ? escapeHtml(naLabel())
      : escapeHtml(fmtFixed(lightRes.primary, lightDisplayDecimals(semLight)));
    var lUnit = (String(semLight) === 'raw_lux' && lightRes.source === 'lux') ? 'lx' : (lightRes.unit || '');
    var lHint = lightN;
    if (lightRes.hint) {
      lHint = lHint ? (lHint + ' · ' + lightRes.hint) : lightRes.hint;
    }

    var warnBlock = '';
    if (warns.length) {
      warnBlock =
        '<div class="iaq-detail__block iaq-detail__block--warnings">' +
        '<div class="iaq-detail__block-title">' + escapeHtml(t('iaq_sensor_breakdown_warnings', 'Warnings')) + '</div>' +
        '<div class="iaq-detail__warn-chips">' +
        warns.map(function (w) {
          return '<span class="iaq-detail__warn-chip" role="status">' + escapeHtml(w.text) + '</span>';
        }).join('') +
        '</div></div>';
    }

    return (
      '<div class="iaq-detail" role="region" aria-label="' + escapeHtml(t('iaq_sensor_breakdown_details_title', 'Sensor details')) + '">' +
      '<div class="iaq-detail__block iaq-detail__block--identity">' +
      '<div class="iaq-detail__identity-head">' +
      '<div class="iaq-detail__identity-names">' +
      '<div class="iaq-detail__name">' + escapeHtml(primary) + '</div>' +
      '<div class="iaq-detail__sub">' +
      '<code class="iaq-detail__uid">' + escapeHtml(uid) + '</code>' +
      '<span class="iaq-detail__idsep"> · </span>' +
      '<span class="iaq-detail__idnum">#' + escapeHtml(String(sensor.id)) + '</span>' +
      '</div>' +
      '<div class="iaq-detail__floorline">' + escapeHtml(floorLbl) +
      ' <span class="iaq-detail__codepill">' + escapeHtml(floorCodeDisplay(floorCode)) + '</span></div>' +
      '<div class="iaq-detail__fresh">' + escapeHtml(t('iaq_sensor_breakdown_last_update', 'Last update')) +
      ': <span class="iaq-detail__time">' + escapeHtml(fresh) + '</span></div>' +
      '<div class="iaq-detail__healthline">' + escapeHtml(healthMeta.label) + ' · ' + escapeHtml(coverageMeta) + '</div>' +
      '</div>' +
      '<div class="iaq-detail__status-slot">' + statusChipForSeverity(sev) + '</div>' +
      '</div>' +

      '<div class="iaq-detail__block">' +
      '<div class="iaq-detail__block-title">' + escapeHtml(t('iaq_sensor_breakdown_latest_readings', 'Latest readings')) + '</div>' +
      '<div class="iaq-detail__measure-grid">' +
      miniMetricDetail(lblCo2, co2Main, 'ppm', vent, co2SeverityMod(latest)) +
      miniMetricDetail(lblT, tMain, '°C', tHint, thermalSeverityMod(latest)) +
      miniMetricDetail(lblH, hMain, '%', '', thermalSeverityMod(latest)) +
      miniMetricDetail(lblPm25, p25Main, 'µg/m³', p25Hint, pm25SeverityMod(latest)) +
      miniMetricDetail(lblPm10, p10Main, 'µg/m³', p10Hint, pm10SeverityMod(latest)) +
      miniMetricDetail(tvocColumnTitle(), tvMain, tvUnit, tvHint, tvocSeverityMod(latest, semTvoc)) +
      miniMetricDetail(lightColumnTitle(), lMain, lUnit, lHint, lightingSeverityFromLatest(latest, semLight)) +
      '</div></div>' +

      '<div class="iaq-detail__block">' +
      '<div class="iaq-detail__block-title">' + escapeHtml(t('iaq_sensor_breakdown_semantic_title', 'Interpretation')) + '</div>' +
      '<div class="iaq-detail__semantic-grid">' +
      semanticPill(t('ventilation_quality_index', 'Ventilation quality'), vent || t('insufficient_data', 'insufficient data')) +
      semanticPill(t('iaq_sensor_breakdown_thermal_comfort', 'Thermal comfort'), thermal || t('insufficient_data', 'insufficient data')) +
      semanticPill(t('iaq_sensor_breakdown_environmental_safety', 'Environmental safety'), env) +
      semanticPill(t('iaq_sensor_breakdown_lighting_condition', 'Lighting condition'), lightN) +
      '</div></div>' +
      warnBlock +
      '</div>'
    );
  }

  function collapsedMetricHtml(val, decimals, suffixHtml) {
    if (val === null) return escapeHtml(naLabel());
    return escapeHtml(fmtFixed(val, decimals)) + suffixHtml;
  }

  function detailCacheSignature(vm) {
    var loc = activeLocation() || '';
    return loc + '\u0001' + String(vm.sensor.id) + '\u0001' + String((vm.latest && vm.latest.measured_at) || '')
      + '\u0001' + String(vm.semTvoc || '') + '\u0001' + String(vm.semLight || '');
  }

  function buildIaqSensorViewModel(sensor, semTvoc, semLight) {
    var latest = normalizeLatestLocal(sensor.latest);
    var warns = collectWarnings(latest, semTvoc, semLight);
    return {
      sensor: sensor,
      id: String(sensor.id),
      latest: latest,
      semTvoc: semTvoc,
      semLight: semLight,
      warns: warns,
      sev: worstSeverity(warns)
    };
  }

  function buildSensorCardSummary(vm) {
    var sensor = vm.sensor;
    var latest = vm.latest;
    var semTvoc = vm.semTvoc;
    var semLight = vm.semLight;
    var warns = vm.warns;
    var sev = vm.sev;
    var primary = sensor.sensor_name || sensor.name || t('not_available_label', '—');
    var uid = sensor.sensor_uid || '—';
    var freshness = formatTimestamp(latest.measured_at);
    var warnBadges = warns.map(function (w) {
      return '<span class="iaq-sensor-card__warn-badge">' + escapeHtml(w.text) + '</span>';
    }).join('');
    var fallbackBadge = readingsFallbackBadgeHtml(latest);
    var badgeRow = warnBadges || fallbackBadge
      ? '<span class="iaq-sensor-card__badges">' + warnBadges + fallbackBadge + '</span>'
      : '';

    var co2Collapsed = collapsedMetricHtml(effectiveCo2(latest), 0, '<span class="iaq-mini-metric__suffix"> ppm</span>');
    var tCollapsed = collapsedMetricHtml(effectiveTemp(latest), 1, '<span class="iaq-mini-metric__suffix"> °C</span>');
    var hCollapsed = collapsedMetricHtml(effectiveRh(latest), 0, '<span class="iaq-mini-metric__suffix"> %</span>');
    var pm25Collapsed = collapsedMetricHtml(effectivePm25(latest), 1, '<span class="iaq-mini-metric__suffix"> µg/m³</span>');
    var pm10Collapsed = collapsedMetricHtml(effectivePm10(latest), 1, '<span class="iaq-mini-metric__suffix"> µg/m³</span>');
    var tvCollapsed = formatTvocDisplay(latest, semTvoc);
    var liCollapsed = formatLightDisplay(latest, semLight);

    return (
      '<article class="iaq-sensor-card" data-sensor-id="' + escapeHtml(String(sensor.id)) + '">' +
      '<button type="button" class="iaq-sensor-card__trigger" aria-expanded="false">' +
      '<span class="iaq-sensor-card__main">' +
      '<span class="iaq-sensor-card__identity">' +
      '<span class="iaq-sensor-card__name">' + escapeHtml(primary) + '</span>' +
      '<span class="iaq-sensor-card__secondary">' + escapeHtml(uid) + '</span>' +
      '<span class="iaq-sensor-card__secondary">' + escapeHtml(t('iaq_sensor_breakdown_last_update', 'Last update')) + ': ' + escapeHtml(freshness) + '</span>' +
      badgeRow +
      '</span>' +
      '<span class="iaq-sensor-card__metrics iaq-sensor-card__metrics--dense">' +
      miniMetricCollapsed(t('labels_co2', 'CO₂'), co2Collapsed, ICON_CO2, co2SeverityMod(latest)) +
      miniMetricCollapsed(t('temperature_label', 'Temperature'), tCollapsed, ICON_TEMP, thermalSeverityMod(latest)) +
      miniMetricCollapsed(t('humidity_label', 'Humidity'), hCollapsed, ICON_HUM, thermalSeverityMod(latest)) +
      miniMetricCollapsed(t('labels_pm25', 'PM2.5'), pm25Collapsed, ICON_PM, pm25SeverityMod(latest)) +
      miniMetricCollapsed(t('labels_pm10', 'PM10'), pm10Collapsed, ICON_PM, pm10SeverityMod(latest)) +
      miniMetricCollapsed(tvocColumnTitle(), tvCollapsed, ICON_TVOC, tvocSeverityMod(latest, semTvoc)) +
      miniMetricCollapsed(lightColumnTitle(), liCollapsed, ICON_LUX, lightingSeverityFromLatest(latest, semLight)) +
      '</span>' +
      '<span class="iaq-sensor-card__side">' + statusChipForSeverity(sev) + '<span class="iaq-sensor-card__chevron" aria-hidden="true">›</span></span>' +
      '</span>' +
      '</button>' +
      '<div class="iaq-sensor-card__details" hidden>' +
      '<div class="iaq-sensor-card__details-inner" data-iaq-detail-ready="0"></div>' +
      '</div></article>'
    );
  }

  function ensureSensorDetail(card, container) {
    var inner = card.querySelector('.iaq-sensor-card__details-inner');
    if (!inner || inner.getAttribute('data-iaq-detail-ready') === '1') return;
    var id = String(card.getAttribute('data-sensor-id') || '');
    var vm = container.__smacaIaqVmById && container.__smacaIaqVmById[id];
    if (!vm) return;
    var sig = detailCacheSignature(vm);
    if (!container.__smacaIaqDetailHtmlCache) container.__smacaIaqDetailHtmlCache = {};
    var cache = container.__smacaIaqDetailHtmlCache;
    var hit = cache[id];
    var html;
    if (hit && hit.sig === sig && hit.html) {
      html = hit.html;
    } else {
      html = buildDetailPanel(vm.sensor, vm.latest, vm.semTvoc, vm.semLight, vm.sev, vm.warns);
      cache[id] = { sig: sig, html: html };
    }
    inner.innerHTML = html;
    inner.setAttribute('data-iaq-detail-ready', '1');
    debugIaqTvocLight(vm.sensor, vm.latest, vm.semTvoc, vm.semLight);
  }

  function buildIaqBreakdownSkeleton() {
    return (
      '<div class="iaq-breakdown-skeleton" aria-hidden="true">' +
      '<div class="iaq-skeleton-row iaq-skeleton-row--wide"></div>' +
      '<div class="iaq-skeleton-row iaq-skeleton-row--mid"></div>' +
      '<div class="iaq-skeleton-row iaq-skeleton-row--wide"></div>' +
      '</div>'
    );
  }

  function iaqBreakdownFingerprint(iaqList, semTvoc, semLight) {
    var scope = activeLocation() || '';
    var parts = [scope, semTvoc, semLight];
    for (var i = 0; i < iaqList.length; i++) {
      var s = iaqList[i];
      var latest = s && s.latest ? s.latest : {};
      var ts = latest.measured_at || latest.snapshot_at || latest.updated_at || '';
      parts.push(String(s.id) + ':' + String(ts));
    }
    return parts.join('|');
  }

  function renderVirtualSensorList(listEl, items, buildHtml, options) {
    if (!listEl) return;
    if (typeof listEl.__smacaVirtualDestroy === 'function') {
      listEl.__smacaVirtualDestroy();
      listEl.__smacaVirtualDestroy = null;
    }
    if (global.SMACAListVirtual && typeof global.SMACAListVirtual.renderVisible === 'function') {
      var handle = global.SMACAListVirtual.renderVisible(listEl, items, buildHtml, options || {});
      listEl.__smacaVirtualDestroy = handle && typeof handle.destroy === 'function' ? handle.destroy : null;
      return;
    }
    listEl.innerHTML = items.map(function (item, idx) {
      return buildHtml(item, idx);
    }).join('');
  }

  function renderIaqFloorCards(floorEl, container) {
    if (!floorEl || !container || floorEl.getAttribute('data-floor-cards-ready') === '1') return;
    var floorCode = floorEl.getAttribute('data-floor-code');
    var groups = container.__smacaIaqGroups;
    if (!groups || !groups[floorCode]) return;
    var list = groups[floorCode];
    var vms = [];
    for (var i = 0; i < list.length; i++) {
      var vm = container.__smacaIaqVmById && container.__smacaIaqVmById[String(list[i].id)];
      if (vm) vms.push(vm);
    }
    var listEl = floorEl.querySelector('.iaq-sensor-list');
    if (listEl) {
      renderVirtualSensorList(listEl, vms, function (vm) {
        return buildSensorCardSummary(vm);
      }, { threshold: 12, rowHeight: 128 });
    }
    floorEl.setAttribute('data-floor-cards-ready', '1');
  }

  function bindGroupInteractions(container) {
    if (!container || container.__smacaIaqGroupsBound) return;
    container.__smacaIaqGroupsBound = true;
    function setFloorState(floor, open) {
      if (!floor) return;
      floor.classList.toggle('is-open', open);
      var trigger = floor.querySelector('.iaq-sensor-floor__trigger');
      var body = floor.querySelector('.iaq-sensor-floor__body');
      if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (body) body.hidden = !open;
      if (open) renderIaqFloorCards(floor, container);
      var floorCode = floor.getAttribute('data-floor-code');
      if (!floorCode) return;
      if (!container.__smacaFloorState) container.__smacaFloorState = {};
      container.__smacaFloorState[floorCode] = open;
    }
    container.addEventListener('click', function (event) {
      var floorTrigger = event.target.closest('.iaq-sensor-floor__trigger');
      if (floorTrigger) {
        var floor = floorTrigger.closest('.iaq-sensor-floor');
        if (floor) {
          var willOpen = !floor.classList.contains('is-open');
          if (willOpen) {
            var openFloors = container.querySelectorAll('.iaq-sensor-floor.is-open');
            for (var fi = 0; fi < openFloors.length; fi++) {
              if (openFloors[fi] !== floor) setFloorState(openFloors[fi], false);
            }
          }
          setFloorState(floor, willOpen);
        }
        return;
      }
      var cardTrigger = event.target.closest('.iaq-sensor-card__trigger');
      if (!cardTrigger) return;
      var card = cardTrigger.closest('.iaq-sensor-card');
      if (!card) return;
      var details = card.querySelector('.iaq-sensor-card__details');
      var open = !card.classList.contains('is-open');
      if (open) {
        var listRoot = card.closest('.iaq-sensor-list');
        if (listRoot) {
          var openCards = listRoot.querySelectorAll('.iaq-sensor-card.is-open');
          for (var oci = 0; oci < openCards.length; oci++) {
            var oc = openCards[oci];
            if (oc === card) continue;
            oc.classList.remove('is-open');
            var ot = oc.querySelector('.iaq-sensor-card__trigger');
            var od = oc.querySelector('.iaq-sensor-card__details');
            if (ot) ot.setAttribute('aria-expanded', 'false');
            if (od) od.hidden = true;
          }
        }
        ensureSensorDetail(card, container);
      }
      card.classList.toggle('is-open', open);
      cardTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (details) details.hidden = !open;
    });
    container.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var floorTrigger = event.target.closest('.iaq-sensor-floor__trigger');
      if (floorTrigger) {
        event.preventDefault();
        floorTrigger.click();
        return;
      }
      var cardTrigger = event.target.closest('.iaq-sensor-card__trigger');
      if (cardTrigger) {
        event.preventDefault();
        cardTrigger.click();
      }
    });
  }

  var IAQ_REFRESH_DEBOUNCE_MS = 220;
  var iaqRefreshDebounceTimer = null;
  var iaqRefreshDebounceTick = 0;
  var iaqSensorsFetchId = 0;

  function refresh() {
    iaqRefreshDebounceTick += 1;
    var tick = iaqRefreshDebounceTick;
    if (iaqRefreshDebounceTimer) clearTimeout(iaqRefreshDebounceTimer);
    iaqRefreshDebounceTimer = setTimeout(function () {
      iaqRefreshDebounceTimer = null;
      if (tick !== iaqRefreshDebounceTick) return;
      refreshExecute();
    }, IAQ_REFRESH_DEBOUNCE_MS);
  }

  function refreshExecute() {
    var container = document.getElementById('iaq-sensor-groups');
    if (!container) return;
    var api = global.SMACAApi;
    if (!api || typeof api.fetchSensors !== 'function') return;

    iaqSensorsFetchId += 1;
    var fetchId = iaqSensorsFetchId;
    container.hidden = false;
    container.innerHTML = buildIaqBreakdownSkeleton();
    container.classList.add('iaq-sensor-groups--skeleton');
    container.setAttribute('aria-busy', 'true');

    api.fetchSensors().then(function (payload) {
      if (fetchId !== iaqSensorsFetchId) return;
      var rowsAll = (payload && Array.isArray(payload.rows)) ? payload.rows : [];
      var scoped = rowsAll.filter(sensorMatchesScope);
      var iaqList = scoped.filter(isIaqSensor);
      var sem = iaqSemantics();
      var semTvoc = String(sem.tvoc_semantic_mode || 'iaq_rating_level');
      var semLight = String(sem.light_semantic_mode || 'normalized_level_0_5');

      container.classList.remove('iaq-sensor-groups--skeleton');
      container.removeAttribute('aria-busy');

      var nextFingerprint = iaqBreakdownFingerprint(iaqList, semTvoc, semLight);
      if (
        container.__smacaIaqFingerprint === nextFingerprint &&
        container.querySelector('.iaq-sensor-floor')
      ) {
        return;
      }
      container.__smacaIaqFingerprint = nextFingerprint;

      if (!iaqList.length) {
        container.innerHTML = '<p class="overview-live-note">' + escapeHtml(t('iaq_sensor_breakdown_no_sensors', 'No IAQ sensors in this scope')) + '</p>';
        container.__smacaIaqVmById = {};
        container.__smacaIaqDetailHtmlCache = {};
        return;
      }

      container.__smacaIaqVmById = {};
      container.__smacaIaqDetailHtmlCache = {};
      for (var vi = 0; vi < iaqList.length; vi++) {
        var vm0 = buildIaqSensorViewModel(iaqList[vi], semTvoc, semLight);
        container.__smacaIaqVmById[vm0.id] = vm0;
      }

      var groups = {};
      for (var i = 0; i < iaqList.length; i++) {
        var s = iaqList[i];
        var code = s.sensor_location || '—';
        if (!groups[code]) groups[code] = [];
        groups[code].push(s);
      }
      container.__smacaIaqGroups = groups;

      var floorCodes = Object.keys(groups).sort(function (a, b) {
        var w = floorSortWeight(a) - floorSortWeight(b);
        if (w !== 0) return w;
        return String(a).localeCompare(String(b));
      });

      var sections = floorCodes.map(function (floorCode, floorIdx) {
        var list = groups[floorCode];
        var vms = list.map(function (s) {
          return container.__smacaIaqVmById[String(s.id)];
        });
        var co2Avg = avgNums(vms.map(function (vm) { return effectiveCo2(vm.latest); }));
        var tAvg = avgNums(vms.map(function (vm) { return effectiveTemp(vm.latest); }));

        var groupWarns = [];
        for (var gi = 0; gi < vms.length; gi++) {
          var warr = vms[gi].warns;
          for (var wj = 0; wj < warr.length; wj++) groupWarns.push(warr[wj]);
        }
        var concern = topConcernFromWarnings(groupWarns);

        var floorLabel = floorTitle(floorCode, list[0] && list[0].sensor_location_label);
        var codePill = floorCodeDisplay(floorCode);
        var isOpen = false;
        if (container.__smacaFloorState && Object.prototype.hasOwnProperty.call(container.__smacaFloorState, floorCode)) {
          isOpen = Boolean(container.__smacaFloorState[floorCode]);
        } else {
          isOpen = false;
        }

        var cards = isOpen
          ? vms.map(function (vm) {
            return buildSensorCardSummary(vm);
          }).join('')
          : '';

        return (
          '<section class="iaq-sensor-floor' + (isOpen ? ' is-open' : '') + '" data-floor-code="' + escapeHtml(floorCode) + '"' +
          (isOpen ? ' data-floor-cards-ready="1"' : '') + '>' +
          '<button type="button" class="iaq-sensor-floor__trigger" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
          '<span class="iaq-sensor-floor__left">' +
          '<span class="iaq-sensor-floor__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + floorIconSvg(floorCode) + '</svg></span>' +
          '<span class="iaq-sensor-floor__identity"><span class="iaq-sensor-floor__code">' + escapeHtml(codePill) + '</span><span class="iaq-sensor-floor__title">' + escapeHtml(floorLabel) + '</span></span>' +
          '</span>' +
          '<span class="iaq-sensor-floor__metrics iaq-sensor-floor__metrics--summary">' +
          '<span><small>' + escapeHtml(t('iaq_sensor_breakdown_sensor_count', 'IAQ sensors')) + '</small><strong>' + escapeHtml(String(list.length)) + '</strong></span>' +
          '<span><small>' + escapeHtml(t('iaq_sensor_breakdown_avg_co2', 'Average CO₂')) + '</small><strong>' + escapeHtml(co2Avg === null ? '—' : fmtFixed(co2Avg, 0) + ' ppm') + '</strong></span>' +
          '<span><small>' + escapeHtml(t('iaq_sensor_breakdown_avg_temperature', 'Average temperature')) + '</small><strong>' + escapeHtml(tAvg === null ? '—' : fmtFixed(tAvg, 1) + ' °C') + '</strong></span>' +
          '<span><small>' + escapeHtml(t('iaq_sensor_breakdown_top_concern', 'Top concern')) + '</small><strong>' + escapeHtml(concern) + '</strong></span>' +
          '</span>' +
          '<span class="iaq-sensor-floor__right">' +
          '<span class="iaq-sensor-floor__count-badge">' + escapeHtml(String(list.length)) + '</span>' +
          '<span class="iaq-sensor-floor__chevron" aria-hidden="true">⌄</span>' +
          '</span>' +
          '</button>' +
          '<div class="iaq-sensor-floor__body"' + (isOpen ? '' : ' hidden') + '>' +
          '<div class="iaq-sensor-list">' + cards + '</div>' +
          '</div>' +
          '</section>'
        );
      });

      container.innerHTML = sections.join('');
      bindGroupInteractions(container);
      floorCodes.forEach(function (floorCode) {
        if (!container.__smacaFloorState || !container.__smacaFloorState[floorCode]) return;
        var floors = container.querySelectorAll('.iaq-sensor-floor');
        for (var fi = 0; fi < floors.length; fi++) {
          if (floors[fi].getAttribute('data-floor-code') === floorCode) {
            renderIaqFloorCards(floors[fi], container);
            break;
          }
        }
      });
    }).catch(function () {
      if (fetchId !== iaqSensorsFetchId) return;
      container.classList.remove('iaq-sensor-groups--skeleton');
      container.removeAttribute('aria-busy');
      container.innerHTML = '<p class="overview-live-note">' + escapeHtml(t('no_iaq_data', 'No IAQ data')) + '</p>';
      container.__smacaIaqVmById = {};
      container.__smacaIaqDetailHtmlCache = {};
    });
  }

  function evaluateTelemetryConfidence(latest, semLight) {
    latest = latest || {};
    return {
      stale_snapshot: isStaleLatest(latest),
      co2_trusted: effectiveCo2(latest) !== null,
      pm_trusted: effectivePm25(latest) !== null || effectivePm10(latest) !== null,
      tvoc_trusted: effectiveTvoc(latest) !== null,
      light_resolved: effectiveLightForDisplay(latest, semLight),
      thermal_trusted: effectiveTemp(latest) !== null || effectiveRh(latest) !== null
    };
  }

  global.SMACAIaqSensorBreakdown = {
    refresh: refresh,
    telemetryValidation: {
      rawMetricPresence: rawMetricPresence,
      effectiveNumeric: effectiveNumeric,
      measuredAgeMs: measuredAgeMs,
      isStaleLatest: isStaleLatest,
      metricAvailabilityMap: metricAvailabilityMap,
      telemetryHealthLabel: telemetryHealthLabel,
      semanticCoverageLabel: semanticCoverageLabel,
      collectThermalWarningsDetailed: collectThermalWarningsDetailed,
      evaluateTelemetryConfidence: evaluateTelemetryConfidence,
      effectiveCo2: effectiveCo2,
      effectivePm25: effectivePm25,
      effectivePm10: effectivePm10,
      effectiveTvoc: effectiveTvoc,
      effectiveLightForDisplay: effectiveLightForDisplay
    }
  };
})(typeof window !== 'undefined' ? window : this);
