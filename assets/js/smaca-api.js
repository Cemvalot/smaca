// SMACA API helpers (plain JS, framework-free)
(function () {
  const REQUEST_CACHE = {
    values: {},
    inflight: {}
  };

  const REQUEST_TTLS_MS = {
    '/api/dashboard/overview': 12000,
    '/api/sensors': 12000
  };

  function nowMs() {
    return Date.now();
  }

  function getTtlForPath(path) {
    if (REQUEST_TTLS_MS[path]) return REQUEST_TTLS_MS[path];
    if (/\/timeseries\?/.test(path)) return 30000;
    if (/\/latest$/.test(path)) return 8000;
    return 0;
  }

  function readCached(path) {
    const ttlMs = getTtlForPath(path);
    if (!ttlMs) return null;
    const cached = REQUEST_CACHE.values[path];
    if (!cached) return null;
    if ((nowMs() - cached.ts) > ttlMs) return null;
    return cached.value;
  }

  function writeCache(path, value) {
    const ttlMs = getTtlForPath(path);
    if (!ttlMs) return;
    REQUEST_CACHE.values[path] = { ts: nowMs(), value: value };
  }

  function getBaseUrl() {
    const configuredBase = (window.SMACA_BASE_URL || '').trim();
    if (!configuredBase) return '';
    if (typeof window === 'undefined' || !window.location) {
      return configuredBase.replace(/\/+$/, '');
    }

    try {
      const resolved = new URL(configuredBase, window.location.origin);
      if (resolved.origin === window.location.origin) return '';
      if (resolved.protocol !== window.location.protocol) {
        return '';
      }
      return resolved.href.replace(/\/+$/, '');
    } catch (error) {
      return configuredBase.replace(/\/+$/, '');
    }
  }

  function isNetworkLoadError(error) {
    if (!error) return false;
    if (error instanceof TypeError) return true;
    const message = String(error.message || error);
    return /load failed|failed to fetch|networkerror/i.test(message);
  }

  async function requestJson(url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      // Keep null; handled below with useful error.
    }

    if (!response.ok) {
      const message = (data && (data.message || data.error)) || `Request failed (${response.status})`;
      const error = new Error(`${message} [${url}]`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    return data;
  }

  async function fetchJson(path) {
    const cached = readCached(path);
    if (cached) return cached;

    if (REQUEST_CACHE.inflight[path]) return REQUEST_CACHE.inflight[path];

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}${path}`;

    REQUEST_CACHE.inflight[path] = (async function () {
      try {
        const result = await requestJson(url);
        writeCache(path, result);
        return result;
      } catch (error) {
        if (baseUrl && isNetworkLoadError(error)) {
          const fallbackResult = await requestJson(path);
          writeCache(path, fallbackResult);
          return fallbackResult;
        }
        throw error;
      } finally {
        delete REQUEST_CACHE.inflight[path];
      }
    })();

    return REQUEST_CACHE.inflight[path];
  }

  function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeSnapshotToIAQItem(snapshotRow) {
    if (!snapshotRow) return null;
    var g = typeof window !== 'undefined' ? window : globalThis;
    var n =
      g.SMACA_TELEMETRY_METRIC_NORMALIZE &&
      typeof g.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest === 'function'
        ? g.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest(snapshotRow)
        : snapshotRow;
    const sensorId = snapshotRow.sensor_id ?? null;
    const sensorUid = snapshotRow.sensor_uid ?? null;
    const deviceName = snapshotRow.sensor_name || `Sensor ${sensorId ?? ''}`.trim() || 'Unknown';
    const deviceProfileName = snapshotRow.device_type || null;
    return {
      time: snapshotRow.measured_at || new Date().toISOString(),
      sensorId: sensorId,
      sensorUid: sensorUid,
      deviceName: deviceName,
      deviceProfileName: deviceProfileName,
      deviceInfo: {
        deviceName: deviceName,
        deviceProfileName: deviceProfileName
      },
      payload: {
        object: {
          co2: toNumberOrNull(n.co2_ppm),
          temperature: toNumberOrNull(n.temperature ?? n.temperature_c),
          humidity: toNumberOrNull(n.humidity ?? n.humidity_rh),
          pm2_5: toNumberOrNull(n.pm25 ?? n.pm2_5_ugm3),
          pm10: toNumberOrNull(n.pm10 ?? n.pm10_ugm3),
          battery: toNumberOrNull(n.battery_pct),
          tvoc: toNumberOrNull(n.tvoc ?? n.tvoc_index),
          pressure: null,
          light_level: toNumberOrNull(n.lighting ?? n.light_level),
          pir: null
        }
      }
    };
  }

  function timeseriesPointsToIAQItems(points, meta) {
    const rows = Array.isArray(points) ? points : [];
    const sensorId = meta?.sensorId ?? null;
    const sensorUid = meta?.sensorUid ?? null;
    const deviceName = meta?.deviceName || `Sensor ${sensorId ?? ''}`.trim() || 'Unknown';
    const deviceProfileName = meta?.deviceProfileName || null;
    return rows.map(function (point) {
      return {
        time: point.time || new Date().toISOString(),
        sensorId: sensorId,
        sensorUid: sensorUid,
        deviceName: deviceName,
        deviceProfileName: deviceProfileName,
        deviceInfo: {
          deviceName: deviceName,
          deviceProfileName: deviceProfileName
        },
        payload: {
          object: {
            co2: null,
            temperature: null,
            humidity: null,
            pm2_5: null,
            pm10: null,
            battery: null,
            tvoc: null,
            pressure: null,
            light_level: null,
            pir: null
          }
        }
      };
    });
  }

  function timeseriesPointsToOccupancyItems(points, meta) {
    const rows = Array.isArray(points) ? points : [];
    return rows.map(function (point) {
      return {
        time: point.time || new Date().toISOString(),
        sensorId: meta.sensorId,
        payload: {
          object: {
            people_in: null,
            people_out: null,
            people_total_in: null,
            people_total_out: null,
            // Backward-compatible aliases used by existing charts.
            period_in: null,
            period_out: null,
            total_in: null,
            total_out: null
          }
        }
      };
    });
  }

  function timeseriesPointsToEnvironmentalItems(points, meta) {
    const rows = Array.isArray(points) ? points : [];
    return rows.map(function (point) {
      return {
        time: point.time || new Date().toISOString(),
        sensorId: meta.sensorId,
        payload: {
          object: {
            uv_index: null,
            energy_kwh: null,
            // Backward-compatible alias used by existing UV widgets.
            modbus_chn_1: null
          }
        }
      };
    });
  }

  function mergeMetricIntoIAQItems(items, metric, points) {
    const normalized = Array.isArray(items) ? items : [];
    const rows = Array.isArray(points) ? points : [];
    const byTime = new Map();
    normalized.forEach(function (item) {
      byTime.set(item.time, item);
    });

    rows.forEach(function (point) {
      const existing = byTime.get(point.time);
      if (!existing) return;
      const value = toNumberOrNull(point.value);
      if (metric === 'co2_ppm') existing.payload.object.co2 = value;
      if (metric === 'temperature_c') existing.payload.object.temperature = value;
      if (metric === 'humidity_rh') existing.payload.object.humidity = value;
      if (metric === 'pm2_5_ugm3') existing.payload.object.pm2_5 = value;
      if (metric === 'pm10_ugm3') existing.payload.object.pm10 = value;
      if (metric === 'battery_pct') existing.payload.object.battery = value;
      if (metric === 'tvoc_index') existing.payload.object.tvoc = value;
    });

    return normalized;
  }

  function mergeMetricIntoOccupancyItems(items, metric, points) {
    const normalized = Array.isArray(items) ? items : [];
    const rows = Array.isArray(points) ? points : [];
    const byTime = new Map();
    normalized.forEach(function (item) {
      byTime.set(item.time, item);
    });

    rows.forEach(function (point) {
      const existing = byTime.get(point.time);
      if (!existing) return;
      const value = toNumberOrNull(point.value);
      if (metric === 'people_in') {
        existing.payload.object.people_in = value;
        existing.payload.object.period_in = value;
      }
      if (metric === 'people_out') {
        existing.payload.object.people_out = value;
        existing.payload.object.period_out = value;
      }
      if (metric === 'people_total_in') {
        existing.payload.object.people_total_in = value;
        existing.payload.object.total_in = value;
      }
      if (metric === 'people_total_out') {
        existing.payload.object.people_total_out = value;
        existing.payload.object.total_out = value;
      }
    });

    return normalized;
  }

  function mergeMetricIntoEnvironmentalItems(items, metric, points) {
    const normalized = Array.isArray(items) ? items : [];
    const rows = Array.isArray(points) ? points : [];
    const byTime = new Map();
    normalized.forEach(function (item) {
      byTime.set(item.time, item);
    });

    rows.forEach(function (point) {
      const existing = byTime.get(point.time);
      if (!existing) return;
      const value = toNumberOrNull(point.value);
      if (metric === 'uv_index') {
        existing.payload.object.uv_index = value;
        existing.payload.object.modbus_chn_1 = value;
      }
      if (metric === 'energy_kwh') {
        existing.payload.object.energy_kwh = value;
      }
      if (metric === 'signal_strength') {
        existing.payload.object.signal_strength = value;
        existing.payload.object.rssi = value;
      }
      if (metric === 'snr' || metric === 'signal_to_noise') {
        existing.payload.object.snr = value;
        existing.payload.object.signal_to_noise = value;
      }
      if (metric === 'tx_ccq') {
        existing.payload.object.tx_ccq = value;
      }
      if (metric === 'tx_rate') {
        existing.payload.object.tx_rate = value;
      }
    });

    return normalized;
  }

  async function fetchDashboardOverview() {
    return fetchJson('/api/dashboard/overview');
  }

  async function fetchSensors() {
    return fetchJson('/api/sensors');
  }

  async function fetchSensorLatest(sensorId) {
    return fetchJson(`/api/sensors/${encodeURIComponent(sensorId)}/latest`);
  }

  async function fetchSensorTimeseries(sensorId, metric, timeframe) {
    const tf = timeframe || '24h';
    const qs = new URLSearchParams({ metric: metric, timeframe: tf }).toString();
    return fetchJson(`/api/sensors/${encodeURIComponent(sensorId)}/timeseries?${qs}`);
  }

  function readActiveLocation() {
    try {
      const value = (window.SMACA_LOCATION || '').toString().trim();
      return value || null;
    } catch (e) {
      return null;
    }
  }

  function readActiveTimeframe() {
    var allowed = ['24h', '7d', '30d'];
    try {
      var fromState = (window.SMACAState && window.SMACAState.currentTimeframe) || '';
      if (allowed.indexOf(String(fromState)) !== -1) return fromState;
      var fromGlobal = window.SMACA_TIMEFRAME || '';
      if (allowed.indexOf(String(fromGlobal)) !== -1) return fromGlobal;
    } catch (e) {}
    return '24h';
  }

  async function fetchKpiSummary(module, options) {
    const resolvedModule = module || 'overview';
    const opts = options || {};
    const params = { module: resolvedModule };
    const explicitLocation = (opts.location || '').toString().trim();
    const activeLocation = explicitLocation || readActiveLocation();
    if (activeLocation) {
      params.location = activeLocation;
    }
    const explicitTimeframe = (opts.timeframe || '').toString().trim();
    const allowedTf = ['24h', '7d', '30d'];
    var tf = explicitTimeframe && allowedTf.indexOf(explicitTimeframe) !== -1
      ? explicitTimeframe
      : readActiveTimeframe();
    params.timeframe = tf;
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`/api/kpis/summary?${qs}`);
  }

  async function fetchSpatialLocations(options) {
    const opts = options || {};
    const params = {};
    const moduleArg = (opts.module || '').toString().trim();
    if (moduleArg) {
      params.module = moduleArg;
    }
    const roleArg = (opts.role || '').toString().trim();
    if (roleArg) {
      params.role = roleArg;
    }
    const qs = new URLSearchParams(params).toString();
    const path = qs ? `/api/spatial/locations?${qs}` : '/api/spatial/locations';
    return fetchJson(path);
  }

  window.SMACAApi = {
    fetchDashboardOverview: fetchDashboardOverview,
    fetchSensors: fetchSensors,
    fetchSensorLatest: fetchSensorLatest,
    fetchSensorTimeseries: fetchSensorTimeseries,
    fetchKpiSummary: fetchKpiSummary,
    fetchSpatialLocations: fetchSpatialLocations,
    adapters: {
      normalizeSnapshotToIAQItem: normalizeSnapshotToIAQItem,
      timeseriesPointsToIAQItems: timeseriesPointsToIAQItems,
      timeseriesPointsToOccupancyItems: timeseriesPointsToOccupancyItems,
      timeseriesPointsToEnvironmentalItems: timeseriesPointsToEnvironmentalItems,
      mergeMetricIntoIAQItems: mergeMetricIntoIAQItems,
      mergeMetricIntoOccupancyItems: mergeMetricIntoOccupancyItems,
      mergeMetricIntoEnvironmentalItems: mergeMetricIntoEnvironmentalItems
    }
  };
})();
