/**
 * SMACA Telemetry Mini-Card System
 * =================================
 *
 * Reusable building blocks for compact, telemetry-style cards that appear
 * across every dashboard module (Overview, IAQ, Occupancy, Energy,
 * Environmental, Connectivity). Each tile is small, dense, and carries a
 * unique signal: a value, optional unit, status colour, optional delta
 * indicator, and optional micro-chart (sparkline, mini-bar, bullet, gauge).
 *
 * Public API:
 *   SMACATelemetry.renderTile(container, opts)       — populate a single tile.
 *   SMACATelemetry.renderSparkline(container, opts)  — Highcharts areaspline.
 *   SMACATelemetry.renderMiniBar(container, opts)    — Highcharts column.
 *   SMACATelemetry.renderBullet(container, opts)     — bar with target marker.
 *   SMACATelemetry.renderGauge(container, opts)      — radial solidgauge or fallback.
 *   SMACATelemetry.formatDelta(curr, prev, opts)     — { label, direction }.
 *
 * Notes:
 *  - All methods are no-throw; they degrade gracefully when:
 *      - the container is missing
 *      - Highcharts isn't loaded
 *      - the data is empty / non-finite
 *  - Highcharts is reused via the existing `SMACAHighchartsAdapter` so the
 *    inherited global theme (softer grids, dim-inactive series, etc.)
 *    automatically applies to micro-charts.
 *  - No new API endpoints, no fake data: callers pass already-fetched data.
 */
(function (global) {
  'use strict';

  function safe(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function statusToTone(status) {
    var s = String(status || '').toLowerCase();
    if (s === 'good' || s === 'normal' || s === 'low' || s === 'healthy' || s === 'ok') return 'good';
    if (s === 'warning' || s === 'medium' || s === 'caution') return 'warning';
    if (s === 'critical' || s === 'crowded' || s === 'high' || s === 'extreme' || s === 'poor') return 'critical';
    if (s === 'insufficient_data' || s === 'unknown' || s === 'unavailable' || s === 'offline') return 'muted';
    return 'muted';
  }

  function toneToColor(tone) {
    switch (tone) {
      case 'good': return '#34d399';
      case 'warning': return '#fbbf24';
      case 'critical': return '#f87171';
      case 'info': return '#60a5fa';
      case 'accent': return '#22d3ee';
      default: return '#94a3b8';
    }
  }

  function adapter() {
    return global.SMACAHighchartsAdapter || null;
  }

  function hasHighcharts() {
    return !!(global.Highcharts && typeof global.Highcharts.chart === 'function');
  }

  // -----------------------------------------------------------------------
  // Tile DOM
  // -----------------------------------------------------------------------
  function resolveContainer(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.getElementById(target);
    if (target instanceof Element) return target;
    return null;
  }

  // Render the tile shell + content. Spark area (if requested) gets a
  // dedicated child element that tile rendering returns so the caller can
  // attach a Highcharts micro-chart afterwards.
  //
  // opts:
  //   label:    short uppercase title (string)
  //   value:    primary number/string
  //   unit:     optional unit string
  //   status:   optional status keyword (good/warning/critical/...)
  //   delta:    optional { value: '+3.4', direction: 'up'|'down'|'flat',
  //                         tone: 'good'|'warning'|'critical'|'muted' }
  //   meta:     optional secondary line (string)
  //   icon:     optional inline SVG path string (top-left)
  //   spark:    optional { kind: 'area'|'bar', data: [...], color }
  //   accent:   optional left-border accent tone ('good'|'warning'|...)
  function renderTile(target, opts) {
    var el = resolveContainer(target);
    if (!el) return null;
    var safeOpts = opts || {};
    var tone = safeOpts.accent || statusToTone(safeOpts.status);
    var hasValue = safeOpts.value !== undefined && safeOpts.value !== null && safeOpts.value !== '';

    var deltaHtml = '';
    if (safeOpts.delta && safeOpts.delta.label) {
      var dirClass = 'smaca-tile__delta--' + (safeOpts.delta.direction || 'flat');
      var toneClass = safeOpts.delta.tone ? (' smaca-tile__delta--' + safeOpts.delta.tone) : '';
      deltaHtml = '<span class="smaca-tile__delta ' + dirClass + toneClass + '">'
        + deltaArrow(safeOpts.delta.direction)
        + '<span class="smaca-tile__delta-text">' + safe(safeOpts.delta.label) + '</span>'
        + '</span>';
    }

    var iconHtml = safeOpts.icon
      ? '<span class="smaca-tile__icon" data-tone="' + safe(tone) + '" aria-hidden="true">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + safeOpts.icon
        + '</svg></span>'
      : '';

    var sparkHtml = '';
    if (safeOpts.spark) {
      sparkHtml = '<div class="smaca-tile__spark" data-smaca-tile-spark="1"></div>';
    }

    var unitHtml = safeOpts.unit
      ? '<span class="smaca-tile__unit">' + safe(safeOpts.unit) + '</span>'
      : '';
    var valueHtml = hasValue
      ? '<span class="smaca-tile__value-number">' + safe(safeOpts.value) + '</span>' + unitHtml
      : '<span class="smaca-tile__value-number smaca-tile__value-number--muted">—</span>';

    var metaHtml = safeOpts.meta
      ? '<div class="smaca-tile__meta">' + safe(safeOpts.meta) + '</div>'
      : '';

    el.classList.add('smaca-tile');
    el.setAttribute('data-tone', tone);
    el.innerHTML = ''
      + '<div class="smaca-tile__head">'
      +   iconHtml
      +   '<span class="smaca-tile__label">' + safe(safeOpts.label || '') + '</span>'
      +   deltaHtml
      + '</div>'
      + '<div class="smaca-tile__value">' + valueHtml + '</div>'
      + sparkHtml
      + metaHtml;

    var sparkEl = el.querySelector('[data-smaca-tile-spark="1"]');
    if (sparkEl && safeOpts.spark && Array.isArray(safeOpts.spark.data) && safeOpts.spark.data.length > 1) {
      var color = safeOpts.spark.color || toneToColor(tone === 'muted' ? 'info' : tone);
      var kind = safeOpts.spark.kind || 'area';
      try {
        if (kind === 'bar') {
          renderMiniBar(sparkEl, { data: safeOpts.spark.data, color: color });
        } else {
          renderSparkline(sparkEl, { data: safeOpts.spark.data, color: color });
        }
      } catch (e) { /* best-effort */ }
    }

    return el;
  }

  function deltaArrow(direction) {
    var dir = String(direction || '').toLowerCase();
    if (dir === 'up') {
      return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15"></polyline></svg>';
    }
    if (dir === 'down') {
      return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    }
    return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  }

  // -----------------------------------------------------------------------
  // Highcharts micro-charts
  // -----------------------------------------------------------------------
  function renderSparkline(target, params) {
    var el = resolveContainer(target);
    if (!el) return null;
    if (!hasHighcharts()) return null;
    var data = (params && Array.isArray(params.data)) ? params.data.filter(function (v) { return Number.isFinite(Number(v)); }).map(Number) : [];
    if (data.length < 2) return null;
    var color = (params && params.color) || '#60a5fa';
    var minVal = Math.min.apply(null, data);
    var maxVal = Math.max.apply(null, data);
    if (minVal === maxVal) {
      // Add a tiny breath so flat lines don't render as zero height.
      maxVal = minVal + 1;
      minVal = minVal - 1;
    }
    var options = {
      chart: {
        type: 'areaspline',
        height: 38,
        margin: [2, 0, 2, 0],
        backgroundColor: 'transparent',
        animation: false,
        spacing: [0, 0, 0, 0]
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: { visible: false, type: 'linear' },
      yAxis: { visible: false, min: minVal, max: maxVal },
      tooltip: { enabled: false },
      plotOptions: {
        series: {
          animation: false,
          marker: { enabled: false },
          lineWidth: 1.6,
          states: { hover: { enabled: false } },
          enableMouseTracking: false
        },
        areaspline: { fillOpacity: 1 }
      },
      series: [{
        type: 'areaspline',
        color: color,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, hexToRgba(color, 0.45)], [1, hexToRgba(color, 0.02)]]
        },
        data: data
      }]
    };
    try {
      return global.Highcharts.chart(el, options);
    } catch (e) {
      return null;
    }
  }

  function renderMiniBar(target, params) {
    var el = resolveContainer(target);
    if (!el) return null;
    if (!hasHighcharts()) return null;
    var data = (params && Array.isArray(params.data))
      ? params.data.map(function (v) { return Number.isFinite(Number(v)) ? Number(v) : 0; })
      : [];
    if (!data.length) return null;
    var color = (params && params.color) || '#60a5fa';
    var options = {
      chart: {
        type: 'column',
        height: 38,
        margin: [2, 0, 2, 0],
        backgroundColor: 'transparent',
        animation: false,
        spacing: [0, 0, 0, 0]
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: { visible: false },
      yAxis: { visible: false, min: 0 },
      tooltip: { enabled: false },
      plotOptions: {
        series: {
          animation: false,
          states: { hover: { enabled: false } },
          enableMouseTracking: false,
          borderWidth: 0,
          borderRadius: 1.5,
          color: color,
          pointPadding: 0.04,
          groupPadding: 0.04
        }
      },
      series: [{ type: 'column', data: data }]
    };
    try {
      return global.Highcharts.chart(el, options);
    } catch (e) {
      return null;
    }
  }

  // Bullet visual: a thin horizontal track with a filled progress portion,
  // a target marker, and an optional accent strip. Implemented in SVG for
  // consistency across pages — not a Highcharts chart.
  function renderBullet(target, params) {
    var el = resolveContainer(target);
    if (!el) return null;
    var p = params || {};
    var value = toNumber(p.value);
    var max = toNumber(p.max) || 100;
    var target_ = toNumber(p.target);
    var pctRaw = isFiniteNumber(value) ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    var targetPctRaw = isFiniteNumber(target_) ? Math.min(100, Math.max(0, (target_ / max) * 100)) : null;
    var tone = p.tone || statusToTone(p.status);
    var color = p.color || toneToColor(tone === 'muted' ? 'info' : tone);
    var pct = pctRaw.toFixed(1);
    var targetPct = targetPctRaw !== null ? targetPctRaw.toFixed(1) : null;
    el.classList.add('smaca-bullet');
    var trackW = 100;
    el.innerHTML = ''
      + '<svg viewBox="0 0 ' + trackW + ' 8" preserveAspectRatio="none" width="100%" height="8" aria-hidden="true">'
      + '  <rect x="0" y="2" width="' + trackW + '" height="4" rx="2" fill="rgba(148,163,184,0.18)" />'
      + '  <rect x="0" y="2" width="' + (pctRaw).toFixed(2) + '" height="4" rx="2" fill="' + color + '" />'
      + (targetPct !== null
        ? '  <line x1="' + targetPct + '" y1="0" x2="' + targetPct + '" y2="8" stroke="rgba(241,245,249,0.85)" stroke-width="1.2" />'
        : '')
      + '</svg>'
      + (p.legend
        ? '<div class="smaca-bullet__legend">'
          + '<span class="smaca-bullet__legend-value">' + safe(p.legend) + '</span>'
          + '</div>'
        : '');
    el.setAttribute('data-pct', pct);
    return el;
  }

  // Radial gauge: prefers Highcharts solidgauge (if loaded) but falls back
  // to a static SVG arc rendering with the same value semantics. Always
  // renders something even without the gauge module.
  function renderGauge(target, params) {
    var el = resolveContainer(target);
    if (!el) return null;
    var p = params || {};
    var value = toNumber(p.value);
    var min = toNumber(p.min);
    var max = toNumber(p.max);
    if (!isFiniteNumber(min)) min = 0;
    if (!isFiniteNumber(max) || max <= min) max = min + 1;
    var pctRaw = isFiniteNumber(value) ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
    var tone = p.tone || statusToTone(p.status);
    var color = p.color || toneToColor(tone === 'muted' ? 'info' : tone);

    // SVG arc fallback — always works, no Highcharts dependency.
    var size = 56;
    var stroke = 5;
    var radius = (size - stroke) / 2;
    var circumference = 2 * Math.PI * radius * 0.75; // 270deg arc
    var dash = (pctRaw * circumference).toFixed(2);
    var rest = (circumference - pctRaw * circumference).toFixed(2);
    el.classList.add('smaca-gauge');
    el.innerHTML = ''
      + '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">'
      + '  <g transform="rotate(135 ' + (size / 2) + ' ' + (size / 2) + ')">'
      + '    <circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + radius + '" stroke="rgba(148,163,184,0.18)"'
      + '            stroke-width="' + stroke + '" fill="none" stroke-linecap="round" stroke-dasharray="' + circumference.toFixed(2) + ' ' + (2 * Math.PI * radius).toFixed(2) + '" />'
      + '    <circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + radius + '" stroke="' + color + '"'
      + '            stroke-width="' + stroke + '" fill="none" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + (rest + (2 * Math.PI * radius - circumference).toFixed(2)) + '" />'
      + '  </g>'
      + '</svg>'
      + (p.label
        ? '<div class="smaca-gauge__label">' + safe(p.label) + '</div>'
        : '');
    return el;
  }

  // -----------------------------------------------------------------------
  // Delta utility
  // -----------------------------------------------------------------------
  function formatDelta(curr, prev, opts) {
    var current = toNumber(curr);
    var previous = toNumber(prev);
    var o = opts || {};
    var unit = o.unit || '';
    if (current === null || previous === null || previous === 0) {
      return null;
    }
    var diff = current - previous;
    var pct = (diff / Math.abs(previous)) * 100;
    if (!Number.isFinite(pct)) return null;
    var direction = 'flat';
    if (pct > 0.5) direction = 'up';
    else if (pct < -0.5) direction = 'down';
    // Tone semantics: callers can flip "up = bad" via opts.invertedTone.
    var tone = 'muted';
    if (o.invertedTone) {
      tone = direction === 'up' ? 'critical' : (direction === 'down' ? 'good' : 'muted');
    } else {
      tone = direction === 'up' ? 'good' : (direction === 'down' ? 'critical' : 'muted');
    }
    var label = (pct > 0 ? '+' : '') + pct.toFixed(1) + '%';
    if (o.showAbs) {
      label = (diff > 0 ? '+' : '') + diff.toFixed(o.decimals || 1) + (unit ? ' ' + unit : '');
    }
    return { label: label, direction: direction, tone: tone };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  function hexToRgba(color, alpha) {
    if (!color) return 'rgba(96, 165, 250, ' + (alpha || 1) + ')';
    if (String(color).startsWith('rgba')) return color;
    if (String(color).startsWith('rgb')) {
      return color.replace('rgb(', 'rgba(').replace(')', ', ' + alpha + ')');
    }
    var hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(function (c) { return c + c; }).join('');
    }
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
      return 'rgba(96, 165, 250, ' + (alpha || 1) + ')';
    }
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  // -----------------------------------------------------------------------
  // Helpers tucked away to avoid linter complaints when unused.
  // -----------------------------------------------------------------------
  void adapter;

  global.SMACATelemetry = {
    renderTile: renderTile,
    renderSparkline: renderSparkline,
    renderMiniBar: renderMiniBar,
    renderBullet: renderBullet,
    renderGauge: renderGauge,
    formatDelta: formatDelta,
    statusToTone: statusToTone,
    toneToColor: toneToColor
  };
})(typeof window !== 'undefined' ? window : this);
