/**
 * SMACA active-alerts topbar indicator (Phase 1).
 * Reads /api/alerts/summary via SMACAApi. Non-admins see active_events only;
 * admins see resolved-today and rules inline plus a title tooltip.
 */
(function (global) {
  'use strict';

  function tr(key, fallback) {
    var map = (global.SMACA_TRANSLATIONS || {});
    var value = map[key];
    return (value && String(value).trim()) ? value : fallback;
  }

  function isAdminView() {
    if (global.SMACARBAC && typeof global.SMACARBAC.isAdmin === 'function') {
      return global.SMACARBAC.isAdmin();
    }
    return !!(global.SMACA_USER && global.SMACA_USER.isAdmin);
  }

  function normalizeSummary(summary) {
    summary = summary || {};
    return {
      active_events: Math.max(0, Math.trunc(Number(summary.active_events) || 0)),
      resolved_today: Math.max(0, Math.trunc(Number(summary.resolved_today) || 0)),
      enabled_rules: Math.max(0, Math.trunc(Number(summary.enabled_rules) || 0)),
      total_rules: Math.max(0, Math.trunc(Number(summary.total_rules) || 0)),
      degraded: !!summary.degraded
    };
  }

  function buildUserLabel(summary) {
    return tr('alerts_indicator_label', 'Active Alerts: :count')
      .replace(':count', String(summary.active_events));
  }

  function buildAdminInlineLabel(summary) {
    var activePart = buildUserLabel(summary);
    var resolvedPart = tr('alerts_indicator_resolved_today_inline', 'Resolved Today: :count')
      .replace(':count', String(summary.resolved_today));
    var rulesPart = tr('alerts_indicator_rules_inline', 'Rules: :enabled/:total')
      .replace(':enabled', String(summary.enabled_rules))
      .replace(':total', String(summary.total_rules));
    return activePart + ' · ' + resolvedPart + ' · ' + rulesPart;
  }

  function buildAdminTitle(summary) {
    var parts = [
      tr('alerts_indicator_active', 'Active alerts') + ': ' + summary.active_events,
      tr('alerts_indicator_resolved_today', 'Resolved today') + ': ' + summary.resolved_today,
      tr('alerts_indicator_rules_enabled', 'Rules enabled') + ': ' + summary.enabled_rules,
      tr('alerts_indicator_rules_total', 'Total rules') + ': ' + summary.total_rules
    ];
    if (summary.degraded) {
      parts.push(tr('alerts_indicator_degraded', 'Data temporarily unavailable'));
    }
    return parts.join(' · ');
  }

  function render(summary) {
    var el = document.getElementById('smaca-active-alerts-indicator');
    if (!el) return;

    var data = normalizeSummary(summary);
    var admin = isAdminView();

    el.textContent = admin ? buildAdminInlineLabel(data) : buildUserLabel(data);
    el.hidden = false;
    el.classList.toggle('is-active', data.active_events > 0);
    el.classList.toggle('topbar__alert-indicator--admin', admin);

    if (admin) {
      el.title = buildAdminTitle(data);
    } else {
      el.removeAttribute('title');
    }
  }

  function refresh() {
    if (!global.SMACAApi || typeof global.SMACAApi.fetchAlertsSummary !== 'function') {
      render({ active_events: 0, degraded: true });
      return;
    }
    global.SMACAApi.fetchAlertsSummary()
      .then(render)
      .catch(function () {
        render({ active_events: 0, degraded: true });
      });
  }

  global.SMACAAlertsIndicator = {
    render: render,
    refresh: refresh
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }
})(typeof window !== 'undefined' ? window : this);
