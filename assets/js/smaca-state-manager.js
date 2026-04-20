const SMACAState = {
  currentTimeframe: '24h', // '24h', '7d', '30d'
  rawData: {
    iaq: [],
    occupancy: [],
    environmental: [],
    energy: []
  },
  cacheVersion: 0,
  filteredCache: {},
  
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
    
    const parseUtcMs = (value) => {
      if (value === null || value === undefined) return NaN;
      if (typeof value === 'number') return value;
      const raw = String(value).trim();
      if (!raw) return NaN;
      // If timestamp has no timezone, treat as UTC.
      const hasTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(raw);
      const normalized = hasTz
        ? raw
        : raw.replace(' ', 'T') + 'Z';
      const ms = new Date(normalized).getTime();
      return Number.isFinite(ms) ? ms : NaN;
    };

    const now = Date.now();
    const cutoffTime = now - this.getTimeframeMs(timeframe);
    
    const filtered = dataArray.filter(item => {
      const itemTime = parseUtcMs(item.time || item.timestamp);
      return Number.isFinite(itemTime) && itemTime >= cutoffTime && itemTime <= now;
    }).sort((a, b) => {
      const timeA = parseUtcMs(a.time || a.timestamp);
      const timeB = parseUtcMs(b.time || b.timestamp);
      return timeA - timeB;
    });
    
    if (filtered.length > 0) {
    }
    
    return filtered;
  },

  invalidateFilteredCache() {
    this.cacheVersion += 1;
    this.filteredCache = {};
  },

  getFilteredByType(type) {
    const cacheKey = [type, this.currentTimeframe, this.cacheVersion].join('|');
    if (Object.prototype.hasOwnProperty.call(this.filteredCache, cacheKey)) {
      return this.filteredCache[cacheKey];
    }
    const source = Array.isArray(this.rawData[type]) ? this.rawData[type] : [];
    const filtered = this.filterByTimeframe(source, this.currentTimeframe);
    this.filteredCache[cacheKey] = filtered;
    return filtered;
  },
  
  // Get filtered IAQ data for current timeframe
  getFilteredIAQ() {
    return this.getFilteredByType('iaq');
  },
  
  // Get filtered Occupancy data
  getFilteredOccupancy() {
    return this.getFilteredByType('occupancy');
  },
  
  // Get filtered Environmental data
  getFilteredEnvironmental() {
    return this.getFilteredByType('environmental');
  },

  // Get filtered Energy data
  getFilteredEnergy() {
    return this.getFilteredByType('energy');
  },
  
  // Set timeframe and trigger update
  setTimeframe(timeframe) {
    if (['24h', '7d', '30d'].includes(timeframe)) {
      if (this.currentTimeframe === timeframe) return;
      this.currentTimeframe = timeframe;
      this.invalidateFilteredCache();
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
      const raw = item.timestamp;
      const hasTz = typeof raw === 'string' && (/[zZ]$|[+-]\d{2}:\d{2}$/.test(raw));
      const normalized = hasTz ? raw : (String(raw || '').trim().replace(' ', 'T') + 'Z');
      const itemTime = new Date(normalized).getTime();
      return Number.isFinite(itemTime) && itemTime >= thirtyDaysAgo;
    });
    this.invalidateFilteredCache();
    
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
      const raw = item.timestamp;
      const hasTz = typeof raw === 'string' && (/[zZ]$|[+-]\d{2}:\d{2}$/.test(raw));
      const normalized = hasTz ? raw : (String(raw || '').trim().replace(' ', 'T') + 'Z');
      const itemTime = new Date(normalized).getTime();
      return Number.isFinite(itemTime) && itemTime >= thirtyDaysAgo;
    });
    this.invalidateFilteredCache();
    
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
    const filteredPayload = {
      iaq: this.getFilteredIAQ(),
      occupancy: this.getFilteredOccupancy(),
      environmental: this.getFilteredEnvironmental(),
      energy: this.getFilteredEnergy()
    };
    this.listeners.forEach((callback, index) => {
      try {
        callback(this.currentTimeframe, filteredPayload);
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
