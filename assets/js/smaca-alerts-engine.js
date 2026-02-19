// SMACA Alerts Engine
// Rule-based alert generation

const SMACAAlertsEngine = {
  alerts: [],
  
  // Check all rules and generate alerts
  checkRules(filteredData, sensors) {
    this.alerts = [];
    
    // Rule 1: CO2 > 1000 => critical
    // Rule 2: CO2 800-1000 => warning
    this.checkCO2Rules(filteredData.iaq);
    
    // Rule 3: Battery < 20 => critical
    // Rule 4: RSSI < -90 => warning
    // Rule 5: Sensor offline (no uplink > 15min) => critical
    this.checkSensorHealthRules(sensors);
    
    return this.alerts;
  },
  
  checkCO2Rules(iaqData) {
    if (!iaqData || iaqData.length === 0) return;
    
    // Check latest CO2 reading
    const latest = iaqData[iaqData.length - 1];
    const co2 = latest?.payload?.object?.co2;
    
    if (co2 === undefined || co2 === null) return;
    
    if (co2 > 1000) {
      this.alerts.push({
        id: `co2-critical-${Date.now()}`,
        severity: 'critical',
        type: 'iaq',
        message: `High CO₂ concentration: ${co2} ppm. Immediate ventilation required.`,
        confidence: 100,
        timestamp: latest.time || latest.timestamp,
        metric: 'co2',
        value: co2,
        threshold: 1000
      });
    } else if (co2 >= 800 && co2 <= 1000) {
      this.alerts.push({
        id: `co2-warning-${Date.now()}`,
        severity: 'warning',
        type: 'iaq',
        message: `Elevated CO₂ concentration: ${co2} ppm. Monitor and consider ventilation.`,
        confidence: 100,
        timestamp: latest.time || latest.timestamp,
        metric: 'co2',
        value: co2,
        threshold: 800
      });
    }
  },
  
  checkSensorHealthRules(sensors) {
    if (!sensors || sensors.length === 0) return;
    
    const now = Date.now();
    const fifteenMinutesAgo = now - (15 * 60 * 1000);
    
    sensors.forEach(sensor => {
      // Check battery
      if (sensor.battery !== null && sensor.battery !== undefined) {
        if (sensor.battery < 20) {
          this.alerts.push({
            id: `battery-critical-${sensor.id}-${Date.now()}`,
            severity: 'critical',
            type: 'sensor',
            message: `Low battery on ${sensor.name || sensor.id}: ${sensor.battery}%`,
            confidence: 100,
            timestamp: new Date().toISOString(),
            sensorId: sensor.id,
            sensorName: sensor.name,
            metric: 'battery',
            value: sensor.battery,
            threshold: 20
          });
        }
      }
      
      // Check RSSI
      if (sensor.rssi !== null && sensor.rssi !== undefined) {
        if (sensor.rssi < -90) {
          this.alerts.push({
            id: `rssi-warning-${sensor.id}-${Date.now()}`,
            severity: 'warning',
            type: 'connectivity',
            message: `Weak signal on ${sensor.name || sensor.id}: ${sensor.rssi} dBm`,
            confidence: 100,
            timestamp: new Date().toISOString(),
            sensorId: sensor.id,
            sensorName: sensor.name,
            metric: 'rssi',
            value: sensor.rssi,
            threshold: -90
          });
        }
      }
      
      // Check offline status (no recent uplink)
      if (sensor.lastSeen) {
        const lastSeenTime = new Date(sensor.lastSeen).getTime();
        if (lastSeenTime < fifteenMinutesAgo) {
          this.alerts.push({
            id: `offline-critical-${sensor.id}-${Date.now()}`,
            severity: 'critical',
            type: 'connectivity',
            message: `Sensor ${sensor.name || sensor.id} appears offline (last seen: ${this.formatTimeAgo(sensor.lastSeen)})`,
            confidence: 100,
            timestamp: sensor.lastSeen,
            sensorId: sensor.id,
            sensorName: sensor.name,
            metric: 'status',
            value: 'offline'
          });
        }
      } else if (sensor.status === 'offline') {
        this.alerts.push({
          id: `offline-critical-${sensor.id}-${Date.now()}`,
          severity: 'critical',
          type: 'connectivity',
          message: `Sensor ${sensor.name || sensor.id} is offline`,
          confidence: 100,
          timestamp: new Date().toISOString(),
          sensorId: sensor.id,
          sensorName: sensor.name,
          metric: 'status',
          value: 'offline'
        });
      }
    });
  },
  
  formatTimeAgo(timestamp) {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / (60 * 1000));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  },
  
  // Get alerts sorted by severity (critical first)
  getSortedAlerts() {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return [...this.alerts].sort((a, b) => {
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
};
