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
      '<polyline fill="none" stroke="' + esc(stroke) + '" stroke-width="1.5" points="' + coords + '"/></svg>';
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
    var band = cls ? cls.label : t('connectivity_no_data', 'No data');
    return (
      '<article class="conn-kpi-card conn-kpi-card--' + accent + '">' +
      '<div class="conn-kpi-card__icon" aria-hidden="true">' + (spec.icon || '') + '</div>' +
      '<div class="conn-kpi-card__body">' +
      '<div class="conn-kpi-card__label">' + esc(label) + '</div>' +
      '<div class="conn-kpi-card__value-row">' +
      '<span class="conn-kpi-card__value">' + esc(String(val)) + '</span>' +
      spark +
      '<span class="conn-kpi-card__band badge badge--' + esc(cls ? cls.severity : 'muted') + '">' + esc(band) + '</span>' +
      '</div></div></article>'
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
      severity: overall.overall_severity,
      value: overall.overall_label,
      unit: ''
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
        var row = card.querySelector('.conn-kpi-card__value-row');
        if (!row || pts.length < 2) return;
        var existing = row.querySelector('.conn-spark');
        if (existing) existing.remove();
        row.insertAdjacentHTML('beforeend', sparklineSvg(pts, sparkColors[mk]));
      });
    });
  }

  function renderWirelessTable(devices) {
    var root = document.getElementById('connectivity-wireless-table-root');
    if (!root) return;
    if (!devices.length) {
      root.innerHTML = '<p class="overview-live-note">' + esc(t('connectivity_breakdown_no_devices', 'No wireless devices in scope')) + '</p>';
      return;
    }
    var groups = {};
    devices.forEach(function (d) {
      var fk = d.floorKey;
      if (!groups[fk]) groups[fk] = [];
      groups[fk].push(d);
    });
    var floors = Object.keys(groups).sort();
    var html = '';
    floors.forEach(function (fk) {
      var rows = groups[fk];
      var floorLabel = fk === '__other' ? t('iaq_sensor_breakdown_unknown_location', 'Other') :
        (global.SMACASpatial && global.SMACASpatial.labelFor ? global.SMACASpatial.labelFor(fk) : fk);
      html += '<div class="conn-table-group"><div class="conn-table-group__head">' + esc(floorLabel) +
        ' <span class="conn-table-group__count">' + rows.length + '</span></div>';
      html += '<div class="conn-table-scroll"><table class="conn-table"><thead><tr>' +
        '<th>' + esc(t('connectivity_col_device', 'Device')) + '</th>' +
        '<th>' + esc(t('connectivity_col_location', 'Location')) + '</th>' +
        '<th>RSSI</th><th>SNR</th><th>TX-CCQ</th><th>TX-rate</th>' +
        '<th>' + esc(t('connectivity_col_quality', 'Quality')) + '</th>' +
        '<th>' + esc(t('connectivity_col_status', 'Status')) + '</th>' +
        '</tr></thead><tbody>';
      rows.sort(function (a, b) {
        var ar = (a.overall.metrics && Object.keys(a.overall.metrics).length) ? (a.overall.overall_band || '') : 'z';
        var br = (b.overall.metrics && Object.keys(b.overall.metrics).length) ? (b.overall.overall_band || '') : 'z';
        return String(ar).localeCompare(String(br));
      });
      rows.forEach(function (d) {
        var cls = d.classifications;
        html += '<tr class="conn-table-row conn-table-row--' + esc(d.status.key) + '">' +
          '<td class="conn-td-device"><span class="conn-td-device__name">' + esc(d.name) + '</span>' +
          '<span class="conn-td-device__id">' + esc(d.deviceId) + '</span></td>' +
          '<td>' + esc(d.location) + '</td>' +
          metricCellHtml('rssi', cls.rssi, d.metrics.rssi) +
          metricCellHtml('snr', cls.snr, d.metrics.snr) +
          metricCellHtml('tx_ccq', cls.tx_ccq, d.metrics.tx_ccq) +
          metricCellHtml('tx_rate', cls.tx_rate, d.metrics.tx_rate) +
          '<td>' + badgeHtml({ band_key: d.overall.overall_band, label: d.overall.overall_label, severity: d.overall.overall_severity }, d.overall.overall_label) + '</td>' +
          '<td><span class="conn-status conn-status--' + esc(d.status.key) + '">' + esc(d.status.label) + '</span></td>' +
          '</tr>';
      });
      html += '</tbody></table></div></div>';
    });
    root.innerHTML = html;
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

    var rateEl = document.getElementById('conn-chart-tx-rate-bars');
    if (rateEl && tel.renderRankedBars) {
      var ranked = devices
        .filter(function (d) { return d.metrics.tx_rate !== null; })
        .sort(function (a, b) { return (b.metrics.tx_rate || 0) - (a.metrics.tx_rate || 0); })
        .slice(0, 12)
        .map(function (d) {
          return {
            label: d.name,
            value: d.metrics.tx_rate,
            color: BAND_COLORS[(d.classifications.tx_rate && d.classifications.tx_rate.band_key) || 'good_usable'],
            unit: 'Mbps'
          };
        });
      rateEl.innerHTML = '';
      if (ranked.length && tel.renderHorizontalBars) tel.renderHorizontalBars(rateEl, { items: ranked, unit: 'Mbps' });
      else rateEl.innerHTML = '<p class="overview-live-note">—</p>';
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
      var pulse = d.status.key === 'online' ? '<span class="conn-device-card__pulse" aria-hidden="true"></span>' : '';
      return (
        '<article class="conn-device-card conn-device-card--' + esc(d.status.key) + '">' +
        pulse +
        '<div class="conn-device-card__head">' +
        '<span class="conn-device-card__name">' + esc(d.name) + '</span>' +
        badgeHtml({ band_key: d.overall.overall_band, label: d.overall.overall_label, severity: d.overall.overall_severity }) +
        '</div>' +
        '<div class="conn-device-card__loc">' + esc(d.location) + '</div>' +
        '<div class="conn-device-card__signal">' +
        '<span class="conn-device-card__signal-label">RSSI</span>' +
        '<span class="conn-device-card__signal-bar"><span style="width:' + rssiPct + '%"></span></span>' +
        '<span class="conn-device-card__signal-val">' + (d.metrics.rssi !== null ? esc(d.metrics.rssi) + ' dBm' : '—') + '</span>' +
        '</div>' +
        '<div class="conn-device-card__foot">' +
        '<span>TX ' + (d.metrics.tx_rate !== null ? esc(d.metrics.tx_rate) + ' Mbps' : '—') + '</span>' +
        '<span class="conn-status conn-status--' + esc(d.status.key) + '">' + esc(d.status.label) + '</span>' +
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
