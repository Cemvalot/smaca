(function () {
  'use strict';

  if (typeof Highcharts !== 'undefined' && typeof Highcharts.setOptions === 'function') {
    Highcharts.setOptions({
      accessibility: {
        enabled: false
      }
    });
  }

  var snapshotUrl = document.body.getAttribute('data-campus-snapshot-url') || '/api/public/campus-snapshot';
  var smacaData = {
    co2: [],
    occupancy: [],
    energy: [],
    activity: [
      'Campus snapshot synchronized with live SMACA telemetry.',
      'Sensor reporting cadence varies by device type across the campus.',
      'Occupancy balance is calculated from entry/exit counters.',
      'Energy intensity uses the same KPI engine as the dashboard overview.',
      'Alert counts reflect active operational events in the platform.'
    ]
  };

  var confidenceValue = 91;
  var heroChart;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initSectionParallax() {
    var dividers = document.querySelectorAll('.section-divider--parallax');
    if (!dividers.length || prefersReducedMotion) {
      return;
    }

    dividers.forEach(function (divider) {
      divider.addEventListener('mousemove', function (event) {
        var rect = divider.getBoundingClientRect();
        var offsetX = (event.clientX - rect.left) / rect.width - 0.5;
        var offsetY = (event.clientY - rect.top) / rect.height - 0.5;
        divider.style.setProperty('--parallax-x', (offsetX * 30).toFixed(2) + 'px');
        divider.style.setProperty('--parallax-y', (offsetY * 18).toFixed(2) + 'px');
      });

      divider.addEventListener('mouseleave', function () {
        divider.style.setProperty('--parallax-x', '0px');
        divider.style.setProperty('--parallax-y', '0px');
      });
    });
  }

  function initScrollReveal() {
    var revealElements = document.querySelectorAll('.scroll-reveal');

    if (prefersReducedMotion) {
      revealElements.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var observerOptions = {
      root: null,
      rootMargin: '0px 0px -80px 0px',
      threshold: 0.1
    };

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, observerOptions);

    revealElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  function chartCategories(snapshot) {
    var chart = snapshot && snapshot.chart ? snapshot.chart : {};
    if (Array.isArray(chart.categories) && chart.categories.length) {
      return chart.categories;
    }
    return ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
  }

  function initHeroChart(snapshot) {
    var chart = snapshot && snapshot.chart ? snapshot.chart : {};
    var categories = chartCategories(snapshot);
    smacaData.co2 = Array.isArray(chart.co2) && chart.co2.length ? chart.co2.slice() : [0, 0, 0, 0, 0, 0, 0, 0];
    smacaData.occupancy = Array.isArray(chart.occupancy) && chart.occupancy.length ? chart.occupancy.slice() : [0, 0, 0, 0, 0, 0, 0, 0];

    heroChart = Highcharts.chart('heroChart', {
      chart: {
        backgroundColor: 'transparent',
        animation: {
          duration: prefersReducedMotion ? 0 : 850,
          easing: 'easeOutQuad'
        }
      },
      accessibility: {
        enabled: false
      },
      title: { text: '' },
      credits: { enabled: false },
      xAxis: {
        categories: categories,
        lineColor: 'rgba(100, 116, 139, 0.28)',
        tickColor: 'rgba(100, 116, 139, 0.28)',
        labels: { style: { color: '#94a3b8' } }
      },
      yAxis: [{
        title: { text: 'Movement', style: { color: '#94a3b8' } },
        labels: { style: { color: '#94a3b8' } },
        gridLineColor: 'rgba(100, 116, 139, 0.12)'
      }, {
        title: { text: 'CO₂ (ppm)', style: { color: '#94a3b8' } },
        labels: { style: { color: '#94a3b8' } },
        opposite: true,
        gridLineWidth: 0
      }],
      tooltip: {
        shared: true,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(59, 130, 246, 0.35)',
        style: { color: '#e2e8f0' }
      },
      legend: {
        itemStyle: { color: '#cbd5e1' },
        itemHoverStyle: { color: '#ffffff' }
      },
      plotOptions: {
        series: {
          animation: {
            duration: prefersReducedMotion ? 0 : 700
          }
        },
        column: {
          borderRadius: 4
        }
      },
      series: [{
        type: 'column',
        name: 'Movement',
        data: smacaData.occupancy,
        color: 'rgba(59, 130, 246, 0.72)',
        yAxis: 0
      }, {
        type: 'spline',
        name: 'CO₂',
        data: smacaData.co2,
        color: '#06B6D4',
        marker: {
          radius: 3.5,
          lineWidth: 2,
          lineColor: '#ffffff'
        },
        yAxis: 1
      }]
    });
  }

  function initPlatformChart(snapshot) {
    var chart = snapshot && snapshot.chart ? snapshot.chart : {};
    var categories = chartCategories(snapshot);
    var co2 = Array.isArray(chart.co2) && chart.co2.length ? chart.co2 : [0, 0, 0, 0, 0, 0, 0, 0];
    var occupancy = Array.isArray(chart.occupancy) && chart.occupancy.length ? chart.occupancy : [0, 0, 0, 0, 0, 0, 0, 0];
    var energyValue = snapshot && snapshot.hero ? Number(snapshot.hero.energy_intensity) : null;
    var energySeries = co2.map(function (_, index) {
      return Number.isFinite(energyValue) ? energyValue : occupancy[index] || 0;
    });

    Highcharts.chart('platformChart', {
      chart: {
        type: 'areaspline',
        backgroundColor: 'transparent',
        spacing: [8, 8, 8, 8]
      },
      accessibility: {
        enabled: false
      },
      title: { text: '' },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: categories,
        labels: { style: { color: '#94a3b8' } },
        lineColor: 'rgba(100, 116, 139, 0.2)',
        tickColor: 'rgba(100, 116, 139, 0.2)'
      },
      yAxis: {
        title: { text: '' },
        labels: { style: { color: '#94a3b8' } },
        gridLineColor: 'rgba(100, 116, 139, 0.12)'
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(59, 130, 246, 0.35)',
        style: { color: '#e2e8f0' }
      },
      series: [{
        name: 'CO₂',
        data: co2,
        color: '#3B82F6',
        fillOpacity: 0.08
      }, {
        name: 'Movement',
        data: occupancy,
        color: '#06B6D4',
        fillOpacity: 0.08
      }, {
        name: 'Energy intensity',
        data: energySeries,
        color: '#22C55E',
        fillOpacity: 0.08
      }]
    });
  }

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && value !== null && value !== undefined && value !== '') {
      el.textContent = String(value);
    }
  }

  function applySnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }

    var totals = snapshot.totals || {};
    var hero = snapshot.hero || {};
    var showcase = snapshot.showcase || {};

    setText('landingStatSensors', totals.sensors);
    setText('landingStatReporting', totals.sensors_reporting);
    setText('landingStatModules', totals.modules);
    setText('landingStatAlerts', totals.active_alert_events);

    setText('kpiCo2', hero.co2_label);
    setText('kpiOccupancy', hero.occupancy_label);
    setText('kpiEnergy', hero.energy_label);

    setText('showcaseAvgCo2', showcase.avg_co2_label);
    setText('showcaseOccupancyPeak', showcase.occupancy_peak_label);
    setText('showcaseEnergy', showcase.energy_label);

    if (heroChart && snapshot.chart) {
      smacaData.co2 = Array.isArray(snapshot.chart.co2) ? snapshot.chart.co2.slice() : smacaData.co2;
      smacaData.occupancy = Array.isArray(snapshot.chart.occupancy) ? snapshot.chart.occupancy.slice() : smacaData.occupancy;
      heroChart.xAxis[0].setCategories(chartCategories(snapshot), false);
      heroChart.series[0].setData(smacaData.occupancy, false);
      heroChart.series[1].setData(smacaData.co2, false);
      heroChart.redraw();
    }

    var totalSensors = Number(totals.sensors);
    var reporting = Number(totals.sensors_reporting);
    if (Number.isFinite(totalSensors) && totalSensors > 0 && Number.isFinite(reporting)) {
      confidenceValue = Math.max(0, Math.min(100, Math.round((reporting / totalSensors) * 100)));
      updateConfidence();
    }
  }

  function fetchSnapshot() {
    return fetch(snapshotUrl, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('snapshot request failed');
      }
      return response.json();
    });
  }

  function addLogLine(message) {
    var stream = document.getElementById('logStream');
    if (!stream) {
      return;
    }
    var line = document.createElement('div');
    line.className = 'log-line';
    line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
    stream.prepend(line);

    while (stream.children.length > 8) {
      stream.removeChild(stream.lastChild);
    }
  }

  function formatConfidenceLabel(value) {
    var confidenceLabel = document.getElementById('confidenceLabel');
    if (!confidenceLabel) {
      return value + '%';
    }

    var template = confidenceLabel.getAttribute('data-confidence-template');
    if (template && template.indexOf(':value') !== -1) {
      return template.replace(':value', value);
    }

    return confidenceLabel.textContent.replace(/\d+/, String(value));
  }

  function updateConfidence() {
    var confidenceBar = document.getElementById('confidenceBar');
    var confidenceLabel = document.getElementById('confidenceLabel');
    var confidenceProgress = confidenceBar ? confidenceBar.closest('[role="progressbar"]') : null;
    if (!confidenceBar || !confidenceLabel) {
      return;
    }

    confidenceBar.style.width = confidenceValue + '%';
    confidenceBar.textContent = confidenceValue + '%';
    confidenceLabel.textContent = formatConfidenceLabel(confidenceValue);
    if (confidenceProgress) {
      confidenceProgress.setAttribute('aria-valuenow', String(confidenceValue));
    }
  }

  function initPredictiveStream() {
    addLogLine('Campus snapshot synchronized with live SMACA platform data.');

    if (prefersReducedMotion) {
      return;
    }

    setInterval(function () {
      addLogLine(randomFrom(smacaData.activity));
    }, 8000);
  }

  var initialSnapshot = window.SMACA_LANDING_SNAPSHOT || null;

  initScrollReveal();
  initSectionParallax();
  initHeroChart(initialSnapshot);
  initPlatformChart(initialSnapshot);
  applySnapshot(initialSnapshot);
  initPredictiveStream();

  fetchSnapshot()
    .then(function (payload) {
      applySnapshot(payload);
      initPlatformChart(payload);
    })
    .catch(function () {
      addLogLine('Live snapshot refresh unavailable; showing server-rendered campus data.');
    });

  if (!prefersReducedMotion) {
    setInterval(function () {
      fetchSnapshot()
        .then(applySnapshot)
        .catch(function () {});
    }, 60000);
  }

  window.smacaData = smacaData;
})();
