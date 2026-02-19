// SMACA CSV Export Utility
// Client-side CSV export for filtered IAQ data

const SMACACSVExport = {
  // Convert array to CSV string
  arrayToCSV(data) {
    if (!data || data.length === 0) return '';
    
    // Get headers from first object
    const headers = this.getHeaders(data[0]);
    
    // Build CSV rows
    const rows = [headers.join(',')];
    
    data.forEach(item => {
      const row = headers.map(header => {
        const value = this.getNestedValue(item, header);
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value !== null && value !== undefined ? value : '';
      });
      rows.push(row.join(','));
    });
    
    return rows.join('\n');
  },
  
  // Get headers from nested object structure
  getHeaders(item) {
    const headers = ['timestamp'];
    
    if (item.payload?.object) {
      const obj = item.payload.object;
      if (obj.co2 !== undefined) headers.push('co2_ppm');
      if (obj.temperature !== undefined) headers.push('temperature_c');
      if (obj.humidity !== undefined) headers.push('humidity_percent');
      if (obj.pm2_5 !== undefined) headers.push('pm2_5_ug_m3');
      if (obj.pm10 !== undefined) headers.push('pm10_ug_m3');
      if (obj.tvoc !== undefined) headers.push('tvoc_raw');
    }
    
    return headers;
  },
  
  // Get nested value from object
  getNestedValue(item, path) {
    if (path === 'timestamp') {
      return item.time || item.timestamp || '';
    }
    
    const pathMap = {
      'co2_ppm': () => item.payload?.object?.co2,
      'temperature_c': () => item.payload?.object?.temperature,
      'humidity_percent': () => item.payload?.object?.humidity,
      'pm2_5_ug_m3': () => item.payload?.object?.pm2_5,
      'pm10_ug_m3': () => item.payload?.object?.pm10,
      'tvoc_raw': () => item.payload?.object?.tvoc
    };
    
    const getter = pathMap[path];
    return getter ? getter() : null;
  },
  
  // Download CSV file
  downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  },
  
  // Export filtered IAQ data
  exportIAQData(filteredData, timeframe) {
    if (!filteredData || filteredData.length === 0) {
      alert('No data available for export');
      return;
    }
    
    const csv = this.arrayToCSV(filteredData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `smaca-iaq-${timeframe}-${timestamp}.csv`;
    
    this.downloadCSV(csv, filename);
  }
};
