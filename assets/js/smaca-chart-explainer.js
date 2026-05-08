/**
 * SMACA Chart Explainer
 * =====================
 *
 * Auto-injects a collapsible "How to read this chart" panel directly under
 * every chart container that has metadata in `window.SMACA_CHART_METADATA`.
 *
 * Usage:
 *   - The metadata bootstrap in app.blade.php sets:
 *       window.SMACA_CHART_METADATA = { charts: { 'chart-id-1': {...}, ... } }
 *   - When DOMContentLoaded fires, this module finds matching `id` elements,
 *     skips ones already explained, and inserts the panel after them.
 *   - It re-runs on the custom `smaca:chart-rendered` event so dynamically
 *     created chart panels (e.g. Highcharts re-renders) also get covered.
 *
 * Public API:
 *   window.SMACAChartExplainer.refresh()  — re-scan and inject any new charts.
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

    return [
      '<details class="chart-help" data-smaca-chart-help="1" style="margin-top:var(--space-3);background:rgba(148,163,184,0.06);border:1px solid rgba(148,163,184,0.18);border-radius:6px;padding:var(--space-2) var(--space-3);">',
      '  <summary style="cursor:pointer;font-size:11px;color:var(--muted);user-select:none;list-style:none;display:flex;align-items:center;gap:var(--space-1);">',
      '    <span aria-hidden="true">&#9432;</span><span>' + summaryLabel + '</span>',
      '    <span style="opacity:0.6;font-weight:400;">— ' + hint + '</span>',
      '  </summary>',
      '  <div style="margin-top:var(--space-2);font-size:12px;line-height:1.5;color:var(--text);">',
      rows.join(''),
      '  </div>',
      '</details>'
    ].join('');
  }

  // Insert the explanation panel after the chart container's enclosing card,
  // so it does not push the chart itself out of place. Falls back to the
  // chart container's parent if we cannot find a `.card` ancestor.
  function injectFor(chartEl, meta) {
    if (!chartEl || !meta) return;
    var html = buildPanel(meta);
    if (!html) return;

    var hostCard = chartEl.closest ? chartEl.closest('.card') : null;
    var anchor = hostCard || chartEl;

    // Avoid duplicate injection — look for an immediately following sibling
    // we already created.
    var sibling = anchor.nextElementSibling;
    while (sibling) {
      if (sibling.dataset && sibling.dataset.smacaChartHelpFor === chartEl.id) return;
      // stop scanning once we leave help blocks
      if (!sibling.dataset || !sibling.dataset.smacaChartHelpFor) break;
      sibling = sibling.nextElementSibling;
    }

    var wrapper = document.createElement('div');
    wrapper.dataset.smacaChartHelpFor = chartEl.id;
    wrapper.innerHTML = html;
    anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);
  }

  function refresh() {
    var dict = getMetaDictionary();
    if (!dict) return;
    Object.keys(dict).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      injectFor(el, dict[id]);
    });
  }

  function bootOnReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', refresh);
    } else {
      refresh();
    }
    // Allow manual triggers when charts are mounted lazily.
    document.addEventListener('smaca:chart-rendered', refresh);
  }

  global.SMACAChartExplainer = {
    refresh: refresh,
    metaFor: metaFor
  };

  bootOnReady();
})(typeof window !== 'undefined' ? window : this);
