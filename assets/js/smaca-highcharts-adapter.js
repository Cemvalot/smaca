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
    const maxValue = values.reduce(function (m, v) { return Math.max(m, Number(v)); }, Number.NEGATIVE_INFINITY);
    const worstHour = Number.isFinite(maxValue) ? values.findIndex(function (v) { return Number(v) === maxValue; }) : -1;

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
        marginTop: 10,
        marginBottom: 44,
        spacingLeft: 8,
        spacingRight: 10
      },
      title: { text: null },
      credits: { enabled: false },
      legend: {
        enabled: true,
        align: 'center',
        verticalAlign: 'bottom',
        layout: 'horizontal',
        symbolWidth: 220,
        itemStyle: { color: '#94a3b8', fontSize: '10px' }
      },
      xAxis: {
        categories: categories,
        tickLength: 0,
        lineColor: 'rgba(148, 163, 184, 0.22)',
        labels: {
          style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' }
        }
      },
      yAxis: {
        categories: ['CO2'],
        title: { text: null },
        labels: { style: { color: '#94a3b8', fontSize: '10px', textOutline: 'none' } },
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
            '<span style="font-weight:500;">CO2 avg</span>' +
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
        name: 'CO2 (ppm)',
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
      destroyIaqTrendHighchart: destroyIaqTrendHighchart
    };
    window.addEventListener('beforeunload', function () {
      destroyAllCharts();
    });
  }
})();
