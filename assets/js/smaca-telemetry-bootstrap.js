/**
 * SMACA Telemetry Bootstrap
 * =========================
 *
 * Per-page populator for the new telemetry mini-card grids that the
 * module Blades expose under `<section class="card smaca-telemetry-card">`.
 *
 * Data sources (no new endpoints):
 *   - `/api/dashboard/overview` and `/api/sensors` (cached for 12s).
 *   - `/api/sensors/{id}/timeseries` (cached for 30s) for the spark
 *     micro-charts. Bootstraps reuse the cache aggressively, so the
 *     additional traffic is bounded even on dashboards that already
 *     rely heavily on these endpoints.
 *
 * Update lifecycle:
 *   - Boot on DOMContentLoaded → render all tiles for the current page.
 *   - Re-render on `smaca:scope-changed`, `smaca:timeframe-changed`,
 *     and `smaca:state-updated` so tiles stay in sync with the rest of
 *     the dashboard.
 *
 * Per-page boot functions are kept small and self-contained. They
 * depend on the global helpers `SMACAApi`, `SMACATelemetry`, and (for
 * locale-aware labels) `SMACASpatial`. Each helper returns the first
 * non-null value it can compute and shows a graceful "—" placeholder
 * when data is missing — never invented numbers.
 */
(function (global) {
  'use strict';

  if (!global) return;

  function api() { return global.SMACAApi || null; }
  function tile() { return global.SMACATelemetry || null; }

  function $(id) { return document.getElementById(id); }
  function $$ (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function activeSection() {
    var el = document.querySelector('.dashboard-section[id]');
    return el ? el.id : null;
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

  function maxOf(values) {
    var nums = values.filter(isFiniteNum);
    if (!nums.length) return null;
    return Math.max.apply(null, nums);
  }

  function fmt(value, decimals) {
    if (!isFiniteNum(value)) return null;
    var d = (decimals === undefined || decimals === null) ? 0 : decimals;
    return value.toFixed(d);
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

  // -----------------------------------------------------------------------
  // Icons (small set of inline SVG paths)
  // -----------------------------------------------------------------------
  var ICONS = {
    sensor:   '<rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
    co2:      '<path d="M12 3a9 9 0 109 9"/><path d="M12 7a5 5 0 105 5"/><circle cx="12" cy="12" r="1.4"/>',
    pm:       '<circle cx="6" cy="8" r="1.6"/><circle cx="14" cy="6" r="1.2"/><circle cx="10" cy="14" r="1.6"/><circle cx="18" cy="13" r="1.2"/><circle cx="8" cy="18" r="1.4"/>',
    tvoc:     '<path d="M12 2v6"/><path d="M5 9c2 4 5 6 7 6s5-2 7-6"/><path d="M5 14c2 4 5 6 7 6s5-2 7-6"/>',
    humidity: '<path d="M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z"/>',
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
    target:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>'
  };

  // -----------------------------------------------------------------------
  // Common fetch helpers
  // -----------------------------------------------------------------------
  function loadOverview() {
    var a = api(); if (!a) return Promise.resolve(null);
    return a.fetchDashboardOverview().catch(function () { return null; });
  }

  function loadSensors() {
    var a = api(); if (!a) return Promise.resolve(null);
    return a.fetchSensors().catch(function () { return null; });
  }

  function loadKpiSummary(module) {
    var a = api(); if (!a) return Promise.resolve(null);
    return a.fetchKpiSummary(module).catch(function () { return null; });
  }

  function loadTimeseries(sensorId, metric) {
    var a = api(); if (!a) return Promise.resolve(null);
    var tf = (global.SMACA_TIMEFRAME) || '24h';
    return a.fetchSensorTimeseries(sensorId, metric, tf).catch(function () { return null; });
  }

  function pointsToValues(points) {
    if (!Array.isArray(points)) return [];
    return points.map(function (p) { return toNumber(p && p.value); }).filter(isFiniteNum);
  }

  // -----------------------------------------------------------------------
  // Per-page boots
  // -----------------------------------------------------------------------

  function bootOverview() {
    var grid = document.querySelector('[data-smaca-telemetry="overview"]');
    if (!grid) return;
    Promise.all([loadOverview(), loadSensors()]).then(function (results) {
      var overview = results[0] || {};
      var sensors = (results[1] && Array.isArray(results[1].rows)) ? results[1].rows : [];

      var totalSensors = sensors.length || (overview.totals && overview.totals.sensors) || null;
      var activeSensors = sensors.filter(function (s) { return s && s.is_active; }).length;
      var alerts = (overview.totals && overview.totals.active_alerts) || 0;
      var minutesAgo = relativeMinutes(overview.latest_update_at);

      var iaqLatest = sensors
        .filter(function (s) { return s && s.latest && isFiniteNum(toNumber(s.latest.co2_ppm)); })
        .map(function (s) { return toNumber(s.latest.co2_ppm); });
      var co2Avg = avg(iaqLatest);

      var movementSensors = sensors
        .filter(function (s) { return s && s.latest && (isFiniteNum(toNumber(s.latest.people_in)) || isFiniteNum(toNumber(s.latest.people_out))); });
      var totalIn = movementSensors.reduce(function (acc, s) { return acc + (toNumber(s.latest.people_in) || 0); }, 0);
      var totalOut = movementSensors.reduce(function (acc, s) { return acc + (toNumber(s.latest.people_out) || 0); }, 0);
      var movementNow = movementSensors.length ? (totalIn + totalOut) : null;

      var uvLatest = sensors
        .filter(function (s) { return s && s.latest && isFiniteNum(toNumber(s.latest.uv_index)); })
        .map(function (s) { return toNumber(s.latest.uv_index); });
      var uvNow = avg(uvLatest);

      var renderOne = function (id, opts) {
        var el = grid.querySelector('[data-tile="' + id + '"]');
        if (el && tile()) tile().renderTile(el, opts);
      };

      renderOne('active-sensors', {
        label: locText('Active sensors', 'Ενεργοί αισθητήρες'),
        value: isFiniteNum(activeSensors) ? activeSensors : null,
        unit: totalSensors ? '/' + totalSensors : '',
        status: activeSensors === 0 ? 'critical' : (activeSensors < (totalSensors || 0) * 0.8 ? 'warning' : 'good'),
        icon: ICONS.sensor,
        meta: totalSensors
          ? locText('of ' + totalSensors + ' deployed', 'από ' + totalSensors + ' στον χώρο')
          : null
      });

      renderOne('alerts', {
        label: locText('Live alerts', 'Ζωντανά συμβάντα'),
        value: isFiniteNum(alerts) ? alerts : 0,
        status: !alerts ? 'good' : (alerts < 3 ? 'warning' : 'critical'),
        icon: ICONS.alert,
        meta: !alerts
          ? locText('Operational', 'Σε λειτουργία')
          : locText(alerts + ' open', alerts + ' ανοικτά')
      });

      renderOne('co2-avg', {
        label: locText('CO₂ campus avg', 'CO₂ μ.ο. πανεπιστημίου'),
        value: isFiniteNum(co2Avg) ? Math.round(co2Avg) : null,
        unit: 'ppm',
        status: !isFiniteNum(co2Avg) ? 'muted'
          : (co2Avg <= 800 ? 'good' : (co2Avg <= 1200 ? 'warning' : 'critical')),
        icon: ICONS.co2,
        meta: isFiniteNum(co2Avg) ? locText('Across ' + iaqLatest.length + ' IAQ sensors', 'Σε ' + iaqLatest.length + ' αισθητήρες') : null
      });

      renderOne('movement', {
        label: locText('Movement (now)', 'Κίνηση (τώρα)'),
        value: isFiniteNum(movementNow) ? movementNow : null,
        unit: locText('events', 'συμβάντα'),
        status: !isFiniteNum(movementNow) ? 'muted' : (movementNow > 0 ? 'accent' : 'muted'),
        icon: ICONS.walk,
        meta: isFiniteNum(movementNow)
          ? locText('In ' + totalIn + ' / Out ' + totalOut, 'Είσοδος ' + totalIn + ' / Έξοδος ' + totalOut)
          : null
      });

      renderOne('uv-now', {
        label: locText('UV index (now)', 'Δείκτης UV (τώρα)'),
        value: isFiniteNum(uvNow) ? uvNow.toFixed(1) : null,
        status: !isFiniteNum(uvNow) ? 'muted'
          : (uvNow < 3 ? 'good' : (uvNow < 6 ? 'warning' : 'critical')),
        icon: ICONS.sun,
        meta: !isFiniteNum(uvNow)
          ? locText('No outdoor data', 'Χωρίς δεδομένα εξωτ.')
          : (uvNow < 3 ? locText('Low exposure', 'Χαμηλή έκθεση')
            : (uvNow < 6 ? locText('Moderate', 'Μέτρια')
              : locText('High exposure', 'Υψηλή έκθεση')))
      });

      renderOne('freshness', {
        label: locText('Last update', 'Τελευταία ενημέρωση'),
        value: isFiniteNum(minutesAgo) ? minutesAgo : null,
        unit: isFiniteNum(minutesAgo) ? locText('min ago', 'λ. πριν') : '',
        status: !isFiniteNum(minutesAgo) ? 'muted'
          : (minutesAgo < 5 ? 'good' : (minutesAgo < 15 ? 'warning' : 'critical')),
        icon: ICONS.clock,
        meta: isFiniteNum(minutesAgo)
          ? (minutesAgo < 5
            ? locText('Live', 'Σε ζωντανή ροή')
            : locText('Stale data', 'Παλιά δεδομένα'))
          : null
      });
    });
  }

  function bootIaq() {
    var grid = document.querySelector('[data-smaca-telemetry="iaq"]');
    if (!grid) return;
    loadSensors().then(function (sensors) {
      var rows = (sensors && Array.isArray(sensors.rows)) ? sensors.rows : [];
      var iaq = rows.filter(function (s) {
        return s && (s.device_type === 'iaq' || (s.latest && (
          isFiniteNum(toNumber(s.latest.co2_ppm))
          || isFiniteNum(toNumber(s.latest.pm2_5_ugm3))
          || isFiniteNum(toNumber(s.latest.tvoc_index))
        )));
      });

      var co2Vals = iaq.map(function (s) { return toNumber(s.latest && s.latest.co2_ppm); }).filter(isFiniteNum);
      var pmVals  = iaq.map(function (s) { return toNumber(s.latest && s.latest.pm2_5_ugm3); }).filter(isFiniteNum);
      var pm10Vals = iaq.map(function (s) { return toNumber(s.latest && s.latest.pm10_ugm3); }).filter(isFiniteNum);
      var tvocVals = iaq.map(function (s) { return toNumber(s.latest && s.latest.tvoc_index); }).filter(isFiniteNum);
      var humVals = iaq.map(function (s) { return toNumber(s.latest && s.latest.humidity_rh); }).filter(isFiniteNum);
      var tempVals = iaq.map(function (s) { return toNumber(s.latest && s.latest.temperature_c); }).filter(isFiniteNum);

      var co2Avg  = avg(co2Vals);
      var pmAvg   = avg(pmVals);
      var pm10Avg = avg(pm10Vals);
      var tvocAvg = avg(tvocVals);
      var humAvg  = avg(humVals);
      var tempAvg = avg(tempVals);

      var freshSensors = iaq.filter(function (s) {
        var min = relativeMinutes(s.latest && s.latest.measured_at);
        return isFiniteNum(min) && min < 30;
      }).length;

      var renderOne = function (id, opts) {
        var el = grid.querySelector('[data-tile="' + id + '"]');
        if (el && tile()) tile().renderTile(el, opts);
      };

      renderOne('co2', {
        label: locText('CO₂ avg', 'CO₂ μ.ο.'),
        value: isFiniteNum(co2Avg) ? Math.round(co2Avg) : null,
        unit: 'ppm',
        status: !isFiniteNum(co2Avg) ? 'muted'
          : (co2Avg <= 800 ? 'good' : (co2Avg <= 1200 ? 'warning' : 'critical')),
        icon: ICONS.co2,
        meta: locText(co2Vals.length + ' sensors', co2Vals.length + ' αισθητήρες')
      });

      renderOne('pm25', {
        label: locText('PM2.5 avg', 'PM2.5 μ.ο.'),
        value: isFiniteNum(pmAvg) ? pmAvg.toFixed(1) : null,
        unit: 'µg/m³',
        status: !isFiniteNum(pmAvg) ? 'muted'
          : (pmAvg <= 12 ? 'good' : (pmAvg <= 35 ? 'warning' : 'critical')),
        icon: ICONS.pm
      });

      renderOne('pm10', {
        label: locText('PM10 avg', 'PM10 μ.ο.'),
        value: isFiniteNum(pm10Avg) ? pm10Avg.toFixed(1) : null,
        unit: 'µg/m³',
        status: !isFiniteNum(pm10Avg) ? 'muted'
          : (pm10Avg <= 25 ? 'good' : (pm10Avg <= 50 ? 'warning' : 'critical')),
        icon: ICONS.pm
      });

      renderOne('tvoc', {
        label: locText('TVOC avg', 'TVOC μ.ο.'),
        value: isFiniteNum(tvocAvg) ? Math.round(tvocAvg) : null,
        unit: 'idx',
        status: !isFiniteNum(tvocAvg) ? 'muted'
          : (tvocAvg <= 100 ? 'good' : (tvocAvg <= 200 ? 'warning' : 'critical')),
        icon: ICONS.tvoc
      });

      renderOne('humidity', {
        label: locText('Humidity avg', 'Υγρασία μ.ο.'),
        value: isFiniteNum(humAvg) ? Math.round(humAvg) : null,
        unit: '%',
        status: !isFiniteNum(humAvg) ? 'muted'
          : (humAvg >= 30 && humAvg <= 60 ? 'good' : 'warning'),
        icon: ICONS.humidity,
        meta: isFiniteNum(tempAvg) ? locText('Temp ' + tempAvg.toFixed(1) + '°C', 'Θερμ. ' + tempAvg.toFixed(1) + '°C') : null
      });

      renderOne('coverage', {
        label: locText('Sensor coverage', 'Κάλυψη αισθητήρων'),
        value: iaq.length ? freshSensors + '/' + iaq.length : null,
        status: !iaq.length ? 'muted'
          : (freshSensors === iaq.length ? 'good'
            : (freshSensors >= iaq.length * 0.6 ? 'warning' : 'critical')),
        icon: ICONS.sensor,
        meta: iaq.length
          ? locText('Reporting in last 30 min', 'Ενημέρωση τελ. 30 λ.')
          : null
      });

      // Optional spark for the most recently reporting IAQ sensor
      var freshest = iaq
        .filter(function (s) { return s.latest && s.latest.measured_at; })
        .sort(function (a, b) {
          return Date.parse(b.latest.measured_at || 0) - Date.parse(a.latest.measured_at || 0);
        })[0];
      if (freshest && freshest.id) {
        loadTimeseries(freshest.id, 'co2_ppm').then(function (resp) {
          var values = pointsToValues(resp && resp.points);
          if (values.length < 2) return;
          var sparkEl = grid.querySelector('[data-tile="co2"] .smaca-tile__spark');
          if (!sparkEl && tile()) {
            var card = grid.querySelector('[data-tile="co2"]');
            if (card) {
              var node = document.createElement('div');
              node.className = 'smaca-tile__spark';
              card.insertBefore(node, card.querySelector('.smaca-tile__meta'));
              tile().renderSparkline(node, { data: values, color: '#22d3ee' });
            }
          } else if (sparkEl && tile()) {
            tile().renderSparkline(sparkEl, { data: values, color: '#22d3ee' });
          }
        });
      }
    });
  }

  function bootOccupancy() {
    var grid = document.querySelector('[data-smaca-telemetry="occupancy"]');
    if (!grid) return;
    Promise.all([loadSensors(), loadKpiSummary('occupancy')]).then(function (results) {
      var sensorsResp = results[0];
      var kpiResp = results[1];
      var rows = (sensorsResp && Array.isArray(sensorsResp.rows)) ? sensorsResp.rows : [];
      var occ = rows.filter(function (s) {
        return s && (s.device_type === 'occupancy' || (s.latest && (
          isFiniteNum(toNumber(s.latest.people_in))
          || isFiniteNum(toNumber(s.latest.people_total_in))
        )));
      });

      var totalIn = 0, totalOut = 0, latestActivity = 0;
      var topPassage = null, topPassageActivity = -Infinity;
      occ.forEach(function (s) {
        var pin  = toNumber(s.latest && s.latest.people_in) || 0;
        var pout = toNumber(s.latest && s.latest.people_out) || 0;
        var ttin = toNumber(s.latest && s.latest.people_total_in) || 0;
        var ttout = toNumber(s.latest && s.latest.people_total_out) || 0;
        totalIn += ttin;
        totalOut += ttout;
        latestActivity += pin + pout;
        var localActivity = pin + pout;
        if (localActivity > topPassageActivity) {
          topPassageActivity = localActivity;
          topPassage = s;
        }
      });

      var net = totalIn - totalOut;
      var balance = (totalIn + totalOut) > 0 ? (totalIn / (totalIn + totalOut)) * 100 : null;

      var kpis = (kpiResp && Array.isArray(kpiResp.kpis)) ? kpiResp.kpis : [];
      var movementKpi = kpis.find(function (k) { return k.key === 'movement_activity_index' || k.key === 'crowd_density_level'; });

      var freshest = occ
        .filter(function (s) { return s.latest && s.latest.measured_at; })
        .sort(function (a, b) {
          return Date.parse(b.latest.measured_at || 0) - Date.parse(a.latest.measured_at || 0);
        })[0];
      var minutesAgo = freshest ? relativeMinutes(freshest.latest.measured_at) : null;

      var renderOne = function (id, opts) {
        var el = grid.querySelector('[data-tile="' + id + '"]');
        if (el && tile()) tile().renderTile(el, opts);
      };

      renderOne('latest-activity', {
        label: locText('Recent movement', 'Πρόσφατη κίνηση'),
        value: isFiniteNum(latestActivity) ? latestActivity : null,
        unit: locText('events', 'συμβάντα'),
        status: !latestActivity ? 'muted' : (latestActivity > 50 ? 'accent' : 'good'),
        icon: ICONS.walk,
        meta: locText('Across ' + occ.length + ' passages', 'Σε ' + occ.length + ' περάσματα')
      });

      renderOne('net-balance', {
        label: locText('Net balance', 'Καθαρό υπόλοιπο'),
        value: isFiniteNum(net) ? (net >= 0 ? '+' : '') + net : null,
        status: !isFiniteNum(net) ? 'muted' : (Math.abs(net) < 5 ? 'good' : 'warning'),
        icon: ICONS.flow,
        meta: isFiniteNum(balance)
          ? locText(balance.toFixed(0) + '% inbound', balance.toFixed(0) + '% είσοδοι')
          : null
      });

      renderOne('total-in', {
        label: locText('Total inbound', 'Σύνολο εισόδων'),
        value: isFiniteNum(totalIn) ? fmtCompact(totalIn) : null,
        unit: locText('people', 'άτομα'),
        status: 'info',
        icon: ICONS.walk
      });

      renderOne('total-out', {
        label: locText('Total outbound', 'Σύνολο εξόδων'),
        value: isFiniteNum(totalOut) ? fmtCompact(totalOut) : null,
        unit: locText('people', 'άτομα'),
        status: 'info',
        icon: ICONS.walk
      });

      renderOne('busiest', {
        label: locText('Busiest passage', 'Πιο συχνό πέρασμα'),
        value: topPassage ? labelForLocation(topPassage.sensor_location, topPassage.sensor_location_label || topPassage.name || topPassage.sensor_uid) : null,
        status: topPassage ? 'accent' : 'muted',
        icon: ICONS.location,
        meta: topPassage && topPassageActivity > 0
          ? locText(topPassageActivity + ' events now', topPassageActivity + ' συμβάντα τώρα')
          : null
      });

      renderOne('movement-kpi', {
        label: movementKpi
          ? movementKpi.label
          : locText('Movement activity', 'Δραστηριότητα κίνησης'),
        value: movementKpi && isFiniteNum(toNumber(movementKpi.value))
          ? fmtCompact(toNumber(movementKpi.value))
          : null,
        unit: movementKpi ? movementKpi.unit : '',
        status: movementKpi ? movementKpi.status : 'muted',
        icon: ICONS.peak,
        meta: minutesAgo !== null
          ? locText('Updated ' + minutesAgo + ' min ago', 'Ενημέρωση ' + minutesAgo + ' λ. πριν')
          : null
      });
    });
  }

  function bootEnergy() {
    var grid = document.querySelector('[data-smaca-telemetry="energy"]');
    if (!grid) return;
    Promise.all([loadSensors(), loadKpiSummary('energy')]).then(function (results) {
      var sensorsResp = results[0];
      var kpiResp = results[1];
      var rows = (sensorsResp && Array.isArray(sensorsResp.rows)) ? sensorsResp.rows : [];
      var energy = rows.filter(function (s) {
        return s && (s.device_type === 'energy' || (s.latest && isFiniteNum(toNumber(s.latest.energy_kwh))));
      });

      var energyVals = energy.map(function (s) { return toNumber(s.latest && s.latest.energy_kwh); }).filter(isFiniteNum);
      var totalEnergy = energyVals.reduce(function (a, b) { return a + b; }, 0);
      var maxLatest = maxOf(energyVals);
      var avgLatest = avg(energyVals);

      var topConsumer = null, topValue = -Infinity;
      energy.forEach(function (s) {
        var v = toNumber(s.latest && s.latest.energy_kwh);
        if (isFiniteNum(v) && v > topValue) {
          topValue = v;
          topConsumer = s;
        }
      });

      var kpis = (kpiResp && Array.isArray(kpiResp.kpis)) ? kpiResp.kpis : [];
      var efficiencyKpi = kpis.find(function (k) { return k.key === 'normalized_energy_intensity'; });
      var baseLoadKpi = kpis.find(function (k) { return k.key === 'base_load_index'; });

      var renderOne = function (id, opts) {
        var el = grid.querySelector('[data-tile="' + id + '"]');
        if (el && tile()) tile().renderTile(el, opts);
      };

      renderOne('total', {
        label: locText('Reading total', 'Σύνολο μετρήσεων'),
        value: isFiniteNum(totalEnergy) && totalEnergy > 0 ? fmtCompact(totalEnergy) : null,
        unit: 'kWh',
        status: 'info',
        icon: ICONS.bolt,
        meta: locText(energyVals.length + ' meters', energyVals.length + ' μετρητές')
      });

      renderOne('peak-meter', {
        label: locText('Peak meter (now)', 'Μέγιστος μετρητής (τώρα)'),
        value: isFiniteNum(maxLatest) ? fmtCompact(maxLatest) : null,
        unit: 'kWh',
        status: !isFiniteNum(maxLatest) ? 'muted' : 'warning',
        icon: ICONS.peak,
        meta: topConsumer
          ? labelForLocation(topConsumer.sensor_location, topConsumer.name || topConsumer.sensor_uid)
          : null
      });

      renderOne('avg-meter', {
        label: locText('Average per meter', 'Μ.ο. ανά μετρητή'),
        value: isFiniteNum(avgLatest) ? fmtCompact(avgLatest) : null,
        unit: 'kWh',
        status: 'info',
        icon: ICONS.bolt
      });

      renderOne('top-area', {
        label: locText('Top area', 'Κορυφαία περιοχή'),
        value: topConsumer ? labelForLocation(topConsumer.sensor_location, topConsumer.name || topConsumer.sensor_uid) : null,
        status: topConsumer ? 'accent' : 'muted',
        icon: ICONS.location,
        meta: isFiniteNum(topValue)
          ? locText(fmtCompact(topValue) + ' kWh latest', fmtCompact(topValue) + ' kWh τελ.')
          : null
      });

      renderOne('efficiency-kpi', {
        label: efficiencyKpi
          ? efficiencyKpi.label
          : locText('Energy intensity', 'Ένταση ενέργειας'),
        value: efficiencyKpi && isFiniteNum(toNumber(efficiencyKpi.value))
          ? fmtCompact(toNumber(efficiencyKpi.value))
          : null,
        unit: efficiencyKpi ? efficiencyKpi.unit : '',
        status: efficiencyKpi ? efficiencyKpi.status : 'muted',
        icon: ICONS.target
      });

      renderOne('base-load', {
        label: baseLoadKpi
          ? baseLoadKpi.label
          : locText('Base load index', 'Βασικό φορτίο'),
        value: baseLoadKpi && isFiniteNum(toNumber(baseLoadKpi.value))
          ? toNumber(baseLoadKpi.value).toFixed(2)
          : null,
        unit: baseLoadKpi ? baseLoadKpi.unit : '',
        status: baseLoadKpi ? baseLoadKpi.status : 'muted',
        icon: ICONS.battery
      });

      // Spark — total energy curve from a representative sensor
      var freshest = energy
        .filter(function (s) { return s.latest && s.latest.measured_at; })
        .sort(function (a, b) {
          return Date.parse(b.latest.measured_at || 0) - Date.parse(a.latest.measured_at || 0);
        })[0];
      if (freshest && freshest.id) {
        loadTimeseries(freshest.id, 'energy_kwh').then(function (resp) {
          var values = pointsToValues(resp && resp.points);
          if (values.length < 3) return;
          // Convert cumulative readings into bucket deltas (clamp negatives)
          var deltas = [];
          for (var i = 1; i < values.length; i++) {
            var d = values[i] - values[i - 1];
            deltas.push(d > 0 ? d : 0);
          }
          var card = grid.querySelector('[data-tile="total"]');
          if (card && tile()) {
            var existingSpark = card.querySelector('.smaca-tile__spark');
            if (existingSpark) {
              tile().renderMiniBar(existingSpark, { data: deltas.slice(-24), color: '#fbbf24' });
            } else {
              var node = document.createElement('div');
              node.className = 'smaca-tile__spark';
              card.insertBefore(node, card.querySelector('.smaca-tile__meta'));
              tile().renderMiniBar(node, { data: deltas.slice(-24), color: '#fbbf24' });
            }
          }
        });
      }
    });
  }

  function bootEnvironmental() {
    var grid = document.querySelector('[data-smaca-telemetry="environmental"]');
    if (!grid) return;
    Promise.all([loadSensors(), loadKpiSummary('environmental')]).then(function (results) {
      var sensorsResp = results[0];
      var kpiResp = results[1];
      var rows = (sensorsResp && Array.isArray(sensorsResp.rows)) ? sensorsResp.rows : [];
      var env = rows.filter(function (s) {
        return s && s.latest && isFiniteNum(toNumber(s.latest.uv_index));
      });

      var uvVals = env.map(function (s) { return toNumber(s.latest.uv_index); }).filter(isFiniteNum);
      var uvAvg = avg(uvVals);
      var uvMax = maxOf(uvVals);

      var freshest = env
        .filter(function (s) { return s.latest && s.latest.measured_at; })
        .sort(function (a, b) {
          return Date.parse(b.latest.measured_at || 0) - Date.parse(a.latest.measured_at || 0);
        })[0];
      var freshMin = freshest ? relativeMinutes(freshest.latest.measured_at) : null;

      var kpis = (kpiResp && Array.isArray(kpiResp.kpis)) ? kpiResp.kpis : [];
      var uvKpi = kpis.find(function (k) { return k.key === 'uv_exposure_risk'; });

      var renderOne = function (id, opts) {
        var el = grid.querySelector('[data-tile="' + id + '"]');
        if (el && tile()) tile().renderTile(el, opts);
      };

      renderOne('uv-now', {
        label: locText('UV now', 'UV τώρα'),
        value: isFiniteNum(uvAvg) ? uvAvg.toFixed(1) : null,
        status: !isFiniteNum(uvAvg) ? 'muted'
          : (uvAvg < 3 ? 'good' : (uvAvg < 6 ? 'warning' : 'critical')),
        icon: ICONS.sun,
        meta: locText(uvVals.length + ' outdoor sensors', uvVals.length + ' εξωτ. αισθητήρες')
      });

      renderOne('uv-peak', {
        label: locText('UV peak (current)', 'UV μέγιστο (τρέχον)'),
        value: isFiniteNum(uvMax) ? uvMax.toFixed(1) : null,
        status: !isFiniteNum(uvMax) ? 'muted'
          : (uvMax < 3 ? 'good' : (uvMax < 6 ? 'warning' : 'critical')),
        icon: ICONS.peak
      });

      renderOne('exposure-risk', {
        label: uvKpi ? uvKpi.label : locText('UV exposure risk', 'Κίνδυνος έκθεσης UV'),
        value: uvKpi && isFiniteNum(toNumber(uvKpi.value)) ? toNumber(uvKpi.value).toFixed(1) : null,
        unit: uvKpi ? uvKpi.unit : '',
        status: uvKpi ? uvKpi.status : 'muted',
        icon: ICONS.target,
        meta: uvKpi && uvKpi.status_meaning
          ? uvKpi.status_meaning
          : null
      });

      renderOne('outdoor-sensors', {
        label: locText('Outdoor sensors', 'Εξωτερικοί αισθητήρες'),
        value: env.length || null,
        status: env.length ? 'good' : 'muted',
        icon: ICONS.sensor,
        meta: freshMin !== null
          ? locText('Updated ' + freshMin + ' min ago', 'Ενημέρωση ' + freshMin + ' λ. πριν')
          : null
      });

      renderOne('advisory', {
        label: locText('Advisory', 'Σύσταση'),
        value: !isFiniteNum(uvAvg) ? null
          : (uvAvg < 3 ? locText('Low', 'Χαμηλή')
            : (uvAvg < 6 ? locText('Moderate', 'Μέτρια')
              : (uvAvg < 8 ? locText('High', 'Υψηλή')
                : locText('Very high', 'Πολύ υψηλή')))),
        status: !isFiniteNum(uvAvg) ? 'muted'
          : (uvAvg < 3 ? 'good' : (uvAvg < 6 ? 'warning' : 'critical')),
        icon: ICONS.alert,
        meta: !isFiniteNum(uvAvg) ? null
          : (uvAvg < 3 ? locText('Outdoor activities OK', 'Εξωτ. δραστηριότητες OK')
            : (uvAvg < 6 ? locText('Use sunscreen outdoors', 'Αντηλιακό σε εξωτ. χώρους')
              : locText('Avoid direct sun', 'Αποφυγή απευθείας ηλίου')))
      });

      // Spark — UV trend from freshest outdoor sensor
      if (freshest && freshest.id) {
        loadTimeseries(freshest.id, 'uv_index').then(function (resp) {
          var values = pointsToValues(resp && resp.points);
          if (values.length < 2) return;
          var card = grid.querySelector('[data-tile="uv-now"]');
          if (card && tile()) {
            var existing = card.querySelector('.smaca-tile__spark');
            if (existing) {
              tile().renderSparkline(existing, { data: values, color: '#fbbf24' });
            } else {
              var node = document.createElement('div');
              node.className = 'smaca-tile__spark';
              card.insertBefore(node, card.querySelector('.smaca-tile__meta'));
              tile().renderSparkline(node, { data: values, color: '#fbbf24' });
            }
          }
        });
      }
    });
  }

  function bootConnectivity() {
    var grid = document.querySelector('[data-smaca-telemetry="connectivity"]');
    if (!grid) return;
    loadSensors().then(function (sensorsResp) {
      var rows = (sensorsResp && Array.isArray(sensorsResp.rows)) ? sensorsResp.rows : [];
      var total = rows.length;
      var active = rows.filter(function (s) { return s.is_active; }).length;
      var stale = rows.filter(function (s) {
        var min = relativeMinutes(s.last_seen_at || (s.latest && s.latest.measured_at));
        return !isFiniteNum(min) || min > 15;
      }).length;
      var batteryVals = rows.map(function (s) { return toNumber(s.latest && s.latest.battery_pct); }).filter(isFiniteNum);
      var batteryAvg = avg(batteryVals);
      var lowestBattery = batteryVals.length ? Math.min.apply(null, batteryVals) : null;

      var freshest = rows
        .filter(function (s) { return s.last_seen_at; })
        .sort(function (a, b) { return Date.parse(b.last_seen_at || 0) - Date.parse(a.last_seen_at || 0); })[0];
      var freshMin = freshest ? relativeMinutes(freshest.last_seen_at) : null;

      var pct = total ? (active / total) * 100 : null;

      var renderOne = function (id, opts) {
        var el = grid.querySelector('[data-tile="' + id + '"]');
        if (el && tile()) tile().renderTile(el, opts);
      };

      renderOne('online', {
        label: locText('Online', 'Σε σύνδεση'),
        value: total ? active : null,
        unit: total ? '/' + total : '',
        status: !total ? 'muted'
          : (pct >= 95 ? 'good' : (pct >= 80 ? 'warning' : 'critical')),
        icon: ICONS.network,
        meta: isFiniteNum(pct) ? pct.toFixed(0) + '%' : null
      });

      renderOne('stale', {
        label: locText('Stale (>15m)', 'Παλιά (>15λ.)'),
        value: total ? stale : null,
        status: !total ? 'muted'
          : (stale === 0 ? 'good' : (stale < total * 0.2 ? 'warning' : 'critical')),
        icon: ICONS.clock,
        meta: total ? locText('of ' + total + ' total', 'από ' + total + ' σύνολο') : null
      });

      renderOne('battery-avg', {
        label: locText('Battery avg', 'Μπαταρία μ.ο.'),
        value: isFiniteNum(batteryAvg) ? Math.round(batteryAvg) : null,
        unit: '%',
        status: !isFiniteNum(batteryAvg) ? 'muted'
          : (batteryAvg >= 50 ? 'good' : (batteryAvg >= 20 ? 'warning' : 'critical')),
        icon: ICONS.battery,
        meta: batteryVals.length
          ? locText('Across ' + batteryVals.length + ' sensors', 'Σε ' + batteryVals.length + ' αισθητήρες')
          : null
      });

      renderOne('battery-min', {
        label: locText('Lowest battery', 'Χαμηλότερη μπαταρία'),
        value: isFiniteNum(lowestBattery) ? Math.round(lowestBattery) : null,
        unit: '%',
        status: !isFiniteNum(lowestBattery) ? 'muted'
          : (lowestBattery >= 50 ? 'good' : (lowestBattery >= 20 ? 'warning' : 'critical')),
        icon: ICONS.battery
      });

      renderOne('uptime-pct', {
        label: locText('Uptime', 'Διαθεσιμότητα'),
        value: isFiniteNum(pct) ? pct.toFixed(0) : null,
        unit: '%',
        status: !isFiniteNum(pct) ? 'muted'
          : (pct >= 95 ? 'good' : (pct >= 80 ? 'warning' : 'critical')),
        icon: ICONS.target
      });

      renderOne('last-update', {
        label: locText('Last sensor seen', 'Τελευταίος αισθητήρας'),
        value: isFiniteNum(freshMin) ? freshMin : null,
        unit: isFiniteNum(freshMin) ? locText('min ago', 'λ. πριν') : '',
        status: !isFiniteNum(freshMin) ? 'muted'
          : (freshMin < 5 ? 'good' : (freshMin < 15 ? 'warning' : 'critical')),
        icon: ICONS.clock,
        meta: freshest
          ? labelForLocation(freshest.sensor_location, freshest.name || freshest.sensor_uid)
          : null
      });
    });
  }

  // -----------------------------------------------------------------------
  // Misc
  // -----------------------------------------------------------------------
  function labelForLocation(code, fallback) {
    if (global.SMACASpatial && typeof global.SMACASpatial.labelFor === 'function') {
      var label = global.SMACASpatial.labelFor(code);
      if (label) return label;
    }
    return fallback || code || '—';
  }

  // Re-route to whichever boot fits the active section.
  function refreshActive() {
    var section = activeSection();
    if (!section) return;
    if (section === 'overview')      bootOverview();
    else if (section === 'iaq')      bootIaq();
    else if (section === 'occupancy') bootOccupancy();
    else if (section === 'energy')   bootEnergy();
    else if (section === 'environmental') bootEnvironmental();
    else if (section === 'connectivity') bootConnectivity();
  }

  function boot() {
    if (!api() || !tile()) return;
    refreshActive();

    // Resync with the rest of the dashboard
    document.addEventListener('smaca:scope-changed', refreshActive);
    document.addEventListener('smaca:timeframe-changed', refreshActive);
    document.addEventListener('smaca:state-updated', refreshActive);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Avoid linter complaints about helpers we keep available for future
  // additions (e.g., a Connectivity heatmap once data is provided).
  void [$, $$, fmt];

  global.SMACATelemetryBootstrap = {
    refresh: refreshActive,
    bootOverview: bootOverview,
    bootIaq: bootIaq,
    bootOccupancy: bootOccupancy,
    bootEnergy: bootEnergy,
    bootEnvironmental: bootEnvironmental,
    bootConnectivity: bootConnectivity
  };
})(typeof window !== 'undefined' ? window : this);
