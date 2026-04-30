
function smacaUiT(key, fallback) {
  const map = (typeof window !== 'undefined' && window.SMACA_TRANSLATIONS) ? window.SMACA_TRANSLATIONS : null;
  if (map && Object.prototype.hasOwnProperty.call(map, key) && map[key] !== undefined && map[key] !== null && map[key] !== '') return map[key];
  return fallback;
}
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

/**
 * CO₂ Time Series with Threshold Bands
 * X: time (HH:MM or date+time)
 * Y: CO₂ (ppm) with proper ticks
 */
function createAccurateCO2Chart(containerId, normalizedData, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || !normalizedData || normalizedData.length === 0) return;
  
  const width = container.offsetWidth || 800;
  const height = options.height || 400;
  const padding = { top: 50, right: 80, bottom: 70, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  container.innerHTML = '';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  
  // Extract CO₂ values (filter nulls)
  const co2Data = normalizedData
    .map((d, i) => ({ value: d.co2, time: d.time, index: i }))
    .filter(d => d.value !== null && d.value !== undefined);
  
  if (co2Data.length === 0) {
    container.innerHTML = '<div style="padding: var(--space-4); color: var(--muted); text-align: center;">No CO₂ data available</div>';
    return;
  }
  
  // Value range
  const values = co2Data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;
  
  // Extend range for thresholds
  const thresholdMax = Math.max(maxValue, 1200);
  const thresholdMin = Math.min(minValue, 0);
  const extendedRange = thresholdMax - thresholdMin;
  
  // Thresholds
  const thresholds = {
    good: { min: 400, max: 800, color: '#10b981', label: smacaUiT('good','Good') },
    warning: { min: 800, max: 1000, color: '#f59e0b', label: 'Warning' },
    action: { min: 1000, max: thresholdMax, color: '#ef4444', label: 'Action' }
  };
  
  // Scales
  const xScale = (index) => (index / (co2Data.length - 1)) * chartWidth;
  const yScale = (value) => chartHeight - ((value - thresholdMin) / extendedRange) * chartHeight;
  
  // Calculate Y-axis ticks for gridlines and labels
  const yTicks = [];
  const tickStep = extendedRange <= 400 ? 100 : extendedRange <= 800 ? 200 : 400;
  for (let v = Math.ceil(thresholdMin / tickStep) * tickStep; v <= thresholdMax; v += tickStep) {
    yTicks.push(v);
  }
  
  // Draw gridlines first (behind everything)
  const gridlines = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gridlines.setAttribute('class', 'chart-gridlines');
  yTicks.forEach(value => {
    const y = yScale(value);
    const gridline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    gridline.setAttribute('x1', '0');
    gridline.setAttribute('y1', y);
    gridline.setAttribute('x2', chartWidth);
    gridline.setAttribute('y2', y);
    gridline.setAttribute('stroke', 'var(--border)');
    gridline.setAttribute('stroke-width', '0.5');
    gridline.setAttribute('stroke-dasharray', '2,2');
    gridline.setAttribute('opacity', '0.3');
    gridlines.appendChild(gridline);
  });
  chartGroup.appendChild(gridlines);
  
  // Draw threshold bands
  const bands = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  bands.setAttribute('class', 'threshold-bands');
  
  // Action band (red)
  if (thresholdMax > 1000) {
    const actionBand = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    actionBand.setAttribute('x', '0');
    actionBand.setAttribute('y', yScale(thresholds.action.max));
    actionBand.setAttribute('width', chartWidth);
    actionBand.setAttribute('height', chartHeight - yScale(thresholds.action.max));
    actionBand.setAttribute('fill', 'rgba(239, 68, 68, 0.15)');
    bands.appendChild(actionBand);
  }
  
  // Warning band (amber)
  const warningBand = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  warningBand.setAttribute('x', '0');
  warningBand.setAttribute('y', yScale(thresholds.warning.max));
  warningBand.setAttribute('width', chartWidth);
  warningBand.setAttribute('height', yScale(thresholds.warning.min) - yScale(thresholds.warning.max));
  warningBand.setAttribute('fill', 'rgba(245, 158, 11, 0.15)');
  bands.appendChild(warningBand);
  
  // Good band (green)
  const goodBand = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  goodBand.setAttribute('x', '0');
  goodBand.setAttribute('y', yScale(thresholds.good.max));
  goodBand.setAttribute('width', chartWidth);
  goodBand.setAttribute('height', yScale(thresholds.good.min) - yScale(thresholds.good.max));
  goodBand.setAttribute('fill', 'rgba(16, 185, 129, 0.1)');
  bands.appendChild(goodBand);
  
  chartGroup.appendChild(bands);
  
  // Draw threshold lines with labels
  const thresholdLines = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  [400, 800, 1000].forEach((threshold, idx) => {
    if (threshold <= thresholdMax) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', yScale(threshold));
      line.setAttribute('x2', chartWidth);
      line.setAttribute('y2', yScale(threshold));
      line.setAttribute('stroke', idx === 0 ? '#10b981' : idx === 1 ? '#f59e0b' : '#ef4444');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-dasharray', '4 4');
      line.setAttribute('opacity', '0.7');
      thresholdLines.appendChild(line);
      
      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', chartWidth + 10);
      label.setAttribute('y', yScale(threshold));
      label.setAttribute('fill', idx === 0 ? '#10b981' : idx === 1 ? '#f59e0b' : '#ef4444');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-weight', '500');
      label.setAttribute('dominant-baseline', 'middle');
      label.textContent = `${threshold} ppm`;
      thresholdLines.appendChild(label);
    }
  });
  chartGroup.appendChild(thresholdLines);
  
  // Draw data line
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const pathData = co2Data.map((d, i) => {
    const x = xScale(i);
    const y = yScale(d.value);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#3b82f6');
  path.setAttribute('stroke-width', '2.5');
  chartGroup.appendChild(path);
  
  // Draw data points with tooltip areas
  const pointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  co2Data.forEach((d, i) => {
    const x = xScale(i);
    const y = yScale(d.value);
    
    // Invisible hit area for tooltip
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hitArea.setAttribute('cx', x);
    hitArea.setAttribute('cy', y);
    hitArea.setAttribute('r', '8');
    hitArea.setAttribute('fill', 'transparent');
    hitArea.setAttribute('cursor', 'pointer');
    hitArea.setAttribute('data-time', d.time);
    hitArea.setAttribute('data-value', d.value);
    hitArea.addEventListener('mouseenter', function(e) {
      showTooltip(e, formatTime(d.time, co2Data.length > 24), d.value, 'ppm');
    });
    pointsGroup.appendChild(hitArea);
    
    // Visible point
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '3.5');
    circle.setAttribute('fill', '#3b82f6');
    circle.setAttribute('stroke', '#1a1f2e');
    circle.setAttribute('stroke-width', '1.5');
    pointsGroup.appendChild(circle);
  });
  chartGroup.appendChild(pointsGroup);
  
  // Draw axes
  const axes = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  // X-axis
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', '0');
  xAxis.setAttribute('y1', chartHeight);
  xAxis.setAttribute('x2', chartWidth);
  xAxis.setAttribute('y2', chartHeight);
  xAxis.setAttribute('stroke', 'var(--border)');
  xAxis.setAttribute('stroke-width', '1.5');
  axes.appendChild(xAxis);
  
  // Y-axis
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', '0');
  yAxis.setAttribute('y1', '0');
  yAxis.setAttribute('x2', '0');
  yAxis.setAttribute('y2', chartHeight);
  yAxis.setAttribute('stroke', 'var(--border)');
  yAxis.setAttribute('stroke-width', '1.5');
  axes.appendChild(yAxis);
  
  chartGroup.appendChild(axes);
  
  // X-axis labels (time)
  const xLabels = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const xTickCount = Math.min(co2Data.length, 6);
  for (let i = 0; i < xTickCount; i++) {
    const index = Math.floor((i / (xTickCount - 1)) * (co2Data.length - 1));
    const x = xScale(index);
    const timeStr = formatTime(co2Data[index].time, co2Data.length > 24);
    
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', x);
    tick.setAttribute('y1', chartHeight);
    tick.setAttribute('x2', x);
    tick.setAttribute('y2', chartHeight + 5);
    tick.setAttribute('stroke', 'var(--border)');
    tick.setAttribute('stroke-width', '1');
    xLabels.appendChild(tick);
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', chartHeight + 20);
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '10');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = timeStr;
    xLabels.appendChild(label);
  }
  chartGroup.appendChild(xLabels);
  
  // X-axis title
  const xAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  xAxisTitle.setAttribute('x', chartWidth / 2);
  xAxisTitle.setAttribute('y', chartHeight + 45);
  xAxisTitle.setAttribute('fill', 'var(--text)');
  xAxisTitle.setAttribute('font-size', '11');
  xAxisTitle.setAttribute('font-weight', '500');
  xAxisTitle.setAttribute('text-anchor', 'middle');
  xAxisTitle.textContent = co2Data.length > 24 ? 'Time (Date + Hour)' : 'Time (Hour:Minute)';
  chartGroup.appendChild(xAxisTitle);
  
  // Y-axis labels (CO₂ values) - use same ticks as gridlines
  const yLabels = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  yTicks.forEach(value => {
    const y = yScale(value);
    
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', '0');
    tick.setAttribute('y1', y);
    tick.setAttribute('x2', '-5');
    tick.setAttribute('y2', y);
    tick.setAttribute('stroke', 'var(--border)');
    tick.setAttribute('stroke-width', '1');
    yLabels.appendChild(tick);
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '-10');
    label.setAttribute('y', y);
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '11');
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = Math.round(value);
    yLabels.appendChild(label);
  });
  chartGroup.appendChild(yLabels);
  
  // Y-axis title
  const yAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yAxisTitle.setAttribute('x', '-45');
  yAxisTitle.setAttribute('y', chartHeight / 2);
  yAxisTitle.setAttribute('fill', 'var(--text)');
  yAxisTitle.setAttribute('font-size', '11');
  yAxisTitle.setAttribute('font-weight', '500');
  yAxisTitle.setAttribute('text-anchor', 'middle');
  yAxisTitle.setAttribute('transform', `rotate(-90 -45 ${chartHeight / 2})`);
  yAxisTitle.textContent = 'CO₂ (ppm)';
  chartGroup.appendChild(yAxisTitle);
  
  // Chart title
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', chartWidth / 2);
  title.setAttribute('y', '-25');
  title.setAttribute('fill', 'var(--text)');
  title.setAttribute('font-size', '14');
  title.setAttribute('font-weight', '600');
  title.setAttribute('text-anchor', 'middle');
  title.textContent = 'CO₂ Concentration Over Time';
  chartGroup.appendChild(title);
  
  svg.appendChild(chartGroup);
  container.appendChild(svg);
  
  // Add tooltip element
  const tooltip = document.createElement('div');
  tooltip.id = 'chart-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: var(--space-2) var(--space-3);
    font-size: 11px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 1000;
    box-shadow: var(--shadow-lg);
  `;
  document.body.appendChild(tooltip);
}

/**
 * Thermal Comfort Scatter Plot (Temperature vs Humidity)
 * X: Temperature (°C) with ticks
 * Y: Relative Humidity (%) with ticks
 * Comfort zone: Temp 20-24°C, RH 30-60%
 */
function createAccurateThermalComfortChart(containerId, normalizedData, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || !normalizedData || normalizedData.length === 0) return;
  
  const width = container.offsetWidth || 600;
  const height = options.height || 500;
  const padding = { top: 50, right: 60, bottom: 70, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  container.innerHTML = '';
  
  // Filter valid temp/humidity pairs
  const validData = normalizedData.filter(d => 
    d.temperature !== null && d.temperature !== undefined &&
    d.humidity !== null && d.humidity !== undefined
  );
  
  if (validData.length === 0) {
    container.innerHTML = '<div style="padding: var(--space-4); color: var(--muted); text-align: center;">No temperature/humidity data available</div>';
    return;
  }
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  
  // Value ranges
  const temps = validData.map(d => d.temperature);
  const hums = validData.map(d => d.humidity);
  const tempMin = Math.min(...temps);
  const tempMax = Math.max(...temps);
  const humMin = Math.min(...hums);
  const humMax = Math.max(...hums);
  
  // Extend ranges for better visualization
  const tempRange = { min: Math.max(16, Math.floor(tempMin) - 2), max: Math.min(30, Math.ceil(tempMax) + 2) };
  const humRange = { min: Math.max(20, Math.floor(humMin) - 5), max: Math.min(80, Math.ceil(humMax) + 5) };
  
  // Comfort zone
  const comfortZone = { tempMin: 20, tempMax: 24, humMin: 30, humMax: 60 };
  
  // Scales
  const tempScale = (temp) => ((temp - tempRange.min) / (tempRange.max - tempRange.min)) * chartWidth;
  const humScale = (hum) => chartHeight - ((hum - humRange.min) / (humRange.max - humRange.min)) * chartHeight;
  
  // Draw gridlines
  const gridlines = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  // Horizontal gridlines (humidity)
  const humTicks = [20, 30, 40, 50, 60, 70, 80].filter(t => t >= humRange.min && t <= humRange.max);
  humTicks.forEach(value => {
    const y = humScale(value);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', y);
    line.setAttribute('x2', chartWidth);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'var(--border)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('opacity', '0.3');
    gridlines.appendChild(line);
  });
  
  // Vertical gridlines (temperature)
  const tempTicks = [16, 18, 20, 22, 24, 26, 28, 30].filter(t => t >= tempRange.min && t <= tempRange.max);
  tempTicks.forEach(value => {
    const x = tempScale(value);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', '0');
    line.setAttribute('x2', x);
    line.setAttribute('y2', chartHeight);
    line.setAttribute('stroke', 'var(--border)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('opacity', '0.3');
    gridlines.appendChild(line);
  });
  
  chartGroup.appendChild(gridlines);
  
  // Draw comfort zone
  const comfortRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  comfortRect.setAttribute('x', tempScale(comfortZone.tempMin));
  comfortRect.setAttribute('y', humScale(comfortZone.humMax));
  comfortRect.setAttribute('width', tempScale(comfortZone.tempMax) - tempScale(comfortZone.tempMin));
  comfortRect.setAttribute('height', humScale(comfortZone.humMin) - humScale(comfortZone.humMax));
  comfortRect.setAttribute('fill', 'rgba(16, 185, 129, 0.2)');
  comfortRect.setAttribute('stroke', '#10b981');
  comfortRect.setAttribute('stroke-width', '2');
  comfortRect.setAttribute('stroke-dasharray', '4 4');
  chartGroup.appendChild(comfortRect);
  
  // Comfort zone label
  const comfortLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  comfortLabel.setAttribute('x', tempScale((comfortZone.tempMin + comfortZone.tempMax) / 2));
  comfortLabel.setAttribute('y', humScale((comfortZone.humMin + comfortZone.humMax) / 2));
  comfortLabel.setAttribute('fill', '#10b981');
  comfortLabel.setAttribute('font-size', '10');
  comfortLabel.setAttribute('font-weight', '500');
  comfortLabel.setAttribute('text-anchor', 'middle');
  comfortLabel.setAttribute('dominant-baseline', 'middle');
  comfortLabel.textContent = 'Comfort Zone';
  chartGroup.appendChild(comfortLabel);
  
  // Draw scatter points
  const pointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  validData.forEach((d, i) => {
    const x = tempScale(d.temperature);
    const y = humScale(d.humidity);
    
    const isComfortable = d.temperature >= comfortZone.tempMin && d.temperature <= comfortZone.tempMax &&
                         d.humidity >= comfortZone.humMin && d.humidity <= comfortZone.humMax;
    
    // Hit area
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hitArea.setAttribute('cx', x);
    hitArea.setAttribute('cy', y);
    hitArea.setAttribute('r', '8');
    hitArea.setAttribute('fill', 'transparent');
    hitArea.setAttribute('cursor', 'pointer');
    hitArea.addEventListener('mouseenter', function(e) {
      showTooltip(e, formatTime(d.time, false), `${d.temperature.toFixed(1)}°C`, `${d.humidity.toFixed(1)}%`);
    });
    pointsGroup.appendChild(hitArea);
    
    // Point
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', isComfortable ? '#10b981' : '#f59e0b');
    circle.setAttribute('stroke', '#1a1f2e');
    circle.setAttribute('stroke-width', '1.5');
    pointsGroup.appendChild(circle);
  });
  chartGroup.appendChild(pointsGroup);
  
  // Draw axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', '0');
  xAxis.setAttribute('y1', chartHeight);
  xAxis.setAttribute('x2', chartWidth);
  xAxis.setAttribute('y2', chartHeight);
  xAxis.setAttribute('stroke', 'var(--border)');
  xAxis.setAttribute('stroke-width', '1.5');
  chartGroup.appendChild(xAxis);
  
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', '0');
  yAxis.setAttribute('y1', '0');
  yAxis.setAttribute('x2', '0');
  yAxis.setAttribute('y2', chartHeight);
  yAxis.setAttribute('stroke', 'var(--border)');
  yAxis.setAttribute('stroke-width', '1.5');
  chartGroup.appendChild(yAxis);
  
  // X-axis labels (temperature)
  tempTicks.forEach(value => {
    const x = tempScale(value);
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', x);
    tick.setAttribute('y1', chartHeight);
    tick.setAttribute('x2', x);
    tick.setAttribute('y2', chartHeight + 5);
    tick.setAttribute('stroke', 'var(--border)');
    tick.setAttribute('stroke-width', '1');
    chartGroup.appendChild(tick);
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', chartHeight + 20);
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '11');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = value;
    chartGroup.appendChild(label);
  });
  
  // X-axis title
  const xAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  xAxisTitle.setAttribute('x', chartWidth / 2);
  xAxisTitle.setAttribute('y', chartHeight + 45);
  xAxisTitle.setAttribute('fill', 'var(--text)');
  xAxisTitle.setAttribute('font-size', '11');
  xAxisTitle.setAttribute('font-weight', '500');
  xAxisTitle.setAttribute('text-anchor', 'middle');
  xAxisTitle.textContent = `${smacaUiT('temperature_label', 'Temperature')} (°C)`;
  chartGroup.appendChild(xAxisTitle);
  
  // Y-axis labels (humidity)
  humTicks.forEach(value => {
    const y = humScale(value);
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', '0');
    tick.setAttribute('y1', y);
    tick.setAttribute('x2', '-5');
    tick.setAttribute('y2', y);
    tick.setAttribute('stroke', 'var(--border)');
    tick.setAttribute('stroke-width', '1');
    chartGroup.appendChild(tick);
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '-10');
    label.setAttribute('y', y);
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '11');
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = value;
    chartGroup.appendChild(label);
  });
  
  // Y-axis title
  const yAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yAxisTitle.setAttribute('x', '-40');
  yAxisTitle.setAttribute('y', chartHeight / 2);
  yAxisTitle.setAttribute('fill', 'var(--text)');
  yAxisTitle.setAttribute('font-size', '11');
  yAxisTitle.setAttribute('font-weight', '500');
  yAxisTitle.setAttribute('text-anchor', 'middle');
  yAxisTitle.setAttribute('transform', `rotate(-90 -40 ${chartHeight / 2})`);
  yAxisTitle.textContent = smacaUiT('relative_humidity_percent', 'Relative Humidity (%)');
  chartGroup.appendChild(yAxisTitle);
  
  // Chart title
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', chartWidth / 2);
  title.setAttribute('y', '-25');
  title.setAttribute('fill', 'var(--text)');
  title.setAttribute('font-size', '14');
  title.setAttribute('font-weight', '600');
  title.setAttribute('text-anchor', 'middle');
  title.textContent = smacaUiT('thermal_comfort_zone', 'Thermal Comfort Zone');
  chartGroup.appendChild(title);
  
  svg.appendChild(chartGroup);
  container.appendChild(svg);
}

/**
 * Tooltip helper
 */
function showTooltip(event, time, value1, unit1, value2 = null, unit2 = null) {
  const tooltip = document.getElementById('chart-tooltip');
  if (!tooltip) return;
  
  let content = `<div style="font-weight: 600; margin-bottom: var(--space-1);">${time}</div>`;
  content += `<div>${value1} ${unit1}</div>`;
  if (value2 !== null) {
    content += `<div>${value2} ${unit2}</div>`;
  }
  
  tooltip.innerHTML = content;
  tooltip.style.opacity = '1';
  
  const rect = event.target.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX + 10}px`;
  tooltip.style.top = `${rect.top + window.scrollY - 10}px`;
  
  event.target.addEventListener('mouseleave', function() {
    tooltip.style.opacity = '0';
  }, { once: true });
}
