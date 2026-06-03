/**
 * SMACA AI / Alerts admin page — operational alert monitoring (Phase 1 UI).
 * Data: GET /api/alerts/summary, GET /api/alerts/events
 */
(function (global) {
  'use strict';

  var METRIC_LABELS = {
    co2_ppm: 'CO₂',
    temperature_c: 'Temperature',
    humidity_rh: 'Humidity',
    battery_pct: 'Battery',
    rssi: 'RSSI',
    uv_index: 'UV index',
    energy_kwh: 'Energy',
    people_total_in: 'People in (total)',
    people_total_out: 'People out (total)'
  };

  function pageRoot() {
    return document.getElementById('ai-insights');
  }

  var PAGE_I18N_DATASET = {
    unavailable: 'i18nUnavailable',
    no_events: 'i18nNoEvents',
    action_pending: 'i18nActionPending',
    acknowledge: 'i18nAcknowledge',
    resolve: 'i18nResolve',
    sensor_id: 'i18nSensorId',
    not_available: 'i18nNotAvailable'
  };

  function pageI18n(key, fallback) {
    var root = pageRoot();
    var dsKey = PAGE_I18N_DATASET[key];
    if (root && dsKey && root.dataset[dsKey]) {
      return root.dataset[dsKey];
    }
    return fallback;
  }

  function tr(key, fallback) {
    var map = (global.SMACA_TRANSLATIONS || {});
    if (map && Object.prototype.hasOwnProperty.call(map, key) && map[key]) {
      return map[key];
    }
    return fallback;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMetricLabel(metricKey) {
    var key = String(metricKey || '').trim();
    if (!key) return pageI18n('not_available', 'Not available');
    if (METRIC_LABELS[key]) return METRIC_LABELS[key];
    return key.replace(/_/g, ' ');
  }

  function formatCondition(operator, threshold) {
    var op = String(operator || '').trim() || '>';
    var th = threshold;
    if (th === null || th === undefined || th === '') return op;
    var num = Number(th);
    if (Number.isFinite(num)) {
      return op + ' ' + (Number.isInteger(num) ? String(num) : num.toFixed(2));
    }
    return op + ' ' + String(th);
  }

  function formatValue(value, metricKey) {
    if (value === null || value === undefined || value === '') {
      return pageI18n('not_available', 'Not available');
    }
    var num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    var key = String(metricKey || '');
    if (key === 'co2_ppm') return String(Math.round(num)) + ' ppm';
    if (key === 'battery_pct') return String(Math.round(num)) + '%';
    if (key === 'temperature_c') return num.toFixed(1) + ' °C';
    if (key === 'humidity_rh') return num.toFixed(1) + '% RH';
    if (key === 'rssi') return String(Math.round(num)) + ' dBm';
    return Number.isInteger(num) ? String(num) : num.toFixed(2);
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    try {
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return d.toISOString();
    }
  }

  function formatDetails(details) {
    if (details === null || details === undefined || details === '') return '—';
    if (typeof details === 'string') {
      var trimmed = details.trim();
      if (!trimmed) return '—';
      try {
        var parsed = JSON.parse(trimmed);
        return escapeHtml(JSON.stringify(parsed, null, 0));
      } catch (e) {
        return escapeHtml(trimmed);
      }
    }
    if (typeof details === 'object') {
      try {
        return escapeHtml(JSON.stringify(details));
      } catch (e2) {
        return '—';
      }
    }
    return escapeHtml(String(details));
  }

  function resolveDisplayStatus(event) {
    var status = String((event && event.status) || '').toLowerCase();
    if (event && event.ack_at) return 'acknowledged';
    if (status === 'acknowledged') return 'acknowledged';
    if (status === 'resolved') return 'resolved';
    if (status === 'active') return 'active';
    return status || 'unknown';
  }

  function statusBadgeClass(status) {
    if (status === 'active') return 'badge--danger';
    if (status === 'acknowledged') return 'badge--warning';
    if (status === 'resolved') return 'badge--muted';
    return 'badge--info';
  }

  function buildSensorIndex(sensorsPayload) {
    var map = Object.create(null);
    var rows = sensorsPayload && Array.isArray(sensorsPayload.rows) ? sensorsPayload.rows : [];
    rows.forEach(function (row) {
      if (!row) return;
      var id = row.id != null ? String(row.id) : '';
      if (!id) return;
      map[id] = {
        label: row.name || row.external_id || row.sensor_uid || ('Sensor ' + id),
        externalId: row.external_id || row.sensor_uid || null
      };
    });
    return map;
  }

  function resolveSensorLabel(sensorId, sensorIndex) {
    var id = sensorId != null ? String(sensorId) : '';
    var entry = id && sensorIndex[id] ? sensorIndex[id] : null;
    var label = entry ? entry.label : null;
    var externalId = entry ? entry.externalId : null;
    return {
      primary: label || (externalId ? String(externalId) : pageI18n('not_available', 'Not available')),
      externalId: externalId,
      id: id
    };
  }

  function renderSummary(summary, degraded) {
    var grid = document.getElementById('ai-alerts-summary-grid');
    var notice = document.getElementById('ai-alerts-summary-notice');
    var heroCount = document.getElementById('active-events-count');
    if (!grid) return;

    summary = summary || {};
    var active = summary.active_events || 0;
    var resolvedToday = summary.resolved_today || 0;
    var enabled = summary.enabled_rules || 0;
    var total = summary.total_rules || 0;

    if (heroCount) heroCount.textContent = String(active);

    if (global.SMACAAlertsIndicator && typeof global.SMACAAlertsIndicator.render === 'function') {
      global.SMACAAlertsIndicator.render(summary);
    }

    var cards = [
      { label: tr('ai_alerts_stat_active', 'Active alerts'), value: active },
      { label: tr('ai_alerts_stat_resolved_today', 'Resolved today'), value: resolvedToday },
      { label: tr('ai_alerts_stat_rules_enabled', 'Enabled rules'), value: enabled },
      { label: tr('ai_alerts_stat_rules_total', 'Total rules'), value: total }
    ];

    grid.innerHTML = cards.map(function (card) {
      return (
        '<article class="stat-card">' +
          '<div class="stat-card__content">' +
            '<div class="stat-card__label">' + escapeHtml(card.label) + '</div>' +
            '<div class="stat-card__value">' + escapeHtml(String(card.value)) + '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');
    grid.removeAttribute('aria-busy');

    if (notice) {
      if (degraded) {
        notice.textContent = pageI18n('unavailable', 'Alert data temporarily unavailable.');
        notice.hidden = false;
      } else {
        notice.textContent = '';
        notice.hidden = true;
      }
    }
  }

  function renderEvents(events, sensorIndex, state) {
    var tbody = document.getElementById('ai-alerts-events-body');
    if (!tbody) return;

    if (state === 'unavailable') {
      tbody.innerHTML =
        '<tr><td colspan="10" class="ai-alerts-events-table__message">' +
        escapeHtml(pageI18n('unavailable', 'Alert data temporarily unavailable.')) +
        '</td></tr>';
      return;
    }

    if (!events.length) {
      tbody.innerHTML =
        '<tr><td colspan="10" class="ai-alerts-events-table__message">' +
        escapeHtml(pageI18n('no_events', 'No alert events recorded yet.')) +
        '</td></tr>';
      return;
    }

    var ackLabel = pageI18n('acknowledge', 'Acknowledge');
    var resolveLabel = pageI18n('resolve', 'Resolve');
    var sensorIdLabel = pageI18n('sensor_id', 'Sensor ID');

    tbody.innerHTML = events.map(function (event) {
      var displayStatus = resolveDisplayStatus(event);
      var sensor = resolveSensorLabel(event.sensor_id, sensorIndex);
      var sensorHtml =
        '<span class="ai-alerts-events-table__sensor-primary">' + escapeHtml(sensor.primary) + '</span>' +
        (sensor.externalId && sensor.primary !== sensor.externalId
          ? '<span class="ai-alerts-events-table__sensor-external">' + escapeHtml(sensor.externalId) + '</span>'
          : '') +
        '<span class="ai-alerts-events-table__sensor-id">' + escapeHtml(sensorIdLabel) + ': ' + escapeHtml(sensor.id || '—') + '</span>';

      var detailsText = formatDetails(event.details);

      return (
        '<tr class="ai-events-row">' +
          '<td><span class="badge ' + statusBadgeClass(displayStatus) + ' badge--sm">' + escapeHtml(displayStatus) + '</span></td>' +
          '<td class="ai-alerts-events-table__alert-name">' + escapeHtml(event.alert_name || '—') + '</td>' +
          '<td>' + escapeHtml(formatMetricLabel(event.metric_key)) + '</td>' +
          '<td class="ai-alerts-events-table__sensor-cell">' + sensorHtml + '</td>' +
          '<td>' + escapeHtml(formatValue(event.value, event.metric_key)) + '</td>' +
          '<td><code class="ai-alerts-events-table__condition">' + escapeHtml(formatCondition(event.operator, event.threshold)) + '</code></td>' +
          '<td>' + escapeHtml(formatDateTime(event.triggered_at)) + '</td>' +
          '<td>' + escapeHtml(formatDateTime(event.resolved_at)) + '</td>' +
          '<td class="ai-alerts-events-table__details">' + detailsText + '</td>' +
          '<td class="ai-alerts-events-table__actions">' +
            '<button type="button" class="btn btn--ghost btn--sm" disabled title="' + escapeHtml(pageI18n('action_pending', 'Action API pending')) + '">' + escapeHtml(ackLabel) + '</button>' +
            '<button type="button" class="btn btn--ghost btn--sm" disabled title="' + escapeHtml(pageI18n('action_pending', 'Action API pending')) + '">' + escapeHtml(resolveLabel) + '</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function updateLastUpdated() {
    var el = document.getElementById('ai-alerts-last-updated');
    if (!el) return;
    var label = tr('last_update', 'Last updated');
    try {
      el.textContent = label + ': ' + new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      el.textContent = label + ': ' + new Date().toISOString();
    }
  }

  function loadSensorsForLabels() {
    if (global.SMACAApi && typeof global.SMACAApi.fetchSensors === 'function') {
      return global.SMACAApi.fetchSensors().catch(function () { return { rows: [] }; });
    }
    if (Array.isArray(global.SMACA_SENSORS)) {
      return Promise.resolve({ rows: global.SMACA_SENSORS });
    }
    return Promise.resolve({ rows: [] });
  }

  function loadAiAlertsPage() {
    var api = global.SMACAApi;
    if (!api || typeof api.fetchAlertsSummary !== 'function' || typeof api.fetchAlertsEvents !== 'function') {
      renderSummary({ active_events: 0, resolved_today: 0, enabled_rules: 0, total_rules: 0 }, true);
      renderEvents([], {}, 'unavailable');
      updateLastUpdated();
      return Promise.resolve();
    }

    return Promise.all([
      api.fetchAlertsSummary(),
      api.fetchAlertsEvents(),
      loadSensorsForLabels()
    ]).then(function (results) {
      var summary = results[0] || {};
      var eventsPayload = results[1] || {};
      var sensorIndex = buildSensorIndex(results[2]);
      var degraded = !!(summary.degraded || eventsPayload.degraded);
      var events = Array.isArray(eventsPayload.events) ? eventsPayload.events : [];

      renderSummary(summary, degraded);
      if (degraded && !events.length) {
        renderEvents([], sensorIndex, 'unavailable');
      } else {
        renderEvents(events, sensorIndex, 'ok');
      }
      updateLastUpdated();
    }).catch(function () {
      renderSummary({ active_events: 0, resolved_today: 0, enabled_rules: 0, total_rules: 0 }, true);
      renderEvents([], {}, 'unavailable');
      updateLastUpdated();
    });
  }

  global.loadAiAlertsPage = loadAiAlertsPage;
  global.loadEnhancedAIInsights = loadAiAlertsPage;
})(typeof window !== 'undefined' ? window : this);
