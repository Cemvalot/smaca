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

  /** Same inclusion rule as `smaca-telemetry-bootstrap.js` IAQ tiles. */
  function isIaqSensor(s) {
    if (!s) return false;
    if (s.device_type === 'iaq') return true;
    var lat = s.latest || {};
    return isFiniteNum(toNum(lat.co2_ppm))
      || isFiniteNum(toNum(lat.pm2_5_ugm3))
      || isFiniteNum(toNum(lat.tvoc_index));
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

  function thermalComfortState(temp, rh) {
    var tC = toNum(temp);
    var rH = toNum(rh);
    var hasT = tC !== null;
    var hasH = rH !== null;
    if (!hasT && !hasH) return null;
    var okT = !hasT || (tC >= 20 && tC <= 24);
    var okH = !hasH || (rH >= 40 && rH <= 60);
    if (okT && okH) return t('iaq_sensor_breakdown_thermal_comfortable', 'Within comfort range');
    return t('iaq_sensor_breakdown_thermal_uncomfortable', 'Outside comfort range');
  }

  function environmentalSafetyNarrative(pm25, pm10, tvoc, tvocMode) {
    var pm25U = toNum(pm25) !== null && toNum(pm25) > 35.4;
    var pm10U = toNum(pm10) !== null && toNum(pm10) > 154;
    var tv = toNum(tvoc);
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

  function lightingNarrative(lightMode, lightLevel, lux) {
    var mode = String(lightMode || 'normalized_level_0_5');
    if (mode === 'raw_lux') {
      var lx = toNum(lux);
      if (lx === null) return t('insufficient_data', 'insufficient data');
      if (lx < 80) return t('iaq_lighting_level_minimal', 'Minimal light');
      if (lx > 2500) return t('iaq_lighting_level_intense', 'Intense lighting');
      return t('iaq_lighting_level_office', 'Office lighting');
    }
    var lv = toNum(lightLevel);
    if (lv === null) return t('insufficient_data', 'insufficient data');
    var labels = ['minimal', 'dim_indoor', 'residential', 'office', 'detailed_work', 'intense'];
    var idx = Math.round(lv);
    if (idx < 0) idx = 0;
    if (idx > 5) idx = 5;
    var k = labels[idx];
    return t('iaq_lighting_level_' + k, k);
  }

  function tvocRatingLabel(v) {
    var x = toNum(v);
    if (x === null) return '—';
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
    var co2 = toNum(latest && latest.co2_ppm);
    if (co2 !== null) {
      if (co2 >= 2000) w.push({ sev: 4, text: t('iaq_sensor_breakdown_warn_co2_critical', 'CO₂ critical (≥2000 ppm)') });
      if (co2 >= 1000) w.push({ sev: 3, text: t('iaq_sensor_breakdown_warn_co2_high', 'CO₂ elevated (≥1000 ppm)') });
    }
    var pm25 = toNum(latest && latest.pm2_5_ugm3);
    if (pm25 !== null && pm25 > 35.4) {
      w.push({ sev: 3, text: t('iaq_sensor_breakdown_warn_pm25', 'PM2.5 unhealthy (>35.4 µg/m³)') });
    }
    var pm10 = toNum(latest && latest.pm10_ugm3);
    if (pm10 !== null && pm10 > 154) {
      w.push({ sev: 3, text: t('iaq_sensor_breakdown_warn_pm10', 'PM10 unhealthy (>154 µg/m³)') });
    }
    var tvoc = toNum(latest && latest.tvoc_index);
    if (tvoc !== null) {
      if (String(tvocMode || '') === 'raw_tvoc_ugm3') {
        if (tvoc >= 1000) w.push({ sev: 4, text: t('iaq_sensor_breakdown_warn_tvoc_critical', 'TVOC high') });
        else if (tvoc >= 250) w.push({ sev: 2, text: t('iaq_sensor_breakdown_warn_tvoc', 'TVOC elevated') });
      } else {
        if (tvoc >= 4.99) w.push({ sev: 4, text: t('iaq_sensor_breakdown_warn_tvoc_critical', 'TVOC high') });
        else if (tvoc >= 3.99) w.push({ sev: 2, text: t('iaq_sensor_breakdown_warn_tvoc', 'TVOC elevated') });
      }
    }
    var temp = toNum(latest && latest.temperature_c);
    var rh = toNum(latest && latest.humidity_rh);
    var hasT = temp !== null;
    var hasH = rh !== null;
    if (hasT || hasH) {
      var okT = !hasT || (temp >= 20 && temp <= 24);
      var okH = !hasH || (rh >= 40 && rh <= 60);
      if (!okT || !okH) w.push({ sev: 2, text: t('iaq_sensor_breakdown_warn_thermal', 'Thermal comfort off target') });
    }
    var lMode = String(lightMode || 'normalized_level_0_5');
    if (lMode === 'raw_lux') {
      var lx = toNum(latest && latest.lux);
      if (lx !== null && (lx < 80 || lx > 2500)) {
        w.push({ sev: 2, text: t('iaq_sensor_breakdown_warn_lighting', 'Lighting outside comfortable range') });
      }
    } else {
      var ll = toNum(latest && latest.light_level);
      if (ll !== null && (ll <= 1 || ll >= 5)) {
        w.push({ sev: 2, text: t('iaq_sensor_breakdown_warn_lighting', 'Lighting outside comfortable range') });
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
    var sorted = warnings.slice().sort(function (a, b) { return b.sev - a.sev; });
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
  function co2SeverityMod(ppm) {
    var p = toNum(ppm);
    if (p === null) return 'iaq-sev--na';
    if (p >= 2000) return 'iaq-sev--co2-critical';
    if (p >= 1000) return 'iaq-sev--co2-warning';
    return 'iaq-sev--co2-good';
  }

  function pm25SeverityMod(v) {
    var x = toNum(v);
    if (x === null) return 'iaq-sev--na';
    if (x > 35.4) return 'iaq-sev--pm-unhealthy';
    if (x > 12) return 'iaq-sev--pm-elevated';
    return 'iaq-sev--pm-healthy';
  }

  function pm10SeverityMod(v) {
    var x = toNum(v);
    if (x === null) return 'iaq-sev--na';
    if (x > 154) return 'iaq-sev--pm-unhealthy';
    if (x > 54) return 'iaq-sev--pm-elevated';
    return 'iaq-sev--pm-healthy';
  }

  function thermalSeverityMod(temp, rh) {
    var tC = toNum(temp);
    var rH = toNum(rh);
    var hasT = tC !== null;
    var hasH = rH !== null;
    if (!hasT && !hasH) return 'iaq-sev--na';
    var okT = !hasT || (tC >= 20 && tC <= 24);
    var okH = !hasH || (rH >= 40 && rH <= 60);
    return okT && okH ? 'iaq-sev--thermal-ok' : 'iaq-sev--thermal-bad';
  }

  function lightingSeverityMod(lightMode, lightLevel, lux) {
    var mode = String(lightMode || 'normalized_level_0_5');
    if (mode === 'raw_lux') {
      var lx = toNum(lux);
      if (lx === null) return 'iaq-sev--na';
      if (lx < 80) return 'iaq-sev--light-minimal';
      if (lx > 2500) return 'iaq-sev--light-intense';
      return 'iaq-sev--light-office';
    }
    var lv = toNum(lightLevel);
    if (lv === null) return 'iaq-sev--na';
    if (lv <= 1) return 'iaq-sev--light-minimal';
    if (lv >= 5) return 'iaq-sev--light-intense';
    return 'iaq-sev--light-office';
  }

  function tvocSeverityMod(v, tvocMode) {
    var x = toNum(v);
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
    var v = toNum(latest && latest.tvoc_index);
    if (v === null) return '—';
    if (String(tvocMode || '') === 'raw_tvoc_ugm3') {
      return escapeHtml(fmtFixed(v, 1)) + ' <span class="iaq-sensor-card__unit">µg/m³</span>';
    }
    return escapeHtml(fmtFixed(v, 2)) + ' <span class="iaq-sensor-card__unit">(' + escapeHtml(tvocRatingLabel(v)) + ')</span>';
  }

  function formatLightDisplay(latest, lightMode) {
    if (String(lightMode || '') === 'raw_lux') {
      var lx = toNum(latest && latest.lux);
      return lx === null ? '—' : escapeHtml(fmtFixed(lx, 0)) + ' <span class="iaq-sensor-card__unit">lx</span>';
    }
    var ll = toNum(latest && latest.light_level);
    return ll === null ? '—' : escapeHtml(fmtFixed(ll, 0));
  }

  function pmBandHint(val, kind) {
    var x = toNum(val);
    if (x === null) return '';
    var m = kind === 'pm25' ? pm25SeverityMod(val) : pm10SeverityMod(val);
    if (m.indexOf('unhealthy') !== -1) return t('poor', 'Poor');
    if (m.indexOf('elevated') !== -1) return t('moderate', 'Moderate');
    return t('good', 'Good');
  }

  function buildDetailPanel(sensor, latest, semTvoc, semLight, sev) {
    var primary = sensor.sensor_name || sensor.name || t('not_available_label', '—');
    var uid = sensor.sensor_uid || '—';
    var floorCode = sensor.sensor_location || '—';
    var floorLbl = floorTitle(floorCode, sensor.sensor_location_label);
    var fresh = formatTimestamp(latest && latest.measured_at);
    var vent = ventilationBandFromCo2(latest.co2_ppm) || '';
    var thermal = thermalComfortState(latest.temperature_c, latest.humidity_rh) || '';
    var env = environmentalSafetyNarrative(latest.pm2_5_ugm3, latest.pm10_ugm3, latest.tvoc_index, semTvoc);
    var lightN = lightingNarrative(semLight, latest.light_level, latest.lux);

    var lblCo2 = t('labels_co2', 'CO₂');
    var lblT = t('temperature_label', 'Temperature');
    var lblH = t('humidity_label', 'Humidity');
    var lblPm25 = t('labels_pm25', 'PM2.5');
    var lblPm10 = t('labels_pm10', 'PM10');

    var co2Val = toNum(latest.co2_ppm);
    var co2Main = co2Val === null ? '—' : escapeHtml(fmtFixed(co2Val, 0));

    var tVal = toNum(latest.temperature_c);
    var tMain = tVal === null ? '—' : escapeHtml(fmtFixed(tVal, 1));
    var tHint = thermal || '';

    var hVal = toNum(latest.humidity_rh);
    var hMain = hVal === null ? '—' : escapeHtml(fmtFixed(hVal, 0));

    var p25Main = toNum(latest.pm2_5_ugm3) === null ? '—' : escapeHtml(fmtFixed(toNum(latest.pm2_5_ugm3), 1));
    var p25Hint = pmBandHint(latest.pm2_5_ugm3, 'pm25');

    var p10Main = toNum(latest.pm10_ugm3) === null ? '—' : escapeHtml(fmtFixed(toNum(latest.pm10_ugm3), 1));
    var p10Hint = pmBandHint(latest.pm10_ugm3, 'pm10');

    var tvVal = toNum(latest.tvoc_index);
    var tvMain = '—';
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

    var lMain = '—';
    var lUnit = '';
    var lHint = '';
    if (String(semLight) === 'raw_lux') {
      var lx = toNum(latest.lux);
      if (lx !== null) {
        lMain = escapeHtml(fmtFixed(lx, 0));
        lUnit = 'lx';
        lHint = lightN || '';
      }
    } else {
      var ll = toNum(latest.light_level);
      if (ll !== null) {
        lMain = escapeHtml(fmtFixed(ll, 0));
        lHint = lightN || '';
      }
    }

    var warns = collectWarnings(latest, semTvoc, semLight);
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
      '</div>' +
      '<div class="iaq-detail__status-slot">' + statusChipForSeverity(sev) + '</div>' +
      '</div>' +

      '<div class="iaq-detail__block">' +
      '<div class="iaq-detail__block-title">' + escapeHtml(t('iaq_sensor_breakdown_latest_readings', 'Latest readings')) + '</div>' +
      '<div class="iaq-detail__measure-grid">' +
      miniMetricDetail(lblCo2, co2Main, 'ppm', vent, co2SeverityMod(latest.co2_ppm)) +
      miniMetricDetail(lblT, tMain, '°C', tHint, thermalSeverityMod(latest.temperature_c, latest.humidity_rh)) +
      miniMetricDetail(lblH, hMain, '%', '', thermalSeverityMod(latest.temperature_c, latest.humidity_rh)) +
      miniMetricDetail(lblPm25, p25Main, 'µg/m³', p25Hint, pm25SeverityMod(latest.pm2_5_ugm3)) +
      miniMetricDetail(lblPm10, p10Main, 'µg/m³', p10Hint, pm10SeverityMod(latest.pm10_ugm3)) +
      miniMetricDetail(tvocColumnTitle(), tvMain, tvUnit, tvHint, tvocSeverityMod(latest.tvoc_index, semTvoc)) +
      miniMetricDetail(lightColumnTitle(), lMain, lUnit, lHint, lightingSeverityMod(semLight, latest.light_level, latest.lux)) +
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

  function buildSensorCard(sensor, semTvoc, semLight) {
    var latest = sensor.latest || {};
    var warns = collectWarnings(latest, semTvoc, semLight);
    var sev = worstSeverity(warns);
    var primary = sensor.sensor_name || sensor.name || t('not_available_label', '—');
    var uid = sensor.sensor_uid || '—';
    var freshness = formatTimestamp(latest.measured_at);
    var warnBadges = warns.map(function (w) {
      return '<span class="iaq-sensor-card__warn-badge">' + escapeHtml(w.text) + '</span>';
    }).join('');

    var co2Collapsed = toNum(latest.co2_ppm) === null ? '—' : escapeHtml(fmtFixed(toNum(latest.co2_ppm), 0)) + '<span class="iaq-mini-metric__suffix"> ppm</span>';
    var tCollapsed = toNum(latest.temperature_c) === null ? '—' : escapeHtml(fmtFixed(toNum(latest.temperature_c), 1)) + '<span class="iaq-mini-metric__suffix"> °C</span>';
    var hCollapsed = toNum(latest.humidity_rh) === null ? '—' : escapeHtml(fmtFixed(toNum(latest.humidity_rh), 0)) + '<span class="iaq-mini-metric__suffix"> %</span>';
    var pm25Collapsed = toNum(latest.pm2_5_ugm3) === null ? '—' : escapeHtml(fmtFixed(toNum(latest.pm2_5_ugm3), 1)) + '<span class="iaq-mini-metric__suffix"> µg/m³</span>';
    var pm10Collapsed = toNum(latest.pm10_ugm3) === null ? '—' : escapeHtml(fmtFixed(toNum(latest.pm10_ugm3), 1)) + '<span class="iaq-mini-metric__suffix"> µg/m³</span>';
    var tvCollapsed = formatTvocDisplay(latest, semTvoc);
    var liCollapsed = formatLightDisplay(latest, semLight);

    var detailsInner = buildDetailPanel(sensor, latest, semTvoc, semLight, sev);

    return (
      '<article class="iaq-sensor-card" data-sensor-id="' + escapeHtml(String(sensor.id)) + '">' +
      '<button type="button" class="iaq-sensor-card__trigger" aria-expanded="false">' +
      '<span class="iaq-sensor-card__main">' +
      '<span class="iaq-sensor-card__identity">' +
      '<span class="iaq-sensor-card__name">' + escapeHtml(primary) + '</span>' +
      '<span class="iaq-sensor-card__secondary">' + escapeHtml(uid) + '</span>' +
      '<span class="iaq-sensor-card__secondary">' + escapeHtml(t('iaq_sensor_breakdown_last_update', 'Last update')) + ': ' + escapeHtml(freshness) + '</span>' +
      (warnBadges ? '<span class="iaq-sensor-card__badges">' + warnBadges + '</span>' : '') +
      '</span>' +
      '<span class="iaq-sensor-card__metrics iaq-sensor-card__metrics--dense">' +
      miniMetricCollapsed(t('labels_co2', 'CO₂'), co2Collapsed, ICON_CO2, co2SeverityMod(latest.co2_ppm)) +
      miniMetricCollapsed(t('temperature_label', 'Temperature'), tCollapsed, ICON_TEMP, thermalSeverityMod(latest.temperature_c, latest.humidity_rh)) +
      miniMetricCollapsed(t('humidity_label', 'Humidity'), hCollapsed, ICON_HUM, thermalSeverityMod(latest.temperature_c, latest.humidity_rh)) +
      miniMetricCollapsed(t('labels_pm25', 'PM2.5'), pm25Collapsed, ICON_PM, pm25SeverityMod(latest.pm2_5_ugm3)) +
      miniMetricCollapsed(t('labels_pm10', 'PM10'), pm10Collapsed, ICON_PM, pm10SeverityMod(latest.pm10_ugm3)) +
      miniMetricCollapsed(tvocColumnTitle(), tvCollapsed, ICON_TVOC, tvocSeverityMod(latest.tvoc_index, semTvoc)) +
      miniMetricCollapsed(lightColumnTitle(), liCollapsed, ICON_LUX, lightingSeverityMod(semLight, latest.light_level, latest.lux)) +
      '</span>' +
      '<span class="iaq-sensor-card__side">' + statusChipForSeverity(sev) + '<span class="iaq-sensor-card__chevron" aria-hidden="true">›</span></span>' +
      '</span>' +
      '</button>' +
      '<div class="iaq-sensor-card__details" hidden>' +
      '<div class="iaq-sensor-card__details-inner">' +
      detailsInner +
      '</div></div>' +
      '</article>'
    );
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
      var floorCode = floor.getAttribute('data-floor-code');
      if (!floorCode) return;
      if (!container.__smacaFloorState) container.__smacaFloorState = {};
      container.__smacaFloorState[floorCode] = open;
    }
    container.addEventListener('click', function (event) {
      var floorTrigger = event.target.closest('.iaq-sensor-floor__trigger');
      if (floorTrigger) {
        var floor = floorTrigger.closest('.iaq-sensor-floor');
        if (floor) setFloorState(floor, !floor.classList.contains('is-open'));
        return;
      }
      var cardTrigger = event.target.closest('.iaq-sensor-card__trigger');
      if (!cardTrigger) return;
      var card = cardTrigger.closest('.iaq-sensor-card');
      if (!card) return;
      var details = card.querySelector('.iaq-sensor-card__details');
      var open = !card.classList.contains('is-open');
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
      }
    });
  }

  function refresh() {
    var container = document.getElementById('iaq-sensor-groups');
    if (!container) return;
    var api = global.SMACAApi;
    if (!api || typeof api.fetchSensors !== 'function') return;

    api.fetchSensors().then(function (payload) {
      var rowsAll = (payload && Array.isArray(payload.rows)) ? payload.rows : [];
      var scoped = rowsAll.filter(sensorMatchesScope);
      var iaqList = scoped.filter(isIaqSensor);
      var sem = iaqSemantics();
      var semTvoc = String(sem.tvoc_semantic_mode || 'iaq_rating_level');
      var semLight = String(sem.light_semantic_mode || 'normalized_level_0_5');

      if (!iaqList.length) {
        container.innerHTML = '<p class="overview-live-note">' + escapeHtml(t('iaq_sensor_breakdown_no_sensors', 'No IAQ sensors in this scope')) + '</p>';
        container.hidden = false;
        return;
      }

      var groups = {};
      for (var i = 0; i < iaqList.length; i++) {
        var s = iaqList[i];
        var code = s.sensor_location || '—';
        if (!groups[code]) groups[code] = [];
        groups[code].push(s);
      }

      var floorCodes = Object.keys(groups).sort(function (a, b) {
        var w = floorSortWeight(a) - floorSortWeight(b);
        if (w !== 0) return w;
        return String(a).localeCompare(String(b));
      });

      var sections = floorCodes.map(function (floorCode) {
        var list = groups[floorCode];
        var co2Avg = avgNums(list.map(function (x) { return x.latest && x.latest.co2_ppm; }));
        var tAvg = avgNums(list.map(function (x) { return x.latest && x.latest.temperature_c; }));

        var groupWarns = [];
        for (var gi = 0; gi < list.length; gi++) {
          var w = collectWarnings(list[gi].latest || {}, semTvoc, semLight);
          for (var wj = 0; wj < w.length; wj++) groupWarns.push(w[wj]);
        }
        var concern = topConcernFromWarnings(groupWarns);

        var floorLabel = floorTitle(floorCode, list[0] && list[0].sensor_location_label);
        var codePill = floorCodeDisplay(floorCode);
        var isOpen = false;
        if (container.__smacaFloorState && Object.prototype.hasOwnProperty.call(container.__smacaFloorState, floorCode)) {
          isOpen = Boolean(container.__smacaFloorState[floorCode]);
        } else {
          isOpen = floorCode === 'F0';
        }

        var cards = list.map(function (sensor) {
          return buildSensorCard(sensor, semTvoc, semLight);
        }).join('');

        return (
          '<section class="iaq-sensor-floor' + (isOpen ? ' is-open' : '') + '" data-floor-code="' + escapeHtml(floorCode) + '">' +
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
      container.hidden = false;
      bindGroupInteractions(container);
    }).catch(function () {
      container.innerHTML = '<p class="overview-live-note">' + escapeHtml(t('no_iaq_data', 'No IAQ data')) + '</p>';
      container.hidden = false;
    });
  }

  global.SMACAIaqSensorBreakdown = { refresh: refresh };
})(typeof window !== 'undefined' ? window : this);
