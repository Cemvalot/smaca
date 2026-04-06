// SMACA API helpers (plain JS, framework-free)
(function () {
  function getBaseUrl() {
    return (window.SMACA_BASE_URL || '').replace(/\/+$/, '');
  }

  async function fetchJson(path) {
    const url = `${getBaseUrl()}${path}`;
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

  function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeSnapshotToIAQItem(snapshotRow) {
    if (!snapshotRow) return null;
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
          co2: toNumberOrNull(snapshotRow.co2_ppm),
          temperature: toNumberOrNull(snapshotRow.temperature_c),
          humidity: toNumberOrNull(snapshotRow.humidity_rh),
          pm2_5: toNumberOrNull(snapshotRow.pm2_5_ugm3),
          pm10: toNumberOrNull(snapshotRow.pm10_ugm3),
          battery: toNumberOrNull(snapshotRow.battery_pct),
          tvoc: null,
          pressure: null,
          light_level: null,
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

  window.SMACAApi = {
    fetchDashboardOverview: fetchDashboardOverview,
    fetchSensors: fetchSensors,
    fetchSensorLatest: fetchSensorLatest,
    fetchSensorTimeseries: fetchSensorTimeseries,
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
