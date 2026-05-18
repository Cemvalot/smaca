/**
 * SMACA Telemetry Mini-Card System
 * =================================
 *
 * Reusable building blocks for compact, telemetry-style cards that appear
 * across every dashboard module (Overview, IAQ, Occupancy, Energy,
 * Environmental, Connectivity). Each tile is small, dense, and carries a
 * unique signal: a value, optional unit, status colour, optional delta
 * indicator, and optional micro-chart (sparkline, mini-bar, bullet, gauge,
 * stacked column, ranking bars, heat strip, banded bullet).
 *
 * Public API:
 *   SMACATelemetry.renderTile(container, opts)              — populate a single tile.
 *   SMACATelemetry.renderEmptyTile(container, opts)         — intentional empty state.
 *   SMACATelemetry.renderChartTile(container, opts)         — title + chart area.
 *   SMACATelemetry.renderSparkline(container, opts)         — Highcharts areaspline.
 *   SMACATelemetry.renderMiniBar(container, opts)           — Highcharts column.
 *   SMACATelemetry.renderHeatStripColumn(container, opts)   — column chart with per-bar colour bands.
 *   SMACATelemetry.renderStackedColumn(container, opts)     — stacked column chart.
 *   SMACATelemetry.renderHorizontalBars(container, opts)    — SVG ranking bars.
 *   SMACATelemetry.renderComparisonBars(container, opts)    — value vs threshold per category.
 *   SMACATelemetry.renderBullet(container, opts)            — bar with target marker (banded variant supported).
 *   SMACATelemetry.renderGauge(container, opts)             — radial gauge (SVG fallback).
 *   SMACATelemetry.formatDelta(curr, prev, opts)            — { label, direction }.
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

  // Track Highcharts instances by host element so we can destroy them
  // safely before re-rendering. Without this, repeatedly populating the
  // same tile (e.g. on timeframe changes) would orphan chart instances.
  var CHART_INSTANCES = new WeakMap();
  var CHART_REBUILD = new WeakMap();

  function chartAnim() {
    if (global.SMACA_CHART_REFRESH) return false;
    return { duration: 220 };
  }

  function observeChartHost(host) {
    if (!host) return;
    if (global.SMACAChartVisibility && typeof global.SMACAChartVisibility.observe === 'function') {
      global.SMACAChartVisibility.observe(host);
    }
  }

  function pauseChartHost(host) {
    if (!host) return;
    var chart = CHART_INSTANCES.get(host);
    if (chart && typeof chart.destroy === 'function') {
      try { chart.destroy(); } catch (e) { /* swallow */ }
    }
    CHART_INSTANCES.delete(host);
    host.setAttribute('data-smaca-chart-paused', '1');
  }

  function resumeChartHost(host) {
    if (!host || host.getAttribute('data-smaca-chart-paused') !== '1') return;
    var rebuild = CHART_REBUILD.get(host);
    if (typeof rebuild !== 'function') return;
    host.removeAttribute('data-smaca-chart-paused');
    try {
      rebuild();
    } catch (e) { /* swallow */ }
  }

  function setChartRefreshMode(isRefresh) {
    global.SMACA_CHART_REFRESH = !!isRefresh;
  }

  function attachChart(container, chart, rebuildFn) {
    if (!container) return chart;
    var prev = CHART_INSTANCES.get(container);
    if (prev && typeof prev.destroy === 'function' && prev !== chart) {
      try { prev.destroy(); } catch (e) { /* swallow */ }
    }
    if (chart) {
      CHART_INSTANCES.set(container, chart);
      container.removeAttribute('data-smaca-chart-paused');
    } else {
      CHART_INSTANCES.delete(container);
    }
    if (typeof rebuildFn === 'function') {
      CHART_REBUILD.set(container, rebuildFn);
      observeChartHost(container);
    }
    return chart;
  }

  // Safe destroy of any chart attached to `container` *before* the
  // caller wipes its innerHTML. Lets `renderChartTile` rebuild a tile
  // shell on every refresh without leaking chart instances.
  function destroyChartIn(container) {
    if (!container) return;
    var chartHosts = [container].concat(
      Array.prototype.slice.call(container.querySelectorAll('[data-smaca-chart="1"]'))
    );
    chartHosts.forEach(function (host) {
      var prev = CHART_INSTANCES.get(host);
      if (prev && typeof prev.destroy === 'function') {
        try { prev.destroy(); } catch (e) { /* swallow */ }
      }
      CHART_INSTANCES.delete(host);
    });
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
    destroyChartIn(el);
    el.classList.remove('smaca-tile--empty', 'smaca-tile--chart');
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

    var subtitleHtml = safeOpts.subtitle
      ? '<p class="smaca-tile__subtitle">' + safe(safeOpts.subtitle) + '</p>'
      : '';
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
      + subtitleHtml
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
  // Intentional empty state — small, low-emphasis, never blank
  // -----------------------------------------------------------------------
  // Renders a compact empty-state version of a tile. Callers should use
  // this whenever the data needed for the tile is unavailable. Avoids the
  // "huge blank card" effect that shows when only a value is set to "—".
  function renderEmptyTile(target, opts) {
    var el = resolveContainer(target);
    if (!el) return null;
    destroyChartIn(el);
    var safeOpts = opts || {};
    el.classList.add('smaca-tile');
    el.classList.add('smaca-tile--empty');
    el.classList.remove('smaca-tile--chart');
    el.setAttribute('data-tone', 'muted');
    var iconHtml = safeOpts.icon
      ? '<span class="smaca-tile__icon" data-tone="muted" aria-hidden="true">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + safeOpts.icon
        + '</svg></span>'
      : '';
    el.innerHTML = ''
      + '<div class="smaca-tile__head">'
      +   iconHtml
      +   '<span class="smaca-tile__label">' + safe(safeOpts.label || '') + '</span>'
      + '</div>'
      + (safeOpts.subtitle ? '<p class="smaca-tile__subtitle">' + safe(safeOpts.subtitle) + '</p>' : '')
      + '<div class="smaca-tile__empty-body">'
      +   '<svg class="smaca-tile__empty-glyph" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      +     '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.8" fill="currentColor"/>'
      +   '</svg>'
      +   '<span class="smaca-tile__empty-text">' + safe(safeOpts.message || 'No data') + '</span>'
      + '</div>';
    return el;
  }

  // Render a chart-only tile shell: a small title bar at the top and a
  // chart-host element below for the caller's Highcharts call. Designed
  // for `smaca-tile--chart` tiles (often combined with `--w2/--w3/--w6`).
  function renderChartTile(target, opts) {
    var el = resolveContainer(target);
    if (!el) return null;
    destroyChartIn(el);
    var safeOpts = opts || {};
    el.classList.add('smaca-tile');
    el.classList.add('smaca-tile--chart');
    el.classList.remove('smaca-tile--empty');
    el.setAttribute('data-tone', safeOpts.accent || statusToTone(safeOpts.status));
    var legendHtml = safeOpts.legend
      ? '<span class="smaca-tile__chart-legend">' + safe(safeOpts.legend) + '</span>'
      : '';
    var unitChip = safeOpts.unit
      ? '<span class="smaca-tile__chart-unit">' + safe(safeOpts.unit) + '</span>'
      : '';
    var subtitle = safeOpts.subtitle
      ? '<p class="smaca-tile__subtitle">' + safe(safeOpts.subtitle) + '</p>'
      : '';
    var chartPillarIcon = (safeOpts.pillar && global.SMACAIcons && global.SMACAIcons.chipHtml)
      ? global.SMACAIcons.chipHtml(safeOpts.pillar, 'xs')
      : '';
    el.innerHTML = ''
      + '<div class="smaca-tile__head">'
      +   chartPillarIcon
      +   '<span class="smaca-tile__label">' + safe(safeOpts.label || '') + '</span>'
      +   unitChip
      +   legendHtml
      + '</div>'
      + subtitle
      + '<div class="smaca-tile__chart" data-smaca-chart="1"></div>'
      + (safeOpts.meta ? '<div class="smaca-tile__meta">' + safe(safeOpts.meta) + '</div>' : '');
    return el.querySelector('[data-smaca-chart="1"]');
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
      return attachChart(el, global.Highcharts.chart(el, options), function () {
        return renderSparkline(el, params);
      });
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
      return attachChart(el, global.Highcharts.chart(el, options), function () {
        return renderMiniBar(el, params);
      });
    } catch (e) {
      return null;
    }
  }

  // Heat-strip column: a very compact column chart where each bar gets
  // its own colour based on a threshold band. Useful for hourly risk /
  // activity strips (24 columns, one per hour). Each input point is
  // either a number or an object `{ y, color }`.
  function renderHeatStripColumn(target, params) {
    var el = resolveContainer(target);
    if (!el) return null;
    if (!hasHighcharts()) return null;
    var raw = (params && Array.isArray(params.data)) ? params.data : [];
    if (!raw.length) return null;
    var bands = (params && Array.isArray(params.bands)) ? params.bands : null;
    var data = raw.map(function (entry) {
      if (entry && typeof entry === 'object') {
        var y = toNumber(entry.y);
        if (y === null) y = 0;
        var isFuture = !!entry.future;
        var useBandColor = !isFuture && entry.hasData !== false && !entry.color;
        var color = entry.color || (useBandColor ? colorForBand(y, bands) : (isFuture ? 'rgba(148,163,184,0.10)' : colorForBand(y, bands)));
        var point = {
          y: y,
          color: color,
          future: isFuture,
          hasData: entry.hasData !== false,
          bucketLabel: entry.bucketLabel || ''
        };
        if (entry.borderColor) point.borderColor = entry.borderColor;
        if (entry.borderWidth != null) point.borderWidth = entry.borderWidth;
        if (entry.dashStyle) point.dashStyle = entry.dashStyle;
        return point;
      }
      var n = toNumber(entry);
      var nv = n === null ? 0 : n;
      return { y: nv, color: colorForBand(nv, bands), hasData: true, future: false };
    });
    var showAxis = !!(params && params.showAxis);
    var showYAxis = !!(params && params.showYAxis);
    var xAxisTitle = (params && params.xAxisTitle) ? String(params.xAxisTitle) : '';
    var yAxisTitle = (params && params.yAxisTitle) ? String(params.yAxisTitle) : '';
    var height = (params && params.height) || 56;
    if ((showAxis || showYAxis) && height < 130) height = 130;
    var categories = (params && Array.isArray(params.categories)) ? params.categories : null;
    var catCount = categories ? categories.length : data.length;
    var xLabelRot = (params && Number.isFinite(params.xAxisLabelRotation))
      ? Number(params.xAxisLabelRotation)
      : (showAxis && catCount >= 12 ? -40 : 0);
    var bottomMargin = showAxis ? (xLabelRot ? 52 : 34) : 14;
    var leftMargin = showYAxis ? 50 : 0;
    var stepOverride = (params && Number.isFinite(params.xAxisLabelStep) && params.xAxisLabelStep >= 1)
      ? Math.floor(params.xAxisLabelStep)
      : ((params && Number.isFinite(params.step) && params.step >= 1) ? Math.floor(params.step) : null);
    var autoStep = Math.max(1, Math.floor(data.length / 6));
    var xLabelFormatter = (params && typeof params.xAxisLabelFormatter === 'function')
      ? params.xAxisLabelFormatter
      : null;
    var yAxisMax = (params && Number.isFinite(Number(params.yAxisMax))) ? Number(params.yAxisMax) : null;
    if (yAxisMax === null) {
      var computedMax = 0;
      data.forEach(function (pt) {
        if (pt.future) return;
        if (pt.hasData === false) return;
        if (pt.y > computedMax) computedMax = pt.y;
      });
      yAxisMax = computedMax > 0 ? computedMax * 1.12 : 1;
    }
    var yTickPositions = (params && Array.isArray(params.yAxisTickPositions))
      ? params.yAxisTickPositions
      : null;
    var options = {
      chart: {
        type: 'column',
        height: height,
        margin: [4, 6, bottomMargin, leftMargin],
        backgroundColor: 'transparent',
        animation: false,
        spacing: [0, 0, 0, 0]
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: categories,
        visible: showAxis,
        title: {
          text: showAxis && xAxisTitle ? xAxisTitle : null,
          style: { color: 'rgba(148,163,184,0.72)', fontSize: '9px', fontWeight: '500' },
          margin: 8
        },
        labels: {
          style: { color: 'rgba(148,163,184,0.78)', fontSize: '10px' },
          step: xLabelFormatter ? 1 : (stepOverride !== null ? stepOverride : autoStep),
          rotation: xLabelRot,
          align: xLabelRot ? 'right' : 'center',
          reserveSpace: true,
          formatter: xLabelFormatter
            ? function () {
              var idx = typeof this.pos === 'number' ? this.pos : this.value;
              if (typeof idx === 'string' && categories) {
                idx = categories.indexOf(idx);
              }
              return xLabelFormatter(idx);
            }
            : undefined
        },
        lineColor: showAxis ? 'rgba(148,163,184,0.14)' : 'transparent',
        tickWidth: 0
      },
      yAxis: {
        visible: showYAxis,
        min: 0,
        max: showYAxis ? yAxisMax : null,
        allowDecimals: true,
        endOnTick: false,
        maxPadding: 0.08,
        tickAmount: yTickPositions ? null : 6,
        tickPositions: yTickPositions || null,
        title: {
          text: showYAxis && yAxisTitle ? yAxisTitle : null,
          style: { color: 'rgba(148,163,184,0.72)', fontSize: '9px', fontWeight: '500' },
          margin: 10
        },
        labels: {
          style: { color: 'rgba(148,163,184,0.82)', fontSize: '10px' },
          x: -3,
          distance: 6,
          formatter: function () {
            var v = Number(this.value);
            if (!Number.isFinite(v)) return '';
            if (v >= 100) return String(Math.round(v));
            if (v >= 10) return v.toFixed(1);
            if (v === 0) return '0';
            return v.toFixed(2);
          }
        },
        gridLineColor: showYAxis ? 'rgba(148,163,184,0.10)' : 'transparent',
        gridLineDashStyle: 'Dot'
      },
      tooltip: {
        enabled: !!(params && params.tooltipFormatter),
        formatter: (params && params.tooltipFormatter) || null,
        useHTML: true,
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderWidth: 0,
        style: { color: '#e2e8f0', fontSize: '11px' }
      },
      plotOptions: {
        column: {
          animation: false,
          borderWidth: 0,
          borderRadius: 1.5,
          pointPadding: 0.06,
          groupPadding: 0.04,
          states: { hover: { enabled: !!(params && params.tooltipFormatter) } },
          enableMouseTracking: !!(params && params.tooltipFormatter)
        }
      },
      series: [{ type: 'column', data: data }]
    };
    try {
      return attachChart(el, global.Highcharts.chart(el, options), function () {
        return renderHeatStripColumn(el, params);
      });
    } catch (e) {
      return null;
    }
  }

  // Stacked mini column: two-series stacked column suitable for
  // operational in/out, on/off-peak, etc.
  // params: { categories, series: [{ name, color, data }] }
  function renderStackedColumn(target, params) {
    var el = resolveContainer(target);
    if (!el) return null;
    if (!hasHighcharts()) return null;
    var p = params || {};
    var series = Array.isArray(p.series) ? p.series : [];
    if (!series.length) return null;
    var catLen = (p.categories || []).length;
    var height = p.height || 88;
    if (catLen && height < 200) height = Math.max(height, 168 + Math.min(40, catLen * 6));
    var bottomPad = Math.max(52, 28 + Math.min(48, catLen * 5));
    var options = {
      chart: {
        type: 'column',
        height: height,
        margin: [8, 8, bottomPad, 46],
        backgroundColor: 'transparent',
        animation: false
      },
      title: { text: null },
      credits: { enabled: false },
      legend: {
        enabled: !!p.showLegend,
        align: 'right',
        verticalAlign: 'top',
        layout: 'horizontal',
        itemStyle: { color: 'rgba(148,163,184,0.85)', fontSize: '10px', fontWeight: '500' },
        symbolRadius: 2,
        margin: 0,
        padding: 0
      },
      xAxis: {
        categories: p.categories || [],
        labels: {
          style: { color: 'rgba(148,163,184,0.82)', fontSize: '10px' },
          rotation: catLen <= 4 ? 0 : -32,
          align: catLen <= 4 ? 'center' : 'right',
          reserveSpace: true,
          formatter: function () {
            var t = this.value != null ? String(this.value) : '';
            if (t.length <= 22) return t;
            return t.slice(0, 20) + '…';
          }
        },
        lineColor: 'rgba(148,163,184,0.10)',
        tickWidth: 0
      },
      yAxis: {
        visible: true,
        min: 0,
        allowDecimals: false,
        tickAmount: 6,
        title: { text: null },
        labels: { style: { color: 'rgba(148,163,184,0.78)', fontSize: '10px' }, x: -4 },
        gridLineColor: 'rgba(148,163,184,0.10)',
        gridLineDashStyle: 'Dot'
      },
      tooltip: {
        enabled: true,
        shared: true,
        useHTML: true,
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderWidth: 0,
        style: { color: '#e2e8f0', fontSize: '11px' }
      },
      plotOptions: {
        column: {
          stacking: 'normal',
          borderWidth: 0,
          borderRadius: 1.5,
          pointPadding: 0.06,
          groupPadding: 0.06
        }
      },
      series: series.map(function (s) {
        return {
          type: 'column',
          name: s.name,
          color: s.color,
          data: s.data || []
        };
      })
    };
    try {
      return attachChart(el, global.Highcharts.chart(el, options), function () {
        return renderStackedColumn(el, params);
      });
    } catch (e) {
      return null;
    }
  }

  // Comparison bars: per-category current value rendered as a horizontal
  // bullet with a threshold marker. Useful for "pollutant vs limit"
  // visualisation. Implemented in SVG so it stays compact.
  // params: { items: [{ label, value, max, threshold, tone }] }
  function renderComparisonBars(target, params) {
    var el = resolveContainer(target);
    if (!el) return null;
    var items = (params && Array.isArray(params.items)) ? params.items : [];
    if (!items.length) {
      el.classList.add('smaca-tile--empty');
      el.innerHTML = '<span class="smaca-tile__empty-text">' + safe((params && params.emptyText) || 'No data') + '</span>';
      return el;
    }
    el.classList.add('smaca-comparison-bars');
    var rows = items.map(function (item) {
      var value = toNumber(item.value);
      var max = toNumber(item.max) || 100;
      var threshold = toNumber(item.threshold);
      var pct = isFiniteNumber(value) ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
      var tPct = (threshold !== null) ? Math.min(100, Math.max(0, (threshold / max) * 100)) : null;
      var tone = item.tone || statusToTone(item.status);
      var color = item.color || toneToColor(tone === 'muted' ? 'info' : tone);
      var valueDisplay = isFiniteNumber(value)
        ? (item.unit ? value.toFixed(item.decimals || 0) + ' ' + item.unit : value.toFixed(item.decimals || 0))
        : '—';
      return ''
        + '<div class="smaca-cb__row" data-tone="' + safe(tone) + '">'
        +   '<div class="smaca-cb__label">' + safe(item.label) + '</div>'
        +   '<div class="smaca-cb__bar">'
        +     '<svg viewBox="0 0 100 6" preserveAspectRatio="none" width="100%" height="6" aria-hidden="true">'
        +       '<rect x="0" y="2" width="100" height="2" rx="1" fill="rgba(148,163,184,0.16)"/>'
        +       '<rect x="0" y="2" width="' + pct.toFixed(2) + '" height="2" rx="1" fill="' + color + '"/>'
        +       (tPct !== null ? '<line x1="' + tPct.toFixed(2) + '" y1="0" x2="' + tPct.toFixed(2) + '" y2="6" stroke="rgba(241,245,249,0.85)" stroke-width="0.9" />' : '')
        +     '</svg>'
        +   '</div>'
        +   '<div class="smaca-cb__value">' + safe(valueDisplay) + '</div>'
        + '</div>';
    });
    el.innerHTML = rows.join('');
    return el;
  }

  // Horizontal ranking bars: top-N entities by value. SVG-based, very
  // compact. params: { items: [{ label, value, color? }], unit, max }
  function renderHorizontalBars(target, params) {
    var el = resolveContainer(target);
    if (!el) return null;
    var raw = (params && Array.isArray(params.items)) ? params.items : [];
    var items = raw
      .filter(function (i) { return i && isFiniteNumber(toNumber(i.value)); })
      .map(function (i) { return Object.assign({}, i, { value: toNumber(i.value) }); });
    if (!items.length) {
      el.classList.add('smaca-tile--empty');
      el.innerHTML = '<span class="smaca-tile__empty-text">' + safe((params && params.emptyText) || 'No data') + '</span>';
      return el;
    }
    var max = toNumber((params && params.max));
    if (!isFiniteNumber(max) || max <= 0) {
      max = items.reduce(function (acc, i) { return Math.max(acc, i.value); }, 0) || 1;
    }
    var unit = (params && params.unit) || '';
    el.classList.add('smaca-rank-bars');
    var rows = items.map(function (item) {
      var pct = Math.min(100, Math.max(0, (item.value / max) * 100));
      var color = item.color || '#60a5fa';
      var valueDisplay = (typeof item.displayValue === 'string') ? item.displayValue
        : (isFiniteNumber(item.value)
          ? (Math.abs(item.value) >= 1000 ? (item.value / 1000).toFixed(1) + 'k' : item.value.toFixed((item.value < 10) ? 1 : 0))
          + (unit ? ' ' + unit : '')
          : '—');
      return ''
        + '<div class="smaca-rank-bars__row">'
        +   '<div class="smaca-rank-bars__label" title="' + safe(item.label) + '">'
        +     (item.pillar && global.SMACAIcons && global.SMACAIcons.chipHtml
          ? global.SMACAIcons.chipHtml(item.pillar, 'xs')
          : (item.statusColor ? '<span class="smaca-rank-bars__status-dot" style="background:' + safe(item.statusColor) + ';" aria-hidden="true"></span>' : ''))
        +     '<div class="smaca-rank-bars__label-text-wrap"><span class="smaca-rank-bars__label-text">' + safe(item.label) + '</span>'
        +     (item.subLabel ? '<div class="smaca-rank-bars__sub">' + safe(item.subLabel) + '</div>' : '')
        +     '</div>'
        +   '</div>'
        +   '<div class="smaca-rank-bars__bar">'
        +     '<div class="smaca-rank-bars__fill" style="width: ' + pct.toFixed(2) + '%; background: ' + color + ';"></div>'
        +   '</div>'
        +   '<div class="smaca-rank-bars__value">' + safe(valueDisplay) + '</div>'
        + '</div>';
    });
    el.innerHTML = rows.join('');
    return el;
  }

  // Donut / ring chart — Highcharts pie with `innerSize` and a
  // dominant centre label. params: { data: [{name, y, color}], total,
  // centerLabel, height }.
  function renderDonut(target, params) {
    var el = resolveContainer(target);
    if (!el) return null;
    if (!hasHighcharts()) return null;
    var p = params || {};
    var data = (Array.isArray(p.data) ? p.data : []).filter(function (d) {
      return d && isFiniteNumber(toNumber(d.y));
    }).map(function (d) {
      return { name: d.name, y: toNumber(d.y), color: d.color };
    });
    if (!data.length) return null;
    var height = p.height || 130;
    var totalText = (p.centerLabel !== undefined && p.centerLabel !== null)
      ? String(p.centerLabel)
      : '';
    var subText = p.centerSubLabel ? String(p.centerSubLabel) : '';
    var options = {
      chart: {
        type: 'pie',
        height: height,
        backgroundColor: 'transparent',
        margin: [6, 4, 6, 4],
        spacing: [0, 0, 0, 0],
        animation: chartAnim(),
        events: {
          load: function () {
            var chart = this;
            if (chart.titleNode) chart.titleNode.destroy();
            chart.titleNode = chart.renderer
              .text(totalText, chart.plotLeft + chart.plotWidth / 2, chart.plotTop + chart.plotHeight / 2 + 2)
              .css({
                color: '#e2e8f0',
                fontSize: '18px',
                fontWeight: '700',
                fontFamily: 'inherit'
              })
              .attr({ 'text-anchor': 'middle', 'aria-hidden': 'true' })
              .add();
            if (subText) {
              chart.subTitleNode = chart.renderer
                .text(subText, chart.plotLeft + chart.plotWidth / 2, chart.plotTop + chart.plotHeight / 2 + 16)
                .css({
                  color: 'rgba(148,163,184,0.85)',
                  fontSize: '9.5px',
                  fontWeight: '500',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: 'inherit'
                })
                .attr({ 'text-anchor': 'middle', 'aria-hidden': 'true' })
                .add();
            }
          }
        }
      },
      title: { text: null },
      credits: { enabled: false },
      legend: {
        enabled: !!p.showLegend,
        align: 'right',
        verticalAlign: 'middle',
        layout: 'vertical',
        symbolRadius: 2,
        itemStyle: { color: 'rgba(148,163,184,0.9)', fontSize: '10px', fontWeight: '500' },
        itemHoverStyle: { color: '#e2e8f0' },
        margin: 0,
        padding: 0
      },
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(15,23,42,0.96)',
        borderWidth: 0,
        style: { color: '#e2e8f0', fontSize: '11px' },
        pointFormat: '<b>{point.name}</b>: {point.y} ({point.percentage:.1f}%)'
      },
      plotOptions: {
        pie: {
          innerSize: p.innerSize || '68%',
          borderWidth: 1,
          borderColor: 'rgba(15, 23, 42, 0.85)',
          dataLabels: { enabled: false },
          animation: chartAnim(),
          states: { hover: { brightness: 0.08, halo: { size: 4 } } }
        }
      },
      series: [{ type: 'pie', name: p.seriesName || '', data: data }]
    };
    try {
      return attachChart(el, global.Highcharts.chart(el, options), function () {
        return renderDonut(el, params);
      });
    } catch (e) {
      return null;
    }
  }

  // Ranked horizontal bar chart (Highcharts) — richer than the SVG
  // version with tooltips + animation. Each bar is a category.
  // params: { categories, values, color, unit, height }
  function renderRankedBarChart(target, params) {
    var el = resolveContainer(target);
    if (!el) return null;
    if (!hasHighcharts()) return null;
    var p = params || {};
    var categories = Array.isArray(p.categories) ? p.categories : [];
    var values = Array.isArray(p.values) ? p.values : [];
    if (!categories.length || !values.length) return null;
    var color = p.color || '#60a5fa';
    var unit = p.unit || '';
    var options = {
      chart: {
        type: 'bar',
        height: p.height || (28 + categories.length * 22),
        backgroundColor: 'transparent',
        margin: [6, 14, 18, 4],
        animation: chartAnim()
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: categories,
        lineColor: 'rgba(148,163,184,0.10)',
        tickWidth: 0,
        labels: { style: { color: 'rgba(226,232,240,0.85)', fontSize: '10px' }, x: -2 }
      },
      yAxis: {
        title: { text: null },
        gridLineColor: 'rgba(148,163,184,0.06)',
        gridLineDashStyle: 'Dot',
        labels: {
          style: { color: 'rgba(148,163,184,0.6)', fontSize: '9px' },
          formatter: function () { return unit ? this.value + ' ' + unit : this.value; }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.96)',
        borderWidth: 0,
        style: { color: '#e2e8f0', fontSize: '11px' },
        pointFormat: '<b>{point.y}' + (unit ? ' ' + unit : '') + '</b>'
      },
      plotOptions: {
        bar: {
          animation: chartAnim(),
          borderWidth: 0,
          borderRadius: 2,
          color: color,
          pointPadding: 0.04,
          groupPadding: 0.04,
          dataLabels: {
            enabled: !!p.showLabels,
            inside: false,
            align: 'left',
            style: { color: 'rgba(226,232,240,0.95)', fontWeight: '600', textOutline: 'none', fontSize: '10px' },
            formatter: function () {
              return Math.abs(this.y) >= 1000
                ? (this.y / 1000).toFixed(1) + 'k' + (unit ? ' ' + unit : '')
                : this.y.toFixed(this.y < 10 ? 1 : 0) + (unit ? ' ' + unit : '');
            }
          }
        }
      },
      series: [{ type: 'bar', data: values }]
    };
    try {
      return attachChart(el, global.Highcharts.chart(el, options), function () {
        return renderRankedBarChart(el, params);
      });
    } catch (e) {
      return null;
    }
  }

  // Grouped column (multi-series, NOT stacked).
  // params: { categories, series: [{ name, color, data }], height }
  function renderGroupedColumn(target, params) {
    var el = resolveContainer(target);
    if (!el) return null;
    if (!hasHighcharts()) return null;
    var p = params || {};
    var series = Array.isArray(p.series) ? p.series : [];
    if (!series.length) return null;
    var options = {
      chart: {
        type: 'column',
        height: p.height || 100,
        margin: [6, 4, 22, 24],
        backgroundColor: 'transparent',
        animation: chartAnim()
      },
      title: { text: null },
      credits: { enabled: false },
      legend: {
        enabled: !!p.showLegend,
        align: 'right',
        verticalAlign: 'top',
        layout: 'horizontal',
        itemStyle: { color: 'rgba(148,163,184,0.9)', fontSize: '10px', fontWeight: '500' },
        symbolRadius: 2,
        margin: 0,
        padding: 0
      },
      xAxis: {
        categories: p.categories || [],
        lineColor: 'rgba(148,163,184,0.10)',
        tickWidth: 0,
        labels: {
          style: { color: 'rgba(148,163,184,0.6)', fontSize: '9px' },
          step: Math.max(1, Math.floor((p.categories || []).length / 6))
        }
      },
      yAxis: {
        title: { text: null },
        gridLineColor: 'rgba(148,163,184,0.06)',
        gridLineDashStyle: 'Dot',
        labels: { style: { color: 'rgba(148,163,184,0.5)', fontSize: '9px' }, x: -2 }
      },
      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: 'rgba(15,23,42,0.96)',
        borderWidth: 0,
        style: { color: '#e2e8f0', fontSize: '11px' }
      },
      plotOptions: {
        column: {
          animation: chartAnim(),
          borderWidth: 0,
          borderRadius: 2,
          pointPadding: 0.06,
          groupPadding: 0.10
        }
      },
      series: series.map(function (s) {
        return { type: 'column', name: s.name, color: s.color, data: s.data || [] };
      })
    };
    try {
      return attachChart(el, global.Highcharts.chart(el, options), function () {
        return renderGroupedColumn(el, params);
      });
    } catch (e) {
      return null;
    }
  }

  // Color picker for heat strips. Bands is an array of
  // [{ from, to, color }]; falls back to neutral when no match.
  function colorForBand(value, bands) {
    if (!bands || !bands.length) return '#60a5fa';
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      var from = isFiniteNumber(b.from) ? b.from : -Infinity;
      var to = isFiniteNumber(b.to) ? b.to : Infinity;
      if (value >= from && value < to) return b.color;
    }
    return bands[bands.length - 1].color || '#60a5fa';
  }

  // Bullet visual: a thin horizontal track with a filled progress portion,
  // a target marker, and an optional accent strip. Implemented in SVG for
  // consistency across pages — not a Highcharts chart.
  // Supports a `bands` option: [{ from, to, color }] painted as background
  // segments behind the value bar (e.g. UV risk bands).
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
    var bands = Array.isArray(p.bands) ? p.bands : null;
    el.classList.add('smaca-bullet');
    var trackW = 100;
    var bandsSvg = '';
    if (bands) {
      bandsSvg = bands.map(function (b) {
        var from = isFiniteNumber(toNumber(b.from)) ? toNumber(b.from) : 0;
        var to = isFiniteNumber(toNumber(b.to)) ? toNumber(b.to) : max;
        var x = Math.min(100, Math.max(0, (from / max) * 100));
        var w = Math.min(100 - x, Math.max(0, ((to - from) / max) * 100));
        return '<rect x="' + x.toFixed(2) + '" y="2" width="' + w.toFixed(2) + '" height="4" rx="2" fill="' + (b.color || 'rgba(96,165,250,0.18)') + '" opacity="' + (b.opacity || 0.55) + '" />';
      }).join('');
    }
    el.innerHTML = ''
      + '<svg viewBox="0 0 ' + trackW + ' 8" preserveAspectRatio="none" width="100%" height="8" aria-hidden="true">'
      + '  <rect x="0" y="2" width="' + trackW + '" height="4" rx="2" fill="rgba(148,163,184,0.18)" />'
      +    bandsSvg
      + (isFiniteNumber(value)
        ? '  <line x1="' + pctRaw.toFixed(2) + '" y1="0" x2="' + pctRaw.toFixed(2) + '" y2="8" stroke="' + color + '" stroke-width="2.4" />'
        : '')
      + (targetPct !== null
        ? '  <line x1="' + targetPct + '" y1="0" x2="' + targetPct + '" y2="8" stroke="rgba(241,245,249,0.85)" stroke-width="1.2" stroke-dasharray="2 2" />'
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
    renderEmptyTile: renderEmptyTile,
    renderChartTile: renderChartTile,
    renderSparkline: renderSparkline,
    renderMiniBar: renderMiniBar,
    renderHeatStripColumn: renderHeatStripColumn,
    renderStackedColumn: renderStackedColumn,
    renderGroupedColumn: renderGroupedColumn,
    renderRankedBarChart: renderRankedBarChart,
    renderDonut: renderDonut,
    renderHorizontalBars: renderHorizontalBars,
    renderComparisonBars: renderComparisonBars,
    renderBullet: renderBullet,
    renderGauge: renderGauge,
    formatDelta: formatDelta,
    statusToTone: statusToTone,
    toneToColor: toneToColor,
    pauseChartHost: pauseChartHost,
    resumeChartHost: resumeChartHost,
    setChartRefreshMode: setChartRefreshMode
  };
})(typeof window !== 'undefined' ? window : this);
