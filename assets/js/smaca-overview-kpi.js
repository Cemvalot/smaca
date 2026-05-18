/**
 * Overview KPI mirror — loads module summaries in parallel (no legacy overview formulas).
 */
(function (global) {
  'use strict';

  function t(key, fallback) {
    var map = global.SMACA_TRANSLATIONS || {};
    return map[key] || fallback;
  }

  function findKpi(payload, key) {
    var list = payload && Array.isArray(payload.kpis) ? payload.kpis : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].key === key) return list[i];
    }
    return null;
  }

  function withModuleSource(kpi, moduleKey, moduleLabel) {
    if (!kpi) return null;
    var copy = Object.assign({}, kpi);
    copy.overview_module_key = moduleKey;
    copy.overview_module_source = moduleLabel || t('overview_module_' + moduleKey, moduleKey);
    return copy;
  }

  function buildOccupancyOverviewKpi(occupancyPayload) {
    var metrics = occupancyPayload && occupancyPayload.occupancy_metrics;
    var ri = metrics && metrics.remaining_inside;
    if (ri !== null && ri !== undefined && Number.isFinite(Number(ri))) {
      var val = Number(ri);
      return {
        key: 'remaining_inside_daily',
        label: t('overview_daily_calculated_balance', 'Daily calculated balance'),
        value: Math.round(val * 10) / 10,
        unit: 'people',
        unit_label: '',
        status: val > 0 ? 'normal' : 'good',
        confidence: 'estimated',
        description: t('occupancy_tooltip_remaining_inside', 'People remaining inside for the current calendar day; resets at midnight.'),
        recommended_action: '',
        kpi_category: 'occupancy',
        overview_module_key: 'occupancy',
        overview_module_source: t('overview_module_occupancy', 'Occupancy / Movement'),
        semantic_explainer: t('overview_movement_activity_tooltip', 'Entry/exit movement activity from passage counters. This is not live room occupancy.')
      };
    }

    var movement = findKpi(occupancyPayload, 'movement_activity_index')
      || findKpi(occupancyPayload, 'crowd_density_level');
    if (!movement) return null;
    return withModuleSource(Object.assign({}, movement, {
      label: t('movement_activity_index', 'Movement Activity'),
      semantic_explainer: t('overview_movement_activity_tooltip', 'Entry/exit movement activity from passage counters. This is not live room occupancy.')
    }), 'occupancy', t('overview_module_occupancy', 'Occupancy / Movement'));
  }

  function pickComfortOrUvKpi(iaqPayload, envPayload) {
    var uv = findKpi(envPayload, 'uv_exposure_risk');
    var thermal = findKpi(iaqPayload, 'iaq_thermal_comfort')
      || findKpi(iaqPayload, 'thermal_comfort_index');

    var uvOk = uv && uv.value !== null && uv.value !== undefined
      && String(uv.status || '').toLowerCase() !== 'insufficient_data';
    var thermalOk = thermal && thermal.value !== null && thermal.value !== undefined
      && String(thermal.status || '').toLowerCase() !== 'insufficient_data';

    if (uvOk) {
      return withModuleSource(uv, 'environmental', t('overview_module_environmental', 'Environmental / UV'));
    }
    if (thermalOk) {
      return withModuleSource(thermal, 'iaq', t('overview_module_iaq', 'Indoor Air Quality'));
    }
    if (uv) return withModuleSource(uv, 'environmental', t('overview_module_environmental', 'Environmental / UV'));
    if (thermal) return withModuleSource(thermal, 'iaq', t('overview_module_iaq', 'Indoor Air Quality'));
    return null;
  }

  function buildOverviewKpiList(bundles) {
    var cards = [];
    var iaq = bundles.iaq;
    var energy = bundles.energy;
    var occupancy = bundles.occupancy;
    var environmental = bundles.environmental;

    var iaqHealth = findKpi(iaq, 'iaq_health_index');
    if (iaqHealth) {
      cards.push(withModuleSource(iaqHealth, 'iaq', t('overview_module_iaq', 'Indoor Air Quality')));
    }

    var occ = buildOccupancyOverviewKpi(occupancy);
    if (occ) cards.push(occ);

    var nei = findKpi(energy, 'normalized_energy_intensity');
    if (nei) {
      cards.push(withModuleSource(nei, 'energy', t('overview_module_energy', 'Energy')));
    }

    var comfortUv = pickComfortOrUvKpi(iaq, environmental);
    if (comfortUv) cards.push(comfortUv);

    return cards;
  }

  function updateIaqGauge(iaqPayload) {
    var kpi = findKpi(iaqPayload, 'iaq_health_index');
    var valueEl = document.getElementById('overview-air-score-value');
    var metaEl = document.getElementById('overview-air-score-meta');
    var progressEl = document.getElementById('overview-air-score-progress');
    if (!valueEl) return;

    if (!kpi || kpi.value === null || kpi.value === undefined) {
      valueEl.textContent = '—';
      if (metaEl) metaEl.textContent = t('awaiting_live_iaq_data', 'Awaiting live IAQ data.');
      if (progressEl) progressEl.style.strokeDashoffset = String(326.73);
      return;
    }

    var score = Number(kpi.value);
    valueEl.textContent = Number.isFinite(score) ? String(Math.round(score)) : '—';
    if (metaEl) {
      metaEl.textContent = kpi.value_caption || kpi.semantic_explainer || kpi.description || '';
    }
    if (progressEl && Number.isFinite(score)) {
      var clamped = Math.max(0, Math.min(100, score));
      progressEl.style.strokeDashoffset = String(326.73 - (clamped / 100) * 326.73);
    }
  }

  function renderScopeSummary(payload) {
    var el = document.getElementById('overview-scope-summary');
    if (!el) return;
    var loc = payload && payload.location ? String(payload.location) : '';
    var label = payload && payload.location_label ? String(payload.location_label) : loc;
    if (!loc) {
      el.textContent = t('spatial_scope_summary_campus', 'Showing KPIs for the whole campus');
    } else {
      el.textContent = t('spatial_scope_summary', 'Showing KPIs for :location').replace(':location', label);
    }
  }

  function loadOverviewMirrorKpis() {
    if (!global.SMACAApi || typeof global.SMACAApi.fetchKpiSummary !== 'function') return Promise.resolve();
    if (!global.SMACAKPIRenderer || typeof global.SMACAKPIRenderer.render !== 'function') return Promise.resolve();

    return Promise.all([
      global.SMACAApi.fetchKpiSummary('iaq'),
      global.SMACAApi.fetchKpiSummary('energy'),
      global.SMACAApi.fetchKpiSummary('occupancy'),
      global.SMACAApi.fetchKpiSummary('environmental')
    ]).then(function (results) {
      var bundles = {
        iaq: results[0] || {},
        energy: results[1] || {},
        occupancy: results[2] || {},
        environmental: results[3] || {}
      };
      var scopePayload = bundles.iaq || bundles.energy || bundles.occupancy || bundles.environmental;
      renderScopeSummary(scopePayload);
      updateIaqGauge(bundles.iaq);

      var kpis = buildOverviewKpiList(bundles);
      var payload = {
        location: scopePayload && scopePayload.location,
        location_label: scopePayload && scopePayload.location_label,
        timeframe: scopePayload && scopePayload.timeframe,
        kpis: kpis
      };
      global.SMACAKPIRenderer.render('overview-kpi-summary-cards', payload, {
        compact: true,
        maxItems: 4,
        showModuleSource: true
      });
      global.__smacaOverviewKpiBundles = bundles;
      try {
        global.dispatchEvent(new CustomEvent('smaca:overview-kpis-ready', { detail: bundles }));
      } catch (e) {}
    }).catch(function () {
      renderScopeSummary({ location: global.SMACA_LOCATION || null });
      global.SMACAKPIRenderer.render('overview-kpi-summary-cards', { kpis: [] }, {
        compact: true,
        maxItems: 4,
        showModuleSource: true
      });
    });
  }

  global.SMACAOverviewKpi = {
    load: loadOverviewMirrorKpis,
    buildOverviewKpiList: buildOverviewKpiList,
    findKpi: findKpi
  };
})(typeof window !== 'undefined' ? window : this);
