// SMACA CSV Export Utility
// Generic client-side export for available sensor measurements.

const SMACACSVExport = {
  CSV_DELIMITER: ';',

  EXCLUDED_FIELDS: new Set([
    'id',
    'raw_id',
    'raw_ids',
    'sensor_id',
    'sensor_uid',
    'sensorId',
    'sensorUid',
    'sensor_name',
    'sensorName',
    'device_type',
    'deviceType',
    'device_profile_name',
    'deviceProfileName',
    'last_seen_at',
    'lastSeenAt',
    'created_at',
    'updated_at',
    'battery',
    'battery_pct',
    'payload',
    'device_info',
    'meta',
    'metadata'
  ]),

  FIELD_ALIASES: {
    measured_at: 'timestamp',
    time: 'timestamp',
    siteName: 'site_name',
    sensor_location: 'sensor_location',
    sensorLocation: 'sensor_location',
    room_name: 'sensor_location',
    roomName: 'sensor_location',
    zone_name: 'sensor_location',
    zoneName: 'sensor_location',
    co2: 'co2_ppm',
    temperature: 'temperature_c',
    humidity: 'humidity_rh',
    pm2_5: 'pm2_5_ugm3',
    pm10: 'pm10_ugm3',
    tvoc: 'tvoc_index',
    total_in: 'people_total_in',
    total_out: 'people_total_out',
    period_in: 'people_in',
    period_out: 'people_out'
  },

  PRIORITY_FIELDS: [
    'timestamp',
    'site_name',
    'sensor_location',
    'temperature_c',
    'humidity_rh',
    'co2_ppm',
    'pm2_5_ugm3',
    'pm10_ugm3',
    'tvoc_index',
    'energy_kwh',
    'uv_index',
    'people_in',
    'people_out',
    'people_total_in',
    'people_total_out',
    'occupancy'
  ],

  LABELS: {
    timestamp: 'Measured At',
    site_name: 'Site Name',
    sensor_location: 'Sensor Location',
    temperature_c: 'Temperature (°C)',
    humidity_rh: 'Humidity (%)',
    co2_ppm: 'CO₂ (ppm)',
    pm2_5_ugm3: 'PM2.5 (μg/m3)',
    pm10_ugm3: 'PM10 (µg/m³)',
    tvoc_index: 'TVOC Index',
    energy_kwh: 'Energy (kWh)',
    uv_index: 'UV Index',
    people_in: 'People In',
    people_out: 'People Out',
    people_total_in: 'People Total In',
    people_total_out: 'People Total Out',
    occupancy: 'Occupancy'
  },

  CONTEXT_FIELDS: new Set([
    'timestamp',
    'site_name',
    'sensor_location'
  ]),

  isPrimitive(value) {
    return ['string', 'number', 'boolean'].includes(typeof value) || value === null;
  },

  hasValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  },

  normalizeKey(key) {
    if (!key) return '';
    return this.FIELD_ALIASES[key] || key;
  },

  isNumericValue(value) {
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'string') return false;
    const normalized = value.trim();
    if (!normalized) return false;
    const parsed = Number(normalized);
    return Number.isFinite(parsed);
  },

  normalizeDecimalString(value) {
    if (typeof value === 'number') return String(value);
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    // Keep dot as decimal separator for Excel numeric compatibility.
    if (/^-?\d+,\d+$/.test(trimmed)) return trimmed.replace(',', '.');
    return value;
  },

  formatTimestamp(value) {
    if (!this.hasValue(value)) return value;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 19).replace('T', ' ');
    }
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(trimmed)) {
      return trimmed.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '');
    }
    return value;
  },

  shouldExcludeField(key, value) {
    if (!key) return true;
    if (this.EXCLUDED_FIELDS.has(key)) return true;
    return false;
  },

  // Flatten known row structures into a generic, metric-focused object.
  flattenRow(item) {
    const flat = {};
    if (!item || typeof item !== 'object') return flat;

    const timestamp = item.measured_at || item.time || item.timestamp || null;
    if (this.hasValue(timestamp)) flat.timestamp = timestamp;

    const siteName = item.site_name || item.siteName || null;
    if (this.hasValue(siteName)) flat.site_name = siteName;

    const sensorLocation = item.sensor_location || item.sensorLocation || item.location || item.room_name || item.roomName || item.zone_name || item.zoneName || null;
    if (this.hasValue(sensorLocation)) flat.sensor_location = sensorLocation;

    Object.keys(item).forEach((key) => {
      const value = item[key];
      if (!this.isPrimitive(value)) return;
      const normalizedKey = this.normalizeKey(key);
      if (normalizedKey === 'timestamp') return;
      if (this.shouldExcludeField(normalizedKey, value)) return;
      flat[normalizedKey] = value;
    });

    const payloadObject = item.payload?.object;
    if (payloadObject && typeof payloadObject === 'object') {
      Object.keys(payloadObject).forEach((key) => {
        const value = payloadObject[key];
        if (!this.isPrimitive(value)) return;
        const normalizedKey = this.normalizeKey(key);
        if (this.shouldExcludeField(normalizedKey, value)) return;
        flat[normalizedKey] = value;
      });
    }

    return flat;
  },

  getActiveColumns(flatRows) {
    const stats = new Map();

    flatRows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!stats.has(key)) {
          stats.set(key, { hasValue: false, hasNumeric: false });
        }
        const current = stats.get(key);
        const value = row[key];
        if (this.hasValue(value)) current.hasValue = true;
        if (this.isNumericValue(value)) current.hasNumeric = true;
      });
    });

    const available = Array.from(stats.keys()).filter((key) => {
      const fieldStats = stats.get(key);
      if (!fieldStats?.hasValue) return false;
      if (this.CONTEXT_FIELDS.has(key)) return true;
      return fieldStats.hasNumeric;
    });
    const prioritized = this.PRIORITY_FIELDS.filter((key) => available.includes(key));
    const dynamic = available
      .filter((key) => !prioritized.includes(key))
      .sort((a, b) => a.localeCompare(b));

    return prioritized.concat(dynamic);
  },

  toLabel(key) {
    if (this.LABELS[key]) return this.LABELS[key];
    const withSpaces = key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .trim();
    return withSpaces.replace(/\b\w/g, (s) => s.toUpperCase());
  },

  formatCell(value) {
    if (value === null || value === undefined) return '';
    const normalized = this.normalizeDecimalString(value);
    const text = String(normalized);
    if (
      text.includes(this.CSV_DELIMITER)
      || text.includes('"')
      || text.includes('\n')
      || text.includes('\r')
    ) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  },

  // Convert normalized rows to CSV string with user-friendly headers.
  arrayToCSV(data) {
    const exportData = this.buildExportData(data);
    if (!exportData) return '';
    const headerRow = exportData.columns.map((key) => this.toLabel(key)).join(this.CSV_DELIMITER);
    const rows = exportData.rows.map((row) => {
      return exportData.columns.map((key) => this.formatCell(row[key])).join(this.CSV_DELIMITER);
    });
    // CRLF improves compatibility with Windows Excel double-click open.
    return [headerRow].concat(rows).join('\r\n');
  },

  buildExportData(data) {
    if (!Array.isArray(data) || data.length === 0) return null;
    const flatRows = data.map((item) => this.flattenRow(item));
    const columns = this.getActiveColumns(flatRows);
    if (columns.length === 0) return null;

    const rows = flatRows.map((row) => {
      const normalized = {};
      columns.forEach((key) => {
        const rawValue = row[key];
        if (key === 'timestamp') {
          normalized[key] = this.formatTimestamp(rawValue);
          return;
        }
        normalized[key] = this.normalizeDecimalString(rawValue);
      });
      return normalized;
    });

    return { columns, rows };
  },

  parseTimestamp(value) {
    if (!this.hasValue(value)) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const formatted = this.formatTimestamp(value);
    if (typeof formatted !== 'string') return null;
    const isoLike = formatted.replace(' ', 'T');
    const parsed = new Date(isoLike);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  },

  buildFileTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate())
    ].join('-') + '-' + [pad(now.getHours()), pad(now.getMinutes())].join('-');
  },

  downloadCSV(csvContent, filename) {
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
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

  async downloadExcel(exportData, filename) {
    const ExcelJS = window.ExcelJS;
    if (!ExcelJS || typeof ExcelJS.Workbook !== 'function') {
      throw new Error('Excel export library is not available');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SMACA';
    workbook.created = new Date();
    workbook.subject = 'SMACA Sensor Measurements Export';

    const worksheet = workbook.addWorksheet('Measurements');
    const headers = exportData.columns.map((key) => this.toLabel(key));
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };

    exportData.rows.forEach((row) => {
      const values = exportData.columns.map((key) => {
        if (key === 'timestamp') {
          return this.parseTimestamp(row[key]) || row[key] || '';
        }
        return row[key] ?? '';
      });
      worksheet.addRow(values);
    });

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: exportData.columns.length }
    };

    exportData.columns.forEach((key, index) => {
      const column = worksheet.getColumn(index + 1);
      let maxLength = this.toLabel(key).length;
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber === 1) return;
        const raw = cell.value instanceof Date ? this.formatTimestamp(cell.value) : String(cell.value ?? '');
        maxLength = Math.max(maxLength, raw.length);
      });
      column.width = Math.min(Math.max(maxLength + 2, 12), 45);
      if (key === 'timestamp') {
        column.numFmt = 'yyyy-mm-dd hh:mm:ss';
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

  // Generic export entrypoint.
  async exportSensorData(filteredData, timeframe, format) {
    if (!Array.isArray(filteredData) || filteredData.length === 0) {
      alert('No sensor data available for export');
      return;
    }

    const exportData = this.buildExportData(filteredData);
    if (!exportData) {
      alert('No measurable sensor fields available for export');
      return;
    }

    const preferredFormat = (format || 'xlsx').toLowerCase();
    const timestamp = this.buildFileTimestamp();
    const csvFilename = `smaca-sensor-measurements-${timestamp}.csv`;
    const xlsxFilename = `smaca-sensor-measurements-${timestamp}.xlsx`;

    if (preferredFormat === 'csv') {
      const csv = this.arrayToCSV(filteredData);
      this.downloadCSV(csv, csvFilename);
      return;
    }

    try {
      await this.downloadExcel(exportData, xlsxFilename);
    } catch (error) {
      console.error('Excel export failed, falling back to CSV:', error);
      const csv = this.arrayToCSV(filteredData);
      this.downloadCSV(csv, csvFilename);
      alert('Excel export is not available right now. Downloaded CSV fallback.');
    }
  },

  // Backward-compatible alias.
  async exportIAQData(filteredData, timeframe) {
    await this.exportSensorData(filteredData, timeframe, 'xlsx');
  }
};
