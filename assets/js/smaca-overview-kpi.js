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

  function overviewUvExposureLabel(kpi) {
    var s = String((kpi && kpi.status) || '').toLowerCase();
    if (s === 'critical' || s === 'extreme' || s === 'high' || s === 'poor' || s === 'warning' || s === 'crowded') {
      return t('overview_uv_high_exposure', 'High exposure');
    }
    if (s === 'medium' || s === 'moderate' || s === 'notice' || s === 'caution') {
      return t('overview_uv_moderate_exposure', 'Moderate exposure');
    }
    if (s === 'good' || s === 'normal' || s === 'low') {
      return t('overview_uv_low_exposure', 'Low exposure');
    }
    return t('overview_uv_high_exposure', 'High exposure');
  }

  function decorateOverviewUvKpi(uv) {
    if (!uv) return uv;
    var copy = Object.assign({}, uv);
    copy.interpretation_label = overviewUvExposureLabel(uv);
    return copy;
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
        unit: '',
        unit_label: t('overview_estimated_balance_unit', 'estimated balance'),
        status: val > 0 ? 'normal' : 'good',
        confidence: 'estimated',
        description: t('overview_balance_not_headcount', 'Calculated from entry/exit counters, not live headcount.'),
        value_caption: t('overview_balance_not_headcount', 'Calculated from entry/exit counters, not live headcount.'),
        recommended_action: '',
        kpi_category: 'occupancy',
        overview_module_key: 'occupancy',
        overview_module_source: t('overview_module_occupancy', 'Occupancy / Movement'),
        semantic_explainer: t('overview_balance_not_headcount', 'Calculated from entry/exit counters, not live headcount.')
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
      return withModuleSource(decorateOverviewUvKpi(uv), 'environmental', t('overview_module_environmental', 'Solar Exposure (UV)'));
    }
    if (thermalOk) {
      return withModuleSource(thermal, 'iaq', t('overview_module_iaq', 'Indoor Air Quality'));
    }
    if (uv) return withModuleSource(decorateOverviewUvKpi(uv), 'environmental', t('overview_module_environmental', 'Solar Exposure (UV)'));
    if (thermal) return withModuleSource(thermal, 'iaq', t('overview_module_iaq', 'Indoor Air Quality'));
    return null;
  }

  function canFetchModule(moduleKey) {
    if (global.SMACARBAC && typeof global.SMACARBAC.canAccessSection === 'function') {
      return global.SMACARBAC.canAccessSection(moduleKey);
    }
    if (moduleKey === 'energy' || moduleKey === 'connectivity' || moduleKey === 'management' || moduleKey === 'ai-insights') {
      return !!(global.SMACA_USER && global.SMACA_USER.isAdmin);
    }
    return true;
  }

  function isLimitedScopeUser() {
    if (global.SMACARBAC && typeof global.SMACARBAC.isAdmin === 'function' && global.SMACARBAC.isAdmin()) {
      return false;
    }
    if (global.SMACARoleView) {
      if (typeof global.SMACARoleView.isAdminView === 'function' && global.SMACARoleView.isAdminView()) return false;
      if (typeof global.SMACARoleView.isResearcherView === 'function' && global.SMACARoleView.isResearcherView()) return false;
    }
    return true;
  }

  function buildOverviewKpiList(bundles) {
    var cards = [];
    var iaq = bundles.iaq;
    var energy = bundles.energy;
    var occupancy = bundles.occupancy;
    var environmental = bundles.environmental;

    var occ = buildOccupancyOverviewKpi(occupancy);
    if (occ) cards.push(occ);

    if (canFetchModule('energy')) {
      var nei = findKpi(energy, 'normalized_energy_intensity');
      if (nei) {
        cards.push(withModuleSource(nei, 'energy', t('overview_module_energy', 'Energy')));
      }
    }

    var comfortUv = pickComfortOrUvKpi(iaq, environmental);
    if (comfortUv) cards.push(comfortUv);

    return cards;
  }

  function renderScopeSummary(payload) {
    var el = document.getElementById('overview-scope-summary');
    if (!el) return;
    if (isLimitedScopeUser()) {
      el.textContent = t('overview_scope_limited_access', 'Showing data for your assigned scope.');
      return;
    }
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

    var moduleOrder = ['iaq', 'energy', 'occupancy', 'environmental'];
    var fetchJobs = moduleOrder.filter(canFetchModule).map(function (mod) {
      return global.SMACAApi.fetchKpiSummary(mod).then(function (payload) {
        return { module: mod, payload: payload || {} };
      });
    });
    return Promise.all(fetchJobs).then(function (results) {
      var bundles = { iaq: {}, energy: {}, occupancy: {}, environmental: {} };
      results.forEach(function (row) {
        if (row && row.module) bundles[row.module] = row.payload;
      });
      var scopePayload = bundles.iaq || bundles.energy || bundles.occupancy || bundles.environmental;
      renderScopeSummary(scopePayload);

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
