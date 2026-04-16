;(function () {
  function hasHighcharts() {
    return typeof window !== 'undefined' && typeof window.Highcharts !== 'undefined';
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

  function createIaqTrendHighchartOptions(params) {
    const cfg = getIaqMetricUiConfig(params.metric);
    const plotBands = getIaqMetricPlotBands(params.metric, params.yDomain.min, params.yDomain.max);
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
        lineColor: 'rgba(148, 163, 184, 0.35)',
        tickColor: 'rgba(148, 163, 184, 0.35)',
        labels: {
          style: { color: '#94a3b8', fontSize: '10px' },
          formatter: function () {
            return params.timeframe === '24h'
              ? window.Highcharts.dateFormat('%H:%M', this.value)
              : window.Highcharts.dateFormat('%d %b %H:%M', this.value);
          }
        }
      },
      yAxis: {
        title: { text: cfg.unit, style: { color: '#94a3b8', fontSize: '10px', fontWeight: '500' } },
        min: params.yDomain.min,
        max: params.yDomain.max,
        gridLineColor: 'rgba(148, 163, 184, 0.22)',
        labels: {
          style: { color: '#94a3b8', fontSize: '10px' },
          formatter: function () {
            return cfg.decimals > 0 ? Number(this.value).toFixed(cfg.decimals) : String(Math.round(this.value));
          }
        },
        plotBands: plotBands
      },
      tooltip: {
        shared: false,
        outside: false,
        useHTML: true,
        backgroundColor: '#111827',
        borderColor: 'rgba(148, 163, 184, 0.35)',
        borderRadius: 8,
        shadow: false,
        style: { color: '#e2e8f0', fontSize: '11px' },
        formatter: function () {
          const value = Number(this.y);
          const valueText = Number.isFinite(value)
            ? value.toFixed(cfg.decimals)
            : 'N/A';
          return (
            '<div style="margin-bottom:6px;color:#94a3b8;">' +
            window.Highcharts.dateFormat(params.timeframe === '24h' ? '%H:%M' : '%d %b %H:%M', this.x) +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">' +
            '<span><span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:' + cfg.color + ';margin-right:6px;"></span>' + cfg.label + '</span>' +
            '<strong>' + valueText + ' ' + cfg.unit + '</strong>' +
            '</div>'
          );
        }
      },
      plotOptions: {
        series: {
          animation: false,
          lineWidth: 2.75,
          marker: { enabled: false },
          states: { hover: { lineWidthPlus: 0 } },
          turboThreshold: 0
        },
        areaspline: {
          fillOpacity: 0.13
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
        color: cfg.color,
        data: params.seriesData
      }]
    };
  }

  function ensureIaqChartStore() {
    if (typeof window === 'undefined') return null;
    if (!window.__smacaIaqHighcharts) {
      window.__smacaIaqHighcharts = {
        chart: null,
        lastMetric: null,
        lastTimeframe: null
      };
    }
    return window.__smacaIaqHighcharts;
  }

  function destroyIaqTrendHighchart() {
    const store = ensureIaqChartStore();
    if (!store || !store.chart) return;
    store.chart.destroy();
    store.chart = null;
  }

  function createOrUpdateIaqTrendHighchart(containerId, params) {
    if (!hasHighcharts()) return { ok: false, reason: 'missing-highcharts' };
    const container = document.getElementById(containerId);
    if (!container) return { ok: false, reason: 'missing-container' };
    const store = ensureIaqChartStore();
    if (!store) return { ok: false, reason: 'missing-window' };
    const options = createIaqTrendHighchartOptions(params);
    const isFirstRender = !store.chart;

    if (isFirstRender) {
      store.chart = window.Highcharts.chart(container, options);
      console.info('Highcharts chart initialized', {
        metric: params.metric,
        timeframe: params.timeframe,
        pointCount: params.seriesData.length
      });
    } else {
      store.chart.update(options, true, false, false);
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
    return { ok: true, initialized: isFirstRender };
  }

  if (typeof window !== 'undefined') {
    window.SMACAHighchartsAdapter = {
      hasHighcharts: hasHighcharts,
      createIaqTrendHighchart: createOrUpdateIaqTrendHighchart,
      createIaqSparklineHighchart: function () { return null; },
      createIaqHeatstripHighchart: function () { return null; },
      destroyIaqTrendHighchart: destroyIaqTrendHighchart
    };
    window.addEventListener('beforeunload', function () {
      destroyIaqTrendHighchart();
    });
  }
})();
