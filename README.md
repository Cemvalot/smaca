# SMACA Dashboard

Smart Campus (SMACA) IoT Monitoring Platform - Frontend Dashboard

## Overview

SMACA Dashboard is a modern, responsive web application for monitoring and managing IoT sensors in a smart campus environment. It provides real-time visualization of Indoor Air Quality (IAQ), Occupancy, Energy consumption, Connectivity, and Environmental/UV data.

## Features

- Real-time Data Visualization: Interactive charts and KPIs for all sensor types
- Time Range Filtering: View data for 24 hours, 7 days, or 30 days
- Trend Analysis: Automatic trend calculation and visualization
- Alert System: Rule-based alerts for sensor anomalies
- Export Functionality: CSV export for IAQ data
- System Health Monitoring: Real-time system status indicators
- AI Insights: Integration with Ollama for predictive analytics
- Management Panel: Sensor management and configuration

## Project Structure

```
smaca/
├── smaca-dashboard.html      # Main dashboard HTML file
├── index.html                 # Entry point (redirects to login)
├── login.html                 # Login page
├── register.html              # Registration page
├── assets/
│   ├── css/
│   │   ├── base.css           # Base styles and CSS variables
│   │   ├── dashboard.css      # Dashboard-specific styles
│   │   └── smaca-dashboard.css # SMACA custom styles
│   ├── js/
│   │   ├── smaca-production-features.js    # Main integration file
│   │   ├── smaca-state-manager.js          # State management
│   │   ├── smaca-accurate-dashboard.js     # IAQ dashboard rendering
│   │   ├── smaca-accurate-charts.js        # Chart rendering functions
│   │   ├── smaca-data-normalizer.js        # Data normalization
│   │   ├── smaca-trend-calculator.js       # Trend calculations
│   │   ├── smaca-alerts-engine.js           # Alert rules engine
│   │   ├── smaca-csv-export.js              # CSV export utility
│   │   ├── smaca-dashboard.js               # General dashboard functions
│   │   ├── advanced-visualizations.js      # Advanced chart types
│   │   ├── smaca-ai-insights.js             # AI insights rendering
│   │   └── app.js                           # General app utilities
│   └── images/                              # Image assets
└── README.md
```

## Laravel Integration

### Replacing Sample Data

Replace `initializeStateWithSampleData()` in `assets/js/smaca-production-features.js` with Laravel API calls. The function should fetch data from your API endpoints and populate `SMACAState` using `addBulkData()`.

Also replace `mockData` references in `smaca-dashboard.js` with API calls for sensor list, connectivity data, and AI insights.

### Expected API Endpoints

- `GET /api/sensors/iaq/history` - Returns array of IAQ sensor readings
- `GET /api/sensors/occupancy/history` - Returns array of occupancy readings
- `GET /api/sensors/environmental/history` - Returns array of environmental readings
- `GET /api/sensors` - Returns list of all sensors
- `GET /api/alerts` - Returns active alerts
- `GET /api/system/health` - Returns system health status

### Data Format

**IAQ Data Format:**
```json
{
  "payload": {
    "object": {
      "co2": 522,
      "temperature": 22.5,
      "humidity": 47,
      "pm2_5": 12.3,
      "pm10": 18.5,
      "tvoc": 148
    }
  },
  "deviceInfo": {
    "deviceName": "IAQ-Sensor-001",
    "deviceProfileName": "Milesight AM308L"
  },
  "rxInfo": [{
    "rssi": -65,
    "snr": 20,
    "gatewayId": "gateway-001"
  }],
  "time": "2026-02-09T10:30:00Z"
}
```

**Occupancy Data Format:**
```json
{
  "payload": {
    "object": {
      "period_in": 5,
      "period_out": 2,
      "total_in": 150,
      "total_out": 145,
      "battery": 85
    }
  },
  "time": "2026-02-09T10:30:00Z"
}
```

**Environmental Data Format:**
```json
{
  "payload": {
    "object": {
      "modbus_chn_1": 6.5,
      "gpio_input_1": 0,
      "gpio_input_2": 0
    }
  },
  "time": "2026-02-09T10:30:00Z"
}
```

## Production Checklist

- [x] Removed all console.log statements
- [x] Removed debug code
- [x] Added integration comments
- [ ] Replace sample data with Laravel API calls
- [ ] Configure API endpoints
- [ ] Set up error handling/logging
- [ ] Test with real sensor data
