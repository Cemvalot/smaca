(function () {
  'use strict';

  if (typeof Highcharts !== 'undefined' && typeof Highcharts.setOptions === 'function') {
    Highcharts.setOptions({
      accessibility: {
        enabled: false
      }
    });
  }

  const smacaData = {
    co2: [602, 614, 628, 640, 635, 620, 612, 608],
    occupancy: [58, 63, 69, 74, 78, 73, 68, 65],
    energy: [285, 298, 306, 323, 338, 329, 314, 302],
    activity: [
      'Anomaly score increased in Building A ventilation profile.',
      'Recommendation issued: increase fresh air cycle in West Wing.',
      'Occupancy flow is above baseline for seminar spaces.',
      'Energy drift identified in HVAC schedule group 2.',
      'Confidence update generated after recent telemetry validation.'
    ]
  };

  var confidenceValue = 91;
  var heroChart;

  function initScrollReveal() {
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

    document.querySelectorAll('.scroll-reveal').forEach(function (el) {
      observer.observe(el);
    });
  }

  function initHeroChart() {
    var categories = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
    heroChart = Highcharts.chart('heroChart', {
      chart: {
        backgroundColor: 'transparent',
        animation: {
          duration: 850,
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
        title: { text: 'Occupancy %', style: { color: '#94a3b8' } },
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
            duration: 700
          }
        },
        column: {
          borderRadius: 4
        }
      },
      series: [{
        type: 'column',
        name: 'Occupancy',
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

  function initPlatformChart() {
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
        categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
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
        name: 'Air Quality',
        data: [58, 66, 63, 74, 77, 71, 68],
        color: '#3B82F6',
        fillOpacity: 0.08
      }, {
        name: 'Occupancy',
        data: [49, 54, 57, 61, 67, 64, 60],
        color: '#06B6D4',
        fillOpacity: 0.08
      }, {
        name: 'Efficiency',
        data: [44, 48, 52, 55, 60, 58, 56],
        color: '#22C55E',
        fillOpacity: 0.08
      }, {
        name: 'Alert Pressure',
        data: [32, 35, 41, 39, 45, 40, 37],
        color: '#F59E0B',
        fillOpacity: 0.06
      }]
    });
  }

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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

  function updateConfidence() {
    var confidenceBar = document.getElementById('confidenceBar');
    var confidenceLabel = document.getElementById('confidenceLabel');
    if (!confidenceBar || !confidenceLabel) {
      return;
    }
    confidenceValue = Math.max(84, Math.min(98, confidenceValue + (Math.random() > 0.5 ? 1 : -1)));

    confidenceBar.style.width = confidenceValue + '%';
    confidenceBar.textContent = confidenceValue + '%';
    confidenceLabel.textContent = 'Confidence: ' + confidenceValue + '%';
  }

  function initPredictiveStream() {
    addLogLine('Predictive pipeline initialized for 4 module domains.');
    addLogLine('Baseline intelligence model loaded for active building portfolio.');

    setInterval(function () {
      addLogLine(randomFrom(smacaData.activity));
      updateConfidence();
      updateHeroSnapshot();
    }, 2000);
  }

  function average(arr) {
    var total = arr.reduce(function (sum, value) { return sum + value; }, 0);
    return total / arr.length;
  }

  function updateHeroSnapshot() {
    var lastCo2 = smacaData.co2[smacaData.co2.length - 1] + (Math.random() > 0.5 ? 3 : -3);
    var lastOcc = smacaData.occupancy[smacaData.occupancy.length - 1] + (Math.random() > 0.5 ? 1 : -1);
    var lastEnergy = smacaData.energy[smacaData.energy.length - 1] + (Math.random() > 0.5 ? 4 : -4);

    smacaData.co2.push(Math.max(560, Math.min(710, lastCo2)));
    smacaData.occupancy.push(Math.max(45, Math.min(84, lastOcc)));
    smacaData.energy.push(Math.max(240, Math.min(360, lastEnergy)));

    smacaData.co2.shift();
    smacaData.occupancy.shift();
    smacaData.energy.shift();

    if (heroChart) {
      heroChart.series[0].setData(smacaData.occupancy, false);
      heroChart.series[1].setData(smacaData.co2, false);
      heroChart.redraw();
    }

    var kpiCo2 = document.getElementById('kpiCo2');
    var kpiOccupancy = document.getElementById('kpiOccupancy');
    var kpiEnergy = document.getElementById('kpiEnergy');

    if (kpiCo2) {
      kpiCo2.textContent = Math.round(average(smacaData.co2)) + ' ppm';
    }
    if (kpiOccupancy) {
      kpiOccupancy.textContent = Math.round(average(smacaData.occupancy)) + '%';
    }
    if (kpiEnergy) {
      kpiEnergy.textContent = Math.round(average(smacaData.energy)) + ' kW';
    }
  }

  initScrollReveal();
  initHeroChart();
  initPlatformChart();
  updateHeroSnapshot();
  initPredictiveStream();

  window.smacaData = smacaData;
})();
