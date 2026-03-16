// Mock Data (for development/testing)
const mockData = {
  iaq: {
    co2: { value: 522, previousValue: 530, status: 'good' },
    temperature: { value: 22.5, previousValue: 22.3 },
    humidity: { value: 47, previousValue: 46 },
    tvoc: { value: 148, previousValue: 150 },
    timeSeries: {
      co2: [480, 495, 510, 505, 520, 515, 530, 525, 522, 518, 515, 520, 525, 530, 528, 522].map((v, i) => ({ value: v, time: i })),
      temperature: [21.5, 21.8, 22.0, 22.2, 22.4, 22.3, 22.5, 22.6, 22.5, 22.4, 22.3, 22.5, 22.6, 22.7, 22.5, 22.5],
      humidity: [45, 46, 47, 46, 48, 47, 49, 48, 47, 46, 47, 48, 47, 46, 47, 47]
    }
  },
  occupancy: {
    current: 7,
    hourly: [2, 3, 1, 0, 0, 1, 3, 5, 8, 12, 15, 18, 20, 22, 19, 15, 12, 10, 8, 7, 5, 4, 3, 2],
    daily: [45, 52, 48, 55, 61, 58, 63],
    flow: {
      in: [0, 1, 0, 0, 0, 1, 2, 3, 4, 5, 3, 4, 2, 3, 1, 2, 1, 1, 0, 1, 0, 0, 0, 0],
      out: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 3, 3, 2, 2, 2, 1, 1, 1, 1, 0]
    }
  },
  energy: {
    daily: 1688.2,
    hourly: [45, 52, 48, 55, 68, 75, 82, 88, 95, 102, 108, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175],
    dailyTrend: [1520, 1580, 1620, 1650, 1680, 1700, 1688],
    // For correlation chart - same time points as occupancy
    hourlyForCorrelation: [45, 52, 48, 55, 68, 75, 82, 88, 95, 102, 108, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175]
  },
  // Sensors for development only; in production we prefer window.SMACA_SENSORS from backend.
  sensors: [],
  environmental: {
    uvIndex: 6.5,
    hourlyUV: [0, 0, 0, 0, 0, 0.5, 1.2, 2.8, 4.5, 5.8, 6.5, 7.2, 6.8, 5.5, 4.2, 3.0, 1.5, 0.8, 0.2, 0, 0, 0, 0, 0]
  },
  // Users - empty until database/API is connected. Expected shape: { id, name, email, role, status, lastLogin }
  users: [],
  aiInsights: {
    recommendations: [
      { 
        type: 'energy', 
        title: 'Energy Consumption Reduction',
        message: 'System identified potential 12% savings in air conditioning for Building A - Floor 2',
        priority: 'high',
        impact: 'high'
      },
      { 
        type: 'iaq', 
        title: 'Ventilation Optimization',
        message: 'Elevated CO₂ levels during morning hours - automatic ventilation recommended',
        priority: 'medium',
        impact: 'medium'
      },
      { 
        type: 'occupancy', 
        title: 'Lighting Scheduling',
        message: 'Occupancy analysis shows lighting can be reduced by 30% after 18:00',
        priority: 'medium',
        impact: 'medium'
      }
    ]
  }
};

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  // Check if production features (with filtered data) are loaded
  // If SMACAState exists, don't use mockData functions - they will be handled by production-features.js
  const useProductionFeatures = typeof SMACAState !== 'undefined' && SMACAState !== null;
  
  
  if (!useProductionFeatures) {
    // Load data for all sections (only if production features not loaded)
    loadIAQData();
    loadOccupancyData();
    loadEnergyData();
  } else {
  }
  
  // Always load these (they don't conflict)
  loadConnectivityData();
  loadEnvironmentalData();
  loadAIInsights();
  
  // Initialize chart hover functionality from app.js if available
  setTimeout(() => {
    if (typeof initChartHover === 'function') {
      initChartHover();
    }
  }, 500);
  
  // Update data every 30 seconds (only if not using production features)
  if (!useProductionFeatures) {
    setInterval(() => {
      updateMockData();
    }, 30000);
  }
});

// Tab Management - Removed (using unified navigation in HTML)
// Dark Mode Toggle - Removed (using existing dark theme)

// IAQ Data Loading
function loadIAQData() {
  const data = mockData.iaq;
  
  // Update current values in the status cards
  const co2Section = document.querySelector('#iaq');
  if (co2Section) {
    const co2ValueEl = co2Section.querySelector('.card:first-child .card__body div div div:nth-child(2)');
    if (co2ValueEl) co2ValueEl.textContent = data.co2.value;
    
    const tempValueEl = co2Section.querySelector('.card:nth-child(2) .card__body div div div:nth-child(2)');
    if (tempValueEl) tempValueEl.textContent = data.temperature.value;
    
    const humidityValueEl = co2Section.querySelector('.card:nth-child(3) .card__body div div div:nth-child(2)');
    if (humidityValueEl) humidityValueEl.textContent = data.humidity.value;
    
    const tvocValueEl = co2Section.querySelector('.card:nth-child(4) .card__body div div div:nth-child(2)');
    if (tvocValueEl) tvocValueEl.textContent = data.tvoc.value;
  }
  
  // Create micro-trend indicators
  if (typeof createMicroTrendIndicator === 'function') {
    createMicroTrendIndicator('co2-trend-indicator', data.co2.value, data.co2.previousValue, { invert: true });
    createMicroTrendIndicator('temp-trend-indicator', data.temperature.value, data.temperature.previousValue);
    createMicroTrendIndicator('humidity-trend-indicator', data.humidity.value, data.humidity.previousValue);
    createMicroTrendIndicator('tvoc-trend-indicator', data.tvoc.value, data.tvoc.previousValue, { invert: true });
  }
  
  if (data.timeSeries && typeof createCO2BandChart === 'function') {
    setTimeout(() => {
      createCO2BandChart('iaq-co2-band-chart', data.timeSeries.co2, { height: 350 });
    }, 100);
  }
}

// Occupancy Data Loading
function loadOccupancyData() {
  const data = mockData.occupancy;
  
  // Update current value
  const occupancySection = document.querySelector('#occupancy');
  if (occupancySection) {
    const currentEl = occupancySection.querySelector('.card:first-child .card__body div div div:nth-child(2)');
    if (currentEl) currentEl.textContent = data.current;
  }
  
  // Render advanced charts
  setTimeout(() => {
    if (data.flow && typeof createFlowBarChart === 'function') {
      createFlowBarChart('occupancy-flow-chart', data.flow.in, data.flow.out, { height: 400 });
    }
    
    if (data.hourly && typeof createOccupancyDensityTimeline === 'function') {
      createOccupancyDensityTimeline('occupancy-density-timeline', data.hourly, { height: 300 });
    }
  }, 100);
}

// Energy Data Loading
function loadEnergyData() {
  const data = mockData.energy;
  const occupancyData = mockData.occupancy;
  
  // Update current value
  const energySection = document.querySelector('#energy');
  if (energySection) {
    const dailyEl = energySection.querySelector('.card:first-child .card__body div div div:nth-child(2)');
    if (dailyEl) dailyEl.textContent = data.daily.toFixed(1);
  }
  
  // Render correlation chart only when energy section is visible (avoids wrong size from hidden container)
  setTimeout(() => {
    const energySection = document.querySelector('#energy');
    if (energySection && energySection.style.display !== 'none' && data.hourlyForCorrelation && occupancyData.hourly && typeof createDualAxisChart === 'function') {
      createDualAxisChart('energy-correlation-chart', occupancyData.hourly, data.hourlyForCorrelation, { height: 400 });
    }
  }, 100);
}

function loadConnectivityData() {
  if (typeof createSensorHealthTable === 'function') {
    setTimeout(() => {
      const sensors =
        (typeof window !== 'undefined' && Array.isArray(window.SMACA_SENSORS))
          ? window.SMACA_SENSORS
          : (mockData.sensors || []);
      createSensorHealthTable('sensor-health-table', sensors);
    }, 100);
  }
}

function loadEnvironmentalData() {
  const data = mockData.environmental;
  
  if (data.uvIndex !== undefined) {
    const uvValue = data.uvIndex;
    const maxUV = 11; // Maximum UV index
    
    createGaugeChart('uv-gauge-chart', uvValue, maxUV, {
      size: 200,
      color: uvValue >= 6 ? '#ef4444' : uvValue >= 3 ? '#f59e0b' : '#10b981',
      label: 'UV Index'
    });
    
    const uvValueEl = document.getElementById('uv-value');
    if (uvValueEl) {
      uvValueEl.textContent = uvValue.toFixed(1);
    }
    
    const uvStatus = document.getElementById('uv-status');
    if (uvStatus) {
      if (uvValue >= 6) {
        uvStatus.textContent = 'High';
        uvStatus.className = 'badge badge--danger badge--sm';
      } else if (uvValue >= 3) {
        uvStatus.textContent = 'Moderate';
        uvStatus.className = 'badge badge--warning badge--sm';
      } else {
        uvStatus.textContent = 'Low';
        uvStatus.className = 'badge badge--success badge--sm';
      }
    }
  }
  
  if (data.hourlyUV) {
    createLineChart('uv-hourly-chart', [{
      label: 'UV Index',
      values: data.hourlyUV,
      color: '#f97316'
    }], { height: 300, legend: true });
  }
}

function loadAIInsights() {
  const data = mockData.aiInsights;
  
  const insightsContainer = document.getElementById('ai-insights-list');
  if (insightsContainer && data.recommendations) {
    insightsContainer.innerHTML = '';
    data.recommendations.forEach(insight => {
      const item = document.createElement('div');
      item.className = 'card';
      item.style.position = 'relative';
      item.style.padding = 'var(--space-5)';
      item.style.borderRadius = 'var(--r-lg)';
      item.style.background = 'var(--surface)';
      item.style.border = '1px solid var(--border)';
      item.style.transition = 'transform 0.2s, box-shadow 0.2s';
      
      // Impact badge colors
      const impactColors = {
        'high': { bg: '#10b981', text: 'white' },
        'medium': { bg: '#3b82f6', text: 'white' },
        'low': { bg: '#6b7280', text: 'white' }
      };
      
      const impactColor = impactColors[insight.impact] || impactColors.medium;
      const impactLabel = insight.impact === 'high' ? 'high impact' : 
                         insight.impact === 'medium' ? 'medium impact' : 'low impact';
      
      item.innerHTML = `
        <div style="position: relative; height: 100%;">
          <!-- Impact Badge -->
          <div style="position: absolute; top: 0; left: 0; background: ${impactColor.bg}; color: ${impactColor.text}; padding: var(--space-1) var(--space-2); border-radius: var(--r-sm); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            ${impactLabel}
          </div>
          
          <!-- Eye Icon -->
          <div style="position: absolute; top: 0; right: 0; color: var(--muted);">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </div>
          
          <!-- Content -->
          <div style="margin-top: var(--space-6);">
            <h4 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--text); margin-bottom: var(--space-3); margin-top: 0;">
              ${insight.title || insight.message.split('.')[0]}
            </h4>
            <p style="font-size: var(--font-size-sm); color: var(--muted); line-height: 1.6; margin: 0;">
              ${insight.message}
            </p>
          </div>
        </div>
      `;
      
      // Add hover effect
      item.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = 'var(--shadow-md)';
      });
      item.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'none';
      });
      
      insightsContainer.appendChild(item);
    });
  }
}

// Chart Rendering Functions
function createLineChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || !data || !data.length || !data[0].values || !data[0].values.length) return;
  
  const width = container.offsetWidth || 800;
  const height = options.height || 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Clear container
  container.innerHTML = '';
  
  // Create SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  
  // Create chart group
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  
  // Find min/max values
  const allValues = data.flatMap(series => series.values);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;
  const paddingValue = valueRange * 0.1;
  
  // Scale functions
  const xScale = (index) => (index / (data[0].values.length - 1)) * chartWidth;
  const yScale = (value) => chartHeight - ((value - minValue + paddingValue) / (valueRange + paddingValue * 2)) * chartHeight;
  
  // Draw grid lines
  const gridLines = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gridLines.setAttribute('class', 'chart-grid');
  for (let i = 0; i <= 4; i++) {
    const y = (chartHeight / 4) * i;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', y);
    line.setAttribute('x2', chartWidth);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'var(--border)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('opacity', '0.3');
    gridLines.appendChild(line);
  }
  chartGroup.appendChild(gridLines);
  
  // Draw data series
  data.forEach((series, seriesIndex) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const points = series.values.map((value, index) => {
      const x = xScale(index);
      const y = yScale(value);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    path.setAttribute('d', points);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', series.color || '#3b82f6');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('data-series', seriesIndex);
    chartGroup.appendChild(path);
    
    // Add data points
    series.values.forEach((value, index) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', xScale(index));
      circle.setAttribute('cy', yScale(value));
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', series.color || '#3b82f6');
      circle.setAttribute('data-point', index);
      chartGroup.appendChild(circle);
    });
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
  
  svg.appendChild(chartGroup);
  container.appendChild(svg);
  
  // Add legend if provided
  if (options.legend && data.length > 0) {
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    data.forEach(series => {
      const item = document.createElement('div');
      item.className = 'chart-legend__item';
      const dot = document.createElement('div');
      dot.className = 'chart-legend__dot';
      dot.style.backgroundColor = series.color || '#3b82f6';
      const label = document.createElement('span');
      label.textContent = series.label || 'Series';
      item.appendChild(dot);
      item.appendChild(label);
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }
}

function createBarChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || !data || !data.length) return;
  
  const width = container.offsetWidth || 800;
  const height = options.height || 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  container.innerHTML = '';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
  
  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = chartWidth / data.length * 0.6;
  const barSpacing = chartWidth / data.length;
  
  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = index * barSpacing + (barSpacing - barWidth) / 2;
    const y = chartHeight - barHeight;
    
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('fill', item.color || '#3b82f6');
    rect.setAttribute('rx', '4');
    chartGroup.appendChild(rect);
  });
  
  svg.appendChild(chartGroup);
  container.appendChild(svg);
}

function createGaugeChart(containerId, value, maxValue, options = {}) {
  const container = document.getElementById(containerId);
  if (!container || value === undefined || maxValue === undefined) return;
  
  const size = options.size || 200;
  const strokeWidth = options.strokeWidth || 20;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / maxValue, 1);
  const offset = circumference - (percentage * circumference);
  
  container.innerHTML = '';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  
  // Background circle
  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', center);
  bgCircle.setAttribute('cy', center);
  bgCircle.setAttribute('r', radius);
  bgCircle.setAttribute('fill', 'none');
  bgCircle.setAttribute('stroke', 'var(--surface-2)');
  bgCircle.setAttribute('stroke-width', strokeWidth);
  svg.appendChild(bgCircle);
  
  // Value circle
  const valueCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  valueCircle.setAttribute('cx', center);
  valueCircle.setAttribute('cy', center);
  valueCircle.setAttribute('r', radius);
  valueCircle.setAttribute('fill', 'none');
  valueCircle.setAttribute('stroke', options.color || '#3b82f6');
  valueCircle.setAttribute('stroke-width', strokeWidth);
  valueCircle.setAttribute('stroke-dasharray', circumference);
  valueCircle.setAttribute('stroke-dashoffset', offset);
  valueCircle.setAttribute('stroke-linecap', 'round');
  valueCircle.setAttribute('transform', `rotate(-90 ${center} ${center})`);
  svg.appendChild(valueCircle);
  
  // Value text
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', center);
  text.setAttribute('y', center);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('fill', 'var(--text)');
  text.setAttribute('font-size', '32');
  text.setAttribute('font-weight', 'bold');
  text.textContent = value.toFixed(1);
  svg.appendChild(text);
  
  // Label text
  if (options.label) {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', center);
    label.setAttribute('y', center + 30);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', 'var(--muted)');
    label.setAttribute('font-size', '14');
    label.textContent = options.label;
    svg.appendChild(label);
  }
  
  container.appendChild(svg);
}

function updateMockData() {
  // Check if production features are loaded - if so, don't update with mockData
  const useProductionFeatures = typeof SMACAState !== 'undefined' && SMACAState !== null;
  if (useProductionFeatures) {
    return;
  }
  
  // Simulate small changes in data
  mockData.iaq.co2.value += Math.floor(Math.random() * 20) - 10;
  mockData.iaq.co2.value = Math.max(400, Math.min(1200, mockData.iaq.co2.value));
  
  mockData.occupancy.current += Math.floor(Math.random() * 6) - 3;
  mockData.occupancy.current = Math.max(0, mockData.occupancy.current);
  
  // Update displayed values
  loadIAQData();
  loadOccupancyData();
}

// Persist sensors/users to localStorage
const STORAGE_KEYS = { sensors: 'smaca-sensors', users: 'smaca-users', managementTab: 'smaca-management-tab' };

function loadPersistedData() {
  try {
    const s = localStorage.getItem(STORAGE_KEYS.sensors);
    if (s) {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) mockData.sensors = arr;
    }
  } catch (e) {}
  try {
    const u = localStorage.getItem(STORAGE_KEYS.users);
    if (u) {
      const arr = JSON.parse(u);
      if (Array.isArray(arr)) mockData.users = arr;
    }
  } catch (e) {}
}

function persistSensors() {
  try {
    localStorage.setItem(STORAGE_KEYS.sensors, JSON.stringify(mockData.sensors));
  } catch (e) {}
}

function persistUsers() {
  try {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(mockData.users));
  } catch (e) {}
}

function switchManagementTab(targetTab) {
  const tabId = targetTab || localStorage.getItem(STORAGE_KEYS.managementTab) || 'sensors';
  const managementTabs = document.querySelectorAll('.management-tab');
  const tabContents = document.querySelectorAll('.management-tab-content');
  managementTabs.forEach(t => {
    t.classList.remove('active');
    t.style.color = 'var(--muted)';
    t.style.borderBottomColor = 'transparent';
    if (t.getAttribute('data-tab') === tabId) {
      t.classList.add('active');
      t.style.color = 'var(--text)';
      t.style.borderBottomColor = 'var(--accent)';
    }
  });
  tabContents.forEach(content => {
    const isTab = content.id === `management-${tabId}-tab`;
    content.style.display = isTab ? 'block' : 'none';
  });
}

// Management Data Loading
function loadManagementData() {
  // When backend sensors are rendered via Blade, summary cards and table are already populated.
  const useServerRenderedSensors =
    (typeof window !== 'undefined' && Array.isArray(window.SMACA_SENSORS));
  if (!useServerRenderedSensors) {
    const sensors = [...(mockData.sensors || [])];
    
    // Update summary cards
    const totalSensors = sensors.length;
    const activeSensors = sensors.filter(s => s.status === 'active' || s.status === 'online').length;
    const maintenanceSensors = sensors.filter(s => s.status === 'maintenance').length;
    
    const totalEl = document.getElementById('total-sensors');
    if (totalEl) totalEl.textContent = totalSensors;
    
    const managementTotalEl = document.getElementById('management-total-sensors');
    if (managementTotalEl) managementTotalEl.textContent = totalSensors;
    
    const activeEl = document.getElementById('active-sensors');
    if (activeEl) activeEl.textContent = activeSensors;
    
    const maintenanceEl = document.getElementById('maintenance-sensors');
    if (maintenanceEl) maintenanceEl.textContent = maintenanceSensors;
    
    // Render sensors table (newest first)
    renderSensorsManagementTable([...(mockData.sensors || [])].reverse());
  }

  // Load and render users (ready for API/database - uses mockData.users when no API)
  loadUsers();

  // Restore last active management tab
  switchManagementTab();
}

// API config - set USERS_API_URL when backend is ready (e.g. '/api/users')
const USERS_API_URL = null; // Replace with '/api/users' when database is connected

async function loadUsers() {
  let users = [];
  try {
    if (USERS_API_URL) {
      const res = await fetch(USERS_API_URL);
      if (res.ok) users = await res.json();
    } else {
      users = mockData.users || [];
    }
  } catch (e) {
    console.warn('Users load failed (API may not be ready):', e.message);
    users = mockData.users || [];
  }
  renderUsersManagementTable([...users].reverse());
}

function renderUsersManagementTable(users) {
  const tbody = document.getElementById('users-management-table-body');
  const table = document.getElementById('users-management-table');
  const emptyState = document.getElementById('users-empty-state');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (users.length === 0) {
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (table) table.style.display = 'table';
  if (emptyState) emptyState.style.display = 'none';

  users.forEach(user => {
    const row = document.createElement('tr');
    row.dataset.userId = user.id || '';
    row.style.borderBottom = '1px solid var(--border)';
    row.style.transition = 'background 0.2s';

    row.addEventListener('mouseenter', function() { this.style.background = 'var(--surface-2)'; });
    row.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });

    const statusClass = (user.status === 'active' || user.status === 'online') ? 'badge--success' : 'badge--muted';
    const statusText = user.status === 'active' || user.status === 'online' ? 'Active' : (user.status || 'Inactive');
    const lastLogin = user.lastLogin || user.last_login || '-';
    const role = user.role || 'user';

    row.innerHTML = `
      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${escapeHtml(user.name || '-')}</td>
      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${escapeHtml(user.email || '-')}</td>
      <td style="padding: var(--space-3) var(--space-4);">
        <span class="badge badge--muted" style="text-transform: none;">${escapeHtml(role)}</span>
      </td>
      <td style="padding: var(--space-3) var(--space-4);">
        <span class="badge ${statusClass} badge--sm">${statusText}</span>
      </td>
      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${escapeHtml(String(lastLogin))}</td>
      <td style="padding: var(--space-3) var(--space-4);">
        <div style="display: flex; gap: var(--space-2);">
          <button class="btn btn--ghost btn--sm" style="padding: var(--space-1); min-width: auto;" title="Edit" data-user-id="${user.id || ''}">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button class="btn btn--ghost btn--sm" style="padding: var(--space-1); min-width: auto; color: var(--danger);" title="Delete" data-user-id="${user.id || ''}">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </td>
    `;

    row.querySelector('[title="Edit"]').addEventListener('click', () => editUser(user));
    row.querySelector('[title="Delete"]').addEventListener('click', () => deleteUser(user.id));

    tbody.appendChild(row);
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function openUserModal(user) {
  const modal = document.getElementById('user-modal');
  const title = document.getElementById('user-modal-title');
  const form = document.getElementById('user-form');
  const idInput = document.getElementById('user-form-id');
  const nameInput = document.getElementById('user-form-name');
  const emailInput = document.getElementById('user-form-email');
  const roleInput = document.getElementById('user-form-role');
  const statusInput = document.getElementById('user-form-status');
  if (!modal || !form) return;

  if (user) {
    title.textContent = 'Edit User';
    idInput.value = user.id || '';
    nameInput.value = user.name || '';
    emailInput.value = user.email || '';
    roleInput.value = user.role || 'user';
    statusInput.value = user.status === 'active' || user.status === 'online' ? 'active' : 'inactive';
    emailInput.readOnly = true;
  } else {
    title.textContent = 'Add User';
    idInput.value = '';
    nameInput.value = '';
    emailInput.value = '';
    roleInput.value = 'user';
    statusInput.value = 'active';
    emailInput.readOnly = false;
  }
  modal.style.display = 'flex';
}

function closeUserModal() {
  const modal = document.getElementById('user-modal');
  if (modal) modal.style.display = 'none';
}

function editUser(userOrId) {
  const user = typeof userOrId === 'object' ? userOrId : mockData.users.find(u => String(u.id) === String(userOrId));
  openUserModal(user || null);
}

function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  const idx = mockData.users.findIndex(u => String(u.id) === String(userId));
  if (idx >= 0) {
    mockData.users.splice(idx, 1);
    persistUsers();
    loadUsers();
  }
}

function saveUser(e) {
  e.preventDefault();
  const idInput = document.getElementById('user-form-id');
  const nameInput = document.getElementById('user-form-name');
  const emailInput = document.getElementById('user-form-email');
  const roleInput = document.getElementById('user-form-role');
  const statusInput = document.getElementById('user-form-status');
  const name = (nameInput?.value || '').trim();
  const email = (emailInput?.value || '').trim();
  const role = roleInput?.value || 'user';
  const status = statusInput?.value || 'active';
  if (!name || !email) return;

  const existingId = idInput?.value;
  const existing = mockData.users.find(u => String(u.id) === String(existingId));

  if (existing) {
    existing.name = name;
    existing.role = role;
    existing.status = status;
  } else {
    const newId = 'u' + Date.now();
    mockData.users.push({
      id: newId,
      name,
      email,
      role,
      status,
      lastLogin: '-'
    });
  }
  closeUserModal();
  persistUsers();
  loadUsers();
}

function initUserModal() {
  const modal = document.getElementById('user-modal');
  const form = document.getElementById('user-form');
  const backdrop = modal?.querySelector('.user-modal__backdrop');
  const closeBtn = modal?.querySelector('.user-modal__close');
  const cancelBtn = modal?.querySelector('.user-modal__cancel');

  form?.addEventListener('submit', saveUser);
  backdrop?.addEventListener('click', closeUserModal);
  closeBtn?.addEventListener('click', closeUserModal);
  cancelBtn?.addEventListener('click', closeUserModal);

  modal?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeUserModal();
  });
}

// Render Sensors Management Table
function renderSensorsManagementTable(sensors) {
  const tbody = document.getElementById('sensors-management-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  sensors.forEach(sensor => {
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid var(--border)';
    row.style.transition = 'background 0.2s';
    
    row.addEventListener('mouseenter', function() {
      this.style.background = 'var(--surface-2)';
    });
    row.addEventListener('mouseleave', function() {
      this.style.background = 'transparent';
    });
    
    // Status badge
    const statusClass = sensor.status === 'active' || sensor.status === 'online' ? 'badge--success' : 'badge--warning';
    const statusText = sensor.status === 'active' || sensor.status === 'online' ? 'Active' : 'Maintenance';
    
    // Battery display
    let batteryDisplay = '-';
    if (sensor.battery !== null && sensor.battery !== undefined) {
      batteryDisplay = `${sensor.battery}%`;
    }
    
    // Signal display
    let signalDisplay = '-';
    if (sensor.rssi !== null && sensor.rssi !== undefined) {
      signalDisplay = `${sensor.rssi} dBm`;
    }
    
    row.innerHTML = `
      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text); font-family: monospace;">${sensor.id}</td>
      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${sensor.name}</td>
      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${sensor.type || 'N/A'}</td>
      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">${sensor.location}</td>
      <td style="padding: var(--space-3) var(--space-4);">
        <span class="badge ${statusClass} badge--sm">${statusText}</span>
      </td>
      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
        ${batteryDisplay !== '-' ? `
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>${batteryDisplay}</span>
          </div>
        ` : '-'}
      </td>
      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); color: var(--text);">
        ${signalDisplay !== '-' ? `
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--muted);">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
            </svg>
            <span>${signalDisplay}</span>
          </div>
        ` : '-'}
      </td>
      <td style="padding: var(--space-3) var(--space-4);">
        <div style="display: flex; gap: var(--space-2);">
          <button class="btn btn--ghost btn--sm edit-sensor-btn" style="padding: var(--space-1); min-width: auto;" title="Edit" data-sensor-id="${sensor.id}">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button class="btn btn--ghost btn--sm delete-sensor-btn" style="padding: var(--space-1); min-width: auto; color: var(--danger);" title="Delete" data-sensor-id="${sensor.id}">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </td>
    `;

    row.querySelector('.edit-sensor-btn')?.addEventListener('click', () => editSensor(sensor));
    row.querySelector('.delete-sensor-btn')?.addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete sensor ${sensor.id}?`)) {
        const idx = mockData.sensors.findIndex(s => String(s.id) === String(sensor.id));
        if (idx >= 0) {
          mockData.sensors.splice(idx, 1);
          persistSensors();
          loadManagementData();
        }
      }
    });

    tbody.appendChild(row);
  });
}

function openSensorModal(sensor) {
  const modal = document.getElementById('sensor-modal');
  const title = document.getElementById('sensor-modal-title');
  const idInput = document.getElementById('sensor-form-id');
  const deviceIdInput = document.getElementById('sensor-form-device-id');
  const nameInput = document.getElementById('sensor-form-name');
  const typeInput = document.getElementById('sensor-form-type');
  const locationInput = document.getElementById('sensor-form-location');
  const statusInput = document.getElementById('sensor-form-status');
  const batteryInput = document.getElementById('sensor-form-battery');
  const rssiInput = document.getElementById('sensor-form-rssi');
  if (!modal) return;

  if (sensor) {
    title.textContent = 'Edit Sensor';
    idInput.value = sensor.id || '';
    deviceIdInput.value = sensor.id || '';
    deviceIdInput.readOnly = true;
    nameInput.value = sensor.name || '';
    typeInput.value = sensor.type || 'AM300';
    locationInput.value = sensor.location || '';
    statusInput.value = sensor.status === 'maintenance' ? 'maintenance' : 'active';
    batteryInput.value = sensor.battery != null ? sensor.battery : '';
    rssiInput.value = sensor.rssi != null ? sensor.rssi : '';
  } else {
    title.textContent = 'Add Sensor';
    idInput.value = '';
    deviceIdInput.value = '';
    deviceIdInput.readOnly = false;
    nameInput.value = '';
    typeInput.value = 'AM300';
    locationInput.value = '';
    statusInput.value = 'active';
    batteryInput.value = '';
    rssiInput.value = '';
  }
  modal.style.display = 'flex';
}

function closeSensorModal() {
  const modal = document.getElementById('sensor-modal');
  if (modal) modal.style.display = 'none';
}

function editSensor(sensorOrId) {
  const sensor = typeof sensorOrId === 'object' ? sensorOrId : mockData.sensors.find(s => String(s.id) === String(sensorOrId));
  openSensorModal(sensor || null);
}

function saveSensor(e) {
  e.preventDefault();
  const idInput = document.getElementById('sensor-form-id');
  const deviceIdInput = document.getElementById('sensor-form-device-id');
  const nameInput = document.getElementById('sensor-form-name');
  const typeInput = document.getElementById('sensor-form-type');
  const locationInput = document.getElementById('sensor-form-location');
  const statusInput = document.getElementById('sensor-form-status');
  const batteryInput = document.getElementById('sensor-form-battery');
  const rssiInput = document.getElementById('sensor-form-rssi');
  const deviceId = (deviceIdInput?.value || '').trim();
  const name = (nameInput?.value || '').trim();
  const type = typeInput?.value || 'AM300';
  const location = (locationInput?.value || '').trim();
  const status = statusInput?.value || 'active';
  const batteryVal = batteryInput?.value;
  const rssiVal = rssiInput?.value;
  const battery = batteryVal === '' ? null : parseInt(batteryVal, 10);
  const rssi = rssiVal === '' ? null : parseInt(rssiVal, 10);
  if (!deviceId || !name || !location) return;

  const existingId = idInput?.value;
  const existing = mockData.sensors.find(s => String(s.id) === String(existingId));

  if (existing) {
    existing.name = name;
    existing.type = type;
    existing.location = location;
    existing.status = status;
    existing.battery = battery;
    existing.rssi = rssi;
  } else {
    mockData.sensors.push({
      id: deviceId,
      name,
      type,
      location,
      status,
      battery,
      rssi,
      snr: null
    });
  }
  closeSensorModal();
  persistSensors();
  loadManagementData();
}

function initSensorModal() {
  const modal = document.getElementById('sensor-modal');
  const form = document.getElementById('sensor-form');
  const backdrop = modal?.querySelector('.user-modal__backdrop');
  const closeBtn = modal?.querySelector('.user-modal__close');
  const cancelBtn = modal?.querySelector('.user-modal__cancel');

  form?.addEventListener('submit', saveSensor);
  backdrop?.addEventListener('click', closeSensorModal);
  closeBtn?.addEventListener('click', closeSensorModal);
  cancelBtn?.addEventListener('click', closeSensorModal);

  modal?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSensorModal();
  });
}

function deleteSensor(sensorId) {
  if (confirm(`Are you sure you want to delete sensor ${sensorId}?`)) {
    const idx = mockData.sensors.findIndex(s => String(s.id) === String(sensorId));
    if (idx >= 0) {
      mockData.sensors.splice(idx, 1);
      persistSensors();
      loadManagementData();
    }
  }
}

// RBAC: apply role badge, lock admin-only items, hide connectivity details for users
function initRBAC() {
  if (typeof SMACARBAC === 'undefined') return;
  const role = SMACARBAC.getRole();
  const isAdmin = SMACARBAC.isAdmin();
  const badge = document.getElementById('role-badge');
  if (badge) {
    badge.textContent = isAdmin ? 'Admin' : 'User';
    badge.className = 'role-badge role-badge--' + (isAdmin ? 'admin' : 'user');
  }
  const adminLinks = document.querySelectorAll('.nav-link--admin-only, [data-admin-only].nav-link--section');
  adminLinks.forEach(function(link) {
    if (isAdmin) {
      link.classList.remove('nav-link--locked');
      link.removeAttribute('aria-disabled');
      link.style.pointerEvents = '';
      link.href = '#management';
    } else {
      link.classList.add('nav-link--locked');
      link.setAttribute('aria-disabled', 'true');
      link.style.pointerEvents = 'none';
      link.href = '#';
    }
  });
  const connectivityDetail = document.querySelector('[data-connectivity-admin-detail]');
  if (connectivityDetail) connectivityDetail.style.display = isAdmin ? '' : 'none';
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn && !isAdmin) exportBtn.setAttribute('title', 'Basic export only');
}

// Unified Navigation Handler (moved from smaca-dashboard.html)
document.addEventListener('DOMContentLoaded', function() {
  loadPersistedData();
  initRBAC();
  if (typeof SMACAUI !== 'undefined' && SMACAUI.initAccordions) {
    SMACAUI.initAccordions('.smaca-accordion');
  }

  const navLinks = document.querySelectorAll('.nav-link--section');
  const quickLinks = document.querySelectorAll('.quick-link');
  const sections = document.querySelectorAll('.dashboard-section');

  function showSection(sectionId) {
    if (typeof SMACARBAC !== 'undefined' && SMACARBAC.isAdminOnlySection && SMACARBAC.isAdminOnlySection(sectionId) && !SMACARBAC.isAdmin()) {
      if (typeof SMACAUI !== 'undefined' && SMACAUI.toast) SMACAUI.toast('Access denied', { type: 'error' });
      sectionId = 'overview';
      window.history.replaceState(null, '', '#overview');
    }
    sections.forEach(section => {
      section.style.display = 'none';
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      if (sectionId === 'management') {
        switchManagementTab();
        if (typeof loadManagementData === 'function') loadManagementData();
      }
      targetSection.style.display = 'block';

      setTimeout(() => {
        if (sectionId === 'management') {
          if (typeof initChartHover === 'function') setTimeout(initChartHover, 100);
          return;
        }
        if (sectionId === 'iaq') {
          const timeframeChangedRecently =
            typeof window !== 'undefined' &&
            window.timeframeChangeTime &&
            (Date.now() - window.timeframeChangeTime) < 1000;

          if (!timeframeChangedRecently) {
            if (typeof initAccurateIAQDashboard === 'function') {
              if (typeof window !== 'undefined') {
                window.lastRenderedTimeframe = null;
              }
              initAccurateIAQDashboard();
            }
          }
        } else if (sectionId === 'occupancy') {
          // Occupancy charts are updated by updateOccupancyCharts in updateAllDashboards
        } else if (sectionId === 'energy') {
          // Re-render energy chart now that section is visible (fixes wrong size when rendered while hidden)
          if (typeof SMACAState !== 'undefined' && SMACAState && typeof updateEnergyCharts === 'function') {
            const occ = SMACAState.getFilteredOccupancy ? SMACAState.getFilteredOccupancy() : [];
            if (occ && occ.length > 0) {
              updateEnergyCharts(occ, SMACAState.currentTimeframe || '24h');
            }
          } else if (typeof loadEnergyData === 'function') {
            loadEnergyData();
          }
        } else if (sectionId === 'environmental') {
          if (typeof loadEnvironmentalData === 'function') {
            loadEnvironmentalData();
          }
        } else if (sectionId === 'ai-insights') {
          if (typeof loadEnhancedAIInsights === 'function') {
            loadEnhancedAIInsights();
          } else if (typeof loadAIInsights === 'function') {
            loadAIInsights();
          }
        }

        if (typeof initChartHover === 'function') {
          setTimeout(() => {
            initChartHover();
          }, 200);
        }
      }, 100);
    }

    navLinks.forEach(link => {
      link.classList.remove('is-active');
      if (link.getAttribute('data-section') === sectionId) {
        link.classList.add('is-active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      if (this.classList.contains('nav-link--locked')) return;
      const sectionId = this.getAttribute('data-section');
      showSection(sectionId);
      window.history.pushState(null, '', '#' + sectionId);
    });
  });

  quickLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const sectionId = this.getAttribute('data-section');
      showSection(sectionId);
      window.history.pushState(null, '', '#' + sectionId);
    });
  });

  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    showSection(hash);
  } else {
    showSection('overview');
  }
  window.addEventListener('hashchange', function() {
    const hash = (window.location.hash || '#overview').slice(1);
    showSection(hash);
  });

  const managementTabs = document.querySelectorAll('.management-tab');
  managementTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      try { localStorage.setItem(STORAGE_KEYS.managementTab, targetTab); } catch (e) {}
      switchManagementTab(targetTab);
    });
  });

  const addUserBtn = document.getElementById('add-user-btn');
  if (addUserBtn) addUserBtn.addEventListener('click', () => editUser(null));

  const addSensorBtn = document.getElementById('add-sensor-btn');
  if (addSensorBtn) addSensorBtn.addEventListener('click', () => editSensor(null));

  initUserModal();
  initSensorModal();

  var searchInput = document.getElementById('management-search');
  var searchBtn = document.getElementById('management-search-btn');
  function runManagementSearch() {
    var q = (searchInput && searchInput.value ? searchInput.value.trim() : '').toLowerCase();
    var rows = document.querySelectorAll('#sensors-management-table-body tr');
    var anyVisible = false;
    rows.forEach(function(tr) {
      var id = (tr.querySelector('td:nth-child(1)') || {}).textContent || '';
      var name = (tr.querySelector('td:nth-child(2)') || {}).textContent || '';
      var location = (tr.querySelector('td:nth-child(4)') || {}).textContent || '';
      var match = !q || id.toLowerCase().indexOf(q) >= 0 || name.toLowerCase().indexOf(q) >= 0 || location.toLowerCase().indexOf(q) >= 0;
      tr.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    if (searchBtn && q && typeof SMACAUI !== 'undefined' && SMACAUI.toast) {
      SMACAUI.toast(anyVisible ? 'Found matching sensors' : 'No matching room or sensor');
    }
  }
  if (searchBtn) searchBtn.addEventListener('click', runManagementSearch);
  if (searchInput) searchInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); runManagementSearch(); } });
});

