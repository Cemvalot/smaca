;(function () {
  const DEFAULT_CHART_OPTIONS = {
    chart: {
      animation: false,
      backgroundColor: 'transparent'
    },
    title: { text: null },
    credits: { enabled: false }
  };

  function hasHighcharts() {
    return typeof window !== 'undefined' && typeof window.Highcharts !== 'undefined';
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
    const isFirstRender = !existingChart;
    if (isFirstRender) {
      store.charts[chartKey] = window.Highcharts.chart(container, options);
    } else {
      existingChart.update(options, true, false, false);
    }
    return { ok: true, initialized: isFirstRender, chartKey: chartKey };
  }

  function getIaqMetricUiConfig(metric) {
    // Prefer shared IAQ UI config if the accurate IAQ dashboard exported it.
    const shared = typeof window !== 'undefined' ? window.__SMACA_IaqMetricConfig : null;
    if (shared && shared[metric]) return shared[metric];

    const map = {
      co2: { label: 'CO2', unit: 'ppm', decimals: 0, color: '#3b82f6' },
      temperature: { label: 'Temperature', unit: '°C', decimals: 1, color: '#06b6d4' },
      humidity: { label: 'Humidity', unit: '%', decimals: 0, color: '#6366f1' },
      pm2_5: { label: 'PM2.5', unit: 'µg/m³', decimals: 1, color: '#f59e0b' },
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
      pm2_5: ['rgba(16, 185, 129, 0.10)', 'rgba(245, 158, 11, 0.10)', 'rgba(239, 68, 68, 0.10)'],
      pm10: ['rgba(16, 185, 129, 0.10)', 'rgba(245, 158, 11, 0.10)', 'rgba(239, 68, 68, 0.10)'],
      temperature: ['rgba(34, 197, 94, 0.10)'],
      humidity: ['rgba(6, 182, 212, 0.10)'],
      tvoc: ['rgba(236, 72, 153, 0.08)', 'rgba(244, 114, 182, 0.06)', 'rgba(244, 114, 182, 0.04)']
    };
    const items = palettes[metric] || [];
    return items[bandIndex] || 'rgba(148, 163, 184, 0.08)';
  }

  function buildMetricPlotBands(metric, yMin, yMax) {
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
            return params.timeframe === '24h'
              ? window.Highcharts.dateFormat('%H:%M', this.value)
              : window.Highcharts.dateFormat('%d %b %H:%M', this.value);
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
            window.Highcharts.dateFormat(params.timeframe === '24h' ? '%H:%M' : '%d %b %H:%M', this.x) +
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
          lineWidth: isCo2 ? 3 : 2.8,
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
        color: isCo2 ? co2LineColor : cfg.color,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, toRgba(isCo2 ? co2LineColor : cfg.color, isCo2 ? 0.18 : 0.22)],
            [1, toRgba(isCo2 ? co2LineColor : cfg.color, 0)]
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

  if (typeof window !== 'undefined') {
    window.SMACAHighchartsAdapter = {
      hasHighcharts: hasHighcharts,
      getDefaultOptions: function () { return mergeOptions({}, DEFAULT_CHART_OPTIONS); },
      createOrUpdateChart: createOrUpdateChart,
      destroyChart: destroyChart,
      destroyAllCharts: destroyAllCharts,
      createIaqTrendHighchart: createOrUpdateIaqTrendHighchart,
      createIaqSparklineHighchart: function () { return null; },
      createIaqHeatstripHighchart: function () { return null; },
      destroyIaqTrendHighchart: destroyIaqTrendHighchart
    };
    window.addEventListener('beforeunload', function () {
      destroyAllCharts();
    });
  }
})();
