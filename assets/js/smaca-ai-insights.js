// SMACA AI Insights - Enhanced with Model Performance Cards and Predictions
const ollamaModel = {
  title: 'Ollama',
  model: 'llama3.2',
  status: 'active',
  lastUpdate: 2, // minutes ago
  version: '3.2',
  insightsGenerated: 47,
  avgResponseTime: '1.2s',
  accuracy: 92.8,
  predictionsToday: 156,
  activeConnections: 3
};

function renderModelPerformanceCards() {
  renderOllamaCard('ollama-model-card', ollamaModel);
}

function renderOllamaCard(cardId, modelData) {
  const card = document.getElementById(cardId);
  if (!card) return;
  
  const iconSVG = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
    </svg>
  `;
  
  card.innerHTML = `
    <div class="card__body" style="padding: var(--space-5);">
      <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: var(--space-4);">
        <div style="display: flex; align-items: center; gap: var(--space-4);">
          <div style="width: 64px; height: 64px; border-radius: var(--r-md); background: rgba(139, 92, 246, 0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${iconSVG}
          </div>
          <div>
            <h4 style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--text); margin-bottom: var(--space-1); margin-top: 0;">
              ${modelData.title}
            </h4>
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <div>
                <div style="font-size: var(--font-size-xs); color: var(--muted); margin-bottom: var(--space-1); text-transform: uppercase; letter-spacing: 0.5px;">Model</div>
                <div style="font-size: var(--font-size-lg); color: var(--text); font-weight: var(--font-weight-semibold); font-family: monospace;">${modelData.model}</div>
              </div>
            </div>
          </div>
        </div>
        <span class="badge badge--success badge--sm">${modelData.status}</span>
      </div>
      
      <!-- Insights Grid - Full Width -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-bottom: var(--space-4);">
        <div style="padding: var(--space-4); background: var(--surface-2); border-radius: var(--r-md); text-align: center;">
          <div style="font-size: var(--font-size-xs); color: var(--muted); margin-bottom: var(--space-2); text-transform: uppercase; letter-spacing: 0.5px;">Accuracy</div>
          <div style="font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold); color: #10b981; line-height: 1;">${modelData.accuracy}%</div>
        </div>
        <div style="padding: var(--space-4); background: var(--surface-2); border-radius: var(--r-md); text-align: center;">
          <div style="font-size: var(--font-size-xs); color: var(--muted); margin-bottom: var(--space-2); text-transform: uppercase; letter-spacing: 0.5px;">Avg Response</div>
          <div style="font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold); color: var(--text); line-height: 1;">${modelData.avgResponseTime}</div>
        </div>
        <div style="padding: var(--space-4); background: var(--surface-2); border-radius: var(--r-md); text-align: center;">
          <div style="font-size: var(--font-size-xs); color: var(--muted); margin-bottom: var(--space-2); text-transform: uppercase; letter-spacing: 0.5px;">Insights Today</div>
          <div style="font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold); color: var(--text); line-height: 1;">${modelData.insightsGenerated}</div>
        </div>
        <div style="padding: var(--space-4); background: var(--surface-2); border-radius: var(--r-md); text-align: center;">
          <div style="font-size: var(--font-size-xs); color: var(--muted); margin-bottom: var(--space-2); text-transform: uppercase; letter-spacing: 0.5px;">Predictions</div>
          <div style="font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold); color: var(--text); line-height: 1;">${modelData.predictionsToday}</div>
        </div>
      </div>
      
      <div style="display: flex; align-items: center; justify-content: space-between; padding-top: var(--space-4); border-top: 1px solid var(--border);">
        <div>
          <div style="font-size: var(--font-size-xs); color: var(--muted); margin-bottom: var(--space-1); text-transform: uppercase; letter-spacing: 0.5px;">Active Connections</div>
          <div style="font-size: var(--font-size-xl); color: var(--text); font-weight: var(--font-weight-semibold);">${modelData.activeConnections}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: var(--font-size-xs); color: var(--muted); margin-bottom: var(--space-1); text-transform: uppercase; letter-spacing: 0.5px;">Last Update</div>
          <div style="font-size: var(--font-size-sm); color: var(--text); font-weight: var(--font-weight-medium);">${modelData.lastUpdate} min ago</div>
        </div>
      </div>
    </div>
  `;
}

// Render CO₂ Prediction Chart
function renderCO2PredictionChart() {
  const container = document.getElementById('co2-prediction-chart');
  if (!container) return;
  
  const width = container.offsetWidth || 800;
  const height = 350;
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  container.innerHTML = '';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  
  // Generate historical data (past 12 hours) and prediction (next 12 hours)
  const now = new Date();
  const historicalData = [];
  const predictedData = [];
  
  // Historical: last 12 hours
  for (let i = 12; i > 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hour = time.getHours();
    // Simulate realistic CO2 levels (400-600 range)
    const baseValue = 450 + Math.sin((hour - 6) / 12 * Math.PI) * 100;
    historicalData.push({
      time: time,
      hour: hour,
      value: baseValue + (Math.random() * 50 - 25)
    });
  }
  
  // Current value (for "Now" marker)
  const currentValue = historicalData[historicalData.length - 1].value;
  
  // Prediction: next 12 hours (trending upward)
  for (let i = 1; i <= 12; i++) {
    const time = new Date(now.getTime() + i * 60 * 60 * 1000);
    const hour = time.getHours();
    // Predict upward trend (+18% over 3 hours)
    const trendFactor = 1 + (i / 12) * 0.18;
    const predictedValue = currentValue * trendFactor + (Math.random() * 30 - 15);
    predictedData.push({
      time: time,
      hour: hour,
      value: Math.min(predictedValue, 800) // Cap at 800
    });
  }
  
  const allData = [...historicalData, ...predictedData];
  const allValues = allData.map(d => d.value);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;
  
  // Scales
  const totalHours = 24;
  const xScale = (index) => (index / (totalHours - 1)) * chartWidth;
  const yScale = (value) => chartHeight - ((value - minValue) / valueRange) * chartHeight;
  
  // Draw gridlines
  for (let i = 0; i <= 4; i++) {
    const y = (chartHeight / 4) * i;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', y);
    line.setAttribute('x2', chartWidth);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'var(--border)');
    line.setAttribute('stroke-width', '0.5');
    line.setAttribute('opacity', '0.3');
    chartGroup.appendChild(line);
  }
  
  // Draw "Now" vertical line
  const nowIndex = historicalData.length - 1;
  const nowX = xScale(nowIndex);
  const nowLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  nowLine.setAttribute('x1', nowX);
  nowLine.setAttribute('y1', '0');
  nowLine.setAttribute('x2', nowX);
  nowLine.setAttribute('y2', chartHeight);
  nowLine.setAttribute('stroke', '#6b7280');
  nowLine.setAttribute('stroke-width', '1.5');
  nowLine.setAttribute('stroke-dasharray', '4 4');
  chartGroup.appendChild(nowLine);
  
  // "Now" label
  const nowLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  nowLabel.setAttribute('x', nowX);
  nowLabel.setAttribute('y', '-10');
  nowLabel.setAttribute('fill', '#6b7280');
  nowLabel.setAttribute('font-size', '11');
  nowLabel.setAttribute('font-weight', '500');
  nowLabel.setAttribute('text-anchor', 'middle');
  nowLabel.textContent = 'Now';
  chartGroup.appendChild(nowLabel);
  
  // Draw historical line (solid blue)
  const historicalPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let historicalPathData = '';
  historicalData.forEach((d, i) => {
    const x = xScale(i);
    const y = yScale(d.value);
    historicalPathData += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });
  historicalPath.setAttribute('d', historicalPathData);
  historicalPath.setAttribute('fill', 'none');
  historicalPath.setAttribute('stroke', '#3b82f6');
  historicalPath.setAttribute('stroke-width', '2.5');
  chartGroup.appendChild(historicalPath);
  
  // Draw predicted line (dashed purple)
  const predictedPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let predictedPathData = '';
  predictedData.forEach((d, i) => {
    const x = xScale(historicalData.length + i);
    const y = yScale(d.value);
    predictedPathData += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });
  predictedPath.setAttribute('d', predictedPathData);
  predictedPath.setAttribute('fill', 'none');
  predictedPath.setAttribute('stroke', '#8b5cf6');
  predictedPath.setAttribute('stroke-width', '2.5');
  predictedPath.setAttribute('stroke-dasharray', '6 4');
  chartGroup.appendChild(predictedPath);
  
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
  
  // X-axis labels (hours)
  for (let i = 0; i < 24; i += 2) {
    const x = xScale(i);
    const hour = String(i).padStart(2, '0') + ':00';
    
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
    label.setAttribute('font-size', '10');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = hour;
    chartGroup.appendChild(label);
  }
  
  // Y-axis labels
  for (let i = 0; i <= 4; i++) {
    const value = minValue + (valueRange / 4) * i;
    const y = yScale(value);
    
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
    label.textContent = Math.round(value);
    chartGroup.appendChild(label);
  }
  
  // Y-axis title
  const yAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yAxisTitle.setAttribute('x', '-35');
  yAxisTitle.setAttribute('y', chartHeight / 2);
  yAxisTitle.setAttribute('fill', 'var(--text)');
  yAxisTitle.setAttribute('font-size', '11');
  yAxisTitle.setAttribute('font-weight', '500');
  yAxisTitle.setAttribute('text-anchor', 'middle');
  yAxisTitle.setAttribute('transform', `rotate(-90 -35 ${chartHeight / 2})`);
  yAxisTitle.textContent = 'CO₂ (ppm)';
  chartGroup.appendChild(yAxisTitle);
  
  // Legend
  const legend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  legend.setAttribute('transform', `translate(${chartWidth - 150}, 20)`);
  
  // Historical legend
  const histLegendLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  histLegendLine.setAttribute('x1', '0');
  histLegendLine.setAttribute('y1', '0');
  histLegendLine.setAttribute('x2', '20');
  histLegendLine.setAttribute('y2', '0');
  histLegendLine.setAttribute('stroke', '#3b82f6');
  histLegendLine.setAttribute('stroke-width', '2');
  legend.appendChild(histLegendLine);
  
  const histLegendText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  histLegendText.setAttribute('x', '25');
  histLegendText.setAttribute('y', '4');
  histLegendText.setAttribute('fill', '#3b82f6');
  histLegendText.setAttribute('font-size', '11');
  histLegendText.textContent = 'Historical';
  legend.appendChild(histLegendText);
  
  // Predicted legend
  const predLegendLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  predLegendLine.setAttribute('x1', '0');
  predLegendLine.setAttribute('y1', '20');
  predLegendLine.setAttribute('x2', '20');
  predLegendLine.setAttribute('y2', '20');
  predLegendLine.setAttribute('stroke', '#8b5cf6');
  predLegendLine.setAttribute('stroke-width', '2');
  predLegendLine.setAttribute('stroke-dasharray', '6 4');
  legend.appendChild(predLegendLine);
  
  const predLegendText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  predLegendText.setAttribute('x', '25');
  predLegendText.setAttribute('y', '24');
  predLegendText.setAttribute('fill', '#8b5cf6');
  predLegendText.setAttribute('font-size', '11');
  predLegendText.textContent = 'Predicted';
  legend.appendChild(predLegendText);
  
  chartGroup.appendChild(legend);
  
  svg.appendChild(chartGroup);
  container.appendChild(svg);
  
  // Update prediction insight text
  const predictionText = document.getElementById('co2-prediction-text');
  if (predictionText) {
    const increasePercent = Math.round(((predictedData[2].value - currentValue) / currentValue) * 100);
    predictionText.textContent = `The model predicts a ${increasePercent}% increase in CO₂ in the next 3 hours`;
  }
}

// Render AI Alerts with Confidence Bars
function renderAIAlerts() {
  const container = document.getElementById('ai-alerts-list');
  if (!container) return;
  
  // Get alerts from alerts engine
  const filteredData = {
    iaq: SMACAState.getFilteredIAQ(),
    occupancy: SMACAState.getFilteredOccupancy(),
    environmental: SMACAState.getFilteredEnvironmental()
  };
  const sensors = (typeof window !== 'undefined' && Array.isArray(window.SMACA_SENSORS))
    ? window.SMACA_SENSORS
    : (typeof mockData !== 'undefined' && Array.isArray(mockData.sensors) ? mockData.sensors : []);
  const alerts = SMACAAlertsEngine.checkRules(filteredData, sensors);
  
  if (alerts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: var(--space-8); color: var(--muted);">
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto var(--space-3); opacity: 0.5;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p style="margin: 0;">No critical alerts</p>
      </div>
    `;
    return;
  }
  
  const sortedAlerts = SMACAAlertsEngine.getSortedAlerts();
  
  container.innerHTML = sortedAlerts.slice(0, 3).map(alert => {
    const severityClass = alert.severity === 'critical' ? 'badge--danger' : 
                         alert.severity === 'warning' ? 'badge--warning' : 'badge--info';
    const severityLabel = alert.severity === 'critical' ? 'critical' : 
                         alert.severity === 'warning' ? 'high' : 'medium';
    const alertType = alert.type === 'iaq' ? 'alert' : 'anomaly';
    
    return `
      <div style="padding: var(--space-4); border-bottom: 1px solid var(--border);">
        <div style="display: flex; align-items: start; gap: var(--space-3); margin-bottom: var(--space-3);">
          <span class="badge ${severityClass} badge--sm">${severityLabel}</span>
          <span class="badge badge--secondary badge--sm">${alertType}</span>
        </div>
        <p style="font-size: var(--font-size-sm); color: var(--text); margin-bottom: var(--space-2); margin-top: 0; line-height: 1.5;">
          ${alert.message}
        </p>
        <div style="margin-top: var(--space-3);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-1);">
            <span style="font-size: var(--font-size-xs); color: var(--muted);">Confidence</span>
            <span style="font-size: var(--font-size-xs); color: var(--text); font-weight: var(--font-weight-medium);">${alert.confidence}%</span>
          </div>
          <div style="width: 100%; height: 6px; background: var(--surface-2); border-radius: var(--r-sm); overflow: hidden;">
            <div style="width: ${alert.confidence}%; height: 100%; background: #3b82f6; transition: width 0.3s;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Update Active Events Count
function updateActiveEventsCount() {
  const filteredData = {
    iaq: SMACAState.getFilteredIAQ(),
    occupancy: SMACAState.getFilteredOccupancy(),
    environmental: SMACAState.getFilteredEnvironmental()
  };
  const sensors = (typeof window !== 'undefined' && Array.isArray(window.SMACA_SENSORS))
    ? window.SMACA_SENSORS
    : (typeof mockData !== 'undefined' && Array.isArray(mockData.sensors) ? mockData.sensors : []);
  const alerts = SMACAAlertsEngine.checkRules(filteredData, sensors);
  
  const countEl = document.getElementById('active-events-count');
  if (countEl) {
    countEl.textContent = alerts.length;
  }
}

// Enhanced AI Insights Loading
function loadEnhancedAIInsights() {
  renderModelPerformanceCards();
  renderCO2PredictionChart();
  renderAIAlerts();
  updateActiveEventsCount();
}
