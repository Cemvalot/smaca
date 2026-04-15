function createCO2BandChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || !data || !data.length) return;
  
  const width = container.offsetWidth || 800;
  const height = options.height || 350;
  const padding = { top: 40, right: 60, bottom: 50, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Thresholds (ppm)
  const thresholds = {
    safe: 400,
    warning: 800,
    critical: 1000
  };
  
  container.innerHTML = '';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  
  // Find value range
  const allValues = data.map(d => d.value);
  const minValue = Math.min(...allValues, 0);
  const maxValue = Math.max(...allValues, thresholds.critical * 1.1);
  const valueRange = maxValue - minValue;
  
  // Scale functions
  const xScale = (index) => (index / (data.length - 1)) * chartWidth;
  const yScale = (value) => chartHeight - ((value - minValue) / valueRange) * chartHeight;
  
  // Draw threshold bands
  const bands = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  bands.setAttribute('class', 'threshold-bands');
  
  // Critical band (red)
  const criticalBand = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  criticalBand.setAttribute('x', '0');
  criticalBand.setAttribute('y', yScale(thresholds.critical));
  criticalBand.setAttribute('width', chartWidth);
  criticalBand.setAttribute('height', chartHeight - yScale(thresholds.critical));
  criticalBand.setAttribute('fill', 'rgba(239, 68, 68, 0.15)');
  bands.appendChild(criticalBand);
  
  // Warning band (amber)
  const warningBand = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  warningBand.setAttribute('x', '0');
  warningBand.setAttribute('y', yScale(thresholds.warning));
  warningBand.setAttribute('width', chartWidth);
  warningBand.setAttribute('height', yScale(thresholds.critical) - yScale(thresholds.warning));
  warningBand.setAttribute('fill', 'rgba(245, 158, 11, 0.15)');
  bands.appendChild(warningBand);
  
  // Safe band (green)
  const safeBand = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  safeBand.setAttribute('x', '0');
  safeBand.setAttribute('y', yScale(thresholds.safe));
  safeBand.setAttribute('width', chartWidth);
  safeBand.setAttribute('height', yScale(thresholds.warning) - yScale(thresholds.safe));
  safeBand.setAttribute('fill', 'rgba(16, 185, 129, 0.1)');
  bands.appendChild(safeBand);
  
  chartGroup.appendChild(bands);
  
  // Draw threshold lines
  const thresholdLines = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  thresholdLines.setAttribute('class', 'threshold-lines');
  
  [thresholds.safe, thresholds.warning, thresholds.critical].forEach((threshold, idx) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', yScale(threshold));
    line.setAttribute('x2', chartWidth);
    line.setAttribute('y2', yScale(threshold));
    line.setAttribute('stroke', idx === 0 ? '#10b981' : idx === 1 ? '#f59e0b' : '#ef4444');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '4 4');
    line.setAttribute('opacity', '0.6');
    thresholdLines.appendChild(line);
    
    // Label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', chartWidth + 8);
    label.setAttribute('y', yScale(threshold));
    label.setAttribute('fill', idx === 0 ? '#10b981' : idx === 1 ? '#f59e0b' : '#ef4444');
    label.setAttribute('font-size', '11');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = `${threshold} ppm`;
    thresholdLines.appendChild(label);
  });
  
  chartGroup.appendChild(thresholdLines);
  
  // Draw data line
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const points = data.map((d, i) => {
    const x = xScale(i);
    const y = yScale(d.value);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  
  path.setAttribute('d', points);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#3b82f6');
  path.setAttribute('stroke-width', '2.5');
  chartGroup.appendChild(path);
  
  // Draw data points
  data.forEach((d, i) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', xScale(i));
    circle.setAttribute('cy', yScale(d.value));
    circle.setAttribute('r', '3.5');
    circle.setAttribute('fill', '#3b82f6');
    circle.setAttribute('stroke', '#1a1f2e');
    circle.setAttribute('stroke-width', '1.5');
    chartGroup.appendChild(circle);
  });
  
  // Draw axes
  const axes = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  // X-axis
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', '0');
  xAxis.setAttribute('y1', chartHeight);
  xAxis.setAttribute('x2', chartWidth);
  xAxis.setAttribute('y2', chartHeight);
  xAxis.setAttribute('stroke', 'var(--border)');
  xAxis.setAttribute('stroke-width', '1');
  axes.appendChild(xAxis);
  
  // X-axis labels (time points)
  const xLabels = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const timeLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
  const labelCount = Math.min(timeLabels.length, data.length);
  for (let i = 0; i < labelCount; i++) {
    const index = Math.floor((i / (labelCount - 1)) * (data.length - 1));
    const x = xScale(index);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', chartHeight + 20);
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '10');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = timeLabels[i];
    xLabels.appendChild(label);
    
    // Tick mark
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', x);
    tick.setAttribute('y1', chartHeight);
    tick.setAttribute('x2', x);
    tick.setAttribute('y2', chartHeight + 4);
    tick.setAttribute('stroke', 'var(--border)');
    tick.setAttribute('stroke-width', '1');
    xLabels.appendChild(tick);
  }
  axes.appendChild(xLabels);
  
  // X-axis label
  const xAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  xAxisLabel.setAttribute('x', chartWidth / 2);
  xAxisLabel.setAttribute('y', chartHeight + 40);
  xAxisLabel.setAttribute('fill', 'var(--muted)');
  xAxisLabel.setAttribute('font-size', '11');
  xAxisLabel.setAttribute('text-anchor', 'middle');
  xAxisLabel.textContent = 'Time (24-hour period)';
  axes.appendChild(xAxisLabel);
  
  // Y-axis
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', '0');
  yAxis.setAttribute('y1', '0');
  yAxis.setAttribute('x2', '0');
  yAxis.setAttribute('y2', chartHeight);
  yAxis.setAttribute('stroke', 'var(--border)');
  yAxis.setAttribute('stroke-width', '1');
  axes.appendChild(yAxis);
  
  chartGroup.appendChild(axes);
  
  // Y-axis labels
  const yLabels = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  for (let i = 0; i <= 5; i++) {
    const value = minValue + (valueRange / 5) * i;
    const y = yScale(value);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '-8');
    label.setAttribute('y', y);
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '11');
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = Math.round(value);
    yLabels.appendChild(label);
  }
  chartGroup.appendChild(yLabels);
  
  // Y-axis unit label
  const yAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yAxisLabel.setAttribute('x', '-35');
  yAxisLabel.setAttribute('y', chartHeight / 2);
  yAxisLabel.setAttribute('fill', 'var(--muted)');
  yAxisLabel.setAttribute('font-size', '11');
  yAxisLabel.setAttribute('text-anchor', 'middle');
  yAxisLabel.setAttribute('transform', `rotate(-90 -35 ${chartHeight / 2})`);
  yAxisLabel.textContent = 'CO₂ (ppm)';
  chartGroup.appendChild(yAxisLabel);
  
  // Title
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', chartWidth / 2);
  title.setAttribute('y', '-20');
  title.setAttribute('fill', 'var(--text)');
  title.setAttribute('font-size', '13');
  title.setAttribute('font-weight', '600');
  title.setAttribute('text-anchor', 'middle');
  title.textContent = 'CO₂ Concentration (ppm)';
  chartGroup.appendChild(title);
  
  svg.appendChild(chartGroup);
  container.appendChild(svg);
  
  // Add data explanation below chart
  const explanation = document.createElement('div');
  explanation.style.marginTop = 'var(--space-4)';
  explanation.style.paddingTop = 'var(--space-4)';
  explanation.style.borderTop = '1px solid var(--border)';
  explanation.style.fontSize = '11px';
  explanation.style.color = 'var(--muted)';
  explanation.style.lineHeight = '1.6';
  explanation.innerHTML = `
    <div style="margin-bottom: var(--space-3);">
      <strong style="color: var(--text); font-size: 12px;">Data Explanation:</strong>
    </div>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4); margin-bottom: var(--space-3);">
      <div>
        <div style="margin-bottom: var(--space-2); color: var(--text); font-weight: 500;">Y-axis (Vertical):</div>
        <div style="margin-bottom: var(--space-1);">
          • <strong>Values (0-1100 ppm):</strong> CO₂ concentration measured in parts per million
        </div>
        <div style="margin-bottom: var(--space-1);">
          • <strong>Each number:</strong> Represents the CO₂ level at that point in time
        </div>
        <div style="margin-bottom: var(--space-1);">
          • <strong>Blue line:</strong> Actual measured CO₂ values over time
        </div>
      </div>
      <div>
        <div style="margin-bottom: var(--space-2); color: var(--text); font-weight: 500;">X-axis (Horizontal):</div>
        <div style="margin-bottom: var(--space-1);">
          • <strong>Time labels:</strong> Hours of the day (00:00 to 20:00)
        </div>
        <div style="margin-bottom: var(--space-1);">
          • <strong>Data points:</strong> Measurements taken throughout the day
        </div>
        <div style="margin-bottom: var(--space-1);">
          • <strong>Trend:</strong> Shows how CO₂ levels change over time
        </div>
      </div>
    </div>
    <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border);">
      <div style="margin-bottom: var(--space-2); color: var(--text); font-weight: 500;">Threshold Zones:</div>
      <div style="display: flex; gap: var(--space-4); flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <div style="width: 12px; height: 12px; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981;"></div>
          <span><strong>Green (0-400 ppm):</strong> Safe outdoor/well-ventilated levels</span>
        </div>
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <div style="width: 12px; height: 12px; background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b;"></div>
          <span><strong>Amber (400-800 ppm):</strong> Acceptable indoor levels, monitor trends</span>
        </div>
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <div style="width: 12px; height: 12px; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444;"></div>
          <span><strong>Red (800+ ppm):</strong> Poor air quality - action required</span>
        </div>
      </div>
    </div>
    <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border); font-style: italic; font-size: 10px;">
      Thresholds based on ASHRAE Standard 62.1 and WHO guidelines. Values above 1000 ppm indicate poor ventilation and may cause discomfort or health issues.
    </div>
  `;
  container.appendChild(explanation);
}

/**
 * Thermal Comfort Matrix (Temperature × Humidity)
 * Purpose: Shows if conditions are within ASHRAE comfort zone
 * Decision: HVAC adjustment needed?
 */
function createThermalComfortMatrix(containerId, tempData, humidityData, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || !tempData || !humidityData || tempData.length !== humidityData.length) return;
  
  const width = container.offsetWidth || 600;
  const height = options.height || 500;
  const padding = { top: 40, right: 50, bottom: 60, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  container.innerHTML = '';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  
  // Comfort zone boundaries (ASHRAE 55 simplified)
  const comfortZone = {
    tempMin: 20,
    tempMax: 26,
    humidityMin: 30,
    humidityMax: 60
  };
  
  // Value ranges
  const tempRange = { min: 18, max: 28 };
  const humidityRange = { min: 20, max: 70 };
  
  const tempScale = (temp) => ((temp - tempRange.min) / (tempRange.max - tempRange.min)) * chartWidth;
  const humidityScale = (hum) => chartHeight - ((hum - humidityRange.min) / (humidityRange.max - humidityRange.min)) * chartHeight;
  
  // Draw comfort zone
  const comfortRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  comfortRect.setAttribute('x', tempScale(comfortZone.tempMin));
  comfortRect.setAttribute('y', humidityScale(comfortZone.humidityMax));
  comfortRect.setAttribute('width', tempScale(comfortZone.tempMax) - tempScale(comfortZone.tempMin));
  comfortRect.setAttribute('height', humidityScale(comfortZone.humidityMin) - humidityScale(comfortZone.humidityMax));
  comfortRect.setAttribute('fill', 'rgba(16, 185, 129, 0.2)');
  comfortRect.setAttribute('stroke', '#10b981');
  comfortRect.setAttribute('stroke-width', '1.5');
  comfortRect.setAttribute('stroke-dasharray', '3 3');
  chartGroup.appendChild(comfortRect);
  
  // Draw scatter points
  tempData.forEach((temp, i) => {
    const hum = humidityData[i];
    const x = tempScale(temp);
    const y = humidityScale(hum);
    
    const isComfortable = temp >= comfortZone.tempMin && temp <= comfortZone.tempMax &&
                         hum >= comfortZone.humidityMin && hum <= comfortZone.humidityMax;
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', isComfortable ? '#10b981' : '#f59e0b');
    circle.setAttribute('stroke', '#1a1f2e');
    circle.setAttribute('stroke-width', '1.5');
    chartGroup.appendChild(circle);
  });
  
  // Draw axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', '0');
  xAxis.setAttribute('y1', chartHeight);
  xAxis.setAttribute('x2', chartWidth);
  xAxis.setAttribute('y2', chartHeight);
  xAxis.setAttribute('stroke', 'var(--border)');
  xAxis.setAttribute('stroke-width', '1');
  chartGroup.appendChild(xAxis);
  
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', '0');
  yAxis.setAttribute('y1', '0');
  yAxis.setAttribute('x2', '0');
  yAxis.setAttribute('y2', chartHeight);
  yAxis.setAttribute('stroke', 'var(--border)');
  yAxis.setAttribute('stroke-width', '1');
  chartGroup.appendChild(yAxis);
  
  // Axis labels
  const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  xLabel.setAttribute('x', chartWidth / 2);
  xLabel.setAttribute('y', chartHeight + 40);
  xLabel.setAttribute('fill', 'var(--text)');
  xLabel.setAttribute('font-size', '12');
  xLabel.setAttribute('text-anchor', 'middle');
  xLabel.textContent = 'Temperature (°C)';
  chartGroup.appendChild(xLabel);
  
  const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yLabel.setAttribute('x', '-30');
  yLabel.setAttribute('y', chartHeight / 2);
  yLabel.setAttribute('fill', 'var(--text)');
  yLabel.setAttribute('font-size', '12');
  yLabel.setAttribute('text-anchor', 'middle');
  yLabel.setAttribute('transform', `rotate(-90 -30 ${chartHeight / 2})`);
  yLabel.textContent = 'Relative Humidity (%)';
  chartGroup.appendChild(yLabel);
  
  // Title
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', chartWidth / 2);
  title.setAttribute('y', '-20');
  title.setAttribute('fill', 'var(--text)');
  title.setAttribute('font-size', '13');
  title.setAttribute('font-weight', '600');
  title.setAttribute('text-anchor', 'middle');
  title.textContent = 'Thermal Comfort Zone';
  chartGroup.appendChild(title);
  
  svg.appendChild(chartGroup);
  container.appendChild(svg);
}

/**
 * Micro-trend Indicator
 * Purpose: Shows direction and magnitude of change without big numbers
 * Decision: Is the metric improving or degrading?
 */
function createMicroTrendIndicator(containerId, currentValue, previousValue, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const diff = currentValue - previousValue;
  const percentChange = previousValue !== 0 ? (diff / previousValue) * 100 : 0;
  const absPercentChange = Math.abs(percentChange);
  
  // Determine direction
  let direction = '→';
  let color = 'var(--muted)';
  if (absPercentChange > 0.5) { // Only show if meaningful change
    if (diff > 0) {
      direction = '↑';
      color = options.invert ? '#10b981' : '#ef4444'; // For CO2, up is bad
    } else {
      direction = '↓';
      color = options.invert ? '#ef4444' : '#10b981'; // For CO2, down is good
    }
  }
  
  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: var(--space-2);">
      <span style="color: ${color}; font-size: 14px; font-weight: 600;">${direction}</span>
      <span style="color: var(--muted); font-size: 11px;">
        ${absPercentChange > 0.5 ? Math.abs(diff).toFixed(1) : '—'}
      </span>
    </div>
  `;
}

// ============================================================================
// OCCUPANCY VISUALIZATIONS
// ============================================================================

/**
 * Flow-based Bar Chart (In/Out)
 * Purpose: Shows movement patterns, not just totals
 * Decision: When is space actually being used?
 */
function createFlowBarChart(containerId, inData, outData, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || !inData || !outData || inData.length !== outData.length) return;
  
  const width = container.offsetWidth || 800;
  const height = options.height || 400;
  const padding = { top: 45, right: 45, bottom: 70, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  container.innerHTML = '';
  container.style.position = 'relative';
  const tooltip = document.createElement('div');
  tooltip.style.cssText = 'position:absolute;pointer-events:none;min-width:150px;padding:8px 10px;border-radius:var(--r-md);border:1px solid rgba(148,163,184,.3);background:#111827;color:var(--text);font-size:var(--font-size-xs);opacity:0;transform:translateY(4px);transition:opacity .15s ease, transform .15s ease;z-index:3;';
  container.appendChild(tooltip);
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(height));
  
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  
  const maxValue = Math.max(...inData, ...outData, 1);
  const barWidth = (chartWidth / inData.length) * 0.35;
  const barSpacing = chartWidth / inData.length;
  const centerY = chartHeight / 2;
  const minVisibleBarPx = Number.isFinite(Number(options.minVisibleBarPx)) ? Math.max(0, Number(options.minVisibleBarPx)) : 0;
  
  inData.forEach((inVal, i) => {
    const outVal = outData[i];
    const x = i * barSpacing + (barSpacing - barWidth) / 2;
    
    // In bar (upward)
    const rawInBarHeight = (inVal / maxValue) * (chartHeight / 2);
    const inBarHeight = inVal > 0 ? Math.max(rawInBarHeight, minVisibleBarPx) : 0;
    const inRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    inRect.setAttribute('x', x);
    inRect.setAttribute('y', centerY - inBarHeight);
    inRect.setAttribute('width', barWidth);
    inRect.setAttribute('height', inBarHeight);
    inRect.setAttribute('fill', '#10b981');
    inRect.style.cursor = 'pointer';
    inRect.addEventListener('mouseenter', function () {
      tooltip.innerHTML = `
        <div style="color:var(--muted);margin-bottom:4px;">${inData.length <= 7 ? `Day ${i + 1}` : `${i}h`}</div>
        <div>In: <strong>${Math.round(inVal)}</strong></div>
        <div>Out: <strong>${Math.round(outVal)}</strong></div>
      `;
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
      const tipW = tooltip.offsetWidth || 150;
      tooltip.style.left = `${Math.min(Math.max(8, padding.left + x + barWidth + 8), width - tipW - 8)}px`;
      tooltip.style.top = `${Math.max(8, padding.top + centerY - inBarHeight - 44)}px`;
    });
    inRect.addEventListener('mouseleave', function () {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(4px)';
    });
    chartGroup.appendChild(inRect);
    
    // Out bar (downward)
    const rawOutBarHeight = (outVal / maxValue) * (chartHeight / 2);
    const outBarHeight = outVal > 0 ? Math.max(rawOutBarHeight, minVisibleBarPx) : 0;
    const outRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    outRect.setAttribute('x', x);
    outRect.setAttribute('y', centerY);
    outRect.setAttribute('width', barWidth);
    outRect.setAttribute('height', outBarHeight);
    outRect.setAttribute('fill', '#ef4444');
    outRect.style.cursor = 'pointer';
    outRect.addEventListener('mouseenter', function () {
      tooltip.innerHTML = `
        <div style="color:var(--muted);margin-bottom:4px;">${inData.length <= 7 ? `Day ${i + 1}` : `${i}h`}</div>
        <div>In: <strong>${Math.round(inVal)}</strong></div>
        <div>Out: <strong>${Math.round(outVal)}</strong></div>
      `;
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
      const tipW = tooltip.offsetWidth || 150;
      tooltip.style.left = `${Math.min(Math.max(8, padding.left + x + barWidth + 8), width - tipW - 8)}px`;
      tooltip.style.top = `${Math.max(8, padding.top + centerY + 12)}px`;
    });
    outRect.addEventListener('mouseleave', function () {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(4px)';
    });
    chartGroup.appendChild(outRect);

    // Value labels with overlap protection near max/top
    const isAtMaxIn = inVal >= maxValue;
    const inLabelY = centerY - inBarHeight - 6;
    if (inVal > 0 && !isAtMaxIn && inLabelY > 10) {
      const inValueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      inValueLabel.setAttribute('x', x + (barWidth / 2));
      inValueLabel.setAttribute('y', inLabelY);
      inValueLabel.setAttribute('fill', '#10b981');
      inValueLabel.setAttribute('font-size', '10');
      inValueLabel.setAttribute('text-anchor', 'middle');
      inValueLabel.textContent = String(Math.round(inVal));
      chartGroup.appendChild(inValueLabel);
    }

    const isAtMaxOut = outVal >= maxValue;
    const outLabelY = centerY + outBarHeight + 12;
    if (outVal > 0 && !isAtMaxOut && outLabelY < chartHeight - 6) {
      const outValueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      outValueLabel.setAttribute('x', x + (barWidth / 2));
      outValueLabel.setAttribute('y', outLabelY);
      outValueLabel.setAttribute('fill', '#ef4444');
      outValueLabel.setAttribute('font-size', '10');
      outValueLabel.setAttribute('text-anchor', 'middle');
      outValueLabel.textContent = String(Math.round(outVal));
      chartGroup.appendChild(outValueLabel);
    }
  });
  
  // Center line
  const centerLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  centerLine.setAttribute('x1', '0');
  centerLine.setAttribute('y1', centerY);
  centerLine.setAttribute('x2', chartWidth);
  centerLine.setAttribute('y2', centerY);
  centerLine.setAttribute('stroke', 'var(--border)');
  centerLine.setAttribute('stroke-width', '1');
  centerLine.setAttribute('stroke-dasharray', '2 2');
  chartGroup.insertBefore(centerLine, chartGroup.firstChild);
  
  // Y-axis labels (In / Out) — positioned in the middle of each half
  const inLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  inLabel.setAttribute('x', '-10');
  inLabel.setAttribute('y', centerY - (chartHeight / 4));
  inLabel.setAttribute('fill', '#10b981');
  inLabel.setAttribute('font-size', '11');
  inLabel.setAttribute('text-anchor', 'end');
  inLabel.setAttribute('dominant-baseline', 'middle');
  inLabel.textContent = 'In (people)';
  chartGroup.appendChild(inLabel);
  
  const outLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  outLabel.setAttribute('x', '-10');
  outLabel.setAttribute('y', centerY + (chartHeight / 4));
  outLabel.setAttribute('fill', '#ef4444');
  outLabel.setAttribute('font-size', '11');
  outLabel.setAttribute('text-anchor', 'end');
  outLabel.setAttribute('dominant-baseline', 'middle');
  outLabel.textContent = 'Out (people)';
  chartGroup.appendChild(outLabel);
  
  // X-axis: time labels
  const xStep = inData.length <= 7 ? 1 : Math.ceil(inData.length / 6);
  for (let i = 0; i < inData.length; i += xStep) {
    const x = i * barSpacing + barSpacing / 2;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', chartHeight + 18);
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '10');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = inData.length <= 7 ? `Day ${i + 1}` : `${i}h`;
    chartGroup.appendChild(label);
  }
  
  // X-axis title
  const xAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  xAxisTitle.setAttribute('x', chartWidth / 2);
  xAxisTitle.setAttribute('y', chartHeight + 42);
  xAxisTitle.setAttribute('fill', 'var(--muted)');
  xAxisTitle.setAttribute('font-size', '11');
  xAxisTitle.setAttribute('text-anchor', 'middle');
  xAxisTitle.textContent = inData.length <= 7 ? 'Time (days)' : 'Time (hours)';
  chartGroup.appendChild(xAxisTitle);
  
  svg.appendChild(chartGroup);
  container.appendChild(svg);
  const rectCount = chartGroup.querySelectorAll('rect').length;
  const pathCount = chartGroup.querySelectorAll('path').length;
}

/**
 * Occupancy Density Timeline (Step Chart)
 * Purpose: Shows discrete presence over time (not smooth curves)
 * Decision: When is space actually occupied?
 */
function createOccupancyDensityTimeline(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || !data || !data.length) return;
  
  const width = container.offsetWidth || 800;
  const height = options.height || 300;
  const padding = { top: 45, right: 45, bottom: 70, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  container.innerHTML = '';
  container.style.position = 'relative';
  const tooltip = document.createElement('div');
  tooltip.style.cssText = 'position:absolute;pointer-events:none;min-width:140px;padding:8px 10px;border-radius:var(--r-md);border:1px solid rgba(148,163,184,.3);background:#111827;color:var(--text);font-size:var(--font-size-xs);opacity:0;transform:translateY(4px);transition:opacity .15s ease, transform .15s ease;z-index:3;';
  container.appendChild(tooltip);
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(height));
  
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  
  const maxValue = Math.max(...data, 1);
  const stepWidth = chartWidth / data.length;
  const minVisiblePointPx = Number.isFinite(Number(options.minVisiblePointPx)) ? Math.max(0, Number(options.minVisiblePointPx)) : 0;
  const toY = (value) => {
    const rawHeight = (value / maxValue) * chartHeight;
    const adjustedHeight = value > 0 ? Math.max(rawHeight, minVisiblePointPx) : 0;
    return chartHeight - adjustedHeight;
  };
  
  // Draw area (step chart)
  const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let pathData = `M 0 ${chartHeight}`;
  
  data.forEach((value, i) => {
    const x = i * stepWidth;
    const y = toY(value);
    pathData += ` L ${x} ${y} L ${x + stepWidth} ${y}`;
  });
  pathData += ` L ${chartWidth} ${chartHeight} Z`;
  
  areaPath.setAttribute('d', pathData);
  areaPath.setAttribute('fill', 'rgba(59, 130, 246, 0.2)');
  chartGroup.appendChild(areaPath);
  
  // Draw step line
  const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let lineData = `M 0 ${toY(data[0])}`;
  
  data.forEach((value, i) => {
    const x = i * stepWidth;
    const y = toY(value);
    lineData += ` L ${x} ${y} L ${x + stepWidth} ${y}`;
  });
  
  linePath.setAttribute('d', lineData);
  linePath.setAttribute('fill', 'none');
  linePath.setAttribute('stroke', '#3b82f6');
  linePath.setAttribute('stroke-width', '2');
  chartGroup.appendChild(linePath);

  // Hover zones and value labels with max overlap protection
  data.forEach((value, i) => {
    const x = i * stepWidth;
    const y = toY(value);
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hit.setAttribute('x', x);
    hit.setAttribute('y', 0);
    hit.setAttribute('width', stepWidth);
    hit.setAttribute('height', chartHeight);
    hit.setAttribute('fill', 'transparent');
    hit.style.cursor = 'crosshair';
    hit.addEventListener('mouseenter', function () {
      tooltip.innerHTML = `
        <div style="color:var(--muted);margin-bottom:4px;">${data.length <= 7 ? `Day ${i + 1}` : `${i}h`}</div>
        <div>Activity: <strong>${Math.round(value)}</strong></div>
      `;
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
      const tipW = tooltip.offsetWidth || 140;
      tooltip.style.left = `${Math.min(Math.max(8, padding.left + x + 8), width - tipW - 8)}px`;
      tooltip.style.top = `${Math.max(8, padding.top + y - 40)}px`;
    });
    hit.addEventListener('mouseleave', function () {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(4px)';
    });
    chartGroup.appendChild(hit);

    const isAtMax = value >= maxValue;
    if (value > 0 && !isAtMax && y > 12) {
      const valueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      valueLabel.setAttribute('x', x + stepWidth / 2);
      valueLabel.setAttribute('y', y - 6);
      valueLabel.setAttribute('fill', '#93c5fd');
      valueLabel.setAttribute('font-size', '10');
      valueLabel.setAttribute('text-anchor', 'middle');
      valueLabel.textContent = String(Math.round(value));
      chartGroup.appendChild(valueLabel);
    }
  });
  
  // Draw axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', '0');
  xAxis.setAttribute('y1', chartHeight);
  xAxis.setAttribute('x2', chartWidth);
  xAxis.setAttribute('y2', chartHeight);
  xAxis.setAttribute('stroke', 'var(--border)');
  xAxis.setAttribute('stroke-width', '1');
  chartGroup.appendChild(xAxis);
  
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', '0');
  yAxis.setAttribute('y1', '0');
  yAxis.setAttribute('x2', '0');
  yAxis.setAttribute('y2', chartHeight);
  yAxis.setAttribute('stroke', 'var(--border)');
  yAxis.setAttribute('stroke-width', '1');
  chartGroup.appendChild(yAxis);
  
  // Y-axis: scale numbers (0 to maxValue)
  const yTicks = Math.min(maxValue, 5);
  for (let i = 0; i <= yTicks; i++) {
    const val = Math.round((maxValue / yTicks) * i);
    const y = chartHeight - (val / maxValue) * chartHeight;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '-8');
    label.setAttribute('y', y);
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '10');
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = String(val);
    chartGroup.appendChild(label);
  }
  
  // Y-axis title (left of chart)
  const yAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yAxisTitle.setAttribute('x', -8);
  yAxisTitle.setAttribute('y', -18);
  yAxisTitle.setAttribute('fill', 'var(--muted)');
  yAxisTitle.setAttribute('font-size', '11');
  yAxisTitle.setAttribute('text-anchor', 'end');
  yAxisTitle.textContent = 'People';
  chartGroup.appendChild(yAxisTitle);
  
  // X-axis: time labels
  const xStep = data.length <= 7 ? 1 : Math.ceil(data.length / 6);
  for (let i = 0; i < data.length; i += xStep) {
    const x = i * stepWidth + stepWidth / 2;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', chartHeight + 18);
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '10');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = data.length <= 7 ? `Day ${i + 1}` : `${i}h`;
    chartGroup.appendChild(label);
  }
  
  // X-axis title
  const xAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  xAxisTitle.setAttribute('x', chartWidth / 2);
  xAxisTitle.setAttribute('y', chartHeight + 42);
  xAxisTitle.setAttribute('fill', 'var(--muted)');
  xAxisTitle.setAttribute('font-size', '11');
  xAxisTitle.setAttribute('text-anchor', 'middle');
  xAxisTitle.textContent = data.length <= 7 ? 'Time (days)' : 'Time (hours)';
  chartGroup.appendChild(xAxisTitle);
  
  svg.appendChild(chartGroup);
  container.appendChild(svg);
  const rectCount = chartGroup.querySelectorAll('rect').length;
  const pathCount = chartGroup.querySelectorAll('path').length;
}

// ============================================================================
// ENERGY VISUALIZATIONS
// ============================================================================

/**
 * Dual-axis Correlation Chart (Occupancy vs Energy)
 * Purpose: Shows if energy use is proportional to occupancy
 * Decision: Are we wasting energy during low occupancy?
 */
function createDualAxisChart(containerId, occupancyData, energyData, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || !occupancyData || !energyData || occupancyData.length !== energyData.length) return;
  
  const width = container.offsetWidth || 800;
  const height = options.height || 400;
  const padding = { top: 40, right: 70, bottom: 60, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  container.innerHTML = '';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  
  const maxOccupancy = Math.max(...occupancyData);
  const maxEnergy = Math.max(...energyData);
  
  const xScale = (index) => (index / (occupancyData.length - 1)) * chartWidth;
  const occupancyScale = (value) => chartHeight - (value / maxOccupancy) * chartHeight;
  const energyScale = (value) => chartHeight - (value / maxEnergy) * chartHeight;
  
  // Highlight idle energy periods (low occupancy but energy > threshold)
  const energyThreshold = maxEnergy * 0.3;
  occupancyData.forEach((occ, i) => {
    if (occ < maxOccupancy * 0.2 && energyData[i] > energyThreshold) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', xScale(i) - (chartWidth / occupancyData.length) / 2);
      rect.setAttribute('y', '0');
      rect.setAttribute('width', chartWidth / occupancyData.length);
      rect.setAttribute('height', chartHeight);
      rect.setAttribute('fill', 'rgba(239, 68, 68, 0.1)');
      chartGroup.appendChild(rect);
    }
  });
  
  // Draw occupancy line
  const occupancyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const occPoints = occupancyData.map((val, i) => {
    const x = xScale(i);
    const y = occupancyScale(val);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  occupancyPath.setAttribute('d', occPoints);
  occupancyPath.setAttribute('fill', 'none');
  occupancyPath.setAttribute('stroke', '#3b82f6');
  occupancyPath.setAttribute('stroke-width', '2');
  chartGroup.appendChild(occupancyPath);
  
  // Draw energy line
  const energyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const energyPoints = energyData.map((val, i) => {
    const x = xScale(i);
    const y = energyScale(val);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  energyPath.setAttribute('d', energyPoints);
  energyPath.setAttribute('fill', 'none');
  energyPath.setAttribute('stroke', '#f59e0b');
  energyPath.setAttribute('stroke-width', '2');
  chartGroup.appendChild(energyPath);
  
  // Y-axis labels (left - occupancy)
  for (let i = 0; i <= 4; i++) {
    const value = (maxOccupancy / 4) * i;
    const y = occupancyScale(value);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '-8');
    label.setAttribute('y', y);
    label.setAttribute('fill', '#3b82f6');
    label.setAttribute('font-size', '11');
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = Math.round(value);
    chartGroup.appendChild(label);
  }
  
  // Y-axis labels (right - energy)
  for (let i = 0; i <= 4; i++) {
    const value = (maxEnergy / 4) * i;
    const y = energyScale(value);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', chartWidth + 8);
    label.setAttribute('y', y);
    label.setAttribute('fill', '#f59e0b');
    label.setAttribute('font-size', '11');
    label.setAttribute('text-anchor', 'start');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = Math.round(value);
    chartGroup.appendChild(label);
  }
  
  // Draw axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', '0');
  xAxis.setAttribute('y1', chartHeight);
  xAxis.setAttribute('x2', chartWidth);
  xAxis.setAttribute('y2', chartHeight);
  xAxis.setAttribute('stroke', 'var(--border)');
  xAxis.setAttribute('stroke-width', '1');
  chartGroup.appendChild(xAxis);
  
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', '0');
  yAxis.setAttribute('y1', '0');
  yAxis.setAttribute('x2', '0');
  yAxis.setAttribute('y2', chartHeight);
  yAxis.setAttribute('stroke', 'var(--border)');
  yAxis.setAttribute('stroke-width', '1');
  chartGroup.appendChild(yAxis);
  
  // Legend
  const legend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  legend.setAttribute('transform', `translate(${chartWidth - 120}, 20)`);
  
  const occLegend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const occLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  occLine.setAttribute('x1', '0');
  occLine.setAttribute('y1', '0');
  occLine.setAttribute('x2', '20');
  occLine.setAttribute('y2', '0');
  occLine.setAttribute('stroke', '#3b82f6');
  occLine.setAttribute('stroke-width', '2');
  occLegend.appendChild(occLine);
  const occText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  occText.setAttribute('x', '25');
  occText.setAttribute('y', '4');
  occText.setAttribute('fill', '#3b82f6');
  occText.setAttribute('font-size', '11');
  occText.textContent = 'Occupancy';
  occLegend.appendChild(occText);
  legend.appendChild(occLegend);
  
  const energyLegend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  energyLegend.setAttribute('transform', 'translate(0, 20)');
  const energyLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  energyLine.setAttribute('x1', '0');
  energyLine.setAttribute('y1', '0');
  energyLine.setAttribute('x2', '20');
  energyLine.setAttribute('y2', '0');
  energyLine.setAttribute('stroke', '#f59e0b');
  energyLine.setAttribute('stroke-width', '2');
  energyLegend.appendChild(energyLine);
  const energyText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  energyText.setAttribute('x', '25');
  energyText.setAttribute('y', '4');
  energyText.setAttribute('fill', '#f59e0b');
  energyText.setAttribute('font-size', '11');
  energyText.textContent = 'Energy';
  energyLegend.appendChild(energyText);
  legend.appendChild(energyLegend);
  
  chartGroup.appendChild(legend);
  
  svg.appendChild(chartGroup);
  container.appendChild(svg);
}

// ============================================================================
// CONNECTIVITY VISUALIZATIONS
// ============================================================================

/**
 * Visual Sensor Health Table
 * Purpose: Shows battery decay, signal strength, and data freshness at a glance
 * Decision: Which sensors need attention?
 */
function createSensorHealthTable(containerId, sensors, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || !sensors || !sensors.length) return;
  
  container.innerHTML = '';
  
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.fontSize = 'var(--font-size-sm)';
  
  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Sensor ID', 'Location', 'Battery', 'Signal', 'Last Seen', 'Status'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    th.style.padding = 'var(--space-3)';
    th.style.textAlign = 'left';
    th.style.borderBottom = '1px solid var(--border)';
    th.style.color = 'var(--muted)';
    th.style.fontWeight = '500';
    th.style.fontSize = '11px';
    th.style.textTransform = 'uppercase';
    th.style.letterSpacing = '0.5px';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Body
  const tbody = document.createElement('tbody');
  sensors.forEach(sensor => {
    const isOnline = sensor.status === 'online' || sensor.status === 'active';
    const formatLastSeen = function (isoDate) {
      if (!isoDate) return 'No data for this sensor';
      const ts = new Date(isoDate).getTime();
      if (!Number.isFinite(ts)) return 'No data for this sensor';
      const deltaMs = Date.now() - ts;
      const mins = Math.floor(deltaMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins} min ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return new Date(isoDate).toLocaleString();
    };
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid var(--border)';
    row.style.cursor = 'pointer';
    row.title = 'Select sensor';
    row.addEventListener('click', function () {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('smaca:sensor-selected', {
          detail: { sensorId: sensor.id }
        }));
      }
    });
    
    // Sensor ID
    const idCell = document.createElement('td');
    idCell.textContent = sensor.id;
    idCell.style.padding = 'var(--space-4)';
    idCell.style.fontWeight = '600';
    row.appendChild(idCell);
    
    // Location
    const locCell = document.createElement('td');
    locCell.textContent = sensor.location;
    locCell.style.padding = 'var(--space-4)';
    locCell.style.color = 'var(--muted)';
    row.appendChild(locCell);
    
    // Battery (visual bar)
    const batteryCell = document.createElement('td');
    batteryCell.style.padding = 'var(--space-4)';
    const batteryBar = document.createElement('div');
    batteryBar.style.width = '80px';
    batteryBar.style.height = '8px';
    batteryBar.style.backgroundColor = 'var(--surface-2)';
    batteryBar.style.borderRadius = '4px';
    batteryBar.style.overflow = 'hidden';
    batteryBar.style.position = 'relative';
    
    const batteryFill = document.createElement('div');
    batteryFill.style.width = `${sensor.battery || 0}%`;
    batteryFill.style.height = '100%';
    batteryFill.style.backgroundColor = sensor.battery > 50 ? '#10b981' : sensor.battery > 20 ? '#f59e0b' : '#ef4444';
    batteryBar.appendChild(batteryFill);
    
    const batteryText = document.createElement('span');
    batteryText.textContent = sensor.battery !== null && sensor.battery !== undefined ? `${sensor.battery}%` : 'Not reported by sensor';
    batteryText.style.marginLeft = 'var(--space-2)';
    batteryText.style.fontSize = '11px';
    batteryText.style.color = 'var(--muted)';
    
    batteryCell.appendChild(batteryBar);
    batteryCell.appendChild(batteryText);
    row.appendChild(batteryCell);
    
    // Signal (dB bands)
    const signalCell = document.createElement('td');
    signalCell.style.padding = 'var(--space-4)';
    if (sensor.rssi !== null && sensor.rssi !== undefined && typeof sensor.rssi === 'number') {
      const signalBar = document.createElement('div');
      signalBar.style.display = 'flex';
      signalBar.style.gap = '2px';
      signalBar.style.width = '60px';
      
      const bars = 5;
      const signalStrength = Math.min(100, Math.max(0, ((sensor.rssi + 100) / 60) * 100));
      const activeBars = Math.round((signalStrength / 100) * bars);
      
      for (let i = 0; i < bars; i++) {
        const bar = document.createElement('div');
        bar.style.width = '4px';
        bar.style.height = `${(i + 1) * 3 + 2}px`;
        bar.style.backgroundColor = i < activeBars ? '#10b981' : 'var(--surface-2)';
        signalBar.appendChild(bar);
      }
      
      const signalText = document.createElement('span');
      signalText.textContent = `${sensor.rssi} dBm`;
      signalText.style.marginLeft = 'var(--space-2)';
      signalText.style.fontSize = '11px';
      signalText.style.color = 'var(--muted)';
      
      signalCell.appendChild(signalBar);
      signalCell.appendChild(signalText);
    } else {
      signalCell.textContent = typeof sensor.rssi === 'string' ? sensor.rssi : 'Not reported by sensor';
      signalCell.style.color = 'var(--muted)';
    }
    row.appendChild(signalCell);
    
    // Last Seen
    const lastSeenCell = document.createElement('td');
    lastSeenCell.style.padding = 'var(--space-4)';
    const lastSeen = formatLastSeen(sensor.lastSeenAt);
    lastSeenCell.textContent = lastSeen;
    lastSeenCell.style.color = 'var(--text)';
    row.appendChild(lastSeenCell);
    
    // Status (with confidence)
    const statusCell = document.createElement('td');
    statusCell.style.padding = 'var(--space-4)';
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge badge--${isOnline ? 'success' : 'danger'} badge--sm`;
    statusBadge.textContent = isOnline ? 'Online' : 'Offline';
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);
    
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  
  container.appendChild(table);
}
