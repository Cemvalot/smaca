/**
 * Connectivity wireless monitoring dashboard — real MQTT metrics only.
 */
(function (global) {
  'use strict';

  var STALE_MIN = 15;
  var ONLINE_MIN = 5;
  var refreshToken = 0;
  var lastFingerprint = '';
  var sparkCache = {};
  var tableDevices = [];
  var tableSort = { key: 'quality', dir: 'asc' };
  var tableSearch = '';

  var BAND_COLORS = {
    excellent: '#34d399',
    very_good: '#6ee7b7',
    good_usable: '#fbbf24',
    weak_unstable: '#fb923c',
    bad: '#f87171'
  };

  var METRIC_BAR = {
    rssi: { min: -95, max: -40 },
    snr: { min: 0, max: 50 },
    tx_ccq: { min: 0, max: 100 },
    tx_rate: { min: 0, max: 400 }
  };

  function q() { return global.SMACA_CONNECTIVITY_QUALITY || {}; }
  function t(key, fb) { return (global.SMACA_TRANSLATIONS || {})[key] || fb; }
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function tile() { return global.SMACATelemetry || null; }
  function ringColors() {
    var qm = q();
    return qm.HEALTH_RING_COLORS || BAND_COLORS;
  }

  function wirelessBarsSvg(strength) {
    var bars = Math.min(4, Math.max(0, Math.round((strength || 0) / 25)));
    var h = [4, 7, 10, 13];
    var out = '<svg class="conn-wifi-bars" width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">';
    for (var i = 0; i < 4; i++) {
      var on = i < bars;
      out += '<rect x="' + (i * 4 + 1) + '" y="' + (14 - h[i]) + '" width="2.5" height="' + h[i] + '" rx="0.5" fill="' + (on ? '#22d3ee' : 'rgba(148,163,184,0.25)') + '"/>';
    }
    return out + '</svg>';
  }

  function normalizeLatest(latest) {
    var fn = global.SMACA_TELEMETRY_METRIC_NORMALIZE && global.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest;
    return typeof fn === 'function' ? fn(latest || {}) : (latest || {});
  }

  function activeLocation() {
    try {
      var v = (global.SMACA_LOCATION || '').toString().trim();
      return v || null;
    } catch (e) { return null; }
  }

  function sensorMatchesScope(sensor) {
    var scope = activeLocation();
    if (!scope) return true;
    var loc = sensor && (sensor.sensor_location || sensor.location);
    if (!loc) return false;
    return String(loc).toUpperCase() === String(scope).toUpperCase();
  }

  function relativeMinutes(ts) {
    if (!ts) return null;
    var ms = new Date(ts).getTime();
    if (!Number.isFinite(ms)) return null;
    return (Date.now() - ms) / 60000;
  }

  function linkStatus(sensor) {
    if (!sensor || sensor.is_active === false || sensor.is_active === 0) {
      return { key: 'offline', label: t('offline', 'Offline'), severity: 'critical' };
    }
    var min = relativeMinutes(sensor.last_seen_at || (sensor.latest && sensor.latest.measured_at));
    if (min === null || !Number.isFinite(min)) {
      return { key: 'offline', label: t('offline', 'Offline'), severity: 'critical' };
    }
    if (min <= ONLINE_MIN) return { key: 'online', label: t('online', 'Online'), severity: 'good' };
    if (min <= STALE_MIN) return { key: 'stale', label: t('connectivity_status_stale', 'Stale'), severity: 'warning' };
    return { key: 'offline', label: t('offline', 'Offline'), severity: 'critical' };
  }

  function deviceName(sensor) {
    var lat = normalizeLatest(sensor.latest_snapshot || sensor.latest || {});
    return sensor.sensor_name || sensor.name || lat.device || t('connectivity_unknown_device', 'Unknown device');
  }

  function deviceLocation(sensor) {
    var lat = normalizeLatest(sensor.latest_snapshot || sensor.latest || {});
    var code = lat.deviceLocation || sensor.sensor_location || sensor.location || '';
    if (sensor.sensor_location_label) return sensor.sensor_location_label;
    if (global.SMACASpatial && typeof global.SMACASpatial.labelFor === 'function' && code) {
      return global.SMACASpatial.labelFor(code);
    }
    return code || t('iaq_sensor_breakdown_unknown_location', 'Unassigned');
  }

  function deviceId(sensor) {
    var lat = normalizeLatest(sensor.latest_snapshot || sensor.latest || {});
    return lat.deviceID || sensor.sensor_uid || String(sensor.id || '');
  }

  function buildWirelessDevice(sensor) {
    var latest = normalizeLatest(sensor.latest_snapshot || sensor.latest || {});
    var quality = q();
    var metrics = quality.extractMetricsFromLatest ? quality.extractMetricsFromLatest(latest) : {};
    var overall = quality.classifyOverall ? quality.classifyOverall(metrics) : {};
    var classifications = overall.metrics || {};
    return {
      sensor: sensor,
      latest: latest,
      metrics: metrics,
      overall: overall,
      classifications: classifications,
      name: deviceName(sensor),
      location: deviceLocation(sensor),
      deviceId: deviceId(sensor),
      floorKey: (sensor.sensor_location || '').split('-')[0] || '__other',
      status: linkStatus(sensor),
      measuredAt: latest.measured_at || sensor.last_seen_at
    };
  }

  function getWirelessDevices(sensors) {
    var list = Array.isArray(sensors) ? sensors : [];
    var hasFn = q().hasConnectivityMetrics;
    return list.filter(function (s) {
      if (!sensorMatchesScope(s)) return false;
      var lat = s.latest_snapshot || s.latest || {};
      return typeof hasFn === 'function' ? hasFn(lat) : false;
    }).map(buildWirelessDevice);
  }

  function avgMetric(devices, key) {
    var vals = [];
    for (var i = 0; i < devices.length; i++) {
      var v = devices[i].metrics[key];
      if (v !== null && v !== undefined && Number.isFinite(Number(v))) vals.push(Number(v));
    }
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  function bandCounts(devices, metricKey) {
    var counts = { excellent: 0, very_good: 0, good_usable: 0, weak_unstable: 0, bad: 0 };
    devices.forEach(function (d) {
      var cls = d.classifications[metricKey];
      if (cls && cls.band_key && counts[cls.band_key] !== undefined) counts[cls.band_key] += 1;
    });
    return counts;
  }

  function metricBarPct(metricKey, value) {
    if (value === null || !Number.isFinite(value)) return 0;
    var r = METRIC_BAR[metricKey] || { min: 0, max: 100 };
    return Math.min(100, Math.max(0, ((value - r.min) / (r.max - r.min)) * 100));
  }

  function badgeHtml(cls, tooltip) {
    if (!cls) return '<span class="conn-badge conn-badge--na">—</span>';
    var color = BAND_COLORS[cls.band_key] || '#94a3b8';
    return (
      '<span class="conn-badge conn-badge--' + esc(cls.severity) + '" style="--conn-badge-color:' + color + '" title="' + esc(tooltip || cls.label) + '">' +
      esc(cls.label) + '</span>'
    );
  }

  function metricCellHtml(metricKey, cls, rawValue) {
    if (!cls) return '<td class="conn-td-metric conn-td-metric--na">—</td>';
    var pct = metricBarPct(metricKey, rawValue);
    var tip = (q().metricLabel ? q().metricLabel(metricKey) : metricKey) + ': ' + cls.label;
    return (
      '<td class="conn-td-metric">' +
      '<span class="conn-metric-bar-wrap" title="' + esc(tip) + '">' +
      '<span class="conn-metric-bar" style="width:' + pct.toFixed(1) + '%;background:' + (BAND_COLORS[cls.band_key] || '#64748b') + '22"></span>' +
      '<span class="conn-metric-val">' + esc(String(cls.value)) + '<span class="conn-metric-unit">' + esc(cls.unit || '') + '</span></span>' +
      badgeHtml(cls, tip) +
      '</span></td>'
    );
  }

  function sparklineSvg(points, stroke) {
    if (!points || points.length < 2) return '';
    var w = 88; var h = 28;
    var vals = points.map(function (p) { return Number(p); }).filter(Number.isFinite);
    if (vals.length < 2) return '';
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var range = max - min || 1;
    var coords = vals.map(function (v, i) {
      var x = (i / (vals.length - 1)) * w;
      var y = h - ((v - min) / range) * (h - 4) - 2;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg class="conn-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
      '<polyline fill="none" stroke="' + esc(stroke) + '" stroke-width="1.75" stroke-opacity="0.95" points="' + coords + '"/></svg>';
  }

  function fetchSparkline(sensorId, metricApiKey) {
    var cacheKey = sensorId + ':' + metricApiKey + ':' + (global.SMACA_TIMEFRAME || '24h');
    if (sparkCache[cacheKey]) return Promise.resolve(sparkCache[cacheKey]);
    if (!global.SMACAApi || typeof global.SMACAApi.fetchSensorTimeseries !== 'function') {
      return Promise.resolve([]);
    }
    return global.SMACAApi.fetchSensorTimeseries(sensorId, metricApiKey, global.SMACA_TIMEFRAME || '24h')
      .then(function (payload) {
        var pts = (payload && payload.points) ? payload.points.map(function (p) { return Number(p.value); }).filter(Number.isFinite) : [];
        sparkCache[cacheKey] = pts.slice(-24);
        return sparkCache[cacheKey];
      })
      .catch(function () { return []; });
  }

  function kpiCardHtml(spec) {
    var cls = spec.cls;
    var label = spec.label;
    var accent = spec.accent || 'cyan';
    var spark = spec.sparkHtml || '';
    var val = cls ? (cls.value + (cls.unit ? ' ' + cls.unit : '')) : '—';
    var band = cls ? (cls.display_label || cls.label) : t('connectivity_no_data', 'No data');
    return (
      '<article class="conn-kpi-card conn-kpi-card--' + accent + '">' +
      '<div class="conn-kpi-card__glow" aria-hidden="true"></div>' +
      '<div class="conn-kpi-card__icon" aria-hidden="true">' + (spec.icon || '') + '</div>' +
      '<div class="conn-kpi-card__body">' +
      '<div class="conn-kpi-card__label">' + esc(label) + '</div>' +
      '<div class="conn-kpi-card__main">' +
      '<span class="conn-kpi-card__value">' + esc(String(val)) + '</span>' +
      '<span class="conn-kpi-card__chip badge badge--' + esc(cls ? cls.severity : 'muted') + '">' + esc(band) + '</span>' +
      '</div>' +
      '<div class="conn-kpi-card__spark-row">' + (spark || '') + '</div>' +
      '</div></article>'
    );
  }

  function renderKpiGrid(devices) {
    var grid = document.getElementById('connectivity-kpi-grid');
    var limitingEl = document.getElementById('connectivity-limiting-factor');
    if (!grid) return;
    if (!devices.length) {
      grid.innerHTML = '<p class="overview-live-note">' + esc(t('connectivity_no_data', 'No connectivity data')) + '</p>';
      if (limitingEl) limitingEl.hidden = true;
      return;
    }
    var quality = q();
    var avgs = {
      rssi: avgMetric(devices, 'rssi'),
      snr: avgMetric(devices, 'snr'),
      tx_ccq: avgMetric(devices, 'tx_ccq'),
      tx_rate: avgMetric(devices, 'tx_rate')
    };
    var overall = quality.classifyOverall ? quality.classifyOverall(avgs) : {};
    var overallCls = overall.overall_band ? {
      band_key: overall.overall_band,
      label: overall.overall_label,
      display_label: overall.composite_label || overall.overall_label,
      severity: overall.overall_severity,
      value: devices.length,
      unit: t('devices', 'devices')
    } : null;

    if (limitingEl && overall.limiting_metric) {
      var cap = t('connectivity_limiting_caption', 'Limiting metric: :metric');
      limitingEl.textContent = cap.indexOf(':metric') >= 0 ? cap.replace(':metric', overall.limiting_metric) : ('Limiting metric: ' + overall.limiting_metric);
      limitingEl.hidden = false;
    } else if (limitingEl) limitingEl.hidden = true;

    var cards = [
      { key: 'overall', label: t('connectivity_kpi_overall', 'Overall Connectivity Quality'), accent: 'overall', cls: overallCls, icon: '◎' },
      { key: 'rssi', label: t('connectivity_signal_strength', 'Signal strength'), accent: 'cyan', cls: quality.classifyMetric('rssi', avgs.rssi), icon: '◉' },
      { key: 'snr', label: t('connectivity_signal_to_noise', 'SNR'), accent: 'green', cls: quality.classifyMetric('snr', avgs.snr), icon: '◈' },
      { key: 'tx_ccq', label: 'TX-CCQ', accent: 'amber', cls: quality.classifyMetric('tx_ccq', avgs.tx_ccq), icon: '◆' },
      { key: 'tx_rate', label: t('connectivity_transmission_rate', 'TX-rate'), accent: 'indigo', cls: quality.classifyMetric('tx_rate', avgs.tx_rate), icon: '◇' }
    ];

    grid.innerHTML = cards.map(function (c) { return kpiCardHtml(c); }).join('');

    var sparkColors = { rssi: '#22d3ee', snr: '#34d399', tx_ccq: '#fbbf24', tx_rate: '#818cf8' };
    var apiKeys = { rssi: 'signal_strength', snr: 'snr', tx_ccq: 'tx_ccq', tx_rate: 'tx_rate' };
    ['rssi', 'snr', 'tx_ccq', 'tx_rate'].forEach(function (mk) {
      var sample = null;
      for (var i = 0; i < devices.length; i++) {
        if (devices[i].metrics[mk] !== null) { sample = devices[i].sensor; break; }
      }
      if (!sample) return;
      fetchSparkline(sample.id, apiKeys[mk]).then(function (pts) {
        var card = grid.querySelector('.conn-kpi-card--' + ({ rssi: 'cyan', snr: 'green', tx_ccq: 'amber', tx_rate: 'indigo' }[mk]));
        if (!card) return;
        var row = card.querySelector('.conn-kpi-card__spark-row');
        if (!row || pts.length < 2) return;
        row.innerHTML = sparklineSvg(pts, sparkColors[mk]);
      });
    });
    renderAlertStrip(devices);
  }

  function renderHealthRing(devices) {
    var ringEl = document.getElementById('connectivity-health-ring');
    var legendEl = document.getElementById('connectivity-health-legend');
    if (!ringEl) return;
    var quality = q();
    var colors = ringColors();
    var bandLabels = {
      excellent: t('connectivity_band_excellent', 'Excellent'),
      very_good: t('connectivity_band_very_good', 'Very good'),
      good_usable: t('connectivity_band_good_usable', 'Good'),
      weak_unstable: t('connectivity_band_weak_unstable', 'Weak'),
      bad: t('connectivity_band_bad', 'Bad')
    };
    var counts = quality.healthBandCounts ? quality.healthBandCounts(devices) : bandCounts(devices, 'rssi');
    var order = ['excellent', 'very_good', 'good_usable', 'weak_unstable', 'bad'];
    var data = order.map(function (bk) {
      return { name: bandLabels[bk], y: counts[bk] || 0, color: colors[bk] || BAND_COLORS[bk] };
    }).filter(function (d) { return d.y > 0; });
    var total = devices.length;
    if (!total || !data.length) {
      ringEl.innerHTML = '<p class="overview-live-note">' + esc(t('connectivity_no_data', 'No data')) + '</p>';
      if (legendEl) legendEl.innerHTML = '';
      return;
    }
    var tel = tile();
    ringEl.innerHTML = '';
    if (tel && tel.renderDonut) {
      tel.renderDonut(ringEl, {
        data: data,
        centerLabel: total,
        centerSubLabel: t('devices', 'devices'),
        height: 220,
        showLegend: false,
        innerSize: '72%'
      });
    }
    if (legendEl) {
      legendEl.innerHTML = order.map(function (bk) {
        var n = counts[bk] || 0;
        if (!n) return '';
        return '<span class="conn-health-legend__item"><span class="conn-health-legend__dot" style="background:' + (colors[bk] || BAND_COLORS[bk]) + '"></span>' +
          esc(bandLabels[bk]) + ' <strong>' + n + '</strong></span>';
      }).join('');
    }
  }

  function buildAlerts(devices) {
    var alerts = [];
    var byLoc = {};
    devices.forEach(function (d) {
      var loc = d.location || '';
      if (!byLoc[loc]) byLoc[loc] = { weakCcq: 0, weakRate: 0, stale: 0 };
      if (d.status.key === 'stale' || d.status.key === 'offline') byLoc[loc].stale += 1;
      if (d.classifications.tx_ccq && (d.classifications.tx_ccq.band_key === 'bad' || d.classifications.tx_ccq.band_key === 'weak_unstable')) {
        byLoc[loc].weakCcq += 1;
      }
      if (d.classifications.tx_rate && (d.classifications.tx_rate.band_key === 'bad' || d.classifications.tx_rate.band_key === 'weak_unstable')) {
        byLoc[loc].weakRate += 1;
      }
    });
    Object.keys(byLoc).forEach(function (loc) {
      var b = byLoc[loc];
      if (b.weakRate >= 2) {
        alerts.push(t('connectivity_alert_tx_rate', 'TX-rate degraded on :location').replace(':location', loc));
      }
      if (b.weakCcq >= 2) {
        alerts.push(t('connectivity_alert_weak_ccq', 'Weak TX-CCQ detected in :location').replace(':location', loc));
      }
    });
    var staleCount = devices.filter(function (d) { return d.status.key === 'stale'; }).length;
    if (staleCount) {
      alerts.push(t('connectivity_alert_stale_devices', ':count stale wireless devices').replace(':count', String(staleCount)));
    }
    var weakRssi = devices.filter(function (d) {
      return d.classifications.rssi && d.classifications.rssi.band_key === 'weak_unstable';
    }).length;
    if (weakRssi >= 2) {
      alerts.push(t('connectivity_alert_signal_instability', 'Signal instability detected'));
    }
    return alerts.slice(0, 12);
  }

  function renderAlertStrip(devices) {
    var strip = document.getElementById('connectivity-alert-strip');
    if (!strip) return;
    var alerts = buildAlerts(devices);
    if (!alerts.length) {
      strip.hidden = true;
      strip.innerHTML = '';
      return;
    }
    strip.hidden = false;
    var pills = alerts.concat(alerts).map(function (msg) {
      return '<span class="conn-alert-pill">' + esc(msg) + '</span>';
    }).join('');
    strip.innerHTML = '<div class="conn-alert-strip__track">' + pills + '</div>';
  }

  function bandRank(band) {
    var ranks = { excellent: 0, very_good: 1, good_usable: 2, weak_unstable: 3, bad: 4 };
    return ranks[band] !== undefined ? ranks[band] : 9;
  }

  function sortDevices(list) {
    var key = tableSort.key;
    var dir = tableSort.dir === 'desc' ? -1 : 1;
    return list.slice().sort(function (a, b) {
      var av; var bv;
      if (key === 'device') { av = a.name; bv = b.name; return dir * String(av).localeCompare(String(bv)); }
      if (key === 'location') { av = a.location; bv = b.location; return dir * String(av).localeCompare(String(bv)); }
      if (key === 'quality') {
        av = bandRank((a.overall && a.overall.dominant_band) || a.overall.overall_band);
        bv = bandRank((b.overall && b.overall.dominant_band) || b.overall.overall_band);
        return dir * (av - bv);
      }
      if (key === 'status') {
        av = a.status.key; bv = b.status.key;
        return dir * String(av).localeCompare(String(bv));
      }
      av = a.metrics[key]; bv = b.metrics[key];
      if (av === null) av = dir > 0 ? Infinity : -Infinity;
      if (bv === null) bv = dir > 0 ? Infinity : -Infinity;
      return dir * ((av || 0) - (bv || 0));
    });
  }

  function filterDevices(list) {
    var qstr = (tableSearch || '').trim().toLowerCase();
    if (!qstr) return list;
    return list.filter(function (d) {
      return (d.name || '').toLowerCase().indexOf(qstr) >= 0 ||
        (d.deviceId || '').toLowerCase().indexOf(qstr) >= 0 ||
        (d.location || '').toLowerCase().indexOf(qstr) >= 0;
    });
  }

  function sortTh(key, label) {
    var active = tableSort.key === key ? ' conn-th--active conn-th--' + tableSort.dir : '';
    return '<th class="conn-th' + active + '" data-sort="' + key + '" scope="col" tabindex="0">' + esc(label) + '</th>';
  }

  function renderWirelessTable(devices) {
    var root = document.getElementById('connectivity-wireless-table-root');
    if (!root) return;
    if (!devices.length) {
      root.innerHTML = '<p class="overview-live-note">' + esc(t('connectivity_breakdown_no_devices', 'No wireless devices in scope')) + '</p>';
      return;
    }
    tableDevices = devices;
    var rows = sortDevices(filterDevices(devices));
    var html = '<div class="conn-table-scroll"><table class="conn-table"><thead><tr>' +
      sortTh('device', t('connectivity_col_device', 'Device')) +
      sortTh('location', t('connectivity_col_location', 'Location')) +
      sortTh('rssi', 'RSSI') + sortTh('snr', 'SNR') + sortTh('tx_ccq', 'TX-CCQ') + sortTh('tx_rate', 'TX-rate') +
      sortTh('quality', t('connectivity_col_quality', 'Quality')) +
      sortTh('status', t('connectivity_col_status', 'Status')) +
      '</tr></thead><tbody>';
    rows.forEach(function (d) {
      var cls = d.classifications;
      var qLabel = d.overall.composite_label || d.overall.overall_label;
      var pulse = d.status.key === 'online' ? '<span class="conn-row-pulse" aria-hidden="true"></span>' : '';
      html += '<tr class="conn-table-row conn-table-row--' + esc(d.status.key) + '">' +
        '<td class="conn-td-device"><span class="conn-td-device__name">' + esc(d.name) + '</span>' +
        '<span class="conn-td-device__id">' + esc(d.deviceId) + '</span></td>' +
        '<td>' + esc(d.location) + '</td>' +
        metricCellHtml('rssi', cls.rssi, d.metrics.rssi) +
        metricCellHtml('snr', cls.snr, d.metrics.snr) +
        metricCellHtml('tx_ccq', cls.tx_ccq, d.metrics.tx_ccq) +
        metricCellHtml('tx_rate', cls.tx_rate, d.metrics.tx_rate) +
        '<td class="conn-td-quality">' + badgeHtml({ band_key: d.overall.dominant_band || d.overall.overall_band, label: qLabel, severity: d.overall.overall_severity }, qLabel) + '</td>' +
        '<td class="conn-td-status">' + pulse + '<span class="conn-status conn-status--' + esc(d.status.key) + '">' + esc(d.status.label) + '</span></td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    root.innerHTML = html;
    root.querySelectorAll('.conn-th[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-sort');
        if (tableSort.key === key) tableSort.dir = tableSort.dir === 'asc' ? 'desc' : 'asc';
        else { tableSort.key = key; tableSort.dir = 'asc'; }
        renderWirelessTable(tableDevices);
      });
    });
  }

  function renderAnalytics(devices) {
    var tel = tile();
    if (!tel || !devices.length) {
      ['conn-chart-rssi-dist', 'conn-chart-snr-dist', 'conn-chart-tx-ccq-donut', 'conn-chart-tx-rate-bars'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '<p class="overview-live-note">' + esc(t('connectivity_no_data', 'No data')) + '</p>';
      });
      return;
    }

    function bandSeries(counts, labels) {
      return ['excellent', 'very_good', 'good_usable', 'weak_unstable', 'bad'].map(function (bk) {
        return {
          name: labels[bk] || bk,
          y: counts[bk] || 0,
          color: BAND_COLORS[bk]
        };
      }).filter(function (d) { return d.y > 0; });
    }

    var bandLabels = {
      excellent: t('connectivity_band_excellent', 'Excellent'),
      very_good: t('connectivity_band_very_good', 'Very good'),
      good_usable: t('connectivity_band_good_usable', 'Good'),
      weak_unstable: t('connectivity_band_weak_unstable', 'Weak'),
      bad: t('connectivity_band_bad', 'Bad')
    };

    var rssiEl = document.getElementById('conn-chart-rssi-dist');
    if (rssiEl && tel.renderHeatStripColumn) {
      var rssiCounts = bandCounts(devices, 'rssi');
      var cats = []; var data = [];
      ['excellent', 'very_good', 'good_usable', 'weak_unstable', 'bad'].forEach(function (bk) {
        if (rssiCounts[bk]) { cats.push(bandLabels[bk]); data.push({ y: rssiCounts[bk], color: BAND_COLORS[bk] }); }
      });
      rssiEl.innerHTML = '';
      if (data.length) tel.renderHeatStripColumn(rssiEl, { data: data, categories: cats, showAxis: true, height: 140 });
      else rssiEl.innerHTML = '<p class="overview-live-note">—</p>';
    }

    var snrEl = document.getElementById('conn-chart-snr-dist');
    if (snrEl && tel.renderHeatStripColumn) {
      var snrCounts = bandCounts(devices, 'snr');
      var sc = []; var sd = [];
      ['excellent', 'very_good', 'good_usable', 'weak_unstable', 'bad'].forEach(function (bk) {
        if (snrCounts[bk]) { sc.push(bandLabels[bk]); sd.push({ y: snrCounts[bk], color: BAND_COLORS[bk] }); }
      });
      snrEl.innerHTML = '';
      if (sd.length) tel.renderHeatStripColumn(snrEl, { data: sd, categories: sc, showAxis: true, height: 140 });
      else snrEl.innerHTML = '<p class="overview-live-note">—</p>';
    }

    var ccqEl = document.getElementById('conn-chart-tx-ccq-donut');
    if (ccqEl && tel.renderDonut) {
      var ccqCounts = bandCounts(devices, 'tx_ccq');
      var donutData = bandSeries(ccqCounts, bandLabels);
      ccqEl.innerHTML = '';
      if (donutData.length) {
        tel.renderDonut(ccqEl, {
          data: donutData,
          centerLabel: devices.length,
          centerSubLabel: t('devices', 'devices'),
          height: 150,
          showLegend: true
        });
      } else ccqEl.innerHTML = '<p class="overview-live-note">—</p>';
    }

    renderTxRateChart(document.getElementById('conn-chart-tx-rate-bars'), devices, tel);
  }

  function renderTxRateChart(rateEl, devices, tel) {
    if (!rateEl) return;
    var rates = devices.map(function (d) { return d.metrics.tx_rate; }).filter(function (v) {
      return v !== null && Number.isFinite(Number(v));
    }).map(Number);
    rateEl.innerHTML = '';
    if (!rates.length) {
      rateEl.innerHTML = '<p class="overview-live-note">—</p>';
      return;
    }
    var buckets = [
      { label: '0–24', min: 0, max: 24, color: BAND_COLORS.bad },
      { label: '24–72', min: 24, max: 72, color: BAND_COLORS.weak_unstable },
      { label: '72–150', min: 72, max: 150, color: BAND_COLORS.good_usable },
      { label: '150–300', min: 150, max: 300, color: BAND_COLORS.very_good },
      { label: '300+', min: 300, max: Infinity, color: BAND_COLORS.excellent }
    ];
    var series = buckets.map(function (b) { return { name: b.label, y: 0, color: '#818cf8' }; });
    rates.forEach(function (v) {
      for (var i = 0; i < buckets.length; i++) {
        if (v >= buckets[i].min && (buckets[i].max === Infinity || v < buckets[i].max)) {
          series[i].y += 1;
          series[i].color = buckets[i].color;
          break;
        }
      }
    });
    var avg = rates.reduce(function (a, b) { return a + b; }, 0) / rates.length;
    if (global.Highcharts) {
      global.Highcharts.chart(rateEl, {
        chart: { type: 'column', height: 150, backgroundColor: 'transparent', animation: { duration: 500 } },
        title: { text: null },
        credits: { enabled: false },
        legend: { enabled: false },
        xAxis: {
          categories: buckets.map(function (b) { return b.label; }),
          title: { text: 'Mbps', style: { color: '#94a3b8', fontSize: '10px' } },
          labels: { style: { color: '#94a3b8', fontSize: '10px' } },
          lineColor: 'rgba(148,163,184,0.25)'
        },
        yAxis: {
          min: 0,
          allowDecimals: false,
          title: { text: t('devices', 'devices'), style: { color: '#94a3b8', fontSize: '10px' } },
          gridLineColor: 'rgba(148,163,184,0.12)',
          labels: { style: { color: '#94a3b8', fontSize: '10px' } }
        },
        subtitle: {
          text: 'Avg ' + avg.toFixed(0) + ' Mbps · <24 weak',
          style: { color: '#a5b4fc', fontSize: '10px' },
          align: 'right'
        },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          borderColor: 'rgba(129,140,248,0.4)',
          style: { color: '#e2e8f0', fontSize: '11px' }
        },
        plotOptions: { column: { borderRadius: 3, animation: { duration: 500 }, color: '#818cf8' } },
        series: [{ name: 'TX-rate', data: series.map(function (s) { return { y: s.y, color: s.color }; }) }]
      });
      return;
    }
    if (tel && tel.renderHorizontalBars) {
      var ranked = devices.filter(function (d) { return d.metrics.tx_rate !== null; })
        .sort(function (a, b) { return (b.metrics.tx_rate || 0) - (a.metrics.tx_rate || 0); })
        .slice(0, 12).map(function (d) {
          return {
            label: d.name,
            value: d.metrics.tx_rate,
            color: BAND_COLORS[(d.classifications.tx_rate && d.classifications.tx_rate.band_key) || 'good_usable'],
            unit: 'Mbps'
          };
        });
      tel.renderHorizontalBars(rateEl, { items: ranked, unit: 'Mbps' });
    }
  }

  function renderAttention(devices) {
    var panel = document.getElementById('connectivity-attention-panel');
    if (!panel) return;
    if (!devices.length) {
      panel.innerHTML = '<p class="overview-live-note">' + esc(t('connectivity_attention_none', 'No issues detected')) + '</p>';
      return;
    }
    var items = [];
    devices.forEach(function (d) {
      if (d.status.key === 'offline' || d.status.key === 'stale') {
        items.push({ type: 'stale', label: d.name, detail: d.status.label + ' · ' + d.location, severity: 'warning' });
      }
      if (d.classifications.rssi && (d.classifications.rssi.band_key === 'bad' || d.classifications.rssi.band_key === 'weak_unstable')) {
        items.push({ type: 'rssi', label: d.name, detail: 'RSSI ' + d.classifications.rssi.value + ' dBm', severity: d.classifications.rssi.severity });
      }
      if (d.classifications.tx_ccq && (d.classifications.tx_ccq.band_key === 'bad' || d.classifications.tx_ccq.band_key === 'weak_unstable')) {
        items.push({ type: 'ccq', label: d.name, detail: 'TX-CCQ ' + d.classifications.tx_ccq.value + '%', severity: d.classifications.tx_ccq.severity });
      }
    });
    items = items.slice(0, 8);
    if (!items.length) {
      panel.innerHTML = '<p class="overview-live-note conn-attention-ok">' + esc(t('connectivity_attention_none', 'All links within acceptable ranges')) + '</p>';
      return;
    }
    panel.innerHTML = items.map(function (it) {
      return '<div class="conn-attention-item conn-attention-item--' + esc(it.severity) + '">' +
        '<span class="conn-attention-item__label">' + esc(it.label) + '</span>' +
        '<span class="conn-attention-item__detail">' + esc(it.detail) + '</span></div>';
    }).join('');
  }

  function renderDeviceGrid(devices) {
    var grid = document.getElementById('connectivity-device-grid');
    if (!grid) return;
    if (!devices.length) {
      grid.innerHTML = '<p class="overview-live-note">—</p>';
      return;
    }
    var sorted = devices.slice().sort(function (a, b) {
      var ar = a.overall.overall_band || 'z';
      var br = b.overall.overall_band || 'z';
      return String(ar).localeCompare(String(br));
    });
    grid.innerHTML = sorted.slice(0, 24).map(function (d) {
      var rssiPct = metricBarPct('rssi', d.metrics.rssi);
      var qLabel = d.overall.composite_label || d.overall.overall_label;
      var pulse = d.status.key === 'online' ? '<span class="conn-device-card__pulse" aria-hidden="true"></span>' : '';
      return (
        '<article class="conn-device-card conn-device-card--' + esc(d.status.key) + '">' +
        '<div class="conn-device-card__quality">' + badgeHtml({ band_key: d.overall.dominant_band || d.overall.overall_band, label: qLabel, severity: d.overall.overall_severity }) + '</div>' +
        pulse +
        '<div class="conn-device-card__name">' + esc(d.name) + '</div>' +
        '<div class="conn-device-card__loc">' + esc(d.location) + '</div>' +
        '<div class="conn-device-card__signal">' +
        wirelessBarsSvg(rssiPct) +
        '<div class="conn-device-card__signal-track"><span style="width:' + rssiPct + '%"></span></div>' +
        '<span class="conn-device-card__signal-val">' + (d.metrics.rssi !== null ? esc(d.metrics.rssi) + ' dBm' : '—') + '</span>' +
        '</div>' +
        '<div class="conn-device-card__tx">' +
        '<span class="conn-device-card__tx-label">TX-rate</span>' +
        '<span class="conn-device-card__tx-val">' + (d.metrics.tx_rate !== null ? esc(d.metrics.tx_rate) + ' Mbps' : '—') + '</span>' +
        '</div></article>'
      );
    }).join('');
  }

  function updateHero(devices, sensors) {
    var onlineEl = document.getElementById('connectivity-online-count');
    var legacyEl = document.getElementById('connectivity-connected-sensors');
    var online = 0;
    (sensors || []).forEach(function (s) {
      if (!sensorMatchesScope(s)) return;
      var st = linkStatus(s);
      if (st.key === 'online') online += 1;
    });
    var txt = String(online);
    if (onlineEl) onlineEl.textContent = txt;
    if (legacyEl) legacyEl.textContent = txt;

    var lastEl = document.getElementById('connectivity-last-updated');
    if (lastEl && devices.length) {
      var latest = devices.reduce(function (best, d) {
        var t0 = d.measuredAt ? new Date(d.measuredAt).getTime() : 0;
        return t0 > best ? t0 : best;
      }, 0);
      if (latest) lastEl.textContent = t('last_update', 'Last update') + ': ' + new Date(latest).toLocaleString();
    }
  }

  function fingerprint(devices) {
    var scope = activeLocation() || '';
    return scope + '|' + devices.map(function (d) {
      return d.deviceId + ':' + (d.measuredAt || '') + ':' + JSON.stringify(d.metrics);
    }).join(';');
  }

  function refresh() {
    if (global.SMACA_CURRENT_PAGE !== 'connectivity') return;
    var token = ++refreshToken;
    var load = Promise.resolve();
    if (global.SMACAApi && typeof global.SMACAApi.fetchSensors === 'function') {
      load = global.SMACAApi.fetchSensors();
    } else if (global.SMACADashboardContext && global.SMACADashboardContext.sensors) {
      load = Promise.resolve({ rows: global.SMACADashboardContext.sensors });
    }
    load.then(function (resp) {
      if (token !== refreshToken) return;
      var sensors = (resp && resp.rows) ? resp.rows : (Array.isArray(resp) ? resp : []);
      if (global.SMACADashboardContext) global.SMACADashboardContext.sensors = sensors;
      var devices = getWirelessDevices(sensors);
      var fp = fingerprint(devices);
      if (fp === lastFingerprint) return;
      lastFingerprint = fp;
      sparkCache = {};
      updateHero(devices, sensors);
      renderHealthRing(devices);
      renderKpiGrid(devices);
      renderWirelessTable(devices);
      renderAnalytics(devices);
      renderAttention(devices);
      renderDeviceGrid(devices);
    }).catch(function () {
      if (token !== refreshToken) return;
      var grid = document.getElementById('connectivity-kpi-grid');
      if (grid) grid.innerHTML = '<p class="overview-live-note">' + esc(t('connectivity_no_data', 'No connectivity data')) + '</p>';
    });
  }

  function init() {
    if (global.SMACA_CURRENT_PAGE !== 'connectivity') return;
    var searchInput = document.getElementById('connectivity-table-search');
    if (searchInput && !searchInput.dataset.connBound) {
      searchInput.dataset.connBound = '1';
      searchInput.addEventListener('input', function () {
        tableSearch = searchInput.value || '';
        renderWirelessTable(tableDevices);
      });
    }
    refresh();
    global.addEventListener('smaca:scope-changed', function () { lastFingerprint = ''; refresh(); });
    global.addEventListener('smaca:timeframe-changed', function () { lastFingerprint = ''; sparkCache = {}; refresh(); });
    if (global.SMACADashboardContext) {
      var obs = new MutationObserver(function () {
        if (global.SMACADashboardContext.sensors && global.SMACADashboardContext.sensors.length) {
          lastFingerprint = '';
          refresh();
        }
      });
      /* noop — rely on production-features sensor load events */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.addEventListener('smaca:sensors-refreshed', function () { lastFingerprint = ''; refresh(); });

  global.SMACAConnectivityDashboard = {
    refresh: refresh,
    getWirelessDevices: getWirelessDevices,
    buildWirelessDevice: buildWirelessDevice
  };
})(typeof window !== 'undefined' ? window : this);
