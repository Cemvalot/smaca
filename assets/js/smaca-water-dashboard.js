/**
 * Water meter monitoring dashboard — readings / sensor_latest only.
 */
(function (global) {
  'use strict';

  var root = (typeof global !== 'undefined' && global)
    || (typeof window !== 'undefined' && window)
    || (typeof self !== 'undefined' && self)
    || {};

  var refreshToken = 0;
  var warnedDirectFetch = false;

  var ALARM_LABEL_KEYS = {
    leakage: 'water_alarm_leakage',
    burst: 'water_alarm_burst',
    backflow: 'water_alarm_backflow',
    low_battery: 'water_alarm_low_battery',
    firmware_changed: 'water_alarm_firmware_changed',
    meter_tamper: 'water_alarm_meter_tamper',
    meter_magnetic_field: 'water_alarm_magnetic_field',
    dry: 'water_alarm_dry',
    clock_invalid: 'water_alarm_clock_invalid',
    hardware_fault: 'water_alarm_hardware_fault',
    low_temperature: 'water_alarm_low_temperature'
  };

  function t(key, fb) {
    return (root.SMACA_TRANSLATIONS || {})[key] || fb;
  }

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtNum(n, digits) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
    var d = digits !== undefined ? digits : 0;
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return '—';
    }
  }

  function alarmLabel(code) {
    var key = ALARM_LABEL_KEYS[String(code || '').toLowerCase()];
    return key ? t(key, String(code)) : esc(code);
  }

  function badgeClassForStatus(status) {
    if (status === 'critical') return 'badge--danger';
    if (status === 'warning') return 'badge--warning';
    if (status === 'normal') return 'badge--info';
    return 'badge--muted';
  }

  function readTimeframe() {
    var allowed = ['24h', '7d', '30d'];
    try {
      var fromState = (root.SMACAState && root.SMACAState.currentTimeframe) || '';
      if (allowed.indexOf(String(fromState)) !== -1) return fromState;
      var fromGlobal = root.SMACA_TIMEFRAME || '';
      if (allowed.indexOf(String(fromGlobal)) !== -1) return fromGlobal;
    } catch (e) {}
    return '24h';
  }

  function warnDirectFetch() {
    if (warnedDirectFetch) return;
    warnedDirectFetch = true;
    try {
      console.warn('[Water] SMACAApi not available, using direct fetch');
    } catch (e) {}
  }

  function directFetchJson(path) {
    return fetch(path, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) {
          var message = (data && (data.message || data.error)) || ('HTTP ' + response.status);
          throw new Error(String(message));
        }
        return data;
      }).catch(function (parseErr) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        throw parseErr;
      });
    });
  }

  function fetchSummary() {
    var api = root.SMACAApi || null;
    if (api && typeof api.fetchWaterSummary === 'function') {
      try {
        return api.fetchWaterSummary();
      } catch (e) {
        warnDirectFetch();
        return directFetchJson('/api/water/summary');
      }
    }
    warnDirectFetch();
    return directFetchJson('/api/water/summary');
  }

  function fetchTimeseries(tf) {
    var timeframe = tf || readTimeframe() || '24h';
    var api = root.SMACAApi || null;
    if (api && typeof api.fetchWaterTimeseries === 'function') {
      try {
        return api.fetchWaterTimeseries({ timeframe: timeframe });
      } catch (e) {
        warnDirectFetch();
        return directFetchJson('/api/water/timeseries?timeframe=' + encodeURIComponent(timeframe));
      }
    }
    warnDirectFetch();
    return directFetchJson('/api/water/timeseries?timeframe=' + encodeURIComponent(timeframe));
  }

  function setEmptyState(show) {
    var empty = document.getElementById('water-empty-state');
    var main = document.getElementById('water-dashboard-main');
    if (empty) empty.style.display = show ? 'block' : 'none';
    if (main) main.hidden = !!show;
  }

  function renderHero(latest, status) {
    var heroVol = document.getElementById('water-hero-volume');
    var lastUp = document.getElementById('water-last-updated');
    if (heroVol) {
      var liters = latest && latest.volume_at_log_time_liters;
      heroVol.textContent = liters != null ? fmtNum(liters, 0) + ' L' : '—';
    }
    if (lastUp) {
      lastUp.textContent = t('last_update', 'Last updated') + ': ' + (latest && latest.measured_at ? fmtDate(latest.measured_at) : t('not_available', 'Not available'));
    }
    if (heroVol && status) {
      heroVol.classList.remove('water-hero--normal', 'water-hero--warning', 'water-hero--critical');
      if (status === 'warning') heroVol.classList.add('water-hero--warning');
      else if (status === 'critical') heroVol.classList.add('water-hero--critical');
      else if (status === 'normal') heroVol.classList.add('water-hero--normal');
    }
  }

  function renderKpis(summary) {
    var latest = summary.latest || {};
    var alarms = Array.isArray(latest.active_alarms) ? latest.active_alarms : [];
    var liters = latest.volume_at_log_time_liters;
    var m3 = latest.volume_at_log_time_m3;

    var consumptionVal = document.querySelector('[data-water-value="consumption"]');
    var consumptionMeta = document.querySelector('[data-water-meta="consumption-m3"]');
    if (consumptionVal) {
      consumptionVal.textContent = liters != null ? fmtNum(liters, 0) + ' L' : '—';
    }
    if (consumptionMeta) {
      consumptionMeta.textContent = m3 != null
        ? fmtNum(m3, 3) + ' m³'
        : '—';
    }

    var batteryVal = document.querySelector('[data-water-value="battery"]');
    if (batteryVal) {
      batteryVal.textContent = latest.battery_lifetime_months != null
        ? fmtNum(latest.battery_lifetime_months, 0)
        : '—';
    }

    var alarmsVal = document.querySelector('[data-water-value="alarms"]');
    var alarmsMeta = document.querySelector('[data-water-meta="alarms-caption"]');
    if (alarmsVal) {
      alarmsVal.textContent = String(alarms.length);
    }
    if (alarmsMeta) {
      alarmsMeta.textContent = alarms.length === 0
        ? t('water_no_active_alarms', 'No Active Alarms')
        : t('water_active_alarms_count', ':count active').replace(':count', String(alarms.length));
    }

    var lastVal = document.querySelector('[data-water-value="last-reading"]');
    var sensorMeta = document.querySelector('[data-water-meta="sensor-uid"]');
    if (lastVal) lastVal.textContent = fmtDate(latest.measured_at);
    if (sensorMeta) {
      sensorMeta.textContent = latest.sensor_uid
        ? (latest.sensor_name ? latest.sensor_name + ' · ' + latest.sensor_uid : latest.sensor_uid)
        : '—';
    }
  }

  function renderAlarmsPanel(summary) {
    var panel = document.getElementById('water-alarms-panel');
    if (!panel) return;

    var latest = summary.latest || {};
    var alarms = Array.isArray(latest.active_alarms) ? latest.active_alarms : [];
    var status = summary.status || 'no_data';

    if (alarms.length === 0) {
      panel.innerHTML =
        '<div class="water-alarms-panel__ok">' +
        '<span class="badge badge--info">' + esc(t('water_status_normal', 'Normal')) + '</span>' +
        '<p>' + esc(t('water_no_active_alarms_message', 'No active water alarms.')) + '</p>' +
        '</div>';
      return;
    }

    var badges = alarms.map(function (code) {
      var cls = badgeClassForStatus(status);
      if (['leakage', 'burst', 'backflow'].indexOf(String(code).toLowerCase()) !== -1) {
        cls = 'badge--danger';
      } else if (String(code).toLowerCase() === 'low_battery') {
        cls = 'badge--warning';
      }
      return '<span class="badge ' + cls + ' water-alarm-badge">' + alarmLabel(code) + '</span>';
    }).join('');

    panel.innerHTML = '<div class="water-alarms-panel__badges">' + badges + '</div>';
  }

  function renderDetails(summary) {
    var list = document.getElementById('water-details-list');
    if (!list) return;
    var latest = summary.latest || {};
    var rows = [
      [t('water_detail_sensor', 'Sensor'), latest.sensor_uid || '—'],
      [t('water_detail_volume_l', 'Volume (L)'), latest.volume_at_log_time_liters != null ? fmtNum(latest.volume_at_log_time_liters, 0) : '—'],
      [t('water_detail_volume_m3', 'Volume (m³)'), latest.volume_at_log_time_m3 != null ? fmtNum(latest.volume_at_log_time_m3, 3) : '—'],
      [t('water_detail_battery', 'Battery lifetime'), latest.battery_lifetime_months != null ? fmtNum(latest.battery_lifetime_months, 0) + ' ' + t('water_card_battery_unit', 'months') : '—'],
      [t('water_detail_status', 'Status'), t('water_status_' + (summary.status || 'no_data'), summary.status || 'no_data')],
      [t('water_detail_measured', 'Measured at'), fmtDate(latest.measured_at)]
    ];
    list.innerHTML = rows.map(function (row) {
      return '<div class="water-details-list__row"><dt>' + esc(row[0]) + '</dt><dd>' + esc(String(row[1])) + '</dd></div>';
    }).join('');
  }

  function renderChart(timeseries) {
    var containerId = 'water-consumption-chart';
    var container = document.getElementById(containerId);
    if (!container) return;

    var points = (timeseries && Array.isArray(timeseries.points)) ? timeseries.points : [];
    if (!points.length) {
      container.innerHTML = '<p class="chart-empty-note">' + esc(t('water_chart_no_points', 'No volume readings in this timeframe.')) + '</p>';
      return;
    }

    var adapter = root.SMACAHighchartsAdapter || null;
    var loader = root.SMACAHighchartsLoader || null;
    var run = function () {
      if (!adapter || !adapter.createOrUpdateChart || !adapter.hasHighcharts || !adapter.hasHighcharts()) {
        container.innerHTML = '<p class="chart-empty-note">' + esc(t('water_chart_unavailable', 'Chart unavailable.')) + '</p>';
        return;
      }

      var seriesData = points.map(function (p) {
        var ms = new Date(p.measured_at).getTime();
        var v = Number(p.volume_at_log_time_liters);
        return [ms, Number.isFinite(v) ? v : null];
      }).filter(function (pt) { return Number.isFinite(pt[0]); });

      var yValues = seriesData.map(function (pt) { return pt[1]; }).filter(function (v) { return v !== null && Number.isFinite(v); });
      var yMax = yValues.length ? Math.max.apply(null, yValues) : 0;
      var yCeil = Math.max(10, Math.ceil(yMax * 1.08));

      adapter.createOrUpdateChart({
        chartKey: 'water-consumption',
        containerId: containerId,
        options: {
          chart: { type: 'spline', backgroundColor: 'transparent', animation: false, spacingTop: 18, spacingBottom: 22 },
          title: { text: null },
          credits: { enabled: false },
          legend: { enabled: false },
          time: { useUTC: false },
          xAxis: {
            type: 'datetime',
            lineColor: 'rgba(148, 163, 184, 0.28)',
            labels: { style: { color: '#94a3b8', fontSize: '11px' } }
          },
          yAxis: {
            min: 0,
            max: yCeil,
            title: {
              text: t('water_chart_yaxis', 'Liters'),
              style: { color: '#7c8ca2', fontSize: '10px' }
            },
            gridLineColor: 'rgba(148, 163, 184, 0.14)',
            labels: { style: { color: '#a7b4c5', fontSize: '11px' } }
          },
          tooltip: {
            shared: true,
            backgroundColor: 'rgba(15, 23, 42, 0.97)',
            borderColor: 'rgba(148, 163, 184, 0.26)',
            style: { color: '#e2e8f0', fontSize: '11px' },
            xDateFormat: '%d %b %H:%M'
          },
          series: [{
            name: t('water_chart_series', 'Volume'),
            data: seriesData,
            color: '#38bdf8',
            lineWidth: 2,
            marker: { enabled: seriesData.length <= 48, radius: 3 }
          }]
        }
      });
    };

    if (loader && typeof loader.load === 'function') {
      loader.load().then(run).catch(run);
    } else {
      run();
    }
  }

  function applySummary(summary) {
    var available = !!(summary && summary.available && summary.latest);
    setEmptyState(!available);
    if (!available) {
      renderHero(null, 'no_data');
      return;
    }
    renderHero(summary.latest, summary.status);
    renderKpis(summary);
    renderAlarmsPanel(summary);
    renderDetails(summary);
  }

  function refresh() {
    var token = ++refreshToken;
    var tf = readTimeframe();
    var summaryPromise = fetchSummary();
    var tsPromise = fetchTimeseries(tf);

    Promise.all([summaryPromise, tsPromise])
      .then(function (results) {
        if (token !== refreshToken) return;
        var summary = results[0] || {};
        applySummary(summary);
        if (summary && summary.available) {
          renderChart(results[1] || { points: [] });
        } else {
          var chartEl = document.getElementById('water-consumption-chart');
          if (chartEl) chartEl.innerHTML = '';
        }
      })
      .catch(function (err) {
        if (token !== refreshToken) return;
        try {
          console.warn('[Water] refresh failed', err);
        } catch (logErr) {}
        setEmptyState(true);
        renderHero(null, 'no_data');
      });
  }

  function init() {
    if (!document.getElementById('water')) return;
    try {
      refresh();
    } catch (e) {
      try {
        console.warn('[Water] init refresh failed', e);
      } catch (logErr) {}
      setEmptyState(true);
      renderHero(null, 'no_data');
    }
    if (typeof root.addEventListener === 'function') {
      root.addEventListener('smaca:timeframe-changed', refresh);
      root.addEventListener('smaca:scope-changed', refresh);
    }
    setInterval(refresh, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  root.SMACAWaterDashboard = { refresh: refresh };
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
