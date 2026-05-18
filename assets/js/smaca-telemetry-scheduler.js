/**
 * Telemetry scheduler — stagger work and cap parallel API fan-out.
 */
(function (global) {
  'use strict';

  function defer(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function mapPool(items, worker, concurrency) {
    var list = Array.isArray(items) ? items : [];
    if (!list.length) return Promise.resolve([]);
    var limit = Math.max(1, Number(concurrency) || 4);
    var results = new Array(list.length);
    var index = 0;
    var active = 0;
    return new Promise(function (resolve, reject) {
      function pump() {
        while (active < limit && index < list.length) {
          (function (i) {
            active += 1;
            Promise.resolve(worker(list[i], i))
              .then(function (r) {
                results[i] = r;
                active -= 1;
                if (index >= list.length && active === 0) resolve(results);
                else pump();
              })
              .catch(reject);
          })(index);
          index += 1;
        }
      }
      pump();
    });
  }

  function stagger(tasks, gapMs) {
    var gap = Number.isFinite(Number(gapMs)) ? Number(gapMs) : 48;
    var steps = Array.isArray(tasks) ? tasks : [];
    return steps.reduce(function (chain, task) {
      return chain
        .then(function () {
          return Promise.resolve().then(task);
        })
        .then(function () {
          return defer(gap);
        });
    }, Promise.resolve());
  }

  function setChartRefreshMode(isRefresh) {
    global.SMACA_CHART_REFRESH = !!isRefresh;
  }

  global.SMACATelemetryScheduler = {
    defer: defer,
    mapPool: mapPool,
    stagger: stagger,
    setChartRefreshMode: setChartRefreshMode
  };
})(typeof window !== 'undefined' ? window : this);
