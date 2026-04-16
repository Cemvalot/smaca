;(function () {
  if (typeof window === 'undefined') return;

  const STORE_KEY = '__SMACAHighchartsLoader';
  const DEFAULT_SRC = 'https://code.highcharts.com/12.2.0/highcharts.js';
  const DEFAULT_MODULES = [];

  function getStore() {
    if (!window[STORE_KEY]) {
      window[STORE_KEY] = {
        state: 'idle',
        src: null,
        error: null,
        promise: null
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

  function loadScriptOnce(src, dataAttrKey, dataAttrValue) {
    return new Promise(function (resolve, reject) {
      const selector = 'script[' + dataAttrKey + '="' + dataAttrValue + '"]';
      const existing = document.querySelector(selector);
      if (existing) {
        existing.addEventListener('load', function () { resolve(); }, { once: true });
        existing.addEventListener('error', function () { reject(new Error('failed-to-load-script')); }, { once: true });
        // If it already loaded earlier, resolve on next tick.
        setTimeout(function () { resolve(); }, 0);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      script.setAttribute(dataAttrKey, dataAttrValue);
      script.addEventListener('load', function () { resolve(); }, { once: true });
      script.addEventListener('error', function () { reject(new Error('failed-to-load-script')); }, { once: true });
      document.head.appendChild(script);
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

  function loadHighcharts() {
    const store = getStore();
    if (typeof window.Highcharts !== 'undefined') {
      store.state = 'ready';
      if (!store.src) store.src = resolveSource();
      return Promise.resolve(window.Highcharts);
    }
    if (store.promise) return store.promise;

    const src = resolveSource();
    const modules = resolveModules();
    store.src = src;
    store.state = 'loading';

    store.promise = new Promise(function (resolve, reject) {
      loadScriptOnce(src, 'data-smaca-highcharts-loader', '1')
        .then(function () {
          // Load optional modules sequentially so they can attach to Highcharts.
          return modules.reduce(function (chain, moduleSrc, idx) {
            return chain.then(function () {
              return loadScriptOnce(moduleSrc, 'data-smaca-highcharts-module', String(idx));
            });
          }, Promise.resolve());
        })
        .then(function () {
          store.state = 'ready';
          store.error = null;
          emitReady();
          resolve(window.Highcharts);
        })
        .catch(function () {
          store.state = 'failed';
          store.error = 'failed-to-load-highcharts';
          emitFailed(store.error);
          reject(new Error(store.error));
        });
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
        error: store.error
      };
    }
  };

  loadHighcharts().catch(function () {
    // Fallback rendering paths already exist in the dashboard.
  });
})();
