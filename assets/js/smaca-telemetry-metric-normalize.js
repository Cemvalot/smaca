/**
 * Single client-side mirror of server IAQ metric aliases (defence in depth).
 * Canonical keys: pm25, pm10, tvoc, lighting, temperature, humidity.
 */
(function (global) {
  'use strict';

  function firstPresentScalar(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      var v = obj[k];
      if (v === null || v === undefined || v === '') continue;
      return v;
    }
    return null;
  }

  /**
   * @param {Record<string, unknown>|null|undefined} latest
   * @returns {Record<string, unknown>}
   */
  function normalizeLatest(latest) {
    var lat = latest && typeof latest === 'object' ? latest : {};
    var out = {};
    for (var key in lat) {
      if (Object.prototype.hasOwnProperty.call(lat, key)) {
        out[key] = lat[key];
      }
    }

    out.pm25 = firstPresentScalar(lat, ['pm25', 'pm2_5_ugm3', 'pm2_5ugm3']);
    out.pm10 = firstPresentScalar(lat, ['pm10', 'pm10_ugm3', 'pm10ugm3']);
    out.tvoc = firstPresentScalar(lat, ['tvoc', 'tvoc_index']);
    out.lighting = firstPresentScalar(lat, ['lighting', 'light_level']);
    out.temperature = firstPresentScalar(lat, ['temperature', 'temperature_c']);
    out.humidity = firstPresentScalar(lat, ['humidity', 'humidity_rh']);

    if (out.pm25 !== null) {
      if (lat.pm2_5_ugm3 === undefined || lat.pm2_5_ugm3 === null || lat.pm2_5_ugm3 === '') out.pm2_5_ugm3 = out.pm25;
      if (lat.pm2_5ugm3 === undefined || lat.pm2_5ugm3 === null || lat.pm2_5ugm3 === '') out.pm2_5ugm3 = out.pm25;
    }
    if (out.pm10 !== null) {
      if (lat.pm10_ugm3 === undefined || lat.pm10_ugm3 === null || lat.pm10_ugm3 === '') out.pm10_ugm3 = out.pm10;
      if (lat.pm10ugm3 === undefined || lat.pm10ugm3 === null || lat.pm10ugm3 === '') out.pm10ugm3 = out.pm10;
    }
    if (out.tvoc !== null && (lat.tvoc_index === undefined || lat.tvoc_index === null || lat.tvoc_index === '')) {
      out.tvoc_index = out.tvoc;
    }
    if (out.lighting !== null && (lat.light_level === undefined || lat.light_level === null || lat.light_level === '')) {
      out.light_level = out.lighting;
    }

    out.rssi = firstPresentScalar(lat, ['rssi', 'signal_strength', 'signalStrength']);
    out.device = firstPresentScalar(lat, ['device', 'device_name']);
    out.deviceLocation = firstPresentScalar(lat, ['deviceLocation', 'device_location', 'sensor_location']);
    out.deviceID = firstPresentScalar(lat, ['deviceID', 'device_id', 'sensor_uid', 'sensor_id']);
    if (out.rssi !== null && (lat.signal_strength === undefined || lat.signal_strength === null || lat.signal_strength === '')) {
      out.signal_strength = out.rssi;
    }
    out.snr = firstPresentScalar(lat, ['snr', 'signal_to_noise']);
    out.tx_ccq = firstPresentScalar(lat, ['tx_ccq']);
    out.tx_rate = firstPresentScalar(lat, ['tx_rate']);

    return out;
  }

  global.SMACA_TELEMETRY_METRIC_NORMALIZE = {
    normalizeLatest: normalizeLatest
  };
})(typeof window !== 'undefined' ? window : this);
