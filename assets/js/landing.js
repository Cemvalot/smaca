(function () {
  'use strict';

  if (typeof Highcharts !== 'undefined' && typeof Highcharts.setOptions === 'function') {
    Highcharts.setOptions({
      accessibility: {
        enabled: false
      }
    });
  }

  var smacaData = {
    co2: [418, 425, 431, 438, 442, 439, 436, 442],
    occupancy: [52, 58, 64, 71, 78, 74, 69, 65],
    energy: [0.52, 0.54, 0.55, 0.57, 0.58, 0.58, 0.57, 0.58],
    activity: [
      'Anomaly score increased in Building A ventilation profile.',
      'Recommendation issued: increase fresh air cycle in West Wing.',
      'Occupancy flow is above baseline for seminar spaces.',
      'Energy drift identified in HVAC schedule group 2.',
      'Confidence update generated after recent telemetry validation.'
    ]
  };

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

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, {
      root: null,
      rootMargin: '0px 0px -80px 0px',
      threshold: 0.1
    });

    revealElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  function initHeroChart() {
    var categories = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];

    Highcharts.chart('heroChart', {
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
        name: 'CO₂',
        data: [58, 66, 63, 74, 77, 71, 68],
        color: '#3B82F6',
        fillOpacity: 0.08
      }, {
        name: 'Movement',
        data: [49, 54, 57, 61, 67, 64, 60],
        color: '#06B6D4',
        fillOpacity: 0.08
      }, {
        name: 'Energy intensity',
        data: [0.52, 0.54, 0.55, 0.56, 0.58, 0.57, 0.58],
        color: '#22C55E',
        fillOpacity: 0.08
      }]
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

  function initPredictiveStream() {
    addLogLine('Predictive pipeline initialized for 4 module domains.');
    addLogLine('Baseline intelligence model loaded for active building portfolio.');
  }

  initScrollReveal();
  initSectionParallax();
  initHeroChart();
  initPlatformChart();
  initPredictiveStream();

  window.smacaData = smacaData;
})();
