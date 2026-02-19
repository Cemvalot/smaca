function normalizeIAQData(payload) {
  const payloads = Array.isArray(payload) ? payload : [payload];
  
  return payloads
    .map(p => {
      const obj = p.payload?.object || p.object || {};
      const deviceInfo = p.deviceInfo || {};
      const rxInfo = p.rxInfo?.[0] || {};
      
      return {
        // Sensor readings
        co2: obj.co2 !== undefined ? obj.co2 : null, // ppm
        temperature: obj.temperature !== undefined ? obj.temperature : null, // °C
        humidity: obj.humidity !== undefined ? obj.humidity : null, // %
        pm2_5: obj.pm2_5 !== undefined ? obj.pm2_5 : null, // µg/m³
        pm10: obj.pm10 !== undefined ? obj.pm10 : null, // µg/m³
        tvoc: obj.tvoc !== undefined ? obj.tvoc : null, // unit unknown
        pressure: obj.pressure !== undefined ? obj.pressure : null, // hPa
        light_level: obj.light_level !== undefined ? obj.light_level : null, // raw or lux
        pir: obj.pir !== undefined ? obj.pir : null, // "idle"/"triggered"
        battery: obj.battery !== undefined ? obj.battery : null, // %
        
        // Metadata
        time: p.time || p.timestamp || new Date().toISOString(),
        deviceName: deviceInfo.deviceName || 'Unknown',
        deviceProfileName: deviceInfo.deviceProfileName || 'Unknown',
        rssi: rxInfo.rssi !== undefined ? rxInfo.rssi : null,
        snr: rxInfo.snr !== undefined ? rxInfo.snr : null,
        gatewayId: rxInfo.gatewayId || 'Unknown'
      };
    })
    .sort((a, b) => new Date(a.time) - new Date(b.time));
}

/**
 * Normalize People Counter payload (Milesight VS350)
 */
function normalizeOccupancyData(payload) {
  const payloads = Array.isArray(payload) ? payload : [payload];
  
  return payloads
    .map(p => {
      const obj = p.payload?.object || p.object || {};
      const deviceInfo = p.deviceInfo || {};
      const rxInfo = p.rxInfo?.[0] || {};
      
      return {
        period_in: obj.period_in !== undefined ? obj.period_in : null,
        period_out: obj.period_out !== undefined ? obj.period_out : null,
        total_in: obj.total_in !== undefined ? obj.total_in : null,
        total_out: obj.total_out !== undefined ? obj.total_out : null,
        battery: obj.battery !== undefined ? obj.battery : null, // %
        
        time: p.time || p.timestamp || new Date().toISOString(),
        deviceName: deviceInfo.deviceName || 'Unknown',
        rssi: rxInfo.rssi !== undefined ? rxInfo.rssi : null,
        snr: rxInfo.snr !== undefined ? rxInfo.snr : null
      };
    })
    .sort((a, b) => new Date(a.time) - new Date(b.time));
}

/**
 * Normalize UV Controller payload (Milesight UC501-EA / Modbus)
 */
function normalizeUVData(payload) {
  const payloads = Array.isArray(payload) ? payload : [payload];
  
  return payloads
    .map(p => {
      const obj = p.payload?.object || p.object || {};
      const deviceInfo = p.deviceInfo || {};
      const rxInfo = p.rxInfo?.[0] || {};
      
      return {
        modbus_chn_1: obj.modbus_chn_1 !== undefined ? obj.modbus_chn_1 : null, // unit unknown
        gpio_input_1: obj.gpio_input_1 !== undefined ? obj.gpio_input_1 : null,
        gpio_input_2: obj.gpio_input_2 !== undefined ? obj.gpio_input_2 : null,
        
        time: p.time || p.timestamp || new Date().toISOString(),
        deviceName: deviceInfo.deviceName || 'Unknown',
        rssi: rxInfo.rssi !== undefined ? rxInfo.rssi : null,
        snr: rxInfo.snr !== undefined ? rxInfo.snr : null
      };
    })
    .sort((a, b) => new Date(a.time) - new Date(b.time));
}

/**
 * Calculate micro-trend (delta between last two values)
 */
function calculateMicroTrend(currentValue, previousValue) {
  if (currentValue === null || previousValue === null || previousValue === undefined) {
    return { direction: '—', delta: null, text: 'Insufficient history' };
  }
  
  const delta = currentValue - previousValue;
  const absDelta = Math.abs(delta);
  
  // Only show trend if change is meaningful (> 0.5% or > 1 unit for integers)
  const threshold = Math.max(1, previousValue * 0.005);
  
  if (absDelta < threshold) {
    return { direction: '→', delta: 0, text: 'Stable' };
  }
  
  if (delta > 0) {
    return { direction: '↑', delta: delta, text: `+${delta.toFixed(1)}` };
  } else {
    return { direction: '↓', delta: delta, text: `${delta.toFixed(1)}` };
  }
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp, includeDate = false) {
  const date = new Date(timestamp);
  if (includeDate) {
    return date.toLocaleString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
