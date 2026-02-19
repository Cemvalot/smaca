const SMACATrendCalculator = {
  // Calculate average for a data series
  calculateAverage(dataArray, field) {
    if (!dataArray || dataArray.length === 0) return null;
    
    const values = dataArray
      .map(item => {
        const value = item.payload?.object?.[field] || item[field];
        return typeof value === 'number' ? value : null;
      })
      .filter(v => v !== null);
    
    if (values.length === 0) return null;
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  },
  
  // Calculate trend percentage
  // trend% = (current_range_avg - previous_range_avg) / previous_range_avg * 100
  calculateTrend(currentData, previousData, field) {
    const currentAvg = this.calculateAverage(currentData, field);
    const previousAvg = this.calculateAverage(previousData, field);
    
    if (currentAvg === null || previousAvg === null || previousAvg === 0) {
      return null; // Insufficient data
    }
    
    const trend = ((currentAvg - previousAvg) / previousAvg) * 100;
    return {
      percentage: trend,
      direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat',
      currentAvg,
      previousAvg
    };
  },
  
  // Get previous range data (same duration, shifted back)
  getPreviousRange(dataArray, timeframe) {
    if (!dataArray || dataArray.length === 0) return [];
    
    const now = Date.now();
    const rangeMs = SMACAState.getTimeframeMs(timeframe);
    const previousRangeStart = now - (rangeMs * 2);
    const previousRangeEnd = now - rangeMs;
    
    return dataArray.filter(item => {
      const itemTime = new Date(item.time || item.timestamp).getTime();
      return itemTime >= previousRangeStart && itemTime < previousRangeEnd;
    });
  },
  
  // Calculate trend for a metric
  calculateMetricTrend(dataArray, field, timeframe) {
    const currentData = SMACAState.filterByTimeframe(dataArray, timeframe);
    const previousData = this.getPreviousRange(dataArray, timeframe);
    
    return this.calculateTrend(currentData, previousData, field);
  },
  
  // Format trend for display
  formatTrend(trend) {
    if (trend === null) {
      return { text: '—', class: 'trend-neutral' };
    }
    
    const sign = trend.percentage > 0 ? '+' : '';
    const text = `${sign}${trend.percentage.toFixed(1)}%`;
    
    let className = 'trend-neutral';
    if (Math.abs(trend.percentage) > 0.1) {
      className = trend.direction === 'up' ? 'trend-up' : 'trend-down';
    }
    
    return { text, class: className };
  }
};
