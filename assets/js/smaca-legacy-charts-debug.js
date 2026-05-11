/**
 * Browser smoke-test helpers for legacy full-width dashboard charts
 * (rendered by smaca-production-features.js / accurate-dashboard.js).
 */
(function (global) {
  'use strict';

  var AUDIT_STORAGE_KEY = 'smaca_legacy_chart_audit_v1';
  var IDLE_MS = 1400;
  var TIMEFRAMES = ['24h', '7d', '30d'];

  var LEGACY_BY_PAGE = {
    overview: ['overview-campus-trend-chart'],
    iaq: ['iaq-co2-band-chart'],
    occupancy: ['occupancy-flow-chart'],
    energy: ['energy-main-combined-chart', 'energy-demand-trend-chart'],
    environmental: ['uv-main-chart', 'uv-daily-comparison-chart']
  };

  function activePage() {
    if (global.SMACA_CURRENT_PAGE) return String(global.SMACA_CURRENT_PAGE);
    var parts = (global.location && global.location.pathname || '').split('/').filter(Boolean);
    return parts.length > 1 ? parts[1] : 'overview';
  }

  function activeTimeframe() {
    if (global.SMACAState && TIMEFRAMES.indexOf(String(global.SMACAState.currentTimeframe)) !== -1) {
      return String(global.SMACAState.currentTimeframe);
    }
    if (TIMEFRAMES.indexOf(String(global.SMACA_TIMEFRAME)) !== -1) {
      return String(global.SMACA_TIMEFRAME);
    }
    return '24h';
  }

  function applyTimeframe(tf) {
    if (TIMEFRAMES.indexOf(tf) === -1) return;
    if (global.SMACAState && typeof global.SMACAState.setTimeframe === 'function') {
      global.SMACAState.setTimeframe(tf);
    } else {
      global.SMACA_TIMEFRAME = tf;
      try {
        global.dispatchEvent(new CustomEvent('smaca:timeframe-changed', { detail: { timeframe: tf } }));
      } catch (e) { /* noop */ }
    }
  }

  function waitIdle(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, Number.isFinite(ms) ? ms : IDLE_MS);
    });
  }

  function countFinite(values) {
    if (!Array.isArray(values)) return 0;
    return values.filter(function (v) { return Number.isFinite(Number(v)); }).length;
  }

  function inspectChart(chartId) {
    var el = global.document && global.document.getElementById(chartId);
    if (!el) {
      return { chartId: chartId, status: 'missing', bucketCount: null, populated: null, empty: null };
    }
    var empty = !!el.querySelector('.smaca-chart-empty');
    var hasSvg = !!el.querySelector('svg');
    var hasHighcharts = !!el.querySelector('.highcharts-container');
    var status = empty ? 'empty' : ((hasSvg || hasHighcharts) ? 'rendered' : 'blank');
    return {
      chartId: chartId,
      status: status,
      empty: empty,
      bucketCount: null,
      populated: null
    };
  }

  function enrichFromDebug(page, rows) {
    var tf = activeTimeframe();
    if (page === 'overview' && global.__overviewTrendDebug) {
      rows.forEach(function (row) {
        if (row.chartId !== 'overview-campus-trend-chart') return;
        row.bucketCount = global.__overviewTrendDebug.bucketCount;
        row.populated = global.__overviewTrendDebug.populatedCount;
        row.timeframe = global.__overviewTrendDebug.timeframe || tf;
      });
    }
    if (page === 'iaq' && global.__SMACAIaqComputed) {
      rows.forEach(function (row) {
        if (row.chartId !== 'iaq-co2-band-chart') return;
        var series = global.__SMACAIaqComputed.series || {};
        var values = series.co2 && Array.isArray(series.co2.values) ? series.co2.values : [];
        row.bucketCount = values.length || null;
        row.populated = countFinite(values);
        row.timeframe = global.__SMACAIaqComputed.timeframe || tf;
      });
    }
    if (page === 'occupancy' && global.__occupancyChartDebug) {
      rows.forEach(function (row) {
        if (row.chartId !== 'occupancy-flow-chart') return;
        row.bucketCount = global.__occupancyChartDebug.pointCount;
        row.populated = Number.isFinite(Number(global.__occupancyChartDebug.peakValue)) ? 1 : 0;
        row.timeframe = global.__occupancyChartDebug.timeframe || tf;
      });
    }
    if (page === 'energy' && global.__energyChartDebug) {
      var energy = global.__energyChartDebug;
      var main = energy.mainSeries && Array.isArray(energy.mainSeries.data) ? energy.mainSeries.data : [];
      rows.forEach(function (row) {
        if (row.chartId === 'energy-main-combined-chart') {
          row.bucketCount = main.length || energy.pointCount || null;
          row.populated = countFinite(main);
          row.timeframe = energy.timeframe || tf;
        }
        if (row.chartId === 'energy-demand-trend-chart') {
          var demand = energy.demandTrendSeries && Array.isArray(energy.demandTrendSeries.data)
            ? energy.demandTrendSeries.data
            : main;
          row.bucketCount = demand.length || energy.pointCount || null;
          row.populated = countFinite(demand);
          row.timeframe = energy.timeframe || tf;
        }
      });
    }
    if (page === 'environmental' && global.__uvChartDebug) {
      var uv = global.__uvChartDebug;
      rows.forEach(function (row) {
        if (row.chartId === 'uv-main-chart') {
          row.bucketCount = Array.isArray(uv.mainSeries) ? uv.mainSeries.length : null;
          row.populated = countFinite(uv.mainSeries);
          row.timeframe = uv.timeframe || tf;
        }
        if (row.chartId === 'uv-daily-comparison-chart') {
          row.bucketCount = Array.isArray(uv.dailyComparisonSeries) ? uv.dailyComparisonSeries.length : null;
          row.populated = countFinite(uv.dailyComparisonSeries);
          row.timeframe = uv.timeframe || tf;
        }
      });
    }
    return rows;
  }

  function collectCurrentPage() {
    var page = activePage();
    var chartIds = LEGACY_BY_PAGE[page] || [];
    var rows = chartIds.map(inspectChart);
    enrichFromDebug(page, rows);
    return {
      page: page,
      timeframe: activeTimeframe(),
      charts: rows
    };
  }

  function auditLegacyTimeframes(timeframes) {
    var order = Array.isArray(timeframes) && timeframes.length ? timeframes.slice() : TIMEFRAMES.slice();
    var auditRows = [];
    return order.reduce(function (chain, tf) {
      return chain.then(function () {
        applyTimeframe(tf);
        return waitIdle().then(function () {
          var snapshot = collectCurrentPage();
          auditRows.push({
            page: snapshot.page,
            timeframe: tf,
            charts: snapshot.charts
          });
          try { console.log('[SMACA_LEGACY]', snapshot); } catch (e) { /* noop */ }
        });
      });
    }, Promise.resolve()).then(function () {
      try {
        console.log('[SMACA_LEGACY] audit complete for', activePage());
        console.table(auditRows.reduce(function (flat, row) {
          (row.charts || []).forEach(function (chart) {
            flat.push({
              page: row.page,
              timeframe: row.timeframe,
              chartId: chart.chartId,
              status: chart.status,
              bucketCount: chart.bucketCount,
              populated: chart.populated
            });
          });
          return flat;
        }, []));
      } catch (e2) { /* noop */ }
      return auditRows;
    });
  }

  function pillarUrl(page) {
    if (page === 'overview') return '/dashboard';
    return '/dashboard/' + page;
  }

  function continueAllLegacyAudit() {
    var raw = null;
    try { raw = global.sessionStorage && global.sessionStorage.getItem(AUDIT_STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) return Promise.resolve(null);
    var state = null;
    try { state = JSON.parse(raw); } catch (e2) { state = null; }
    if (!state || !state.active) return Promise.resolve(state && state.results ? state.results : null);

    var target = state.pages[state.pageIndex];
    if (activePage() !== target) {
      global.location.assign(pillarUrl(target));
      return Promise.resolve({ navigating: target, partial: state.results || [] });
    }

    return auditLegacyTimeframes(state.timeframes).then(function (rows) {
      state.results = state.results || [];
      state.results.push({ page: target, rows: rows });
      state.pageIndex += 1;
      if (state.pageIndex >= state.pages.length) {
        state.active = false;
        try { global.sessionStorage.removeItem(AUDIT_STORAGE_KEY); } catch (e3) { /* noop */ }
        try {
          console.log('[SMACA_LEGACY] all pages audit complete');
          console.table((state.results || []).reduce(function (flat, block) {
            (block.rows || []).forEach(function (row) {
              (row.charts || []).forEach(function (chart) {
                flat.push({
                  page: row.page,
                  timeframe: row.timeframe,
                  chartId: chart.chartId,
                  status: chart.status,
                  bucketCount: chart.bucketCount,
                  populated: chart.populated
                });
              });
            });
            return flat;
          }, []));
        } catch (e4) { /* noop */ }
        return state.results;
      }
      try { global.sessionStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(state)); } catch (e5) { /* noop */ }
      global.location.assign(pillarUrl(state.pages[state.pageIndex]));
      return { navigating: state.pages[state.pageIndex], partial: state.results };
    });
  }

  function auditAllLegacyPages(timeframes) {
    var state = {
      pages: Object.keys(LEGACY_BY_PAGE),
      pageIndex: 0,
      timeframes: Array.isArray(timeframes) && timeframes.length ? timeframes.slice() : TIMEFRAMES.slice(),
      results: [],
      active: true
    };
    try { global.sessionStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* noop */ }
    try {
      console.log('[SMACA_LEGACY] audit started — the browser will visit each dashboard module with legacy charts.');
    } catch (e2) { /* noop */ }
    return continueAllLegacyAudit();
  }

  function cancelAllLegacyAudit() {
    try { global.sessionStorage.removeItem(AUDIT_STORAGE_KEY); } catch (e) { /* noop */ }
  }

  if (global.document) {
    global.document.addEventListener('DOMContentLoaded', function () {
      try {
        if (global.sessionStorage && global.sessionStorage.getItem(AUDIT_STORAGE_KEY)) {
          continueAllLegacyAudit();
        }
      } catch (e) { /* noop */ }
    });
  }

  global.SMACALegacyCharts = {
    chartsForPage: function (page) { return (LEGACY_BY_PAGE[page || activePage()] || []).slice(); },
    collect: collectCurrentPage,
    auditTimeframes: auditLegacyTimeframes,
    auditAllPages: auditAllLegacyPages,
    cancelAllPagesAudit: cancelAllLegacyAudit
  };
})(typeof window !== 'undefined' ? window : globalThis);
