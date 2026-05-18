/**
 * Pause Highcharts / heavy chart hosts outside the viewport.
 * Defers resume while scrolling; flushes on scroll settle via rAF.
 */
(function (global) {
  'use strict';

  var observer = null;
  var observed = new WeakSet();
  var customHosts = Object.create(null);
  var pendingResumeHosts = new Set();
  var pendingResumeIds = new Set();
  var scrollRootEl = null;
  var scrollEndTimer = null;
  var flushRaf = 0;
  var isScrolling = false;
  var SCROLL_SETTLE_MS = 140;
  var RESUME_DEBOUNCE_MS = 80;

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

  function scrollDebugEnabled() {
    try {
      return String(global.localStorage && global.localStorage.getItem('smaca_debug_scroll')) === '1';
    } catch (e) {
      return false;
    }
  }

  function scrollLog(message, detail) {
    if (!scrollDebugEnabled()) return;
    try {
      if (detail !== undefined) {
        console.log('[SMACA_SCROLL]', message, detail);
      } else {
        console.log('[SMACA_SCROLL]', message);
      }
    } catch (e) { /* noop */ }
  }

  function getScrollRoot() {
    if (scrollRootEl && scrollRootEl.isConnected) return scrollRootEl;
    scrollRootEl = document.querySelector('.content') || document.documentElement;
    return scrollRootEl;
  }

  function markScrolling() {
    if (!isScrolling) {
      isScrolling = true;
      document.documentElement.classList.add('smaca-is-scrolling');
      scrollLog('scroll-start');
    }
    clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(function () {
      isScrolling = false;
      document.documentElement.classList.remove('smaca-is-scrolling');
      scrollLog('scroll-settle', { pendingHosts: pendingResumeHosts.size, pendingIds: pendingResumeIds.size });
      scheduleFlushResumes();
    }, SCROLL_SETTLE_MS);
  }

  function bindScrollListener() {
    var root = getScrollRoot();
    if (!root || root.__smacaScrollBound) return;
    root.__smacaScrollBound = true;
    root.addEventListener('scroll', markScrolling, { passive: true });
    global.addEventListener('resize', function () {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(scheduleFlushResumes, RESUME_DEBOUNCE_MS);
    }, { passive: true });
  }

  function scheduleResumeHost(host) {
    if (!host) return;
    pendingResumeHosts.add(host);
    if (!isScrolling) {
      scheduleFlushResumes();
    }
  }

  function scheduleResumeId(id) {
    if (!id) return;
    pendingResumeIds.add(id);
    if (!isScrolling) {
      scheduleFlushResumes();
    }
  }

  function scheduleFlushResumes() {
    if (flushRaf) return;
    flushRaf = global.requestAnimationFrame(function () {
      flushRaf = 0;
      setTimeout(flushPendingResumes, RESUME_DEBOUNCE_MS);
    });
  }

  function flushPendingResumes() {
    var hosts = Array.from(pendingResumeHosts);
    var ids = Array.from(pendingResumeIds);
    pendingResumeHosts.clear();
    pendingResumeIds.clear();

    hosts.forEach(function (host) {
      if (!host || !host.isConnected) return;
      var rect = host.getBoundingClientRect();
      var inView = rect.bottom > 0 && rect.top < (global.innerHeight || document.documentElement.clientHeight);
      if (!inView) return;
      scrollLog('chart-resume', { kind: 'host', paused: host.getAttribute('data-smaca-chart-paused') });
      var tel = global.SMACATelemetry;
      if (tel && typeof tel.resumeChartHost === 'function') {
        tel.resumeChartHost(host);
      }
    });

    ids.forEach(function (id) {
      var handlers = customHosts[id] || HEAVY_CHART_IDS[id];
      if (!handlers || typeof handlers.resume !== 'function') return;
      var el = document.getElementById(id);
      if (!el) return;
      var rect = el.getBoundingClientRect();
      var inView = rect.bottom > 0 && rect.top < (global.innerHeight || document.documentElement.clientHeight);
      if (!inView) return;
      scrollLog('chart-resume', { kind: 'heavy', id: id });
      handlers.resume();
    });
  }

  function pauseHost(host) {
    if (!host) return;
    pendingResumeHosts.delete(host);
    var tel = global.SMACATelemetry;
    if (tel && typeof tel.pauseChartHost === 'function') {
      tel.pauseChartHost(host);
    }
    scrollLog('chart-pause', { kind: 'host' });
  }

  function pauseId(id) {
    if (!id) return;
    pendingResumeIds.delete(id);
    var handlers = customHosts[id] || HEAVY_CHART_IDS[id];
    if (handlers && typeof handlers.pause === 'function') {
      handlers.pause();
    }
    scrollLog('chart-pause', { kind: 'heavy', id: id });
  }

  function ensureObserver() {
    if (observer || typeof IntersectionObserver === 'undefined') return observer;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (!el) return;
        var visible = entry.isIntersecting && entry.intersectionRatio > 0.06;
        var id = el.id || '';
        var isChartHost = el.getAttribute && el.getAttribute('data-smaca-chart') === '1';

        if (visible) {
          if (isChartHost) {
            scheduleResumeHost(el);
          } else if (id && (customHosts[id] || HEAVY_CHART_IDS[id])) {
            scheduleResumeId(id);
          }
        } else {
          if (isChartHost) {
            pauseHost(el);
          } else if (id) {
            pauseId(id);
          }
        }
      });
    }, { root: null, rootMargin: '120px 0px', threshold: [0, 0.06, 0.15] });
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

  function watchHeightStability() {
    if (!scrollDebugEnabled() || typeof ResizeObserver === 'undefined') return;
    var sections = document.querySelectorAll('[data-smaca-telemetry], .dashboard-section > .card');
    sections.forEach(function (el) {
      if (el.__smacaHeightWatch) return;
      el.__smacaHeightWatch = true;
      var lastH = el.offsetHeight;
      var ro = new ResizeObserver(function () {
        var h = el.offsetHeight;
        if (Math.abs(h - lastH) > 24) {
          scrollLog('section-height-change', { selector: el.className, from: lastH, to: h });
          lastH = h;
        }
      });
      ro.observe(el);
    });
  }

  function init() {
    bindScrollListener();
    bootHeavyHosts();
    watchHeightStability();
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
    bootHeavyHosts: bootHeavyHosts,
    flushPendingResumes: flushPendingResumes
  };
})(typeof window !== 'undefined' ? window : this);
