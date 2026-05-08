/**
 * SMACA Chart Explainer (registry)
 * ================================
 *
 * NOTE: Visual injection of inline "How to read this chart" panels has
 * been retired in favour of the unified card-help popover system in
 * `smaca-card-help.js`. This module now exposes only metadata lookup so
 * external consumers (and tests) keep working.
 *
 * Public API:
 *   window.SMACAChartExplainer.refresh()  — no-op (compat).
 *   window.SMACAChartExplainer.metaFor(id) — locale-resolved metadata for `id`.
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

  function getMetaDictionary() {
    var src = global.SMACA_CHART_METADATA;
    if (!src) return {};
    return (src.charts && typeof src.charts === 'object') ? src.charts : {};
  }

  function metaFor(id) {
    var dict = getMetaDictionary();
    return (id && dict[id]) || null;
  }

  function buildPanel(meta) {
    if (!meta) return '';
    var what = meta.what ? escapeHtml(meta.what) : '';
    var ds = meta.data_source ? escapeHtml(meta.data_source) : '';
    var read = meta.how_to_read ? escapeHtml(meta.how_to_read) : '';
    var tf = meta.timeframe_note ? escapeHtml(meta.timeframe_note) : '';
    var act = meta.actions ? escapeHtml(meta.actions) : '';
    var lim = meta.limitations ? escapeHtml(meta.limitations) : '';

    if (!what && !ds && !read && !tf && !act && !lim) return '';

    var summaryLabel = escapeHtml(t('chart_help_how_to_read', 'How to read this chart'));
    var hint = escapeHtml(t('chart_help_hint', 'Click to learn more'));
    var lblWhat = escapeHtml(t('chart_help_what', 'What this shows'));
    var lblData = escapeHtml(t('chart_help_data_source', 'Data source'));
    var lblRead = escapeHtml(t('chart_help_read', 'How to read peaks and trends'));
    var lblTf = escapeHtml(t('chart_help_timeframe', 'Timeframe'));
    var lblAct = escapeHtml(t('chart_help_actions', 'Actions to consider'));
    var lblLim = escapeHtml(t('chart_help_limitations', 'Limitations'));

    var rows = [];
    if (what) rows.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + lblWhat + ':</strong> ' + what + '</p>');
    if (ds) rows.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + lblData + ':</strong> ' + ds + '</p>');
    if (read) rows.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + lblRead + ':</strong> ' + read + '</p>');
    if (tf) rows.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + lblTf + ':</strong> ' + tf + '</p>');
    if (act) rows.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + lblAct + ':</strong> ' + act + '</p>');
    if (lim) rows.push('<p style="margin:0;color:var(--muted);"><strong>' + lblLim + ':</strong> ' + lim + '</p>');

    // Inline, lightweight chrome — separation is provided by the wrapper's
    // CSS rule (`.card .chart-placeholder ~ .smaca-chart-help`). The details
    // element itself stays borderless to avoid a double divider.
    return [
      '<details class="chart-help" data-smaca-chart-help="1">',
      '  <summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--text);user-select:none;list-style:none;display:flex;align-items:center;gap:var(--space-2);">',
      '    <span aria-hidden="true" style="opacity:0.6;">&#9432;</span><span>' + summaryLabel + '</span>',
      '    <span style="opacity:0.55;font-weight:400;font-size:11px;">— ' + hint + '</span>',
      '  </summary>',
      '  <div style="margin-top:var(--space-3);font-size:11.5px;line-height:1.6;color:var(--muted);">',
      rows.join(''),
      '  </div>',
      '</details>'
    ].join('');
  }

  function refresh() {
    // No-op: the unified card-help popover (smaca-card-help.js) reads chart
    // metadata directly from window.SMACA_CHART_METADATA. We keep this
    // method on the public API for backwards compatibility with any
    // existing call sites.
    return null;
  }

  // The buildPanel function is intentionally kept for backwards-compat in
  // case an external script wants to render the panel inline. It is no
  // longer auto-injected.
  // eslint-disable-next-line no-unused-vars
  void buildPanel;

  global.SMACAChartExplainer = {
    refresh: refresh,
    metaFor: metaFor
  };
})(typeof window !== 'undefined' ? window : this);
