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
  window.SMACAIaqSelectedMetric = window.SMACAIaqSelectedMetric || 'co2';
}

function finalizeIaqPageRenderCleanup() {
  if (typeof window === 'undefined') return;
  const currentPage = typeof getSmacaCurrentPage === 'function' ? getSmacaCurrentPage() : null;
  if (currentPage !== 'iaq') return;
  const overlay = document.getElementById('smaca-page-loading-overlay');
  const overlayMessage = document.getElementById('smaca-page-loading-message');
  if (overlay) {
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.display = '';
  }
  if (overlayMessage && overlay && !overlay.classList.contains('is-visible')) {
    overlayMessage.textContent = 'Loading data...';
  }
  const chart = document.getElementById('iaq-co2-band-chart');
  if (chart) {
    chart.style.position = 'relative';
    chart.style.zIndex = '1';
  }
  // Defensive IAQ-only cleanup in case legacy/combined templates are present.
  [
    '#alerts-panel',
    '#add-sensor-btn',
    '#add-user-btn',
    '#management',
    '#management-sensors-tab',
    '#management-users-tab',
    '#sensor-modal',
    '#user-modal'
  ].forEach(function (selector) {
    const el = document.querySelector(selector);
    if (el) el.style.display = 'none';
  });
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
      placeholder.innerHTML = '<div style="text-align: center; padding: var(--space-8); color: var(--muted);"><p>No IAQ data available</p></div>';
    });
    if (typeof window !== 'undefined') {
      window.lastRenderedTimeframe = currentTimeframe;
      window.iaqDashboardRendering = false; // Release lock
    }
    finalizeIaqPageRenderCleanup();
    return;
  }
  
  try {
    const normalizedIAQ = normalizeIAQData(filteredIAQ);
    const computed = computeIaqDashboardData(normalizedIAQ, currentTimeframe);
    if (typeof window !== 'undefined') window.__SMACAIaqComputed = computed;
    bindIaqMetricToggle();
    renderIAQDashboard(computed);
    finalizeIaqPageRenderCleanup();
    
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

function getIaqMetricConfig() {
  return {
    co2: { label: 'CO2', unit: 'ppm', decimals: 0, color: '#3b82f6' },
    temperature: { label: 'Temperature', unit: '°C', decimals: 1, color: '#06b6d4' },
    humidity: { label: 'Humidity', unit: '%', decimals: 0, color: '#6366f1' },
    pm2_5: { label: 'PM2.5', unit: 'µg/m³', decimals: 1, color: '#f59e0b' },
    pm10: { label: 'PM10', unit: 'µg/m³', decimals: 1, color: '#f97316' },
    tvoc: { label: 'TVOC', unit: '(raw)', decimals: 1, color: '#ec4899' }
  };
}

function getBucketMsForTimeframe(timeframe) {
  if (timeframe === '7d') return 6 * 60 * 60 * 1000;
  if (timeframe === '30d') return 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
}

function isFiniteMetric(value) {
  return Number.isFinite(Number(value));
}

function hexToRgb(color) {
  const value = String(color || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return { r: 59, g: 130, b: 246 };
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function toRgba(color, alpha) {
  const rgb = hexToRgb(color);
  const a = Number.isFinite(Number(alpha)) ? Number(alpha) : 1;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

function computeIaqDashboardData(normalizedRows, timeframe) {
  const rows = Array.isArray(normalizedRows) ? normalizedRows : [];
  const metrics = ['co2', 'temperature', 'humidity', 'pm2_5', 'pm10', 'tvoc'];
  const bucketMs = getBucketMsForTimeframe(timeframe);
  const grouped = {};
  let latestTimestampMs = 0;
  const latestPerSensor = {};

  rows.forEach(function (row) {
    const timeMs = new Date(row?.time).getTime();
    if (!Number.isFinite(timeMs)) return;
    latestTimestampMs = Math.max(latestTimestampMs, timeMs);
    const sensorId = row?.sensorId;
    if (sensorId !== null && sensorId !== undefined) {
      const key = String(sensorId);
      if (!latestPerSensor[key] || timeMs >= latestPerSensor[key].timeMs) {
        latestPerSensor[key] = { timeMs: timeMs, row: row };
      }
    }
    const bucket = Math.floor(timeMs / bucketMs) * bucketMs;
    const bucketKey = String(bucket);
    if (!grouped[bucketKey]) {
      grouped[bucketKey] = {
        bucketMs: bucket,
        metrics: {
          co2: [], temperature: [], humidity: [], pm2_5: [], pm10: [], tvoc: []
        }
      };
    }
    metrics.forEach(function (metric) {
      const value = Number(row?.[metric]);
      if (Number.isFinite(value)) grouped[bucketKey].metrics[metric].push(value);
    });
  });

  const sortedBuckets = Object.values(grouped).sort(function (a, b) { return a.bucketMs - b.bucketMs; });
  const seriesByMetric = {
    co2: [], temperature: [], humidity: [], pm2_5: [], pm10: [], tvoc: []
  };
  sortedBuckets.forEach(function (bucket) {
    metrics.forEach(function (metric) {
      const values = bucket.metrics[metric];
      if (!values.length) return;
      const sum = values.reduce(function (acc, v) { return acc + v; }, 0);
      seriesByMetric[metric].push({
        time: new Date(bucket.bucketMs).toISOString(),
        value: sum / values.length
      });
    });
  });

  const latestValues = {};
  const previousValues = {};
  metrics.forEach(function (metric) {
    const series = seriesByMetric[metric];
    const latest = series.length ? series[series.length - 1].value : null;
    const previous = series.length > 1 ? series[series.length - 2].value : null;
    latestValues[metric] = Number.isFinite(Number(latest)) ? Number(latest) : null;
    previousValues[metric] = Number.isFinite(Number(previous)) ? Number(previous) : null;
  });

  const activeSensorCount = Object.values(latestPerSensor).filter(function (entry) {
    const row = entry?.row || {};
    return metrics.some(function (metric) { return isFiniteMetric(row?.[metric]); });
  }).length;

  const summary = evaluateOverallIaqSummary(latestValues, activeSensorCount, latestTimestampMs);

  return {
    timeframe: timeframe,
    rows: rows,
    seriesByMetric: seriesByMetric,
    latestValues: latestValues,
    previousValues: previousValues,
    activeSensorCount: activeSensorCount,
    latestTimestampMs: latestTimestampMs,
    summary: summary
  };
}

function evaluateMetricStatus(metric, value) {
  if (!Number.isFinite(Number(value))) return { label: 'N/A', score: 0, tone: 'neutral' };
  const v = Number(value);
  if (metric === 'co2') {
    if (v < 800) return { label: 'Good', score: 5, tone: 'good' };
    if (v < 1000) return { label: 'Moderate', score: 3, tone: 'moderate' };
    return { label: 'High', score: 1, tone: 'high' };
  }
  if (metric === 'pm2_5') {
    if (v <= 12) return { label: 'Low', score: 5, tone: 'good' };
    if (v <= 35) return { label: 'Elevated', score: 3, tone: 'moderate' };
    return { label: 'High', score: 1, tone: 'high' };
  }
  if (metric === 'pm10') {
    if (v <= 20) return { label: 'Low', score: 5, tone: 'good' };
    if (v <= 50) return { label: 'Elevated', score: 3, tone: 'moderate' };
    return { label: 'High', score: 1, tone: 'high' };
  }
  if (metric === 'temperature') {
    if (v >= 21 && v <= 25) return { label: 'Comfortable', score: 5, tone: 'good' };
    if ((v >= 19 && v < 21) || (v > 25 && v <= 27)) return { label: 'Slightly Off', score: 3, tone: 'moderate' };
    return { label: 'Out of Range', score: 1, tone: 'high' };
  }
  if (metric === 'humidity') {
    if (v >= 40 && v <= 60) return { label: 'Comfortable', score: 5, tone: 'good' };
    if ((v >= 30 && v < 40) || (v > 60 && v <= 70)) return { label: 'Slightly Off', score: 3, tone: 'moderate' };
    return { label: 'Out of Range', score: 1, tone: 'high' };
  }
  if (metric === 'tvoc') {
    if (v < 150) return { label: 'Low', score: 5, tone: 'good' };
    if (v < 300) return { label: 'Elevated', score: 3, tone: 'moderate' };
    return { label: 'High', score: 1, tone: 'high' };
  }
  return { label: 'N/A', score: 0, tone: 'neutral' };
}

function evaluateOverallIaqSummary(latestValues, activeSensorCount, latestTimestampMs) {
  const drivingOrder = ['co2', 'pm2_5', 'pm10', 'humidity', 'temperature', 'tvoc'];
  const statuses = drivingOrder.map(function (metric) {
    return { metric: metric, status: evaluateMetricStatus(metric, latestValues?.[metric]) };
  });
  const contributing = statuses.filter(function (entry) { return entry.status.score > 0; });
  if (!contributing.length) {
    return {
      statusLabel: 'Moderate',
      explanation: 'No valid IAQ metric values available',
      freshnessMinutes: null
    };
  }
  const minScore = contributing.reduce(function (min, entry) { return Math.min(min, entry.status.score); }, 5);
  const avgScore = contributing.reduce(function (acc, entry) { return acc + entry.status.score; }, 0) / contributing.length;
  let statusLabel = 'Good';
  if (minScore <= 1 && avgScore < 2) statusLabel = 'Critical';
  else if (minScore <= 1) statusLabel = 'Poor';
  else if (avgScore < 3) statusLabel = 'Moderate';
  else if (avgScore >= 4.5) statusLabel = 'Excellent';
  const topDriver = statuses.sort(function (a, b) { return a.status.score - b.status.score; })[0];
  const driverLabelMap = { co2: 'CO2', pm2_5: 'PM2.5', pm10: 'PM10', humidity: 'Humidity', temperature: 'Temperature', tvoc: 'TVOC' };
  const explanation = topDriver
    ? `${driverLabelMap[topDriver.metric]} is ${topDriver.status.label.toLowerCase()}`
    : 'IAQ metrics are within expected ranges';
  const freshnessMinutes = latestTimestampMs ? Math.max(0, Math.round((Date.now() - latestTimestampMs) / 60000)) : null;
  return {
    statusLabel: statusLabel,
    explanation: explanation,
    activeSensorCount: activeSensorCount,
    latestTimestamp: latestTimestampMs ? new Date(latestTimestampMs).toISOString() : null,
    freshnessMinutes: freshnessMinutes
  };
}

/**
 * Render complete IAQ dashboard
 */
function renderIAQDashboard(computed) {
  if (!computed || !computed.rows || computed.rows.length === 0) {
    return;
  }
  renderIAQKPICards(computed);
  renderIaqMainTrendChart(computed);
  renderSensorHealthPanel(computed);
  renderDataSourcePanel(computed.summary);
  renderIaqHourlyHeatStrip(computed);
}

/**
 * Render IAQ KPI Cards with metric definitions
 */
function renderIAQKPICards(computed) {
  const cfg = getIaqMetricConfig();
  const metrics = Object.keys(cfg);
  const container = document.getElementById('iaq-kpi-cards');
  if (!container) return;
  container.innerHTML = '';
  metrics.forEach(function (metricKey) {
    const metricCfg = cfg[metricKey];
    const value = computed.latestValues?.[metricKey];
    const previous = computed.previousValues?.[metricKey];
    const status = evaluateMetricStatus(metricKey, value);
    const trend = calculateMicroTrend(value, previous, ['co2', 'pm2_5', 'pm10', 'tvoc'].includes(metricKey));
    const series = (computed.seriesByMetric?.[metricKey] || []).slice(-18).map(function (entry) { return entry.value; });
    const sparkline = renderSparklineSvg(series, metricCfg.color);
    const toneColor = status.tone === 'good' ? '#10b981' : status.tone === 'moderate' ? '#f59e0b' : status.tone === 'high' ? '#ef4444' : 'var(--muted)';
    const displayValue = Number.isFinite(Number(value)) ? Number(value).toFixed(metricCfg.decimals) : 'N/A';
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-card__content">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2);">
          <div class="stat-card__label">${metricCfg.label}</div>
          <span class="badge badge--sm" style="border:1px solid ${toneColor};color:${toneColor};background:transparent;">${status.label}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:var(--space-2);">
          <div>
            <div class="stat-card__value">${displayValue}</div>
            <div class="stat-card__unit">${metricCfg.unit}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:var(--muted);">Trend</div>
            <div style="font-size:12px;font-weight:600;color:var(--text);">${trend.text}</div>
          </div>
        </div>
        <div style="margin-top:var(--space-2);">${sparkline}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderSparklineSvg(values, color) {
  const series = Array.isArray(values) ? values.filter(function (v) { return Number.isFinite(Number(v)); }).map(Number) : [];
  if (series.length < 2) {
    return '<div style="height:26px;font-size:11px;color:var(--muted);display:flex;align-items:center;">No sparkline data</div>';
  }
  const min = Math.min.apply(null, series);
  const max = Math.max.apply(null, series);
  const range = max - min || 1;
  const points = series.map(function (v, i) {
    const x = (i / (series.length - 1)) * 100;
    const y = 24 - (((v - min) / range) * 20 + 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return `<svg viewBox="0 0 100 26" preserveAspectRatio="none" style="width:100%;height:26px;display:block;"><polyline fill="none" stroke="${color}" stroke-width="2" points="${points}"/></svg>`;
}

function bindIaqMetricToggle() {
  if (typeof window === 'undefined' || window.__smacaIaqMetricToggleBound) return;
  const toggle = document.getElementById('iaq-metric-toggle');
  if (!toggle) return;
  window.__smacaIaqMetricToggleBound = true;
  toggle.addEventListener('click', function (event) {
    const button = event.target?.closest('button[data-iaq-metric]');
    if (!button) return;
    const metric = button.getAttribute('data-iaq-metric') || 'co2';
    window.SMACAIaqSelectedMetric = metric;
    toggle.querySelectorAll('button[data-iaq-metric]').forEach(function (btn) {
      btn.classList.toggle('active', btn === button);
    });
    if (window.__SMACAIaqComputed) renderIaqMainTrendChart(window.__SMACAIaqComputed);
  });
}

function getThresholdBandsForMetric(metric) {
  const softBandA = 'rgba(148, 163, 184, 0.06)';
  const softBandB = 'rgba(148, 163, 184, 0.04)';
  const softBandC = 'rgba(148, 163, 184, 0.03)';
  if (metric === 'co2') {
    return [
      { min: 400, max: 800, color: softBandA },
      { min: 800, max: 1000, color: softBandB },
      { min: 1000, max: Number.POSITIVE_INFINITY, color: softBandC }
    ];
  }
  if (metric === 'pm2_5') {
    return [
      { min: 0, max: 12, color: softBandA },
      { min: 12, max: 35, color: softBandB },
      { min: 35, max: Number.POSITIVE_INFINITY, color: softBandC }
    ];
  }
  if (metric === 'pm10') {
    return [
      { min: 0, max: 20, color: softBandA },
      { min: 20, max: 50, color: softBandB },
      { min: 50, max: Number.POSITIVE_INFINITY, color: softBandC }
    ];
  }
  if (metric === 'temperature') return [{ min: 21, max: 25, color: softBandA }];
  if (metric === 'humidity') return [{ min: 40, max: 60, color: softBandA }];
  return [];
}

function renderIaqMainTrendChart(computed) {
  const chartEl = document.getElementById('iaq-co2-band-chart');
  if (!chartEl) return;
  const metric = (typeof window !== 'undefined' ? window.SMACAIaqSelectedMetric : null) || 'co2';
  const toggle = document.getElementById('iaq-metric-toggle');
  if (toggle) {
    toggle.querySelectorAll('button[data-iaq-metric]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-iaq-metric') === metric);
    });
  }
  const cfg = getIaqMetricConfig()[metric] || getIaqMetricConfig().co2;
  const series = (computed.seriesByMetric?.[metric] || []).filter(function (entry) {
    return Number.isFinite(Number(entry?.value));
  });
  if (!series.length) {
    chartEl.innerHTML = '<div style="padding: var(--space-6); text-align:center; color: var(--muted);">No IAQ data available</div>';
    return;
  }
  chartEl.style.position = 'relative';
  chartEl.style.zIndex = '1';

  const titleEl = document.getElementById('iaq-main-chart-title');
  if (titleEl) titleEl.textContent = `IAQ Trend - ${cfg.label}`;
  const subtitleEl = document.getElementById('iaq-main-chart-subtitle');
  if (subtitleEl) subtitleEl.textContent = `Aggregated across ${computed.activeSensorCount} IAQ sensors`;

  const width = chartEl.offsetWidth || 900;
  const height = 370;
  const padding = { top: 20, right: 24, bottom: 50, left: 56 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = series.map(function (entry) { return Number(entry.value); });
  const dataMin = Math.min.apply(null, values);
  const dataMax = Math.max.apply(null, values);
  const dataSpread = dataMax - dataMin;
  const scalingByMetric = {
    co2: { minVisualRange: 20, paddingRatio: 0.2, minPadding: 4 },
    temperature: { minVisualRange: 1.5, paddingRatio: 0.18, minPadding: 0.3 },
    humidity: { minVisualRange: 8, paddingRatio: 0.16, minPadding: 1.5 },
    pm2_5: { minVisualRange: 5, paddingRatio: 0.2, minPadding: 0.8 },
    pm10: { minVisualRange: 8, paddingRatio: 0.2, minPadding: 1 },
    tvoc: { minVisualRange: 20, paddingRatio: 0.2, minPadding: 2 }
  };
  const scaling = scalingByMetric[metric] || { minVisualRange: 5, paddingRatio: 0.18, minPadding: 1 };
  let min = dataMin;
  let max = dataMax;
  if (dataSpread < scaling.minVisualRange) {
    const center = (dataMin + dataMax) / 2;
    const halfRange = scaling.minVisualRange / 2;
    min = center - halfRange;
    max = center + halfRange;
  }
  const bands = getThresholdBandsForMetric(metric);
  const baseSpread = (max - min) || scaling.minVisualRange || 1;
  const yPadding = Math.max(baseSpread * scaling.paddingRatio, scaling.minPadding);
  min -= yPadding;
  max += yPadding;
  if (min < 0 && metric !== 'temperature') min = 0;
  const currentPage = typeof getSmacaCurrentPage === 'function' ? getSmacaCurrentPage() : null;
  if (typeof window !== 'undefined' && currentPage === 'iaq') {
    window.__iaqChartData = {
      selectedMetric: metric,
      timeframe: computed.timeframe,
      pointCount: series.length,
      series: series.map(function (entry) {
        return {
          time: entry?.time || null,
          value: Number(entry?.value)
        };
      }),
      min: dataMin,
      max: dataMax,
      spread: dataSpread,
      yDomain: [min, max]
    };
  }
  const yScale = function (v) { return chartHeight - ((v - min) / (max - min || 1)) * chartHeight; };
  const xScale = function (i) { return (i / Math.max(1, series.length - 1)) * chartWidth; };
  const points = series.map(function (entry, i) {
    const x = xScale(i);
    const y = yScale(Number(entry.value));
    return { x: x, y: y, value: Number(entry.value), time: entry.time };
  });
  const path = points.map(function (point, i) {
    return `${i === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(' ');

  chartEl.innerHTML = '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const gradientKey = `iaq-main-${metric}-${Date.now()}`;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const lineGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  lineGradient.setAttribute('id', `${gradientKey}-line`);
  lineGradient.setAttribute('x1', '0%');
  lineGradient.setAttribute('y1', '0%');
  lineGradient.setAttribute('x2', '100%');
  lineGradient.setAttribute('y2', '0%');
  const lineStopStart = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  lineStopStart.setAttribute('offset', '0%');
  lineStopStart.setAttribute('stop-color', toRgba(cfg.color, 0.8));
  const lineStopMid = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  lineStopMid.setAttribute('offset', '50%');
  lineStopMid.setAttribute('stop-color', cfg.color);
  const lineStopEnd = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  lineStopEnd.setAttribute('offset', '100%');
  lineStopEnd.setAttribute('stop-color', toRgba(cfg.color, 0.85));
  lineGradient.appendChild(lineStopStart);
  lineGradient.appendChild(lineStopMid);
  lineGradient.appendChild(lineStopEnd);
  defs.appendChild(lineGradient);

  const areaGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  areaGradient.setAttribute('id', `${gradientKey}-area`);
  areaGradient.setAttribute('x1', '0%');
  areaGradient.setAttribute('y1', '0%');
  areaGradient.setAttribute('x2', '0%');
  areaGradient.setAttribute('y2', '100%');
  const areaStopTop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  areaStopTop.setAttribute('offset', '0%');
  areaStopTop.setAttribute('stop-color', toRgba(cfg.color, 0.16));
  const areaStopBottom = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  areaStopBottom.setAttribute('offset', '100%');
  areaStopBottom.setAttribute('stop-color', toRgba(cfg.color, 0.02));
  areaGradient.appendChild(areaStopTop);
  areaGradient.appendChild(areaStopBottom);
  defs.appendChild(areaGradient);
  svg.appendChild(defs);

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${padding.left},${padding.top})`);

  const yTickCount = 6;
  const yTicks = [];
  for (let i = 0; i < yTickCount; i += 1) {
    const ratio = i / Math.max(1, yTickCount - 1);
    yTicks.push(min + ((max - min) * (1 - ratio)));
  }
  yTicks.forEach(function (tickValue) {
    const y = yScale(tickValue);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', String(y));
    line.setAttribute('x2', String(chartWidth));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', 'var(--border)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('opacity', '0.28');
    g.appendChild(line);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '-8');
    label.setAttribute('y', String(y));
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '10');
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = metric === 'co2' || metric === 'humidity'
      ? String(Math.round(tickValue))
      : Number(tickValue).toFixed(metric === 'temperature' ? 1 : 0);
    g.appendChild(label);
  });

  bands.forEach(function (band) {
    const top = Number.isFinite(band.max) ? Math.max(min, Math.min(max, band.max)) : max;
    const bottom = Number.isFinite(band.min) ? Math.max(min, Math.min(max, band.min)) : min;
    if (top <= bottom) return;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', yScale(top));
    rect.setAttribute('width', String(chartWidth));
    rect.setAttribute('height', String(yScale(bottom) - yScale(top)));
    rect.setAttribute('fill', band.color);
    g.appendChild(rect);
  });

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', path);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', `url(#${gradientKey}-line)`);
  line.setAttribute('stroke-width', '2.75');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('stroke-linecap', 'round');
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const areaPath = `${path} L ${xScale(series.length - 1).toFixed(2)} ${chartHeight} L 0 ${chartHeight} Z`;
  area.setAttribute('d', areaPath);
  area.setAttribute('fill', `url(#${gradientKey}-area)`);
  g.appendChild(area);
  g.appendChild(line);

  const staticMarkerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  points.forEach(function (point, idx) {
    const markerStep = Math.max(1, Math.floor(points.length / 10));
    const shouldShow = idx === 0 || idx === points.length - 1 || idx % markerStep === 0;
    if (!shouldShow) return;
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marker.setAttribute('cx', String(point.x));
    marker.setAttribute('cy', String(point.y));
    marker.setAttribute('r', '2.5');
    marker.setAttribute('fill', cfg.color);
    marker.setAttribute('opacity', '0.65');
    marker.setAttribute('stroke', '#0f172a');
    marker.setAttribute('stroke-width', '1');
    staticMarkerGroup.appendChild(marker);
  });
  g.appendChild(staticMarkerGroup);

  const focusLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  focusLine.setAttribute('x1', '0');
  focusLine.setAttribute('y1', '0');
  focusLine.setAttribute('x2', '0');
  focusLine.setAttribute('y2', String(chartHeight));
  focusLine.setAttribute('stroke', 'rgba(148, 163, 184, 0.45)');
  focusLine.setAttribute('stroke-width', '1');
  focusLine.setAttribute('stroke-dasharray', '3 3');
  focusLine.setAttribute('opacity', '0');
  g.appendChild(focusLine);

  const hoverDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  hoverDot.setAttribute('cx', '0');
  hoverDot.setAttribute('cy', '0');
  hoverDot.setAttribute('r', '4');
  hoverDot.setAttribute('fill', cfg.color);
  hoverDot.setAttribute('stroke', '#0f172a');
  hoverDot.setAttribute('stroke-width', '1.5');
  hoverDot.setAttribute('opacity', '0');
  g.appendChild(hoverDot);

  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', '0');
  xAxis.setAttribute('y1', String(chartHeight));
  xAxis.setAttribute('x2', String(chartWidth));
  xAxis.setAttribute('y2', String(chartHeight));
  xAxis.setAttribute('stroke', 'var(--border)');
  g.appendChild(xAxis);
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', '0');
  yAxis.setAttribute('y1', '0');
  yAxis.setAttribute('x2', '0');
  yAxis.setAttribute('y2', String(chartHeight));
  yAxis.setAttribute('stroke', 'var(--border)');
  g.appendChild(yAxis);

  const tickCount = 5;
  for (let i = 0; i < tickCount; i += 1) {
    const idx = Math.floor((i / Math.max(1, tickCount - 1)) * (series.length - 1));
    const x = xScale(idx);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(x));
    label.setAttribute('y', String(chartHeight + 16));
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '10');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = formatTime(series[idx].time, computed.timeframe !== '24h');
    g.appendChild(label);
  }

  const yAxisUnitLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yAxisUnitLabel.setAttribute('x', '-40');
  yAxisUnitLabel.setAttribute('y', '-6');
  yAxisUnitLabel.setAttribute('fill', 'var(--muted)');
  yAxisUnitLabel.setAttribute('font-size', '10');
  yAxisUnitLabel.textContent = cfg.unit;
  g.appendChild(yAxisUnitLabel);

  const hitGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  points.forEach(function (point, idx) {
    const prevX = idx > 0 ? points[idx - 1].x : 0;
    const nextX = idx < points.length - 1 ? points[idx + 1].x : chartWidth;
    const hitWidth = Math.max(12, (nextX - prevX) / 2);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(Math.max(0, point.x - hitWidth / 2)));
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(hitWidth));
    rect.setAttribute('height', String(chartHeight));
    rect.setAttribute('fill', 'transparent');
    rect.style.cursor = 'crosshair';
    rect.dataset.index = String(idx);
    hitGroup.appendChild(rect);
  });
  g.appendChild(hitGroup);

  svg.appendChild(g);
  chartEl.appendChild(svg);

  const tooltip = document.createElement('div');
  tooltip.style.position = 'absolute';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.minWidth = '150px';
  tooltip.style.padding = '10px 12px';
  tooltip.style.borderRadius = 'var(--r-md)';
  tooltip.style.border = '1px solid rgba(148, 163, 184, 0.3)';
  tooltip.style.background = '#111827';
  tooltip.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.24)';
  tooltip.style.color = 'var(--text)';
  tooltip.style.fontSize = 'var(--font-size-xs)';
  tooltip.style.opacity = '0';
  tooltip.style.transform = 'translateY(4px)';
  tooltip.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
  tooltip.style.zIndex = '3';
  chartEl.appendChild(tooltip);

  const formatValue = function (value) {
    if (!Number.isFinite(value)) return 'N/A';
    const decimals = Number.isFinite(Number(cfg.decimals)) ? Number(cfg.decimals) : 0;
    return `${value.toFixed(decimals)} ${cfg.unit}`.trim();
  };

  const showHoverAt = function (index) {
    const point = points[index];
    if (!point) return;
    focusLine.setAttribute('x1', String(point.x));
    focusLine.setAttribute('x2', String(point.x));
    focusLine.setAttribute('opacity', '1');
    hoverDot.setAttribute('cx', String(point.x));
    hoverDot.setAttribute('cy', String(point.y));
    hoverDot.setAttribute('opacity', '1');

    tooltip.innerHTML = `
      <div style="margin-bottom:8px;color:var(--muted);">${formatTime(point.time, computed.timeframe !== '24h')}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);">
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:999px;background:${cfg.color};"></span>${cfg.label}
        </span>
        <strong>${formatValue(point.value)}</strong>
      </div>
    `;
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0)';
    const tooltipWidth = tooltip.offsetWidth || 160;
    const tooltipHeight = tooltip.offsetHeight || 72;
    const left = Math.min(Math.max(8, padding.left + point.x + 12), width - tooltipWidth - 8);
    const top = Math.min(Math.max(8, padding.top + 8), height - tooltipHeight - 8);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  const hideHover = function () {
    focusLine.setAttribute('opacity', '0');
    hoverDot.setAttribute('opacity', '0');
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(4px)';
  };

  Array.from(hitGroup.querySelectorAll('rect')).forEach(function (rect) {
    rect.addEventListener('mouseenter', function () {
      showHoverAt(Number(rect.dataset.index));
    });
    rect.addEventListener('mousemove', function () {
      showHoverAt(Number(rect.dataset.index));
    });
  });
  chartEl.addEventListener('mouseleave', hideHover);
}

function renderIaqHourlyHeatStrip(computed) {
  const container = document.getElementById('iaq-hourly-heatstrip-panel');
  if (!container) return;
  const metric = 'co2';
  const series = (computed.seriesByMetric?.[metric] || []).slice(-24);
  if (!series.length) {
    container.innerHTML = '<div class="card"><div class="card__body"><div style="color: var(--muted); text-align:center;">No IAQ data available</div></div></div>';
    return;
  }
  const values = series.map(function (entry) { return Number(entry.value); });
  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  const range = max - min || 1;
  const cells = series.map(function (entry) {
    const val = Number(entry.value);
    const ratio = (val - min) / range;
    const hue = 120 - (ratio * 120);
    const color = `hsl(${hue.toFixed(0)} 75% 45%)`;
    return `<div title="${formatTime(entry.time, true)} - ${val.toFixed(0)} ppm" style="height:16px;border-radius:4px;background:${color};"></div>`;
  }).join('');
  container.innerHTML = `
    <div class="card">
      <div class="card__header"><h3 class="card__title">CO2 Hourly Pattern</h3></div>
      <div class="card__body">
        <div style="display:grid;grid-template-columns:repeat(${series.length}, minmax(8px,1fr));gap:4px;">${cells}</div>
        <div class="smaca-accordion smaca-accordion--collapsed" style="margin-top: var(--space-4);">
          <button type="button" class="smaca-accordion__trigger" aria-expanded="false">
            <span>What is this pattern?</span>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          <div class="smaca-accordion__body" hidden>
            <div class="accordion-content">
              <p><strong>What it shows:</strong> Aggregated CO2 behavior by hour slots across the selected timeframe.</p>
              <p><strong>How to read:</strong> Stronger/darker color blocks indicate consistently higher CO2 during those hours.</p>
              <p><strong>Why useful:</strong> Use recurring hot hours to identify ventilation or occupancy patterns and pre-emptively improve air exchange.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  if (typeof window !== 'undefined' && window.SMACAUI && typeof window.SMACAUI.initAccordions === 'function') {
    window.SMACAUI.initAccordions('#iaq-hourly-heatstrip-panel .smaca-accordion');
  }
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
function renderSensorHealthPanel(computed) {
  const container = document.getElementById('sensor-health-panel');
  if (!container) return;
  const metrics = ['co2', 'temperature', 'humidity', 'pm2_5', 'pm10', 'tvoc'];
  const latestValues = computed?.latestValues || {};
  const validCount = metrics.filter(function (metric) {
    return Number.isFinite(Number(latestValues?.[metric]));
  }).length;
  const completenessPct = Math.round((validCount / metrics.length) * 100);
  const freshnessMinutes = computed?.summary?.freshnessMinutes;
  const freshnessText = Number.isFinite(Number(freshnessMinutes)) ? `${freshnessMinutes} min ago` : 'Unavailable';
  const freshnessColor = Number.isFinite(Number(freshnessMinutes))
    ? (freshnessMinutes <= 10 ? '#10b981' : freshnessMinutes <= 30 ? '#f59e0b' : '#ef4444')
    : 'var(--muted)';

  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">Data Reliability</h3>
      </div>
      <div class="card__body">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4);">
          <div>
            <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">Active IAQ Sensors</div>
            <div style="width: 100%; height: 8px; background: var(--surface-2); border-radius: 4px; overflow: hidden; margin-bottom: var(--space-1);">
              <div style="width: 100%; height: 100%; background: #10b981;"></div>
            </div>
            <div style="font-size: 12px; font-weight: 600; color: var(--text);">
              ${Number(computed?.activeSensorCount || 0)}
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">Metric Coverage</div>
            <div style="font-size: 18px; font-weight: 600; color: ${completenessPct >= 80 ? '#10b981' : completenessPct >= 50 ? '#f59e0b' : '#ef4444'}; margin-bottom: var(--space-1);">
              ${completenessPct}%
            </div>
            <div style="font-size: 10px; color: var(--muted);">
              ${validCount}/${metrics.length} metrics have valid current values
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--muted); margin-bottom: var(--space-2);">Data Freshness</div>
            <div style="font-size: 18px; font-weight: 600; color: ${freshnessColor}; margin-bottom: var(--space-1);">
              ${freshnessText}
            </div>
            <div style="font-size: 10px; color: var(--muted);">
              Latest aggregated IAQ sample
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
function renderDataSourcePanel(summary) {
  const container = document.getElementById('data-source-panel');
  if (!container) return;
  const status = summary?.statusLabel || 'Moderate';
  const explanation = summary?.explanation || 'IAQ summary is unavailable';
  const activeSensors = Number(summary?.activeSensorCount || 0);
  const latestTimestamp = summary?.latestTimestamp ? formatTime(summary.latestTimestamp, true) : 'Unavailable';
  const freshnessText = Number.isFinite(Number(summary?.freshnessMinutes)) ? `${summary.freshnessMinutes} min ago` : 'Unavailable';

  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">Overall IAQ Summary</h3>
      </div>
      <div class="card__body">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); font-size: 11px;">
          <div>
            <div style="color: var(--muted); margin-bottom: var(--space-1);">Status</div>
            <div style="color: var(--text); font-weight: 600; font-size: 14px;">${status}</div>
          </div>
          <div>
            <div style="color: var(--muted); margin-bottom: var(--space-1);">Active sensors</div>
            <div style="color: var(--text); font-weight: 500;">${activeSensors}</div>
          </div>
          <div style="grid-column: 1 / -1;">
            <div style="color: var(--muted); margin-bottom: var(--space-1);">Driver</div>
            <div style="color: var(--text); font-weight: 500;">${explanation}</div>
          </div>
          <div>
            <div style="color: var(--muted); margin-bottom: var(--space-1);">Latest timestamp</div>
            <div style="color: var(--text); font-weight: 500;">${latestTimestamp}</div>
          </div>
          <div>
            <div style="color: var(--muted); margin-bottom: var(--space-1);">Freshness</div>
            <div style="color: var(--text); font-weight: 500;">${freshnessText}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
