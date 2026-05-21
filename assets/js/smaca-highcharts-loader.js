;(function () {
  if (typeof window === 'undefined') return;

  const STORE_KEY = '__SMACAHighchartsLoader';
  const DEFAULT_SRC = 'https://code.highcharts.com/12.2.0/highcharts.js';
  const DEFAULT_HEATMAP = 'https://code.highcharts.com/12.2.0/modules/heatmap.js';
  const DEFAULT_MODULES = [];

  function getStore() {
    if (!window[STORE_KEY]) {
      window[STORE_KEY] = {
        state: 'idle',
        src: null,
        error: null,
        promise: null,
        moduleErrors: []
      };
    }
    return window[STORE_KEY];
  }

  function resolveSource() {
    const configured = typeof window.SMACA_HIGHCHARTS_SRC === 'string'
      ? window.SMACA_HIGHCHARTS_SRC.trim()
      : '';
    return configured || DEFAULT_SRC;
  }

  function resolveModules() {
    const modules = Array.isArray(window.SMACA_HIGHCHARTS_MODULES)
      ? window.SMACA_HIGHCHARTS_MODULES
      : DEFAULT_MODULES;
    return modules
      .map(function (src) { return typeof src === 'string' ? src.trim() : ''; })
      .filter(Boolean);
  }

  function isScriptLoaded(script) {
    if (!script) return false;
    if (script.getAttribute('data-smaca-loaded') === '1') return true;
    if (script.readyState === 'complete' || script.readyState === 'loaded') return true;
    return false;
  }

  function loadScriptOnce(src, dataAttrKey, dataAttrValue) {
    return new Promise(function (resolve, reject) {
      const selector = 'script[' + dataAttrKey + '="' + dataAttrValue + '"]';
      const existing = document.querySelector(selector);
      if (existing) {
        if (isScriptLoaded(existing)) {
          resolve();
          return;
        }
        existing.addEventListener('load', function () {
          existing.setAttribute('data-smaca-loaded', '1');
          resolve();
        }, { once: true });
        existing.addEventListener('error', function () {
          reject(new Error('failed-to-load-script'));
        }, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      // Do not set crossOrigin — many CDNs omit ACAO and the script is blocked.
      script.setAttribute(dataAttrKey, dataAttrValue);
      script.addEventListener('load', function () {
        script.setAttribute('data-smaca-loaded', '1');
        resolve();
      }, { once: true });
      script.addEventListener('error', function () {
        reject(new Error('failed-to-load-script'));
      }, { once: true });
      document.head.appendChild(script);
    });
  }

  function removeScript(dataAttrKey, dataAttrValue) {
    const el = document.querySelector('script[' + dataAttrKey + '="' + dataAttrValue + '"]');
    if (el) el.remove();
  }

  function coreCdnFallback(primarySrc) {
    if (!primarySrc || primarySrc.indexOf('code.highcharts.com') !== -1) return null;
    return DEFAULT_SRC;
  }

  function moduleCdnFallback(moduleSrc) {
    if (!moduleSrc || moduleSrc.indexOf('code.highcharts.com') !== -1) return null;
    if (/heatmap/i.test(moduleSrc)) return DEFAULT_HEATMAP;
    return null;
  }

  function loadCoreLibrary() {
    const primary = resolveSource();
    const fallback = coreCdnFallback(primary);
    return loadScriptOnce(primary, 'data-smaca-highcharts-loader', 'core')
      .catch(function () {
        removeScript('data-smaca-highcharts-loader', 'core');
        if (!fallback) throw new Error('failed-to-load-highcharts');
        return loadScriptOnce(fallback, 'data-smaca-highcharts-loader', 'core-cdn');
      });
  }

  function loadOptionalModule(moduleSrc, idx) {
    const key = String(idx);
    const fallback = moduleCdnFallback(moduleSrc);
    return loadScriptOnce(moduleSrc, 'data-smaca-highcharts-module', key)
      .catch(function () {
        removeScript('data-smaca-highcharts-module', key);
        if (!fallback) {
          getStore().moduleErrors.push({ src: moduleSrc, error: 'failed-to-load-module' });
          return;
        }
        return loadScriptOnce(fallback, 'data-smaca-highcharts-module', key + '-cdn')
          .catch(function () {
            getStore().moduleErrors.push({ src: moduleSrc, error: 'failed-to-load-module-fallback' });
          });
      });
  }

  function emitReady() {
    window.dispatchEvent(new CustomEvent('smaca:highcharts-ready', {
      detail: { source: getStore().src }
    }));
  }

  function emitFailed(errorMessage) {
    window.dispatchEvent(new CustomEvent('smaca:highcharts-failed', {
      detail: { source: getStore().src, error: errorMessage || 'unknown' }
    }));
  }

  function applyGlobalHighchartsOptions() {
    if (typeof window.Highcharts === 'undefined' || typeof window.Highcharts.setOptions !== 'function') {
      return;
    }
    window.Highcharts.setOptions({
      accessibility: {
        enabled: false
      }
    });
  }

  function loadHighcharts() {
    const store = getStore();
    if (typeof window.Highcharts !== 'undefined') {
      applyGlobalHighchartsOptions();
      store.state = 'ready';
      if (!store.src) store.src = resolveSource();
      return Promise.resolve(window.Highcharts);
    }
    if (store.promise) return store.promise;

    const modules = resolveModules();
    store.src = resolveSource();
    store.state = 'loading';
    store.moduleErrors = [];

    store.promise = loadCoreLibrary()
      .then(function () {
        return modules.reduce(function (chain, moduleSrc, idx) {
          return chain.then(function () {
            return loadOptionalModule(moduleSrc, idx);
          });
        }, Promise.resolve());
      })
      .then(function () {
        if (typeof window.Highcharts === 'undefined') {
          throw new Error('failed-to-load-highcharts');
        }
        applyGlobalHighchartsOptions();
        store.state = 'ready';
        store.error = null;
        emitReady();
        return window.Highcharts;
      })
      .catch(function (err) {
        store.state = 'failed';
        store.error = (err && err.message) ? err.message : 'failed-to-load-highcharts';
        emitFailed(store.error);
        throw err;
      });

    return store.promise;
  }

  window.SMACAHighchartsLoader = {
    load: loadHighcharts,
    isReady: function () { return typeof window.Highcharts !== 'undefined'; },
    getState: function () {
      const store = getStore();
      return {
        state: store.state,
        source: store.src || resolveSource(),
        error: store.error,
        moduleErrors: store.moduleErrors || []
      };
    }
  };

  loadHighcharts().catch(function () {
    // Dashboard boot waits on SMACAHighchartsLoader.load() before rendering charts.
  });
})();
