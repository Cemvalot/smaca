const SMACAState = {
  currentTimeframe: '24h', // '24h', '7d', '30d'
  rawData: {
    iaq: [],
    occupancy: [],
    environmental: [],
    energy: []
  },
  
  // Get milliseconds for timeframe
  getTimeframeMs(timeframe) {
    const now = Date.now();
    switch(timeframe) {
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  },
  
  // Filter data by timeframe
  filterByTimeframe(dataArray, timeframe) {
    if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
      return [];
    }
    
    const cutoffTime = Date.now() - this.getTimeframeMs(timeframe);
    const now = Date.now();
    
    const filtered = dataArray.filter(item => {
      const itemTime = new Date(item.time || item.timestamp).getTime();
      return itemTime >= cutoffTime;
    }).sort((a, b) => {
      const timeA = new Date(a.time || a.timestamp).getTime();
      const timeB = new Date(b.time || b.timestamp).getTime();
      return timeA - timeB;
    });
    
    if (filtered.length > 0) {
    }
    
    return filtered;
  },
  
  // Get filtered IAQ data for current timeframe
  getFilteredIAQ() {
    const filtered = this.filterByTimeframe(this.rawData.iaq, this.currentTimeframe);
    return filtered;
  },
  
  // Get filtered Occupancy data
  getFilteredOccupancy() {
    const filtered = this.filterByTimeframe(this.rawData.occupancy, this.currentTimeframe);
    return filtered;
  },
  
  // Get filtered Environmental data
  getFilteredEnvironmental() {
    const filtered = this.filterByTimeframe(this.rawData.environmental, this.currentTimeframe);
    return filtered;
  },

  // Get filtered Energy data
  getFilteredEnergy() {
    const filtered = this.filterByTimeframe(this.rawData.energy, this.currentTimeframe);
    return filtered;
  },
  
  // Set timeframe and trigger update
  setTimeframe(timeframe) {
    if (['24h', '7d', '30d'].includes(timeframe)) {
      this.currentTimeframe = timeframe;
      const filteredData = {
        iaq: this.getFilteredIAQ(),
        occupancy: this.getFilteredOccupancy(),
        environmental: this.getFilteredEnvironmental(),
        energy: this.getFilteredEnergy()
      };
      this.notifyListeners();
    }
  },
  
  // Add data point (single add - will notify listeners)
  addDataPoint(type, payload) {
    if (!this.rawData[type]) {
      this.rawData[type] = [];
    }
    
    // Normalize timestamp
    const normalized = {
      ...payload,
      timestamp: payload.time || payload.timestamp || new Date().toISOString()
    };
    
    this.rawData[type].push(normalized);
    
    // Keep only last 30 days of data
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.rawData[type] = this.rawData[type].filter(item => {
      const itemTime = new Date(item.timestamp).getTime();
      return itemTime >= thirtyDaysAgo;
    });
    
    
    // Notify listeners for single adds
    this.notifyListeners();
  },
  
  // Bulk add data
  addBulkData(type, payloads) {
    if (!Array.isArray(payloads)) {
      return;
    }
    
    if (!this.rawData[type]) {
      this.rawData[type] = [];
    }
    
    const beforeCount = this.rawData[type].length;
    
    // Add all payloads without notifying
    payloads.forEach(payload => {
      const normalized = {
        ...payload,
        timestamp: payload.time || payload.timestamp || new Date().toISOString()
      };
      this.rawData[type].push(normalized);
    });
    
    // Keep only last 30 days of data
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.rawData[type] = this.rawData[type].filter(item => {
      const itemTime = new Date(item.timestamp).getTime();
      return itemTime >= thirtyDaysAgo;
    });
    
    const afterCount = this.rawData[type].length;
    
    // Notify listeners once at the end
    this.notifyListeners();
  },
  
  // Listeners for updates
  listeners: [],
  
  onUpdate(callback) {
    this.listeners.push(callback);
  },
  
  notifyListeners() {
    this.listeners.forEach((callback, index) => {
      try {
        callback(this.currentTimeframe, {
          iaq: this.getFilteredIAQ(),
          occupancy: this.getFilteredOccupancy(),
          environmental: this.getFilteredEnvironmental(),
          energy: this.getFilteredEnergy()
        });
      } catch (e) {
        // Silently handle listener errors in production
      }
    });
  },
  
  // Check if enough history exists
  hasEnoughHistory(type, timeframe) {
    const filtered = this.filterByTimeframe(this.rawData[type] || [], timeframe);
    // More lenient thresholds: require at least some data points
    // 24h: at least 12 hours of data (hourly)
    // 7d: at least 5 days of data (daily averages)
    // 30d: at least 20 days of data (daily averages)
    const requiredPoints = timeframe === '24h' ? 12 : timeframe === '7d' ? 5 : 20;
    return filtered.length >= requiredPoints;
  }
};
