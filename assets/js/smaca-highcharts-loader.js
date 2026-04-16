;(function () {
  if (typeof window === 'undefined') return;

  const STORE_KEY = '__SMACAHighchartsLoader';
  const DEFAULT_SRC = 'https://code.highcharts.com/12.2.0/highcharts.js';

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
    store.src = src;
    store.state = 'loading';

    const existing = document.querySelector('script[data-smaca-highcharts-loader="1"]');
    if (existing) {
      store.promise = new Promise(function (resolve, reject) {
        existing.addEventListener('load', function () {
          store.state = 'ready';
          emitReady();
          resolve(window.Highcharts);
        }, { once: true });
        existing.addEventListener('error', function () {
          store.state = 'failed';
          store.error = 'failed-to-load-highcharts';
          emitFailed(store.error);
          reject(new Error(store.error));
        }, { once: true });
      });
      return store.promise;
    }

    store.promise = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      script.dataset.smacaHighchartsLoader = '1';
      script.addEventListener('load', function () {
        store.state = 'ready';
        store.error = null;
        emitReady();
        resolve(window.Highcharts);
      }, { once: true });
      script.addEventListener('error', function () {
        store.state = 'failed';
        store.error = 'failed-to-load-highcharts';
        emitFailed(store.error);
        reject(new Error(store.error));
      }, { once: true });
      document.head.appendChild(script);
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
