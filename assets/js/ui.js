/**
 * UI Helpers - Toasts, Accordions
 * Minimal global surface, pure vanilla JS.
 */
(function (global) {
  'use strict';

  const TOAST_CONTAINER_ID = 'smaca-toast-container';
  const DEFAULT_TIMEFRAME = '24h';
  const IAQ_METRIC_KEY = 'iaq_selected_metric';
  const CHART_CONTEXT_BY_ID = {
    'occupancy-flow-chart': { metric: 'occupancy', chartType: 'flow' },
    'occupancy-density-timeline': { metric: 'occupancy', chartType: 'activity_timeline' },
    'occupancy-top-traffic-locations-chart': { metric: 'occupancy', chartType: 'location_bar' },
    'iaq-co2-band-chart': { metric: IAQ_METRIC_KEY, chartType: 'line' },
    'iaq-co2-hourly-heatmap': { metric: 'co2', chartType: 'hourly_pattern' },
    'uv-main-chart': { metric: 'uv_index', chartType: 'line' },
    'uv-pattern-chart': { metric: 'uv_index', chartType: 'hourly_pattern' },
    'uv-daily-comparison-chart': { metric: 'uv_index', chartType: 'daily_comparison' },
    'energy-main-combined-chart': { metric: 'energy_kwh', chartType: 'bar_line_combo' },
    'energy-demand-trend-chart': { metric: 'energy_kwh', chartType: 'demand_trend' },
    'energy-usage-pattern-hour-chart': { metric: 'energy_kwh', chartType: 'hourly_pattern' },
    'energy-distribution-location-chart': { metric: 'energy_kwh', chartType: 'location_bar' },
    'energy-share-donut-chart': { metric: 'energy_kwh', chartType: 'donut_share' }
  };
  const KNOWN_CHART_IDS = Object.keys(CHART_CONTEXT_BY_ID);
  const t = (key, fallback = '') => global?.SMACA_TRANSLATIONS?.[key] || fallback;

  /**
   * Show a small toast message
   * @param {string} message
   * @param {object} options { type: 'info'|'success'|'error'|'default', duration: number }
   */
  function toast(message, options) {
    const opts = { type: 'default', duration: 3000, ...options };
    let container = document.getElementById(TOAST_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = TOAST_CONTAINER_ID;
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.className = `smaca-toast smaca-toast--${opts.type}`;
    el.textContent = message;
    container.appendChild(el);

    requestAnimationFrame(() => el.classList.add('is-visible'));

    setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 300);
    }, opts.duration);
  }

  /**
   * Initialize collapsible accordions
   * @param {string} selector - e.g. '.smaca-accordion'
   */
  function initAccordions(selector) {
    const accordions = document.querySelectorAll(selector);
    accordions.forEach((acc) => {
      const trigger = acc.querySelector('.smaca-accordion__trigger');
      const body = acc.querySelector('.smaca-accordion__body');
      if (!trigger || !body) return;

      const isCollapsed = acc.classList.contains('smaca-accordion--collapsed');
      if (isCollapsed) {
        body.setAttribute('hidden', '');
        trigger.setAttribute('aria-expanded', 'false');
      } else {
        body.removeAttribute('hidden');
        trigger.setAttribute('aria-expanded', 'true');
      }

      if (acc.dataset.smacaAccordionBound === '1') return;
      acc.dataset.smacaAccordionBound = '1';

      trigger.addEventListener('click', () => {
        const hidden = body.hasAttribute('hidden');
        if (hidden) {
          body.removeAttribute('hidden');
          acc.classList.remove('smaca-accordion--collapsed');
          trigger.setAttribute('aria-expanded', 'true');
        } else {
          body.setAttribute('hidden', '');
          acc.classList.add('smaca-accordion--collapsed');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
    });

    refreshGraphExplanations(selector);
  }

  function normalizeMetric(metric) {
    const raw = String(metric || '').trim().toLowerCase();
    if (!raw) return 'co2';
    const aliases = {
      'co2_ppm': 'co2',
      'pm2_5_ugm3': 'pm2_5',
      'pm10_ugm3': 'pm10',
      'temperature_c': 'temperature',
      'humidity_rh': 'humidity',
      'tvoc_index': 'tvoc',
      'uv': 'uv_index',
      'energy': 'energy_kwh'
    };
    return aliases[raw] || raw;
  }

  function getCurrentTimeframe() {
    const tf = global?.SMACAState?.currentTimeframe || DEFAULT_TIMEFRAME;
    return ['24h', '7d', '30d'].includes(tf) ? tf : DEFAULT_TIMEFRAME;
  }

  function getIaqSelectedMetric() {
    const metric = normalizeMetric(global?.SMACAIaqSelectedMetric || 'co2');
    return metric || 'co2';
  }

  function getTimeframeNarrative(timeframe) {
    if (timeframe === '24h') return t('explain_timeframe_24h', 'The 24h view highlights hour-by-hour behavior so you can spot short-term peaks and dips.');
    if (timeframe === '7d') return t('explain_timeframe_7d', 'The 7d view emphasizes day-by-day movement and recurring patterns across the week.');
    return t('explain_timeframe_30d', 'The 30d view focuses on long-term behavior, recurring cycles, and sustained trend direction.');
  }

  function getMetricNarrative(metric) {
    const map = {
      occupancy: t('explain_metric_occupancy', 'This graph shows how people use the space over time. Peaks indicate high activity and flatter periods indicate lower usage.'),
      temperature: t('explain_metric_temperature', 'This graph shows temperature changes over time. Sudden increases or drops can indicate HVAC activity or environmental shifts.'),
      humidity: t('explain_metric_humidity', 'This graph shows relative humidity levels over time. Values outside comfort range can point to ventilation imbalance.'),
      co2: t('explain_metric_co2', 'This graph shows CO₂ concentration over time. Higher values often indicate poor ventilation or high occupancy density.'),
      pm2_5: t('explain_metric_pm25', 'This graph shows PM2.5 concentration over time. Spikes can indicate short-term particulate exposure events.'),
      pm10: t('explain_metric_pm10', 'This graph shows PM10 concentration over time. Elevated periods may indicate dust or coarse particulate buildup.'),
      tvoc: t('explain_metric_tvoc', 'This graph shows TVOC levels over time. Rising values can indicate increased volatile compounds in indoor air.'),
      uv_index: t('explain_metric_uv', 'This graph shows UV intensity over time. Higher values indicate stronger exposure risk and greater protection need.'),
      energy_kwh: t('explain_metric_energy', 'This graph shows energy consumption over time. Peaks reveal high-demand periods and baseline levels show typical load.')
    };
    return map[metric] || t('explain_metric_default', 'This graph shows how the selected metric changes over time.');
  }

  function getChartTypeNarrative(chartType, metric, timeframe) {
    if (chartType === 'flow') {
      if (timeframe === '24h') {
        return 'Bars compare entries and exits each hour, helping identify today\'s busiest windows.';
      }
      return 'Bars compare entries and exits by time bucket, helping reveal recurring usage and traffic rhythm.';
    }
    if (chartType === 'activity_timeline') {
      return 'The area/timeline highlights occupancy intensity by period so repeating busy windows are easier to identify.';
    }
    if (chartType === 'location_bar') {
      return 'Bars compare cumulative inbound activity by location. Longer bars indicate spaces with higher traffic.';
    }
    if (chartType === 'bar_line_combo') {
      return 'Columns show bucket-level energy use while the line shows cumulative progression across the selected range.';
    }
    if (chartType === 'hourly_pattern') {
      return metric === 'uv_index'
        ? 'The pattern view summarizes UV intensity by hour-of-day, making recurrent risk windows easy to spot.'
        : 'The pattern view summarizes typical hour-of-day behavior to reveal recurring high and low periods.';
    }
    if (chartType === 'demand_trend') {
      return 'The trend line emphasizes demand direction and volatility, making surges and persistent high-load windows easier to detect.';
    }
    if (chartType === 'donut_share') {
      return 'Each slice represents a location\'s share of total usage in the selected timeframe. Larger slices indicate heavier contribution.';
    }
    if (chartType === 'daily_comparison') {
      return 'Each bar compares day-level peaks, so you can quickly benchmark stronger vs lighter exposure days.';
    }
    return 'The line traces metric evolution across the selected time buckets to reveal direction and volatility.';
  }

  function getHowToUseNarrative(metric) {
    const map = {
      occupancy: 'Use this to schedule staffing, ventilation windows, and interventions around actual demand periods.',
      co2: 'Use sustained high periods to validate ventilation strategy and correlate with occupancy pressure.',
      temperature: 'Use sharp changes to verify HVAC schedules, control tuning, and thermal comfort consistency.',
      humidity: 'Use out-of-range periods to identify dehumidification or fresh-air balancing needs.',
      pm2_5: 'Use spikes to investigate pollutant sources and evaluate filtration performance.',
      pm10: 'Use repeated peaks to detect dust-heavy periods and mitigation opportunities.',
      tvoc: 'Use elevated intervals to investigate material/activity emissions and airflow effectiveness.',
      uv_index: 'Use peak windows to guide outdoor activity timing and exposure protection messaging.',
      energy_kwh: 'Use high-demand intervals to optimize equipment schedules and reduce unnecessary consumption.'
    };
    return map[metric] || 'Use this chart to identify abnormal shifts and recurring patterns for faster operational decisions.';
  }

  function getGraphExplanation(metric, timeframe, chartType) {
    const normalizedMetric = normalizeMetric(metric);
    const tf = ['24h', '7d', '30d'].includes(timeframe) ? timeframe : DEFAULT_TIMEFRAME;
    return {
      summary: getMetricNarrative(normalizedMetric),
      timeframe: getTimeframeNarrative(tf),
      chartType: getChartTypeNarrative(chartType, normalizedMetric, tf),
      howToUse: getHowToUseNarrative(normalizedMetric)
    };
  }

  function renderGraphExplanationHtml(explanation) {
    return [
      `<p><strong>${t('what_it_shows', 'What it shows:')}</strong> ${explanation.summary}</p>`,
      `<p><strong>${t('timeframe_insight', 'Timeframe insight:')}</strong> ${explanation.timeframe}</p>`,
      `<p><strong>${t('how_to_read_chart', 'How to read this chart:')}</strong> ${explanation.chartType}</p>`,
      `<p><strong>${t('why_it_matters', 'Why it matters:')}</strong> ${explanation.howToUse}</p>`
    ].join('');
  }

  function resolveAccordionChartContext(accordionEl) {
    if (!accordionEl) return null;
    const body = accordionEl.querySelector('.smaca-accordion__body');
    const parent = accordionEl.closest('.card__body') || accordionEl.parentElement;
    if (!body || !parent) return null;
    for (let i = 0; i < KNOWN_CHART_IDS.length; i += 1) {
      const chartId = KNOWN_CHART_IDS[i];
      if (parent.querySelector(`#${chartId}`)) {
        const context = CHART_CONTEXT_BY_ID[chartId] || null;
        if (!context) return null;
        return {
          chartId: chartId,
          chartType: context.chartType,
          metric: context.metric === IAQ_METRIC_KEY ? getIaqSelectedMetric() : context.metric,
          body: body
        };
      }
    }
    return null;
  }

  function refreshGraphExplanations(selector) {
    const targetSelector = selector || '.smaca-accordion';
    const accordions = document.querySelectorAll(targetSelector);
    const timeframe = getCurrentTimeframe();
    accordions.forEach(function (acc) {
      const context = resolveAccordionChartContext(acc);
      if (!context || !context.body) return;
      const explanation = getGraphExplanation(context.metric, timeframe, context.chartType);
      const content = context.body.querySelector('.accordion-content');
      if (!content) return;
      content.innerHTML = renderGraphExplanationHtml(explanation);
      content.dataset.smacaDynamicExplanation = '1';
    });
  }

  function bindGraphExplanationEvents() {
    if (global.__smacaGraphExplanationEventsBound) return;
    global.__smacaGraphExplanationEventsBound = true;
    global.addEventListener('smaca:timeframe-changed', function () {
      refreshGraphExplanations();
    });
    global.addEventListener('smaca:iaq-metric-changed', function () {
      refreshGraphExplanations();
    });
    global.addEventListener('smaca:graph-context-updated', function () {
      refreshGraphExplanations();
    });
    if (document && document.addEventListener) {
      document.addEventListener('DOMContentLoaded', function () {
        refreshGraphExplanations();
      });
    }
  }

  bindGraphExplanationEvents();

  global.SMACAUI = {
    toast,
    initAccordions,
    refreshGraphExplanations,
    getGraphExplanation
  };
})(typeof window !== 'undefined' ? window : this);
