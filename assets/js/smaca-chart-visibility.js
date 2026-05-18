/**
 * Pause Highcharts / heavy chart hosts outside the viewport (IntersectionObserver).
 */
(function (global) {
  'use strict';

  var observer = null;
  var observed = new WeakSet();
  var customHosts = Object.create(null);

  var HEAVY_CHART_IDS = {
    'iaq-co2-band-chart': {
      pause: function () {
        if (global.SMACAHighchartsAdapter && typeof global.SMACAHighchartsAdapter.destroyIaqTrendHighchart === 'function') {
          global.SMACAHighchartsAdapter.destroyIaqTrendHighchart();
        }
      },
      resume: function () {
        if (typeof global.renderIAQSection === 'function') {
          global.renderIAQSection('chart-visible', false);
        }
      }
    },
    'iaq-co2-hourly-heatmap': {
      pause: function () {
        if (global.SMACAHighchartsAdapter && typeof global.SMACAHighchartsAdapter.destroyIaqHeatstripHighchart === 'function') {
          global.SMACAHighchartsAdapter.destroyIaqHeatstripHighchart();
        }
      },
      resume: function () {
        if (typeof global.renderIAQSection === 'function') {
          global.renderIAQSection('chart-visible', false);
        }
      }
    }
  };

  function ensureObserver() {
    if (observer || typeof IntersectionObserver === 'undefined') return observer;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (!el) return;
        var visible = entry.isIntersecting && entry.intersectionRatio > 0.04;
        var tel = global.SMACATelemetry;
        if (visible) {
          if (tel && typeof tel.resumeChartHost === 'function') tel.resumeChartHost(el);
          var id = el.id;
          if (id && customHosts[id] && typeof customHosts[id].resume === 'function') {
            customHosts[id].resume();
          } else if (id && HEAVY_CHART_IDS[id] && typeof HEAVY_CHART_IDS[id].resume === 'function') {
            HEAVY_CHART_IDS[id].resume();
          }
        } else {
          if (tel && typeof tel.pauseChartHost === 'function') tel.pauseChartHost(el);
          var pid = el.id;
          if (pid && customHosts[pid] && typeof customHosts[pid].pause === 'function') {
            customHosts[pid].pause();
          } else if (pid && HEAVY_CHART_IDS[pid] && typeof HEAVY_CHART_IDS[pid].pause === 'function') {
            HEAVY_CHART_IDS[pid].pause();
          }
        }
      });
    }, { root: null, rootMargin: '80px 0px', threshold: [0, 0.04, 0.12] });
    return observer;
  }

  function observe(el) {
    if (!el || observed.has(el)) return;
    var obs = ensureObserver();
    if (!obs) return;
    observed.add(el);
    obs.observe(el);
  }

  function observeById(id) {
    if (!id) return;
    var el = document.getElementById(id);
    if (el) observe(el);
  }

  function registerHost(id, handlers) {
    if (!id || !handlers) return;
    customHosts[id] = handlers;
    observeById(id);
  }

  function bootHeavyHosts() {
    Object.keys(HEAVY_CHART_IDS).forEach(observeById);
  }

  function init() {
    bootHeavyHosts();
    if (typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(function () {
      bootHeavyHosts();
      document.querySelectorAll('[data-smaca-chart="1"]').forEach(function (host) {
        observe(host);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.SMACAChartVisibility = {
    observe: observe,
    observeById: observeById,
    registerHost: registerHost,
    bootHeavyHosts: bootHeavyHosts
  };
})(typeof window !== 'undefined' ? window : this);
