;(function () {
  const DEFAULT_CHART_OPTIONS = {
    chart: {
      animation: false,
      backgroundColor: 'transparent'
    },
    title: { text: null },
    credits: { enabled: false },
    accessibility: { enabled: false }
  };

  function hasHighcharts() {
    return typeof window !== 'undefined' && typeof window.Highcharts !== 'undefined';
  }

  function ensureAccessibilityDisabled() {
    if (!hasHighcharts() || typeof window.Highcharts.setOptions !== 'function') return;
    window.Highcharts.setOptions({
      accessibility: {
        enabled: false
      }
    });
  }

  function ensureChartStore() {
    if (typeof window === 'undefined') return null;
    if (!window.__smacaHighchartsStore) {
      window.__smacaHighchartsStore = {
        charts: {}
      };
    }
    return window.__smacaHighchartsStore;
  }

  function mergeOptions(baseOptions, overrideOptions) {
    if (!hasHighcharts()) {
      return overrideOptions || baseOptions || {};
    }
    return window.Highcharts.merge(baseOptions || {}, overrideOptions || {});
  }

  function getChartByKey(chartKey) {
    const store = ensureChartStore();
    if (!store || !store.charts) return null;
    return store.charts[chartKey] || null;
  }

  function destroyChart(chartKey) {
    const store = ensureChartStore();
    if (!store || !store.charts || !store.charts[chartKey]) return false;
    try {
      store.charts[chartKey].destroy();
    } catch (err) {
      // No-op: destroy best effort.
    }
    delete store.charts[chartKey];
    return true;
  }

  function destroyAllCharts() {
    const store = ensureChartStore();
    if (!store || !store.charts) return;
    Object.keys(store.charts).forEach(function (chartKey) {
      destroyChart(chartKey);
    });
  }

  function createOrUpdateChart(params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    ensureAccessibilityDisabled();
    const chartKey = String(params?.chartKey || '').trim();
    if (!chartKey) return { ok: false, reason: 'missing-chart-key' };
    const containerId = String(params?.containerId || '').trim();
    if (!containerId) return { ok: false, reason: 'missing-container-id' };
    const container = document.getElementById(containerId);
    if (!container) return { ok: false, reason: 'missing-container' };
    const store = ensureChartStore();
    if (!store) return { ok: false, reason: 'missing-window' };

    const options = mergeOptions(DEFAULT_CHART_OPTIONS, params.options || {});
    const existingChart = getChartByKey(chartKey);
    const needsRecreate = !!(existingChart && existingChart.renderTo && existingChart.renderTo !== container);
    const isFirstRender = !existingChart || needsRecreate;
    if (needsRecreate) {
      try { existingChart.destroy(); } catch (e) {}
      delete store.charts[chartKey];
    }

    if (isFirstRender) {
      store.charts[chartKey] = window.Highcharts.chart(container, options);
    } else {
      existingChart.update(options, true, false, false);
    }

    // Ensure charts recover correctly when containers were hidden/resized.
    const chart = store.charts[chartKey];
    if (chart && typeof chart.reflow === 'function') {
      setTimeout(function () {
        try { chart.reflow(); } catch (e) {}
      }, 0);
    }

    return { ok: true, initialized: isFirstRender, chartKey: chartKey, recreated: needsRecreate };
  }

  function getIaqMetricUiConfig(metric) {
    // Prefer shared IAQ UI config if the accurate IAQ dashboard exported it.
    const shared = typeof window !== 'undefined' ? window.__SMACA_IaqMetricConfig : null;
    if (shared && shared[metric]) return shared[metric];

    const map = {
      co2: { label: 'CO₂', unit: 'ppm', decimals: 0, color: '#3b82f6' },
      temperature: { label: 'Temperature', unit: '°C', decimals: 1, color: '#06b6d4' },
      humidity: { label: 'Humidity', unit: '%', decimals: 0, color: '#6366f1' },
      pm2_5: { label: 'PM2.5', unit: 'μg/m3', decimals: 1, color: '#f59e0b' },
      pm10: { label: 'PM10', unit: 'µg/m³', decimals: 1, color: '#f97316' },
      tvoc: { label: 'TVOC', unit: '(raw)', decimals: 1, color: '#ec4899' }
    };
    return map[metric] || map.co2;
  }

  function getIaqMetricPlotBands(metric, yMin, yMax) {
    // Prefer shared threshold bands from the IAQ dashboard if available.
    const sharedBands = typeof window !== 'undefined' ? window.__SMACA_IaqThresholdBandsByMetric : null;
    const bandsForMetric = sharedBands && sharedBands[metric] ? sharedBands[metric] : null;
    if (bandsForMetric && Array.isArray(bandsForMetric) && bandsForMetric.length) {
      return bandsForMetric
        .map(function (band) {
          const from = Math.max(yMin, Number(band.min));
          const rawTo = Number(band.max);
          const to = Number.isFinite(rawTo) ? Math.min(yMax, rawTo) : yMax;
          if (to <= from) return null;
          return { from: from, to: to, color: band.color };
        })
        .filter(Boolean);
    }

    const softBandA = 'rgba(148, 163, 184, 0.08)';
    const softBandB = 'rgba(148, 163, 184, 0.05)';
    const softBandC = 'rgba(148, 163, 184, 0.035)';
    const ranges = {
      co2: [[400, 800, softBandA], [800, 1000, softBandB], [1000, Number.POSITIVE_INFINITY, softBandC]],
      pm2_5: [[0, 12, softBandA], [12, 35, softBandB], [35, Number.POSITIVE_INFINITY, softBandC]],
      pm10: [[0, 20, softBandA], [20, 50, softBandB], [50, Number.POSITIVE_INFINITY, softBandC]],
      temperature: [[21, 25, softBandA]],
      humidity: [[40, 60, softBandA]],
      tvoc: []
    };
    return (ranges[metric] || []).map(function (item) {
      const from = Math.max(yMin, Number(item[0]));
      const rawTo = Number(item[1]);
      const to = Number.isFinite(rawTo) ? Math.min(yMax, rawTo) : yMax;
      if (to <= from) return null;
      return { from: from, to: to, color: item[2] };
    }).filter(Boolean);
  }

  function hexToRgb(color) {
    const value = String(color || '').trim().replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(value)) return { r: 59, g: 130, b: 246 };
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function toRgba(color, alpha) {
    const rgb = hexToRgb(color);
    const a = Number.isFinite(Number(alpha)) ? Number(alpha) : 1;
    return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + a + ')';
  }

  function getIaqBandColorByMetric(metric, bandIndex) {
    const palettes = {
      co2: ['rgba(16, 185, 129, 0.10)', 'rgba(245, 158, 11, 0.10)', 'rgba(239, 68, 68, 0.10)'],
      // PM bands use WHO-style thresholds: low/medium/high, but keep very subtle opacity.
      pm2_5: ['rgba(22, 163, 74, 0.05)', 'rgba(234, 179, 8, 0.05)', 'rgba(239, 68, 68, 0.05)'],
      pm10: ['rgba(22, 163, 74, 0.05)', 'rgba(234, 179, 8, 0.05)', 'rgba(239, 68, 68, 0.05)'],
      // Temperature/humidity handled explicitly in buildMetricPlotBands for better semantic zones.
      temperature: ['rgba(22, 163, 74, 0.05)'],
      humidity: ['rgba(22, 163, 74, 0.05)'],
      tvoc: ['rgba(236, 72, 153, 0.08)', 'rgba(244, 114, 182, 0.06)', 'rgba(244, 114, 182, 0.04)']
    };
    const items = palettes[metric] || [];
    return items[bandIndex] || 'rgba(148, 163, 184, 0.08)';
  }

  function buildMetricPlotBands(metric, yMin, yMax) {
    // Semantic comfort / warning zones for metrics where "good vs bad" isn't symmetric.
    if (metric === 'temperature') {
      const comfortLow = 21;
      const comfortHigh = 24;
      return [
        { from: yMin, to: Math.min(yMax, comfortLow), color: 'rgba(56, 189, 248, 0.05)' }, // cool (blue)
        { from: Math.max(yMin, comfortLow), to: Math.min(yMax, comfortHigh), color: 'rgba(22, 163, 74, 0.05)' }, // comfort (green)
        { from: Math.max(yMin, comfortHigh), to: yMax, color: 'rgba(249, 115, 22, 0.05)' } // warm (orange)
      ].filter(function (band) { return band.to > band.from; });
    }
    if (metric === 'humidity') {
      const idealLow = 40;
      const idealHigh = 60;
      return [
        { from: yMin, to: Math.min(yMax, idealLow), color: 'rgba(234, 179, 8, 0.05)' }, // too dry (warn)
        { from: Math.max(yMin, idealLow), to: Math.min(yMax, idealHigh), color: 'rgba(22, 163, 74, 0.05)' }, // ideal (green)
        { from: Math.max(yMin, idealHigh), to: yMax, color: 'rgba(239, 68, 68, 0.05)' } // too humid (warn)
      ].filter(function (band) { return band.to > band.from; });
    }

    const rawBands = getIaqMetricPlotBands(metric, yMin, yMax);
    return rawBands.map(function (band, index) {
      return {
        from: band.from,
        to: band.to,
        color: getIaqBandColorByMetric(metric, index)
      };
    });
  }

  function createIaqTrendHighchartOptions(params) {
    const cfg = getIaqMetricUiConfig(params.metric);
    const isCo2 = params.metric === 'co2';
    const plotBands = buildMetricPlotBands(params.metric, params.yDomain.min, params.yDomain.max);
    const co2PlotBands = isCo2
      ? [
          { from: Math.max(params.yDomain.min, 400), to: Math.min(params.yDomain.max, 800), color: 'rgba(22, 163, 74, 0.05)' },
          { from: Math.max(params.yDomain.min, 800), to: Math.min(params.yDomain.max, 1000), color: 'rgba(234, 179, 8, 0.05)' },
          { from: Math.max(params.yDomain.min, 1000), to: params.yDomain.max, color: 'rgba(239, 68, 68, 0.05)' }
        ].filter(function (band) { return band.to > band.from; })
      : [];
    const resolvedPlotBands = isCo2 ? co2PlotBands : plotBands;
    const co2LineColor = '#60a5fa';
    const seriesLineColor = isCo2 ? co2LineColor : cfg.color;
    const seriesLineWidth = isCo2 ? 3 : 2.35;
    const fillTopAlpha = isCo2 ? 0.22 : 0.12;
    const seriesData = Array.isArray(params.seriesData) ? params.seriesData : [];
    const latestPoint = seriesData.length ? seriesData[seriesData.length - 1] : null;
    const maxPoint = seriesData.length
      ? seriesData.reduce(function (currentMax, point) {
          if (!currentMax) return point;
          return Number(point[1]) > Number(currentMax[1]) ? point : currentMax;
        }, null)
      : null;
    const hasDistinctMaxPoint = isCo2 && latestPoint && maxPoint && latestPoint[0] !== maxPoint[0];
    const highlightSeries = isCo2
      ? [
          latestPoint
            ? {
                type: 'scatter',
                name: 'Latest',
                data: [latestPoint],
                color: co2LineColor,
                marker: {
                  enabled: true,
                  radius: 3,
                  lineColor: '#0f172a',
                  lineWidth: 1.25,
                  fillColor: '#93c5fd'
                },
                enableMouseTracking: false,
                showInLegend: false,
                states: { hover: { enabled: false } }
              }
            : null,
          hasDistinctMaxPoint
            ? {
                type: 'scatter',
                name: 'Peak',
                data: [maxPoint],
                color: '#f59e0b',
                marker: {
                  enabled: true,
                  radius: 2.5,
                  lineColor: '#0f172a',
                  lineWidth: 1,
                  fillColor: '#fcd34d'
                },
                enableMouseTracking: false,
                showInLegend: false,
                states: { hover: { enabled: false } }
              }
            : null
        ].filter(Boolean)
      : [];
    return {
      chart: {
        type: 'areaspline',
        animation: false,
        spacingTop: 16,
        spacingRight: 12,
        spacingBottom: 16,
        spacingLeft: 8,
        backgroundColor: 'transparent'
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      time: { useUTC: false },
      xAxis: {
        type: 'datetime',
        lineColor: 'rgba(148, 163, 184, 0.28)',
        tickColor: 'rgba(148, 163, 184, 0.22)',
        tickLength: 4,
        tickPixelInterval: params.timeframe === '24h' ? 84 : 120,
        labels: {
          style: {
            color: '#94a3b8',
            fontSize: '10px',
            textOutline: 'none'
          },
          autoRotation: [-20, -35],
          autoRotationLimit: 80,
          formatter: function () {
            if (params.timeframe === '24h') return window.Highcharts.dateFormat('%H:%M', this.value);
            if (params.timeframe === '7d') return window.Highcharts.dateFormat('%d %b', this.value);
            return window.Highcharts.dateFormat('%d %b', this.value);
          }
        }
      },
      yAxis: {
        title: {
          text: cfg.unit,
          style: {
            color: '#7c8ca2',
            fontSize: '10px',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }
        },
        min: params.yDomain.min,
        max: params.yDomain.max,
        tickAmount: 5,
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        gridLineWidth: 1,
        labels: {
          style: {
            color: '#a7b4c5',
            fontSize: '10px',
            textOutline: 'none'
          },
          x: -4,
          formatter: function () {
            return cfg.decimals > 0 ? Number(this.value).toFixed(cfg.decimals) : String(Math.round(this.value));
          }
        },
        plotBands: resolvedPlotBands
      },
      tooltip: {
        shared: false,
        outside: false,
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: {
          color: '#e2e8f0',
          fontSize: '11px'
        },
        formatter: function () {
          const value = Number(this.y);
          const valueText = Number.isFinite(value)
            ? value.toFixed(cfg.decimals)
            : 'N/A';
          return (
            '<div style="min-width:140px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' +
            (params.timeframe === '24h'
              ? window.Highcharts.dateFormat('%H:%M', this.x)
              : window.Highcharts.dateFormat('%d %b', this.x)) +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:' + cfg.color + ';box-shadow:0 0 0 2px ' + toRgba(cfg.color, 0.16) + ';"></span>' +
            '<span style="font-weight:500;">' + cfg.label + '</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + valueText + ' ' + cfg.unit + '</strong>' +
            '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: {
          animation: false,
          lineWidth: seriesLineWidth,
          marker: { enabled: false },
          states: { hover: { lineWidthPlus: 0.35 } },
          turboThreshold: 0
        },
        areaspline: {
          fillOpacity: 1
        }
      },
      responsive: {
        rules: [{
          condition: { maxWidth: 720 },
          chartOptions: {
            xAxis: { labels: { style: { fontSize: '9px' } } },
            yAxis: { labels: { style: { fontSize: '9px' } } }
          }
        }]
      },
      series: [{
        type: 'areaspline',
        name: cfg.label,
        color: seriesLineColor,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, toRgba(seriesLineColor, fillTopAlpha)],
            [1, toRgba(seriesLineColor, 0)]
          ]
        },
        data: params.seriesData
      }].concat(highlightSeries)
    };
  }

  function ensureIaqChartStore() {
    const rootStore = ensureChartStore();
    if (!rootStore) return null;
    if (!rootStore.iaqTrendMeta) {
      rootStore.iaqTrendMeta = {
        lastMetric: null,
        lastTimeframe: null
      };
    }
    return rootStore.iaqTrendMeta;
  }

  function destroyIaqTrendHighchart() {
    destroyChart('iaq-trend-main');
  }

  function hasHeatmapModule() {
    return hasHighcharts()
      && window.Highcharts
      && window.Highcharts.seriesTypes
      && typeof window.Highcharts.seriesTypes.heatmap !== 'undefined';
  }

  function createOrUpdateIaqCo2HourlyHeatmap(containerId, params) {
    if (!hasHeatmapModule()) return { ok: false, reason: 'missing-heatmap-module' };
    const container = document.getElementById(containerId);
    if (!container) return { ok: false, reason: 'missing-container' };
    const timeframe = params?.timeframe || '24h';
    const categories = Array.isArray(params?.categories) && params.categories.length
      ? params.categories
      : Array.from({ length: 24 }).map(function (_, i) { return String(i).padStart(2, '0'); });
    const values = Array.isArray(params?.values) ? params.values : (Array.isArray(params?.hourlyValues) ? params.hourlyValues : []);
    const numericValues = values
      .map(function (v) { return Number(v); })
      .filter(function (v) { return Number.isFinite(v); });
    const maxValue = numericValues.length ? Math.max.apply(null, numericValues) : null;
    const worstHour = Number.isFinite(maxValue)
      ? values.findIndex(function (v) { return Number.isFinite(Number(v)) && Number(v) === maxValue; })
      : -1;

    const points = categories.map(function (_, hourIdx) {
      const v = Number(values[hourIdx]);
      const isWorst = hourIdx === worstHour && Number.isFinite(v);
      return {
        x: hourIdx,
        y: 0,
        value: Number.isFinite(v) ? v : null,
        borderColor: isWorst ? 'rgba(248, 250, 252, 0.55)' : 'rgba(148, 163, 184, 0.18)',
        borderWidth: isWorst ? 1.5 : 0.75
      };
    });

    const options = {
      chart: {
        type: 'heatmap',
        animation: false,
        backgroundColor: 'transparent',
        marginTop: 0,
        marginBottom: 10,
        spacingLeft: 8,
        spacingRight: 10,
        spacingTop: 2,
        spacingBottom: 6
      },
      title: { text: null },
      credits: { enabled: false },
      legend: {
        enabled: false
      },
      xAxis: {
        categories: categories,
        tickLength: 0,
        lineColor: 'rgba(148, 163, 184, 0.22)',
        labels: {
          style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' },
          y: 10
        }
      },
      yAxis: {
        categories: ['CO₂'],
        title: { text: null },
        labels: { enabled: false },
        gridLineWidth: 0
      },
      colorAxis: {
        min: 400,
        max: Math.max(1200, Number.isFinite(maxValue) ? maxValue : 1200),
        stops: [
          [0, '#16a34a'],
          [0.5, '#eab308'],
          [1, '#ef4444']
        ],
        visible: false,
        labels: { enabled: false }
      },
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const hour = categories[this.point.x] || '--';
          const value = Number(this.point.value);
          const text = Number.isFinite(value) ? value.toFixed(0) + ' ppm' : 'N/A';
          const context = timeframe === '24h'
            ? 'Last 24h'
            : (timeframe === '7d' ? 'Last 7d' : 'Last 30d');
          return (
            '<div style="min-width:140px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' +
            (timeframe === '24h' ? ('Bucket: ' + hour) : ('Hour: ' + hour + ':00')) +
            ' · ' + context +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#60a5fa;box-shadow:0 0 0 2px rgba(96,165,250,0.16);"></span>' +
            '<span style="font-weight:500;">CO₂ avg</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + text + '</strong>' +
            '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: {
          animation: false,
          states: { hover: { brightness: 0.05 } }
        }
      },
      series: [{
        type: 'heatmap',
        name: 'CO₂ (ppm)',
        borderRadius: 4,
        nullColor: 'rgba(148, 163, 184, 0.10)',
        data: points,
        dataLabels: {
          enabled: false
        }
      }]
    };

    return createOrUpdateChart({
      chartKey: 'iaq-co2-hourly-heatmap',
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateIaqTrendHighchart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const container = document.getElementById(containerId);
    if (!container) return { ok: false, reason: 'missing-container' };
    const store = ensureIaqChartStore();
    if (!store) return { ok: false, reason: 'missing-store' };
    const options = createIaqTrendHighchartOptions(params);
    const rendered = createOrUpdateChart({
      chartKey: 'iaq-trend-main',
      containerId: containerId,
      options: options
    });
    if (!rendered.ok) return rendered;
    const isFirstRender = !!rendered.initialized;

    if (isFirstRender) {
      console.info('Highcharts chart initialized', {
        metric: params.metric,
        timeframe: params.timeframe,
        pointCount: params.seriesData.length
      });
    } else {
      const reason = store.lastMetric !== params.metric
        ? 'metric change'
        : (store.lastTimeframe !== params.timeframe ? 'timeframe change' : 'data refresh');
      console.info(
        reason === 'metric change'
          ? 'Highcharts chart updated on metric change'
          : (reason === 'timeframe change'
            ? 'Highcharts chart updated on timeframe change'
            : 'Highcharts chart updated'),
        {
          metric: params.metric,
          timeframe: params.timeframe,
          pointCount: params.seriesData.length
        }
      );
    }

    store.lastMetric = params.metric;
    store.lastTimeframe = params.timeframe;
    return { ok: true, initialized: isFirstRender, chartKey: 'iaq-trend-main' };
  }

  function createOrUpdateOccupancyMainCombinedChart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const times = Array.isArray(params?.bucketTimesMs) ? params.bucketTimesMs : [];
    const inValues = Array.isArray(params?.peopleIn) ? params.peopleIn : [];
    const outValues = Array.isArray(params?.peopleOut) ? params.peopleOut : [];
    const timeframe = params?.timeframe || '24h';

    const inSeries = times.map(function (t, i) {
      const v = Number(inValues[i]);
      return [Number(t), Number.isFinite(v) ? v : null];
    });
    const outSeries = times.map(function (t, i) {
      const v = Number(outValues[i]);
      return [Number(t), Number.isFinite(v) ? v : null];
    });

    const netSeries = times.map(function (t, i) {
      const inV = Number(inValues[i]);
      const outV = Number(outValues[i]);
      const hasIn = Number.isFinite(inV);
      const hasOut = Number.isFinite(outV);
      if (!hasIn && !hasOut) return [Number(t), null];
      const net = (hasIn ? inV : 0) - (hasOut ? outV : 0);
      return [Number(t), Number.isFinite(net) ? net : null];
    });

    const numericIn = inValues.map(function (v) { return Number(v); }).filter(function (v) { return Number.isFinite(v); });
    const numericOut = outValues.map(function (v) { return Number(v); }).filter(function (v) { return Number.isFinite(v); });
    const numericNet = netSeries.map(function (p) { return Number(p?.[1]); }).filter(function (v) { return Number.isFinite(v); });
    const maxColumns = Math.max(1, numericIn.length ? Math.max.apply(null, numericIn) : 1, numericOut.length ? Math.max.apply(null, numericOut) : 1);
    const maxNetAbs = numericNet.length ? Math.max.apply(null, numericNet.map(function (v) { return Math.abs(v); })) : 0;
    const yPad = 0.1;
    const axisMax = Math.max(maxColumns, maxNetAbs) * (1 + yPad);
    const axisMin = -maxNetAbs * (1 + yPad);

    const options = {
      chart: {
        type: 'column',
        animation: false,
        backgroundColor: 'transparent',
        spacingTop: 26,
        spacingRight: 10,
        spacingBottom: 16,
        spacingLeft: 8
      },
      title: { text: null },
      credits: { enabled: false },
      legend: {
        enabled: true,
        align: 'left',
        verticalAlign: 'top',
        layout: 'horizontal',
        x: 0,
        y: 8,
        itemStyle: { color: '#94a3b8', fontSize: '11px' },
        itemHoverStyle: { color: '#e2e8f0' }
      },
      time: { useUTC: false },
      xAxis: {
        type: 'datetime',
        lineColor: 'rgba(148, 163, 184, 0.28)',
        tickColor: 'rgba(148, 163, 184, 0.22)',
        tickLength: 0,
        tickPixelInterval: timeframe === '24h' ? 84 : 120,
        labels: {
          style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' },
          autoRotation: [-20, -35],
          autoRotationLimit: 80,
          y: 12,
          formatter: function () {
            if (timeframe === '24h') return window.Highcharts.dateFormat('%H:%M', this.value);
            return window.Highcharts.dateFormat('%d %b', this.value);
          }
        }
      },
      yAxis: {
        title: {
          text: 'People',
          style: { color: '#7c8ca2', fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' }
        },
        min: axisMin,
        max: axisMax,
        tickAmount: 5,
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        gridLineWidth: 1,
        labels: { style: { color: '#a7b4c5', fontSize: '10px', textOutline: 'none' }, x: -4 }
      },
      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const header = timeframe === '24h'
            ? window.Highcharts.dateFormat('%H:%M', this.x)
            : window.Highcharts.dateFormat('%d %b', this.x);
          const rows = (this.points || []).map(function (p) {
            const name = p.series && p.series.name ? p.series.name : 'Series';
            const value = Number(p.y);
            let valueText = 'N/A';
            if (Number.isFinite(value)) {
              const rounded = Math.round(value);
              valueText = name === 'Net Flow' ? (rounded > 0 ? ('+' + rounded) : String(rounded)) : String(rounded);
            }
            const color = p.color || '#94a3b8';
            return (
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:6px;">' +
              '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
              '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:' + color + ';"></span>' +
              '<span style="font-weight:500;">' + name + '</span>' +
              '</span>' +
              '<strong style="color:#f8fbff;">' + valueText + ' ppl</strong>' +
              '</div>'
            );
          }).join('');
          return (
            '<div style="min-width:170px;">' +
            '<div style="margin-bottom:6px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' + header + '</div>' +
            rows +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: {
          animation: false,
          borderWidth: 0,
          states: { inactive: { opacity: 1 } }
        },
        column: {
          grouping: true,
          groupPadding: 0.12,
          pointPadding: 0.06,
          borderRadius: 3
        }
      },
      series: [{
        type: 'column',
        name: 'People In',
        color: 'rgba(16, 185, 129, 0.85)',
        data: inSeries
      }, {
        type: 'column',
        name: 'People Out',
        color: 'rgba(249, 115, 22, 0.85)',
        data: outSeries
      }, {
        type: 'spline',
        name: 'Net Flow',
        color: 'rgba(125, 211, 252, 0.98)',
        lineWidth: 3.2,
        marker: { enabled: false },
        data: netSeries,
        states: { hover: { lineWidthPlus: 0.25 } },
        tooltip: { valueSuffix: ' ppl' }
      }]
    };

    return createOrUpdateChart({
      chartKey: 'occupancy-main-combined',
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateOccupancyActivityTrend(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const times = Array.isArray(params?.bucketTimesMs) ? params.bucketTimesMs : [];
    const values = Array.isArray(params?.values)
      ? params.values
      : (Array.isArray(params?.presence) ? params.presence : (Array.isArray(params?.activity) ? params.activity : []));
    const timeframe = params?.timeframe || '24h';
    const seriesName = params?.seriesName || 'Activity';
    const seriesColor = params?.color || '#93c5fd';
    const series = times.map(function (t, i) {
      const v = Number(values[i]);
      return [Number(t), Number.isFinite(v) ? v : null];
    });

    // Highlight peak period with a subtle marker.
    const numericValues = values.map(function (v) { return Number(v); }).filter(function (v) { return Number.isFinite(v); });
    const maxValue = numericValues.length ? Math.max.apply(null, numericValues) : null;
    const peakIdx = Number.isFinite(maxValue)
      ? values.findIndex(function (v) { return Number.isFinite(Number(v)) && Number(v) === maxValue; })
      : -1;
    const peakPoint = (peakIdx >= 0 && Array.isArray(times) && times[peakIdx] != null && Number.isFinite(Number(values[peakIdx])))
      ? [Number(times[peakIdx]), Number(values[peakIdx])]
      : null;

    const options = {
      chart: {
        type: 'areaspline',
        animation: false,
        backgroundColor: 'transparent',
        spacingTop: 16,
        spacingRight: 10,
        spacingBottom: 18,
        spacingLeft: 8
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      time: { useUTC: false },
      xAxis: {
        type: 'datetime',
        lineColor: 'rgba(148, 163, 184, 0.28)',
        tickColor: 'rgba(148, 163, 184, 0.22)',
        tickLength: 0,
        tickPixelInterval: timeframe === '24h' ? 84 : 120,
        labels: {
          style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' },
          autoRotation: [-20, -35],
          autoRotationLimit: 80,
          y: 12,
          formatter: function () {
            if (timeframe === '24h') return window.Highcharts.dateFormat('%H:%M', this.value);
            return window.Highcharts.dateFormat('%d %b', this.value);
          }
        }
      },
      yAxis: {
        title: { text: null },
        min: 0,
        tickAmount: 5,
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        gridLineWidth: 1,
        labels: { style: { color: '#a7b4c5', fontSize: '10px', textOutline: 'none' }, x: -4 }
      },
      tooltip: {
        shared: false,
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const header = timeframe === '24h'
            ? window.Highcharts.dateFormat('%H:%M', this.x)
            : window.Highcharts.dateFormat('%d %b', this.x);
          const value = Number(this.y);
          const text = Number.isFinite(value) ? String(Math.round(value)) : 'N/A';
          return (
            '<div style="min-width:160px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' + header + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:' + seriesColor + ';box-shadow:0 0 0 2px rgba(147,197,253,0.16);"></span>' +
            '<span style="font-weight:500;">' + seriesName + '</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + text + '</strong>' +
            '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: {
          animation: false,
          marker: { enabled: false },
          states: { hover: { lineWidthPlus: 0.2 } },
          turboThreshold: 0
        },
        areaspline: { fillOpacity: 1 }
      },
      series: [{
        type: 'areaspline',
        name: seriesName,
        color: seriesColor,
        lineWidth: 2.6,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, 'rgba(147, 197, 253, 0.18)'], [1, 'rgba(147, 197, 253, 0.00)']]
        },
        data: series
      }].concat(peakPoint ? [{
        type: 'scatter',
        name: 'Peak',
        data: [peakPoint],
        color: seriesColor,
        marker: {
          enabled: true,
          radius: 4.5,
          lineColor: '#0f172a',
          lineWidth: 2,
          fillColor: seriesColor
        },
        enableMouseTracking: false,
        showInLegend: false,
        tooltip: { enabled: false },
        states: { hover: { enabled: false } }
      }] : [])
    };

    return createOrUpdateChart({
      chartKey: 'occupancy-activity-trend',
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateOccupancyLocationComparison(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const categories = Array.isArray(params?.categories) ? params.categories : [];
    const series = Array.isArray(params?.values) ? params.values : [];
    const title = params?.seriesName || 'Activity';

    const options = {
      chart: { type: 'column', animation: false, backgroundColor: 'transparent', spacingLeft: 8, spacingRight: 10, spacingTop: 10, spacingBottom: 10 },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: categories,
        lineColor: 'rgba(148, 163, 184, 0.22)',
        labels: { style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' } }
      },
      yAxis: {
        title: { text: null },
        min: 0,
        tickAmount: 4,
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        labels: { style: { color: '#a7b4c5', fontSize: '10px', textOutline: 'none' } }
      },
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const value = Number(this.y);
          const text = Number.isFinite(value) ? String(Math.round(value)) : 'N/A';
          return (
            '<div style="min-width:170px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' + (this.key || 'Location') + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="font-weight:500;color:#dbe7f5;">' + title + '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + text + '</strong>' +
            '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: { animation: false, borderWidth: 0, borderRadius: 3 }
      },
      series: [{
        type: 'column',
        name: title,
        color: params?.color || '#3b82f6',
        data: series.map(function (v) { return Number.isFinite(Number(v)) ? Number(v) : null; })
      }]
    };

    return createOrUpdateChart({
      chartKey: String(params?.chartKey || 'occupancy-location-activity'),
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateOccupancyLocationInOutFlow(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const categories = Array.isArray(params?.categories) ? params.categories : [];
    const peopleIn = Array.isArray(params?.peopleIn) ? params.peopleIn : [];
    const peopleOut = Array.isArray(params?.peopleOut) ? params.peopleOut : [];
    const chartKey = String(params?.chartKey || 'occupancy-location-flow');

    const options = {
      chart: { type: 'column', animation: false, backgroundColor: 'transparent', spacingLeft: 8, spacingRight: 10, spacingTop: 10, spacingBottom: 10 },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: true },
      xAxis: {
        categories: categories,
        lineColor: 'rgba(148, 163, 184, 0.22)',
        labels: { style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' } }
      },
      yAxis: {
        title: { text: null },
        min: 0,
        tickAmount: 4,
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        labels: { style: { color: '#a7b4c5', fontSize: '10px', textOutline: 'none' } }
      },
      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const cat = this.x || this.key || 'Location';
          const inPoint = (this.points || []).find(function (p) { return p.series && p.series.name === 'People In'; });
          const outPoint = (this.points || []).find(function (p) { return p.series && p.series.name === 'People Out'; });
          const inVal = inPoint ? Number(inPoint.y) : null;
          const outVal = outPoint ? Number(outPoint.y) : null;
          const net = (Number.isFinite(inVal) ? inVal : 0) - (Number.isFinite(outVal) ? outVal : 0);
          return (
            '<div style="min-width:190px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' + cat + '</div>' +
            '<div style="display:flex;flex-direction:column;gap:6px;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:rgba(16, 185, 129, 0.85);"></span>' +
            '<span style="font-weight:500;">People In</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + (Number.isFinite(inVal) ? Math.round(inVal) : 'N/A') + '</strong>' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:rgba(249, 115, 22, 0.85);"></span>' +
            '<span style="font-weight:500;">People Out</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + (Number.isFinite(outVal) ? Math.round(outVal) : 'N/A') + '</strong>' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:4px;padding-top:6px;border-top:1px solid rgba(148, 163, 184, 0.18);">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#93a7bf;">' +
            '<span style="font-weight:500;">Net (In - Out)</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + Math.round(net) + '</strong>' +
            '</div>' +
            '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: { animation: false, borderWidth: 0, borderRadius: 3 }
      },
      series: [
        {
          type: 'column',
          name: 'People In',
          color: 'rgba(16, 185, 129, 0.85)',
          data: peopleIn.map(function (v) { return Number.isFinite(Number(v)) ? Number(v) : null; })
        },
        {
          type: 'column',
          name: 'People Out',
          color: 'rgba(249, 115, 22, 0.85)',
          data: peopleOut.map(function (v) { return Number.isFinite(Number(v)) ? Number(v) : null; })
        }
      ]
    };

    return createOrUpdateChart({
      chartKey: chartKey,
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateOccupancyTopTrafficLocationsChart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const categories = Array.isArray(params?.categories) ? params.categories : [];
    const values = Array.isArray(params?.values) ? params.values : [];
    const timeframe = params?.timeframe || '24h';
    const seriesName = params?.seriesName || 'Top Traffic';
    const color = params?.color || 'rgba(16, 185, 129, 0.85)';

    if (!categories.length || categories.length !== values.length) return { ok: false, reason: 'missing-data' };

    const seriesData = values.map(function (v) {
      const num = Number(v);
      return Number.isFinite(num) ? num : null;
    });

    const options = {
      chart: {
        type: 'bar',
        animation: false,
        backgroundColor: 'transparent',
        spacingTop: 10,
        spacingRight: 10,
        spacingBottom: 10,
        spacingLeft: 8
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        title: { text: null },
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        gridLineWidth: 1,
        labels: { style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' } }
      },
      yAxis: {
        categories: categories,
        title: { text: null },
        gridLineWidth: 0,
        labels: { style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' } },
        reversed: false
      },
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const loc = this.point && this.point.category ? this.point.category : 'Location';
          const value = Number(this.point && this.point.y != null ? this.point.y : this.y);
          const text = Number.isFinite(value) ? String(Math.round(value)) : 'N/A';
          const context = timeframe === '24h' ? 'Last 24h' : (timeframe === '7d' ? 'Last 7d' : 'Last 30d');
          return (
            '<div style="min-width:170px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' + loc + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:' + (color || '#3b82f6') + ';"></span>' +
            '<span style="font-weight:500;">' + seriesName + '</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + text + '</strong>' +
            '</div>' +
            '<div style="margin-top:6px;color:#94a3b8;font-size:10px;">' + context + '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: { animation: false, borderWidth: 0, borderRadius: 4, groupPadding: 0.14 }
      },
      series: [{
        type: 'bar',
        name: seriesName,
        color: color,
        data: seriesData
      }]
    };

    return createOrUpdateChart({
      chartKey: String(params?.chartKey || 'occupancy-top-traffic-locations'),
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateOccupancyPatternHeatmap(containerId, params) {
    if (!hasHeatmapModule()) return { ok: false, reason: 'missing-heatmap-module' };
    const timeframe = params?.timeframe || '24h';
    const categories = Array.isArray(params?.categories) && params.categories.length ? params.categories : [];
    const values = Array.isArray(params?.values) ? params.values : [];
    const numericValues = values
      .map(function (v) { return Number(v); })
      .filter(function (v) { return Number.isFinite(v); });
    const maxValue = numericValues.length ? Math.max.apply(null, numericValues) : null;
    const worstIdx = Number.isFinite(maxValue)
      ? values.findIndex(function (v) { return Number.isFinite(Number(v)) && Number(v) === maxValue; })
      : -1;

    const subtitleText = timeframe === '24h'
      ? 'Last 24 hours'
      : (timeframe === '7d'
        ? 'Average by hour-of-day (last 7 days)'
        : 'Average by hour-of-day (last 30 days)');

    const points = categories.map(function (_, idx) {
      const v = Number(values[idx]);
      const isWorst = idx === worstIdx && Number.isFinite(v);
      return {
        x: idx,
        y: 0,
        value: Number.isFinite(v) ? v : null,
        borderColor: isWorst ? 'rgba(248, 250, 252, 0.55)' : 'rgba(148, 163, 184, 0.18)',
        borderWidth: isWorst ? 1.5 : 0.75
      };
    });

    const options = {
      chart: { type: 'heatmap', animation: false, backgroundColor: 'transparent', marginTop: 0, marginBottom: 10, spacingLeft: 8, spacingRight: 10, spacingTop: 2, spacingBottom: 6 },
      title: { text: null },
      subtitle: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: categories,
        tickLength: 0,
        lineColor: 'rgba(148, 163, 184, 0.22)',
        labels: { style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' }, y: 10 }
      },
      yAxis: {
        categories: ['Activity'],
        title: { text: null },
        labels: { enabled: false },
        gridLineWidth: 0
      },
      colorAxis: {
        min: 0,
        max: Math.max(1, Number.isFinite(maxValue) ? maxValue : 1),
        stops: [[0, '#16a34a'], [0.5, '#eab308'], [1, '#ef4444']],
        labels: { enabled: false },
        visible: false
      },
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const label = categories[this.point.x] || '--';
          const value = Number(this.point.value);
          const text = Number.isFinite(value) ? String(Math.round(value)) : 'N/A';
          const context = timeframe === '24h' ? 'Last 24h' : (timeframe === '7d' ? 'Last 7d' : 'Last 30d');
          const hourText = timeframe === '24h'
            ? (String(label).includes(':') ? String(label) : (String(label) + ':00'))
            : (String(label) + ':00');
          return (
            '<div style="min-width:160px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' +
            ('Hour: ' + hourText) +
            ' · ' + context +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#93c5fd;box-shadow:0 0 0 2px rgba(147,197,253,0.16);"></span>' +
            '<span style="font-weight:500;">Activity</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + text + '</strong>' +
            '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: { series: { animation: false, states: { hover: { brightness: 0.05 } } } },
      series: [{ type: 'heatmap', name: 'Activity', borderRadius: 4, nullColor: 'rgba(148, 163, 184, 0.10)', data: points, dataLabels: { enabled: false } }]
    };

    return createOrUpdateChart({
      chartKey: 'occupancy-pattern-heatmap',
      containerId: containerId,
      options: options
    });
  }

  function getUvCategory(uvValue) {
    const uv = Number(uvValue);
    if (!Number.isFinite(uv)) return 'Unavailable';
    if (uv >= 11) return 'Extreme';
    if (uv >= 8) return 'Very High';
    if (uv >= 6) return 'High';
    if (uv >= 3) return 'Moderate';
    return 'Low';
  }

  function getUvColor(uvValue) {
    const uv = Number(uvValue);
    if (!Number.isFinite(uv)) return '#64748b';
    if (uv >= 11) return '#a855f7';
    if (uv >= 8) return '#ef4444';
    if (uv >= 6) return '#f97316';
    if (uv >= 3) return '#f59e0b';
    return '#10b981';
  }

  function createOrUpdateUvMainTrendChart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const timeframe = params?.timeframe || '24h';
    const times = Array.isArray(params?.bucketTimesMs) ? params.bucketTimesMs : [];
    const values = Array.isArray(params?.values) ? params.values : [];
    const series = times.map(function (t, i) {
      const v = Number(values[i]);
      return [Number(t), Number.isFinite(v) ? Number(v.toFixed(2)) : null];
    });
    const numericValues = values.map(function (v) { return Number(v); }).filter(function (v) { return Number.isFinite(v); });
    const yMaxData = numericValues.length ? Math.max.apply(null, numericValues) : 12;
    const yMax = Math.max(12, Math.ceil(yMaxData + 1));
    const latestValue = numericValues.length ? numericValues[numericValues.length - 1] : null;
    const seriesColor = getUvColor(latestValue);

    const options = {
      chart: {
        type: 'areaspline',
        animation: false,
        backgroundColor: 'transparent',
        spacingTop: 22,
        spacingRight: 12,
        spacingBottom: 22,
        spacingLeft: 10
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      time: { useUTC: false },
      xAxis: {
        type: 'datetime',
        lineColor: 'rgba(148, 163, 184, 0.28)',
        tickColor: 'rgba(148, 163, 184, 0.22)',
        tickLength: 0,
        tickPixelInterval: timeframe === '24h' ? 84 : 120,
        labels: {
          style: { color: '#94a3b8', fontSize: '11px', textOutline: 'none' },
          autoRotation: [-20, -35],
          autoRotationLimit: 80,
          y: 12,
          formatter: function () {
            if (timeframe === '24h') return window.Highcharts.dateFormat('%H:%M', this.value);
            return window.Highcharts.dateFormat('%d %b', this.value);
          }
        }
      },
      yAxis: {
        min: 0,
        max: yMax,
        tickAmount: 6,
        title: {
          text: 'UV Index',
          style: { color: '#7c8ca2', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }
        },
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        labels: { style: { color: '#a7b4c5', fontSize: '11px', textOutline: 'none' }, x: -4 },
        plotBands: [
          { from: 0, to: 3, color: 'rgba(16, 185, 129, 0.08)' },
          { from: 3, to: 6, color: 'rgba(245, 158, 11, 0.08)' },
          { from: 6, to: 8, color: 'rgba(249, 115, 22, 0.08)' },
          { from: 8, to: 11, color: 'rgba(239, 68, 68, 0.08)' },
          { from: 11, to: yMax, color: 'rgba(168, 85, 247, 0.08)' }
        ]
      },
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const header = timeframe === '24h'
            ? window.Highcharts.dateFormat('%d %b %H:%M', this.x)
            : window.Highcharts.dateFormat('%d %b', this.x);
          const uv = Number(this.y);
          const category = getUvCategory(uv);
          const valueText = Number.isFinite(uv) ? uv.toFixed(1) : 'N/A';
          return (
            '<div style="min-width:180px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' + header + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
            '<span style="font-weight:500;color:#dbe7f5;">UV Index</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + valueText + '</strong>' +
            '</div>' +
            '<div style="margin-top:6px;display:flex;align-items:center;gap:6px;">' +
            '<span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:' + getUvColor(uv) + ';"></span>' +
            '<span style="color:' + getUvColor(uv) + ';font-weight:700;letter-spacing:0.02em;">Category: ' + category + '</span>' +
            '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: {
          animation: false,
          marker: {
            enabled: false,
            states: {
              hover: {
                enabled: true,
                radius: 3.2,
                lineWidth: 1.4,
                lineColor: '#0f172a'
              }
            }
          },
          turboThreshold: 0
        }
      },
      series: [{
        type: 'areaspline',
        name: 'UV Index',
        color: seriesColor,
        lineWidth: 3.6,
        states: {
          hover: {
            lineWidthPlus: 0.2,
            halo: {
              size: 7,
              opacity: 0.16
            }
          }
        },
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, toRgba(seriesColor, 0.24)], [1, toRgba(seriesColor, 0.015)]]
        },
        data: series
      }]
    };

    return createOrUpdateChart({
      chartKey: 'uv-main-trend',
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateUvPatternChart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const timeframe = params?.timeframe || '24h';
    const categories = Array.isArray(params?.categories) ? params.categories : [];
    const values = Array.isArray(params?.values) ? params.values : [];
    const points = categories.map(function (label, idx) {
      const uv = Number(values[idx]);
      return {
        y: Number.isFinite(uv) ? Number(uv.toFixed(2)) : null,
        color: getUvColor(uv),
        custom: {
          category: getUvCategory(uv),
          hourLabel: label
        }
      };
    });

    const options = {
      chart: { type: 'column', animation: false, backgroundColor: 'transparent', spacingLeft: 10, spacingRight: 12, spacingTop: 12, spacingBottom: 12 },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: categories,
        lineColor: 'rgba(148, 163, 184, 0.22)',
        labels: { style: { color: '#94a3b8', fontSize: '11px', textOutline: 'none' } }
      },
      yAxis: {
        title: { text: 'UV Index', style: { color: '#7c8ca2', fontSize: '10px', fontWeight: '600' } },
        min: 0,
        tickAmount: 5,
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        labels: { style: { color: '#a7b4c5', fontSize: '11px', textOutline: 'none' } }
      },
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const uv = Number(this.y);
          const uvText = Number.isFinite(uv) ? uv.toFixed(1) : 'N/A';
          const hourText = this.point?.custom?.hourLabel || this.key || '--';
          const category = this.point?.custom?.category || 'Unavailable';
          const subtitle = timeframe === '24h' ? 'Last 24 hours' : (timeframe === '7d' ? 'Hourly avg (7 days)' : 'Hourly avg (30 days)');
          return (
            '<div style="min-width:180px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' + hourText + ' · ' + subtitle + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
            '<span style="font-weight:500;color:#dbe7f5;">UV Index</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + uvText + '</strong>' +
            '</div>' +
            '<div style="margin-top:6px;display:flex;align-items:center;gap:6px;">' +
            '<span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:' + getUvColor(uv) + ';"></span>' +
            '<span style="color:' + getUvColor(uv) + ';font-weight:700;letter-spacing:0.02em;">Category: ' + category + '</span>' +
            '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        column: {
          animation: false,
          borderWidth: 0,
          borderRadius: 3,
          pointPadding: 0.08,
          groupPadding: 0.12
        }
      },
      series: [{
        type: 'column',
        name: 'Hourly UV',
        data: points
      }]
    };

    return createOrUpdateChart({
      chartKey: 'uv-hourly-pattern',
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateUvDailyComparisonChart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const categories = Array.isArray(params?.categories) ? params.categories : [];
    const values = Array.isArray(params?.values) ? params.values : [];
    const metricLabel = params?.metricLabel || 'Daily peak UV';
    const points = values.map(function (v) {
      const uv = Number(v);
      return {
        y: Number.isFinite(uv) ? Number(uv.toFixed(2)) : null,
        color: getUvColor(uv),
        custom: { category: getUvCategory(uv) }
      };
    });

    const options = {
      chart: { type: 'column', animation: false, backgroundColor: 'transparent', spacingLeft: 10, spacingRight: 12, spacingTop: 12, spacingBottom: 10 },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: categories,
        lineColor: 'rgba(148, 163, 184, 0.22)',
        labels: { style: { color: '#94a3b8', fontSize: '11px', textOutline: 'none' } }
      },
      yAxis: {
        title: { text: 'UV Index', style: { color: '#7c8ca2', fontSize: '10px', fontWeight: '600' } },
        min: 0,
        tickAmount: 5,
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        labels: { style: { color: '#a7b4c5', fontSize: '11px', textOutline: 'none' } }
      },
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const uv = Number(this.y);
          const uvText = Number.isFinite(uv) ? uv.toFixed(1) : 'N/A';
          const category = this.point?.custom?.category || 'Unavailable';
          return (
            '<div style="min-width:180px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' + (this.key || 'Day') + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
            '<span style="font-weight:500;color:#dbe7f5;">' + metricLabel + '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + uvText + '</strong>' +
            '</div>' +
            '<div style="margin-top:6px;display:flex;align-items:center;gap:6px;">' +
            '<span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:' + getUvColor(uv) + ';"></span>' +
            '<span style="color:' + getUvColor(uv) + ';font-weight:700;letter-spacing:0.02em;">Category: ' + category + '</span>' +
            '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        column: {
          animation: false,
          borderWidth: 0,
          borderRadius: 3,
          pointPadding: 0.1,
          groupPadding: 0.12
        }
      },
      series: [{
        type: 'column',
        name: metricLabel,
        data: points
      }]
    };

    return createOrUpdateChart({
      chartKey: 'uv-daily-comparison',
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateEnergyMainCombinedChart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const timeframe = params?.timeframe || '24h';
    const bucketTimesMs = Array.isArray(params?.bucketTimesMs) ? params.bucketTimesMs : [];
    const energyValues = Array.isArray(params?.energyValues) ? params.energyValues : [];
    const trendValues = Array.isArray(params?.trendValues) ? params.trendValues : [];

    const numericEnergy = energyValues
      .map(function (v) { return Number(v); })
      .filter(function (v) { return Number.isFinite(v); });
    const avgUsage = numericEnergy.length
      ? (numericEnergy.reduce(function (s, v) { return s + v; }, 0) / numericEnergy.length)
      : null;

    const energySeries = bucketTimesMs.map(function (t, i) {
      const v = Number(energyValues[i]);
      return [Number(t), Number.isFinite(v) ? v : null];
    });
    const trendSeries = bucketTimesMs.map(function (t, i) {
      const v = Number(trendValues[i]);
      return [Number(t), Number.isFinite(v) ? v : null];
    });

    const options = {
      chart: {
        type: 'column',
        animation: false,
        backgroundColor: 'transparent',
        spacingTop: 18,
        spacingRight: 10,
        spacingBottom: 18,
        spacingLeft: 8
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      time: { useUTC: false },
      xAxis: {
        type: 'datetime',
        tickLength: 0,
        tickColor: 'rgba(148, 163, 184, 0.22)',
        tickPixelInterval: timeframe === '24h' ? 84 : 120,
        lineColor: 'rgba(148, 163, 184, 0.28)',
        labels: {
          style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' },
          autoRotation: [-20, -35],
          autoRotationLimit: 80,
          y: 12,
          formatter: function () {
            if (timeframe === '24h') return window.Highcharts.dateFormat('%H:%M', this.value);
            return window.Highcharts.dateFormat('%d %b', this.value);
          }
        }
      },
      yAxis: [{
        title: { text: 'kWh', style: { color: '#7c8ca2', fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' } },
        min: 0,
        tickAmount: 5,
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        gridLineWidth: 1,
        labels: { style: { color: '#a7b4c5', fontSize: '10px', textOutline: 'none' }, x: -4 },
        plotLines: avgUsage !== null
          ? [{
              value: avgUsage,
              color: 'rgba(56, 189, 248, 0.55)',
              width: 1,
              dashStyle: 'Dash',
              zIndex: 2,
              label: {
                text: 'Avg',
                style: { color: 'rgba(148, 163, 184, 0.9)', fontSize: '10px', fontWeight: '500' }
              }
            }]
          : []
      }, {
        title: { text: 'Cumulative kWh', style: { color: '#7c8ca2', fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' } },
        opposite: true,
        min: 0,
        tickAmount: 5,
        gridLineWidth: 0,
        labels: { style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' } }
      }],
      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const header = timeframe === '24h'
            ? window.Highcharts.dateFormat('%H:%M', this.x)
            : window.Highcharts.dateFormat('%d %b', this.x);
          const rows = (this.points || []).map(function (p) {
            const name = p.series && p.series.name ? p.series.name : 'Series';
            const value = Number(p.y);
            const color = p.color || '#94a3b8';
            const valueText = Number.isFinite(value) ? String(value.toFixed(1)) : 'N/A';
            return (
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:6px;">' +
              '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
              '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:' + color + ';"></span>' +
              '<span style="font-weight:500;">' + name + '</span>' +
              '</span>' +
              '<strong style="color:#f8fbff;">' + valueText + '</strong>' +
              '</div>'
            );
          }).join('');
          return (
            '<div style="min-width:190px;">' +
            '<div style="margin-bottom:6px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' + header + '</div>' +
            rows +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: { animation: false, states: { inactive: { opacity: 1 } } },
        column: { groupPadding: 0.12, pointPadding: 0.06, borderRadius: 3, borderWidth: 0 },
        spline: { marker: { enabled: false }, lineWidth: 2.2 }
      },
      series: [
        {
          type: 'column',
          name: 'Energy usage',
          color: 'rgba(168, 85, 247, 0.85)',
          data: energySeries,
          yAxis: 0,
          zIndex: 2
        },
        {
          type: 'spline',
          name: 'Cumulative trend',
          color: 'rgba(56, 189, 248, 0.98)',
          data: trendSeries,
          yAxis: 1,
          zIndex: 3
        }
      ]
    };

    return createOrUpdateChart({
      chartKey: 'energy-main-combined',
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateEnergyDemandTrendChart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const timeframe = params?.timeframe || '24h';
    const bucketTimesMs = Array.isArray(params?.bucketTimesMs) ? params.bucketTimesMs : [];
    const values = Array.isArray(params?.values) ? params.values : [];

    if (!bucketTimesMs.length || bucketTimesMs.length !== values.length) {
      return { ok: false, reason: 'missing-data' };
    }

    const series = bucketTimesMs.map(function (t, i) {
      const v = Number(values[i]);
      return [Number(t), Number.isFinite(v) ? v : null];
    });

    const numericValues = values
      .map(function (v) { return Number(v); })
      .filter(function (v) { return Number.isFinite(v); });
    const maxValue = numericValues.length ? Math.max.apply(null, numericValues) : null;
    const peakIdx = Number.isFinite(maxValue)
      ? values.findIndex(function (v) { return Number.isFinite(Number(v)) && Number(v) === maxValue; })
      : -1;
    const peakPoint = (peakIdx >= 0 && bucketTimesMs[peakIdx] != null && Number.isFinite(Number(values[peakIdx])))
      ? [Number(bucketTimesMs[peakIdx]), Number(values[peakIdx])]
      : null;

    const options = {
      chart: {
        type: 'areaspline',
        animation: false,
        backgroundColor: 'transparent',
        spacingTop: 14,
        spacingRight: 10,
        spacingBottom: 16,
        spacingLeft: 8
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      time: { useUTC: false },
      xAxis: {
        type: 'datetime',
        tickLength: 0,
        tickColor: 'rgba(148, 163, 184, 0.22)',
        lineColor: 'rgba(148, 163, 184, 0.28)',
        tickPixelInterval: timeframe === '24h' ? 84 : 120,
        labels: {
          style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' },
          autoRotation: [-20, -35],
          autoRotationLimit: 80,
          y: 12,
          formatter: function () {
            if (timeframe === '24h') return window.Highcharts.dateFormat('%H:%M', this.value);
            return window.Highcharts.dateFormat('%d %b', this.value);
          }
        }
      },
      yAxis: {
        title: { text: 'kWh', style: { color: '#7c8ca2', fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' } },
        min: 0,
        tickAmount: 5,
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        gridLineWidth: 1,
        labels: { style: { color: '#a7b4c5', fontSize: '10px', textOutline: 'none' }, x: -4 }
      },
      tooltip: {
        shared: false,
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const header = timeframe === '24h'
            ? window.Highcharts.dateFormat('%H:%M', this.x)
            : window.Highcharts.dateFormat('%d %b', this.x);
          const value = Number(this.y);
          const text = Number.isFinite(value) ? value.toFixed(1) : 'N/A';
          return (
            '<div style="min-width:170px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' + header + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:rgba(56,189,248,0.95);box-shadow:0 0 0 2px rgba(56,189,248,0.16);"></span>' +
            '<span style="font-weight:500;">Energy</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + text + ' kWh</strong>' +
            '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: { animation: false, states: { inactive: { opacity: 1 } } },
        areaspline: {
          lineWidth: 2.3,
          marker: { enabled: false },
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [[0, 'rgba(56, 189, 248, 0.18)'], [1, 'rgba(56, 189, 248, 0.00)']]
          }
        }
      },
      series: (peakPoint ? [
        {
          type: 'areaspline',
          name: 'Energy',
          color: 'rgba(56, 189, 248, 0.98)',
          data: series
        },
        {
          type: 'scatter',
          name: 'Peak',
          data: [peakPoint],
          color: 'rgba(239, 68, 68, 0.98)',
          marker: {
            enabled: true,
            radius: 4.5,
            lineColor: '#0f172a',
            lineWidth: 2,
            fillColor: 'rgba(239, 68, 68, 0.98)'
          },
          enableMouseTracking: false,
          tooltip: { enabled: false },
          showInLegend: false
        }
      ] : [
        {
          type: 'areaspline',
          name: 'Energy',
          color: 'rgba(56, 189, 248, 0.98)',
          data: series
        }
      ])
    };

    return createOrUpdateChart({
      chartKey: 'energy-demand-trend',
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateEnergyUsagePatternHourChart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const timeframe = params?.timeframe || '24h';
    const categories = Array.isArray(params?.categories) ? params.categories : [];
    const values = Array.isArray(params?.values) ? params.values : [];
    if (!categories.length || categories.length !== values.length) return { ok: false, reason: 'missing-data' };

    const numericValues = values
      .map(function (v) { return Number(v); })
      .filter(function (v) { return Number.isFinite(v); });
    const minV = numericValues.length ? Math.min.apply(null, numericValues) : 0;
    const maxV = numericValues.length ? Math.max.apply(null, numericValues) : 1;
    const spread = (maxV - minV) || 1;
    const lowCut = minV + spread * 0.33;
    const midCut = minV + spread * 0.66;

    const getColor = function (v) {
      const n = Number(v);
      if (!Number.isFinite(n)) return 'rgba(148, 163, 184, 0.35)';
      if (n <= lowCut) return 'rgba(16, 185, 129, 0.95)'; // green
      if (n <= midCut) return 'rgba(234, 179, 8, 0.95)'; // amber
      return 'rgba(239, 68, 68, 0.98)'; // red
    };

    const data = values.map(function (v, idx) {
      const n = Number(v);
      return { x: idx, y: Number.isFinite(n) ? n : null, color: getColor(n) };
    });

    const options = {
      chart: {
        type: 'column',
        animation: false,
        backgroundColor: 'transparent',
        spacingTop: 14,
        spacingRight: 10,
        spacingBottom: 20,
        spacingLeft: 8
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: categories,
        tickLength: 0,
        lineColor: 'rgba(148, 163, 184, 0.22)',
        labels: { style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' } }
      },
      yAxis: {
        title: { text: 'kWh', style: { color: '#7c8ca2', fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' } },
        min: 0,
        tickAmount: 5,
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        gridLineWidth: 1,
        labels: { style: { color: '#a7b4c5', fontSize: '10px', textOutline: 'none' }, x: -4 }
      },
      tooltip: {
        shared: false,
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const hour = categories[this.point.x] || '--';
          const value = Number(this.point.y);
          const text = Number.isFinite(value) ? value.toFixed(1) : 'N/A';
          const subtitle = timeframe === '24h'
            ? 'Last 24h by hour'
            : (timeframe === '7d' ? 'Avg by hour-of-day (last 7d)' : 'Avg by hour-of-day (last 30d)');
          return (
            '<div style="min-width:170px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">Hour ' + hour + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:' + (this.point.color || '#94a3b8') + ';box-shadow:0 0 0 2px rgba(148,163,184,0.16);"></span>' +
            '<span style="font-weight:500;">Energy</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + text + ' kWh</strong>' +
            '</div>' +
            '<div style="margin-top:6px;color:#94a3b8;font-size:10px;">' + subtitle + '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: { animation: false, states: { hover: { brightness: 0.05 } } },
        column: { groupPadding: 0.12, pointPadding: 0.06, borderRadius: 3, borderWidth: 0 }
      },
      series: [
        {
          type: 'column',
          name: 'Energy',
          data: data
        }
      ]
    };

    return createOrUpdateChart({
      chartKey: 'energy-usage-pattern-hour',
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateEnergyDistributionByLocationChart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const categories = Array.isArray(params?.categories) ? params.categories : [];
    const values = Array.isArray(params?.values) ? params.values : [];
    const timeframe = params?.timeframe || '24h';

    if (!categories.length || categories.length !== values.length) return { ok: false, reason: 'missing-data' };

    const options = {
      chart: {
        type: 'bar',
        animation: false,
        backgroundColor: 'transparent',
        spacingTop: 14,
        spacingRight: 10,
        spacingBottom: 12,
        spacingLeft: 8
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        title: { text: 'kWh', style: { color: '#94a3b8', fontSize: '10px' } },
        gridLineColor: 'rgba(148, 163, 184, 0.14)',
        gridLineWidth: 1,
        labels: { style: { color: '#a7b4c5', fontSize: '10px', textOutline: 'none' } }
      },
      yAxis: {
        title: { text: null },
        categories: categories,
        reversed: true,
        gridLineWidth: 0,
        labels: { style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' } }
      },
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const loc = this.point && this.point.category ? this.point.category : 'Location';
          const value = Number(this.point && Number.isFinite(this.point.y) ? this.point.y : this.y);
          const text = Number.isFinite(value) ? value.toFixed(1) : 'N/A';
          const ctx = timeframe === '24h' ? 'Last 24h' : (timeframe === '7d' ? 'Last 7d' : 'Last 30d');
          return (
            '<div style="min-width:180px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">' + ctx + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:rgba(56,189,248,0.9);box-shadow:0 0 0 2px rgba(56,189,248,0.16);"></span>' +
            '<span style="font-weight:500;">' + loc + '</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + text + ' kWh</strong>' +
            '</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: { animation: false, borderWidth: 0 },
        bar: { borderRadius: 4 }
      },
      series: [
        {
          type: 'bar',
          name: 'Energy',
          color: 'rgba(56, 189, 248, 0.85)',
          data: values
        }
      ]
    };

    return createOrUpdateChart({
      chartKey: 'energy-distribution-location',
      containerId: containerId,
      options: options
    });
  }

  function createOrUpdateEnergyShareDonutChart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const labels = Array.isArray(params?.labels) ? params.labels : [];
    const values = Array.isArray(params?.values) ? params.values : [];

    if (!labels.length || labels.length !== values.length) return { ok: false, reason: 'missing-data' };

    const total = values.reduce(function (s, v) {
      const n = Number(v);
      return s + (Number.isFinite(n) ? n : 0);
    }, 0);

    const seriesData = labels.map(function (l, i) {
      const n = Number(values[i]);
      return { name: l, y: Number.isFinite(n) ? n : 0 };
    });

    const options = {
      chart: {
        type: 'pie',
        animation: false,
        backgroundColor: 'transparent',
        spacingTop: 10,
        spacingRight: 10,
        spacingBottom: 10,
        spacingLeft: 10
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(148, 163, 184, 0.26)',
        borderWidth: 1,
        borderRadius: 10,
        shadow: false,
        padding: 10,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const v = Number(this.y);
          const text = Number.isFinite(v) ? v.toFixed(1) : 'N/A';
          const pct = (total > 0 && Number.isFinite(v)) ? (v / total * 100) : 0;
          return (
            '<div style="min-width:170px;">' +
            '<div style="margin-bottom:7px;color:#93a7bf;font-size:10px;letter-spacing:0.02em;">Energy share</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">' +
            '<span style="display:inline-flex;align-items:center;gap:7px;color:#dbe7f5;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:' + (this.point.color || '#94a3b8') + ';box-shadow:0 0 0 2px rgba(148,163,184,0.16);"></span>' +
            '<span style="font-weight:500;">' + this.point.name + '</span>' +
            '</span>' +
            '<strong style="font-size:12px;color:#f8fbff;">' + text + ' kWh</strong>' +
            '</div>' +
            '<div style="margin-top:6px;color:#94a3b8;font-size:10px;">' + pct.toFixed(0) + '%</div>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        pie: {
          innerSize: '62%',
          borderWidth: 0,
          dataLabels: {
            enabled: true,
            formatter: function () {
              return this.point.name + '<br/>' + this.percentage.toFixed(0) + '%';
            },
            style: { color: '#e2e8f0', textOutline: 'none', fontSize: '10px' }
          }
        }
      },
      series: [
        {
          name: 'Energy share',
          data: seriesData
        }
      ]
    };

    return createOrUpdateChart({
      chartKey: 'energy-share-donut',
      containerId: containerId,
      options: options
    });
  }

  if (typeof window !== 'undefined') {
    window.SMACAHighchartsAdapter = {
      hasHighcharts: hasHighcharts,
      hasHeatmapModule: hasHeatmapModule,
      getDefaultOptions: function () { return mergeOptions({}, DEFAULT_CHART_OPTIONS); },
      createOrUpdateChart: createOrUpdateChart,
      destroyChart: destroyChart,
      destroyAllCharts: destroyAllCharts,
      createIaqTrendHighchart: createOrUpdateIaqTrendHighchart,
      createIaqSparklineHighchart: function () { return null; },
      createIaqHeatstripHighchart: createOrUpdateIaqCo2HourlyHeatmap,
      createOccupancyMainCombinedChart: createOrUpdateOccupancyMainCombinedChart,
      createOccupancyActivityTrendChart: createOrUpdateOccupancyActivityTrend,
      createOccupancyLocationComparisonChart: createOrUpdateOccupancyLocationComparison,
      createOccupancyLocationInOutFlowChart: createOrUpdateOccupancyLocationInOutFlow,
      createOccupancyTopTrafficLocationsChart: createOrUpdateOccupancyTopTrafficLocationsChart,
      createOccupancyPatternHeatmap: createOrUpdateOccupancyPatternHeatmap,
      createEnergyMainCombinedChart: createOrUpdateEnergyMainCombinedChart,
      createEnergyDemandTrendChart: createOrUpdateEnergyDemandTrendChart,
      createEnergyUsagePatternHourChart: createOrUpdateEnergyUsagePatternHourChart,
      createEnergyDistributionByLocationChart: createOrUpdateEnergyDistributionByLocationChart,
      createEnergyShareDonutChart: createOrUpdateEnergyShareDonutChart,
      createUvMainTrendChart: createOrUpdateUvMainTrendChart,
      createUvPatternChart: createOrUpdateUvPatternChart,
      createUvDailyComparisonChart: createOrUpdateUvDailyComparisonChart,
      destroyIaqTrendHighchart: destroyIaqTrendHighchart
    };
    window.addEventListener('beforeunload', function () {
      destroyAllCharts();
    });
  }
})();
