/**
 * WiFi connectivity quality classifier (CONNECTIVITY-1) — client mirror of PHP bands.
 */
(function (global) {
  'use strict';

  var BANDS = {
    excellent: { rank: 0, severity: 'good' },
    very_good: { rank: 1, severity: 'good' },
    good_usable: { rank: 2, severity: 'normal' },
    weak_unstable: { rank: 3, severity: 'warning' },
    bad: { rank: 4, severity: 'critical' }
  };

  var METRIC_ORDER = ['rssi', 'snr', 'tx_ccq', 'tx_rate'];

  var METRICS = {
    rssi: {
      unit: 'dBm',
      aliases: ['rssi', 'signal_strength'],
      thresholds: [
        { band: 'excellent', min: -60 },
        { band: 'very_good', min: -67, max: -61 },
        { band: 'good_usable', min: -75, max: -68 },
        { band: 'weak_unstable', min: -82, max: -76 },
        { band: 'bad', max: -83 }
      ]
    },
    snr: {
      unit: 'dB',
      aliases: ['snr', 'signal_to_noise'],
      thresholds: [
        { band: 'excellent', min: 35 },
        { band: 'very_good', min: 25, max: 34 },
        { band: 'good_usable', min: 20, max: 24 },
        { band: 'weak_unstable', min: 10, max: 19 },
        { band: 'bad', max: 9 }
      ]
    },
    tx_ccq: {
      unit: '%',
      aliases: ['tx_ccq'],
      thresholds: [
        { band: 'excellent', min: 90 },
        { band: 'very_good', min: 80, max: 89 },
        { band: 'good_usable', min: 65, max: 79 },
        { band: 'weak_unstable', min: 40, max: 64 },
        { band: 'bad', max: 39 }
      ]
    },
    tx_rate: {
      unit: 'Mbps',
      aliases: ['tx_rate'],
      thresholds: [
        { band: 'excellent', min: 300 },
        { band: 'very_good', min: 150, max: 299 },
        { band: 'good_usable', min: 72, max: 149 },
        { band: 'weak_unstable', min: 24, max: 71 },
        { band: 'bad', max: 23 }
      ]
    }
  };

  var TIMESERIES_METRIC = {
    rssi: 'signal_strength',
    snr: 'snr',
    tx_ccq: 'tx_ccq',
    tx_rate: 'tx_rate'
  };

  function t(key, fallback) {
    var map = global.SMACA_TRANSLATIONS || {};
    return map[key] || fallback;
  }

  function toNum(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function bandLabel(bandKey) {
    return t('connectivity_band_' + bandKey, bandKey.replace(/_/g, ' '));
  }

  function metricLabel(metricKey) {
    var keys = {
      rssi: 'connectivity_signal_strength',
      snr: 'connectivity_signal_to_noise',
      tx_ccq: 'connectivity_client_connection_quality',
      tx_rate: 'connectivity_transmission_rate'
    };
    return t(keys[metricKey] || metricKey, metricKey);
  }

  function resolveBandKey(value, thresholds) {
    for (var i = 0; i < thresholds.length; i++) {
      var rule = thresholds[i];
      var minOk = rule.min === undefined || value >= rule.min;
      var maxOk = rule.max === undefined || value <= rule.max;
      if (minOk && maxOk) return rule.band;
    }
    return 'bad';
  }

  function pickMetricValue(row, metricKey) {
    if (!row) return null;
    var cfg = METRICS[metricKey];
    if (!cfg) return null;
    var keys = [metricKey].concat(cfg.aliases || []);
    for (var i = 0; i < keys.length; i++) {
      var n = toNum(row[keys[i]]);
      if (n !== null) return n;
    }
    return null;
  }

  function classifyMetric(metricKey, value) {
    var n = toNum(value);
    if (n === null) return null;
    var cfg = METRICS[metricKey];
    if (!cfg) return null;
    var bandKey = resolveBandKey(n, cfg.thresholds);
    var band = BANDS[bandKey] || BANDS.bad;
    return {
      metric_key: metricKey,
      value: metricKey === 'tx_rate' ? Math.round(n * 10) / 10 : Math.round(n),
      unit: cfg.unit,
      band_key: bandKey,
      band_rank: band.rank,
      label: bandLabel(bandKey),
      severity: band.severity
    };
  }

  function medianRank(ranks) {
    if (!ranks.length) return null;
    var sorted = ranks.slice().sort(function (a, b) { return a - b; });
    return sorted[Math.floor(sorted.length / 2)];
  }

  function rankToBand(rank) {
    var keys = ['excellent', 'very_good', 'good_usable', 'weak_unstable', 'bad'];
    return keys[Math.min(4, Math.max(0, rank))] || 'bad';
  }

  var BAND_SHORT = {
    excellent: 'Excellent',
    very_good: 'Very good',
    good_usable: 'Good',
    weak_unstable: 'Weak',
    bad: 'Bad'
  };

  var LIMIT_SUFFIX = {
    tx_rate: 'TX limited',
    tx_ccq: 'CCQ limited',
    rssi: 'RSSI weak',
    snr: 'SNR weak'
  };

  function compactQualityLabel(overall) {
    if (!overall || !overall.dominant_band) {
      return (overall && overall.overall_label) ? overall.overall_label : '—';
    }
    var dom = t('connectivity_band_short_' + overall.dominant_band, BAND_SHORT[overall.dominant_band] || overall.dominant_band);
    var limKey = overall.limiting_metric_key;
    if (!limKey || !overall.metrics || !overall.metrics[limKey]) return dom;
    var limCls = overall.metrics[limKey];
    var domRank = (BANDS[overall.dominant_band] || BANDS.bad).rank;
    if (limCls.band_rank <= domRank) return dom;
    if (limCls.band_rank - domRank < 2 && limCls.band_rank < 3) return dom;
    var suffix = LIMIT_SUFFIX[limKey];
    if (!suffix && (limCls.band_key === 'weak_unstable' || limCls.band_key === 'bad')) {
      suffix = t('connectivity_quality_unstable', 'unstable');
    }
    if (!suffix) suffix = (limKey === 'tx_rate' ? 'TX' : limKey.toUpperCase()) + ' limited';
    return dom + ' / ' + suffix;
  }

  function classifyOverall(metrics) {
    var classifications = {};
    var ranks = [];
    var worstRank = -1;
    var worstBand = null;
    var limitingKey = null;
    var limitingCls = null;

    for (var i = 0; i < METRIC_ORDER.length; i++) {
      var key = METRIC_ORDER[i];
      var raw = metrics[key];
      if (raw === null || raw === undefined) continue;
      var cls = classifyMetric(key, raw);
      if (!cls) continue;
      classifications[key] = cls;
      ranks.push(cls.band_rank);
      if (cls.band_rank > worstRank) {
        worstRank = cls.band_rank;
        worstBand = cls.band_key;
        limitingKey = key;
        limitingCls = cls;
      }
    }

    if (!worstBand || !ranks.length) {
      return {
        overall_band: null,
        overall_label: null,
        overall_severity: 'insufficient_data',
        dominant_band: null,
        dominant_label: null,
        composite_label: null,
        limiting_metric: null,
        limiting_metric_key: null,
        limiting_metric_value: null,
        metrics: {}
      };
    }

    var medRank = medianRank(ranks);
    var dominantBand = rankToBand(medRank !== null ? medRank : worstRank);
    var gap = worstRank - (medRank !== null ? medRank : worstRank);
    var useComposite = gap >= 2 && limitingKey;
    var interim = {
      overall_band: worstBand,
      dominant_band: dominantBand,
      limiting_metric_key: limitingKey,
      metrics: classifications
    };
    var displayLabel = compactQualityLabel(interim);
    var displayBand = useComposite ? dominantBand : worstBand;
    var displaySev = (BANDS[displayBand] || BANDS.bad).severity;
    if (!useComposite && worstRank >= 3) {
      displaySev = (BANDS[worstBand] || BANDS.bad).severity;
    }

    return {
      overall_band: worstBand,
      overall_label: displayLabel,
      overall_severity: displaySev,
      dominant_band: dominantBand,
      dominant_label: bandLabel(dominantBand),
      composite_label: useComposite ? displayLabel : null,
      compact_label: displayLabel,
      limiting_metric: metricLabel(limitingKey),
      limiting_metric_key: limitingKey,
      limiting_metric_value: limitingCls ? limitingCls.value : null,
      limiting_metric_unit: limitingCls ? limitingCls.unit : null,
      metrics: classifications
    };
  }

  function healthBandCounts(devices) {
    var counts = { excellent: 0, very_good: 0, good_usable: 0, weak_unstable: 0, bad: 0 };
    (devices || []).forEach(function (d) {
      var o = d.overall || {};
      var b = o.dominant_band || o.overall_band;
      if (b && counts[b] !== undefined) counts[b] += 1;
    });
    return counts;
  }

  function extractMetricsFromLatest(latest) {
    var lat = latest || {};
    if (global.SMACA_TELEMETRY_METRIC_NORMALIZE && typeof global.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest === 'function') {
      lat = global.SMACA_TELEMETRY_METRIC_NORMALIZE.normalizeLatest(lat);
    }
    return {
      rssi: pickMetricValue(lat, 'rssi'),
      snr: pickMetricValue(lat, 'snr'),
      tx_ccq: pickMetricValue(lat, 'tx_ccq'),
      tx_rate: pickMetricValue(lat, 'tx_rate')
    };
  }

  function hasConnectivityMetrics(latest) {
    var m = extractMetricsFromLatest(latest);
    return m.rssi !== null || m.snr !== null || m.tx_ccq !== null || m.tx_rate !== null;
  }

  /** Plot band regions for Highcharts (yAxis plotBands). */
  function plotBandsForMetric(metricKey) {
    var cfg = METRICS[metricKey];
    if (!cfg) return [];
    var colors = {
      excellent: 'rgba(34, 197, 94, 0.12)',
      very_good: 'rgba(34, 197, 94, 0.08)',
      good_usable: 'rgba(234, 179, 8, 0.1)',
      weak_unstable: 'rgba(249, 115, 22, 0.12)',
      bad: 'rgba(239, 68, 68, 0.12)'
    };
    return cfg.thresholds.map(function (rule) {
      var from = rule.min !== undefined ? rule.min : -200;
      var to = rule.max !== undefined ? rule.max : 10000;
      if (metricKey === 'rssi') {
        if (rule.band === 'bad' && rule.max !== undefined) to = rule.max;
        if (rule.band === 'excellent' && rule.min !== undefined) from = rule.min;
      }
      return {
        from: from,
        to: to,
        color: colors[rule.band] || 'rgba(148, 163, 184, 0.08)',
        label: { text: bandLabel(rule.band), style: { fontSize: '9px', color: '#94a3b8' } }
      };
    });
  }

  function timeseriesMetricKey(metricKey) {
    return TIMESERIES_METRIC[metricKey] || metricKey;
  }

  var HEALTH_RING_COLORS = {
    excellent: '#22d3ee',
    very_good: '#34d399',
    good_usable: '#fbbf24',
    weak_unstable: '#fb923c',
    bad: '#f87171'
  };

  global.SMACA_CONNECTIVITY_QUALITY = {
    BANDS: BANDS,
    METRICS: METRICS,
    METRIC_ORDER: METRIC_ORDER,
    HEALTH_RING_COLORS: HEALTH_RING_COLORS,
    classifyMetric: classifyMetric,
    classifyOverall: classifyOverall,
    compactQualityLabel: compactQualityLabel,
    healthBandCounts: healthBandCounts,
    extractMetricsFromLatest: extractMetricsFromLatest,
    hasConnectivityMetrics: hasConnectivityMetrics,
    pickMetricValue: pickMetricValue,
    bandLabel: bandLabel,
    metricLabel: metricLabel,
    plotBandsForMetric: plotBandsForMetric,
    timeseriesMetricKey: timeseriesMetricKey
  };
})(typeof window !== 'undefined' ? window : this);
