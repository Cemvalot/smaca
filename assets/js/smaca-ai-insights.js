/**
 * SMACA AI / Alerts admin page — operational alert monitoring.
 * Data: GET /api/alerts/summary, GET /api/alerts/events, GET /api/alerts/ai-summary
 * Admin generate: POST /api/alerts/ai-summary/generate (manual only; never on page load)
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
    not_available: 'i18nNotAvailable',
    ai_summary_unavailable: 'i18nAiSummaryUnavailable',
    ai_summary_not_generated: 'i18nAiSummaryNotGenerated',
    ai_summary_generate: 'i18nAiSummaryGenerate',
    ai_summary_generating: 'i18nAiSummaryGenerating',
    ai_summary_fallback: 'i18nAiSummaryFallback'
  };

  var aiSummaryGenerateInFlight = false;

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

  function isPageAdmin() {
    if (global.SMACARBAC && typeof global.SMACARBAC.isAdmin === 'function') {
      return global.SMACARBAC.isAdmin();
    }
    var user = global.SMACA_USER || {};
    return String(user.role || '').toLowerCase() === 'admin' || !!user.isAdmin;
  }

  function initAiSummaryControls() {
    var btn = document.getElementById('ai-alerts-generate-summary-btn');
    if (!btn) return;
    if (isPageAdmin()) {
      btn.hidden = false;
      if (!btn.dataset.bound) {
        btn.dataset.bound = '1';
        btn.addEventListener('click', function () {
          if (aiSummaryGenerateInFlight) return;
          generateAiSummary();
        });
      }
    } else {
      btn.hidden = true;
    }
  }

  function formatAiSummaryMeta(generatedAt, source) {
    if (!generatedAt) return '';
    var when = formatDateTime(generatedAt);
    var sourceLabel = source === 'ollama' ? 'Ollama' : (source === 'fallback' ? 'Fallback' : '');
    return sourceLabel ? when + ' · ' + sourceLabel : when;
  }

  function renderAiSummaryPanel(payload, state) {
    var textEl = document.getElementById('ai-alerts-ai-summary-text');
    var metaEl = document.getElementById('ai-alerts-ai-summary-meta');
    var noticeEl = document.getElementById('ai-alerts-ai-summary-notice');
    if (!textEl) return;

    textEl.classList.remove('is-loading');

    if (state === 'unavailable') {
      textEl.textContent = pageI18n('ai_summary_unavailable', 'AI summary temporarily unavailable.');
      if (metaEl) {
        metaEl.textContent = '';
        metaEl.hidden = true;
      }
      if (noticeEl) {
        noticeEl.textContent = '';
        noticeEl.hidden = true;
      }
      return;
    }

    if (state === 'loading') {
      textEl.classList.add('is-loading');
      textEl.textContent = pageI18n('ai_summary_generating', 'Generating summary…');
      if (metaEl) {
        metaEl.textContent = '';
        metaEl.hidden = true;
      }
      if (noticeEl) {
        noticeEl.textContent = '';
        noticeEl.hidden = true;
      }
      return;
    }

    payload = payload || {};
    var summary = String(payload.summary || '').trim();
    var source = String(payload.source || 'none').toLowerCase();

    if (!summary) {
      textEl.textContent = pageI18n('ai_summary_not_generated', 'AI summary has not been generated yet.');
      if (metaEl) {
        metaEl.textContent = '';
        metaEl.hidden = true;
      }
      if (noticeEl) {
        noticeEl.textContent = '';
        noticeEl.hidden = true;
      }
      return;
    }

    textEl.textContent = summary;
    if (metaEl) {
      var meta = formatAiSummaryMeta(payload.generated_at, source);
      if (meta) {
        metaEl.textContent = meta;
        metaEl.hidden = false;
      } else {
        metaEl.textContent = '';
        metaEl.hidden = true;
      }
    }
    if (noticeEl) {
      if (payload.degraded || source === 'fallback') {
        noticeEl.textContent = pageI18n('ai_summary_fallback', 'Generated using offline fallback (Ollama unavailable).');
        noticeEl.hidden = false;
      } else {
        noticeEl.textContent = '';
        noticeEl.hidden = true;
      }
    }
  }

  function loadAiSummaryCached() {
    initAiSummaryControls();
    var api = global.SMACAApi;
    if (!api || typeof api.fetchAiAlertSummary !== 'function') {
      renderAiSummaryPanel(null, 'unavailable');
      return Promise.resolve();
    }

    return api.fetchAiAlertSummary().then(function (payload) {
      if (payload && payload.degraded && !String(payload.summary || '').trim()) {
        renderAiSummaryPanel(payload, 'unavailable');
        return;
      }
      renderAiSummaryPanel(payload, 'ok');
    }).catch(function () {
      renderAiSummaryPanel(null, 'unavailable');
    });
  }

  function generateAiSummary() {
    var api = global.SMACAApi;
    var btn = document.getElementById('ai-alerts-generate-summary-btn');
    if (!api || typeof api.generateAiAlertSummary !== 'function') {
      renderAiSummaryPanel(null, 'unavailable');
      return Promise.resolve();
    }

    aiSummaryGenerateInFlight = true;
    renderAiSummaryPanel(null, 'loading');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }

    return api.generateAiAlertSummary().then(function (payload) {
      if (!payload || (!String(payload.summary || '').trim() && payload.degraded)) {
        renderAiSummaryPanel(payload, 'unavailable');
        return;
      }
      renderAiSummaryPanel(payload, 'ok');
    }).catch(function () {
      renderAiSummaryPanel(null, 'unavailable');
    }).finally(function () {
      aiSummaryGenerateInFlight = false;
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    });
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
    initAiSummaryControls();
    loadAiSummaryCached();

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
