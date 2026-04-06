if (typeof formatTime === 'undefined') {
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
}

if (typeof window !== 'undefined') {
  window.lastRenderedTimeframe = null;
  window.iaqDashboardRendering = false; // Lock to prevent concurrent renders
}

function initAccurateIAQDashboard() {
  
  // Check if already rendering
  if (typeof window !== 'undefined' && window.iaqDashboardRendering) {
    return;
  }
  
  // Check if IAQ section exists and is visible
  const iaqSection = document.getElementById('iaq');
  if (!iaqSection || iaqSection.style.display === 'none') {
    return;
  }
  
  // Get current timeframe
  const currentTimeframe = SMACAState.currentTimeframe;
  
  // Skip if timeframe hasn't changed and we've already rendered
  const lastRendered = typeof window !== 'undefined' ? window.lastRenderedTimeframe : null;
  if (lastRendered === currentTimeframe && lastRendered !== null) {
    return;
  }
  
  // Set rendering lock
  if (typeof window !== 'undefined') {
    window.iaqDashboardRendering = true;
  }
  
  // Get filtered data from state manager
  const filteredIAQ = SMACAState.getFilteredIAQ();
  
  if (!filteredIAQ || filteredIAQ.length === 0) {
    // Show insufficient history message
    const chartPlaceholders = document.querySelectorAll('#iaq .chart-placeholder');
    chartPlaceholders.forEach(placeholder => {
      placeholder.innerHTML = '<div style="text-align: center; padding: var(--space-8); color: var(--muted);"><p>Insufficient history for selected range</p></div>';
    });
    if (typeof window !== 'undefined') {
      window.lastRenderedTimeframe = currentTimeframe;
      window.iaqDashboardRendering = false; // Release lock
    }
    return;
  }
  
  try {
    // Normalize data
    const normalizedIAQ = normalizeIAQData(filteredIAQ);
    
    // Render IAQ dashboard
    renderIAQDashboard(normalizedIAQ);
    
    // Update last rendered timeframe and release lock
    if (typeof window !== 'undefined') {
      window.lastRenderedTimeframe = currentTimeframe;
      window.iaqDashboardRendering = false;
    }
  } catch (error) {
    // Release lock on error
    if (typeof window !== 'undefined') {
      window.iaqDashboardRendering = false;
    }
  }
}

/**
 * Render complete IAQ dashboard
 */
function renderIAQDashboard(normalizedData) {
  if (!normalizedData || normalizedData.length === 0) {
    return;
  }
  
  const latest = normalizedData[normalizedData.length - 1];
  const selectedSensorId = typeof window !== 'undefined' ? window.SMACACurrentSensorId : null;

  // KPI cards are handled by updateIAQDashboardWithTrends in smaca-production-features.js
  // Don't render them here to avoid conflicts
  
  createAccurateCO2Chart('iaq-co2-band-chart', normalizedData);
  renderSensorHealthPanel(latest);
  renderDataSourcePanel(latest);
}

/**
 * Render IAQ KPI Cards with metric definitions
 */
function renderIAQKPICards(latest, previous) {
  const metrics = [
    {
      key: 'co2',
      label: 'CO₂',
      value: latest.co2,
      unit: 'ppm',
      definition: 'Carbon dioxide concentration; proxy for ventilation adequacy.',
      trendKey: 'co2',
      invertTrend: true // Lower is better for CO2
    },
    {
      key: 'temperature',
      label: 'Temperature',
      value: latest.temperature,
      unit: '°C',
      definition: 'Indoor air temperature.',
      trendKey: 'temperature'
    },
    {
      key: 'humidity',
      label: 'Humidity',
      value: latest.humidity,
      unit: '%',
      definition: 'Relative humidity.',
      trendKey: 'humidity'
    },
    {
      key: 'pm2_5',
      label: 'PM2.5',
      value: latest.pm2_5,
      unit: 'µg/m³',
      definition: 'Particulate matter concentration (particles < 2.5µm).',
      trendKey: 'pm2_5',
      invertTrend: true
    },
    {
      key: 'pm10',
      label: 'PM10',
      value: latest.pm10,
      unit: 'µg/m³',
      definition: 'Particulate matter concentration (particles < 10µm).',
      trendKey: 'pm10',
      invertTrend: true
    },
    {
      key: 'tvoc',
      label: 'TVOC',
      value: latest.tvoc,
      unit: '(raw)',
      definition: 'Total volatile organic compounds (raw from sensor payload).',
      trendKey: 'tvoc',
      invertTrend: true
    }
  ];
  
  const container = document.getElementById('iaq-kpi-cards');
  if (!container) return;
  
  container.innerHTML = '';
  
  metrics.forEach(metric => {
    if (metric.value === null || metric.value === undefined) return;
    
    const card = document.createElement('div');
    card.className = 'card';
    
    const trend = previous ? calculateMicroTrend(
      metric.value,
      previous[metric.trendKey],
      metric.invertTrend
    ) : { direction: '—', text: 'Insufficient history' };
    
    const trendColor = trend.direction === '↑' && metric.invertTrend ? '#ef4444' :
                      trend.direction === '↓' && metric.invertTrend ? '#10b981' :
                      trend.direction === '↑' ? '#10b981' :
                      trend.direction === '↓' ? '#ef4444' : 'var(--muted)';
    
    card.innerHTML = `
      <div class="card__body">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-3);">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);">
              <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">${metric.label}</div>
              <div class="info-tooltip" style="position: relative; cursor: help;">
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div class="tooltip-content" style="
                  position: absolute;
                  bottom: 100%;
                  left: 50%;
                  transform: translateX(-50%);
                  margin-bottom: var(--space-2);
                  background: var(--surface);
                  border: 1px solid var(--border);
                  border-radius: var(--r-md);
                  padding: var(--space-2) var(--space-3);
                  font-size: 10px;
                  color: var(--text);
                  white-space: nowrap;
                  opacity: 0;
                  pointer-events: none;
                  transition: opacity 0.2s;
                  z-index: 100;
                  box-shadow: var(--shadow-md);
                ">
                  ${metric.definition}
                </div>
              </div>
            </div>
            <div style="font-size: 28px; font-weight: 600; color: var(--text); margin-bottom: var(--space-1);">
              ${typeof metric.value === 'number' ? metric.value.toFixed(metric.value % 1 === 0 ? 0 : 1) : metric.value}
            </div>
            <div style="font-size: 11px; color: var(--muted);">${metric.unit}</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-1);">
            <div style="color: ${trendColor}; font-size: 16px; font-weight: 600;">${trend.direction}</div>
            <div style="font-size: 10px; color: var(--muted);">${trend.text}</div>
          </div>
        </div>
      </div>
    `;
    
    // Add tooltip functionality
    const tooltipTrigger = card.querySelector('.info-tooltip');
    const tooltipContent = card.querySelector('.tooltip-content');
    if (tooltipTrigger && tooltipContent) {
      tooltipTrigger.addEventListener('mouseenter', () => {
        tooltipContent.style.opacity = '1';
      });
      tooltipTrigger.addEventListener('mouseleave', () => {
        tooltipContent.style.opacity = '0';
      });
    }
    
    container.appendChild(card);
  });
}

/**
 * Enhanced micro-trend calculation with invert option
 */
function calculateMicroTrend(currentValue, previousValue, invert = false) {
  if (currentValue === null || previousValue === null || previousValue === undefined) {
    return { direction: '—', delta: null, text: 'Insufficient history' };
  }
  
  const delta = currentValue - previousValue;
  const absDelta = Math.abs(delta);
  
  // Threshold: 0.5% or 1 unit minimum
  const threshold = Math.max(1, Math.abs(previousValue) * 0.005);
  
  if (absDelta < threshold) {
    return { direction: '→', delta: 0, text: 'Stable' };
  }
  
  const isPositive = delta > 0;
  const isGood = invert ? !isPositive : isPositive;
  
  if (isPositive) {
    return { 
      direction: '↑', 
      delta: delta, 
      text: `+${delta.toFixed(1)}`,
      isGood: !invert
    };
  } else {
    return { 
      direction: '↓', 
      delta: delta, 
      text: `${delta.toFixed(1)}`,
      isGood: invert
    };
  }
}

/**
 * Render Sensor Health Panel
 */
function renderSensorHealthPanel(data) {
  const container = document.getElementById('sensor-health-panel');
  if (!container) return;

  const batteryValue = typeof data?.battery === 'number' && Number.isFinite(data.battery) ? data.battery : null;
  const hasBatteryField = data && Object.prototype.hasOwnProperty.call(data, 'battery');
  const hasRSSIField = data && Object.prototype.hasOwnProperty.call(data, 'rssi');
  const hasSNRField = data && Object.prototype.hasOwnProperty.call(data, 'snr');

  const resolveMissingLabel = (hasField, value, unsupportedText) => {
    if (!hasField) return unsupportedText;
    if (value === null || value === undefined) return 'Unavailable';
    return null;
  };
  
  // RSSI interpretation
  const getRSSIStatus = (rssi) => {
    if (rssi === null || rssi === undefined) return { status: 'unknown', label: 'N/A', color: 'var(--muted)' };
    if (rssi > -70) return { status: 'strong', label: 'Strong', color: '#10b981' };
    if (rssi > -90) return { status: 'ok', label: 'OK', color: '#f59e0b' };
    return { status: 'weak', label: 'Weak', color: '#ef4444' };
  };
  
  // SNR interpretation
  const getSNRStatus = (snr) => {
    if (snr === null || snr === undefined) return { status: 'unknown', label: 'N/A', color: 'var(--muted)' };
    if (snr > 5) return { status: 'good', label: 'Good', color: '#10b981' };
    if (snr > 0) return { status: 'ok', label: 'OK', color: '#f59e0b' };
    return { status: 'poor', label: 'Poor', color: '#ef4444' };
  };
  
  const rssiStatus = getRSSIStatus(data.rssi);
  const snrStatus = getSNRStatus(data.snr);

  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">Sensor Health</h3>
      </div>
      <div class="card__body">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4);">
          <div>
            <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">Battery</div>
            <div style="width: 100%; height: 8px; background: var(--surface-2); border-radius: 4px; overflow: hidden; margin-bottom: var(--space-1);">
              <div style="width: ${batteryValue !== null ? batteryValue : 0}%; height: 100%; background: ${batteryValue !== null && batteryValue > 50 ? '#10b981' : batteryValue !== null && batteryValue > 20 ? '#f59e0b' : '#ef4444'};"></div>
            </div>
            <div style="font-size: 12px; font-weight: 600; color: var(--text);">
              ${batteryValue !== null ? `${batteryValue}%` : resolveMissingLabel(hasBatteryField, data?.battery, 'Not reported by sensor')}
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">RSSI</div>
            <div style="font-size: 18px; font-weight: 600; color: ${rssiStatus.color}; margin-bottom: var(--space-1);">
              ${data.rssi !== null && data.rssi !== undefined ? `${data.rssi} dBm` : resolveMissingLabel(hasRSSIField, data?.rssi, 'Unsupported by device')}
            </div>
            <div style="font-size: 10px; color: var(--muted);">
              ${rssiStatus.label} ${data.rssi !== null && data.rssi !== undefined ? `(${data.rssi > -70 ? '> -70' : data.rssi > -90 ? '-70 to -90' : '< -90'})` : ''}
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">SNR</div>
            <div style="font-size: 18px; font-weight: 600; color: ${snrStatus.color}; margin-bottom: var(--space-1);">
              ${data.snr !== null && data.snr !== undefined ? `${data.snr} dB` : resolveMissingLabel(hasSNRField, data?.snr, 'Unsupported by device')}
            </div>
            <div style="font-size: 10px; color: var(--muted);">
              ${snrStatus.label} ${data.snr !== null && data.snr !== undefined ? `(${data.snr > 5 ? '> 5' : data.snr > 0 ? '0-5' : '< 0'})` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Data Source Panel
 */
function renderDataSourcePanel(data) {
  const container = document.getElementById('data-source-panel');
  if (!container) return;

  const formatField = (value, options = {}) => {
    if (value !== null && value !== undefined && value !== '') return value;
    if (options.unsupportedWhenMissing) return 'Unsupported by device';
    if (options.notReportedWhenMissing) return 'Not reported by sensor';
    return 'Unavailable';
  };

  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">Data Source</h3>
      </div>
      <div class="card__body">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); font-size: 11px;">
          <div>
            <div style="color: var(--muted); margin-bottom: var(--space-1);">Device Name</div>
            <div style="color: var(--text); font-weight: 500;">${formatField(data.deviceName, { notReportedWhenMissing: true })}</div>
          </div>
          <div>
            <div style="color: var(--muted); margin-bottom: var(--space-1);">Device Profile</div>
            <div style="color: var(--text); font-weight: 500;">${formatField(data.deviceProfileName, { notReportedWhenMissing: true })}</div>
          </div>
          <div>
            <div style="color: var(--muted); margin-bottom: var(--space-1);">Timestamp</div>
            <div style="color: var(--text); font-weight: 500;">${data.time ? formatTime(data.time, true) : 'Unavailable'}</div>
          </div>
          <div>
            <div style="color: var(--muted); margin-bottom: var(--space-1);">Gateway ID</div>
            <div style="color: var(--text); font-weight: 500;">${formatField(data.gatewayId, { unsupportedWhenMissing: true })}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
