(function (global) {
  'use strict';

  function t(key, fallback) {
    const map = global.SMACA_TRANSLATIONS || {};
    return map[key] || fallback;
  }

  function getRoleView() {
    return global.SMACARoleView || null;
  }

  function isAdminFlag() {
    var rv = getRoleView();
    if (rv && typeof rv.isAdminView === 'function') return rv.isAdminView();
    var role = String((global.SMACA_USER && global.SMACA_USER.role) || '').toLowerCase();
    return role === 'admin';
  }

  function shouldShowConfidenceFlag() {
    var rv = getRoleView();
    if (rv && typeof rv.shouldShowConfidence === 'function') return rv.shouldShowConfidence();
    return isAdminFlag();
  }

  // Admin + researcher get the technical detail block; user/student do not.
  function shouldShowTechnicalDetail() {
    var rv = getRoleView();
    if (rv && typeof rv.shouldShowTechnicalLabels === 'function') return rv.shouldShowTechnicalLabels();
    var role = String((global.SMACA_USER && global.SMACA_USER.role) || '').toLowerCase();
    return role === 'admin' || role === 'researcher';
  }

  function resolveLabel(kpi) {
    if (!kpi || !kpi.key) return '';
    var techLabel = t(kpi.key, kpi.label || kpi.key);
    var rv = getRoleView();
    if (rv && typeof rv.getRoleAwareLabel === 'function') {
      return rv.getRoleAwareLabel(kpi.key, techLabel);
    }
    return techLabel;
  }

  function statusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'insufficient_data') return 'badge--muted';
    if (s === 'good' || s === 'normal' || s === 'low') return 'badge--success';
    if (s === 'notice') return 'badge--info';
    if (s === 'warning' || s === 'medium') return 'badge--warning';
    if (s === 'crowded' || s === 'high' || s === 'critical') return 'badge--danger';
    return 'badge--danger';
  }

  function statusDotClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'insufficient_data') return 'muted';
    if (s === 'good' || s === 'normal' || s === 'low') return 'good';
    if (s === 'notice') return 'notice';
    if (s === 'warning' || s === 'medium') return 'warning';
    return 'critical';
  }

  // Returns { value, unit } as separate display strings so the renderer can
  // give each its own typographic weight (value = headline, unit = secondary).
  function splitValueUnit(kpi) {
    if (!kpi || kpi.value === null || kpi.value === undefined) {
      return { value: '--', unit: '' };
    }
    var dk = String(kpi.display_kind || '').toLowerCase();
    if (dk === 'categorical' || dk === 'boolean') {
      var u = kpi.unit_label || kpi.unit || '';
      return { value: String(kpi.value), unit: u ? String(u) : '' };
    }
    if (kpi.unit === 'ratio') {
      return { value: Number(kpi.value || 0).toFixed(2), unit: '' };
    }
    var unitDisplay = kpi.unit_label || kpi.unit || '';
    return { value: String(kpi.value), unit: unitDisplay };
  }

  function formatConfidence(confidence) {
    const value = String(confidence || '').toLowerCase();
    if (!value) return '';
    if (value === 'estimated') return t('estimated', 'estimated');
    if (value === 'estimated_limited') return t('estimated_limited', 'estimated · limited');
    if (value === 'partial') return t('partial', 'partial');
    if (value === 'none') return t('insufficient_data', 'insufficient_data');
    return value;
  }

  function formatInterpretationLabel(kpi) {
    if (!kpi || !kpi.interpretation_label) return '';
    return String(kpi.interpretation_label);
  }

  function formatStatus(status) {
    const s = String(status || 'unknown').toLowerCase();
    if (s === 'insufficient_data') return t('insufficient_data', 'insufficient_data');
    return t(s, s);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function co2LabelHtml() {
    return '<span class="smaca-chem-co2" aria-label="CO₂">CO<sub>2</sub></span>';
  }

  /** Replace CO2 / CO₂ tokens with subscript markup (safe for server-translated captions). */
  function formatCo2InText(text) {
    return String(text || '')
      .replace(/CO₂/g, co2LabelHtml())
      .replace(/CO2/g, co2LabelHtml());
  }

  /** Strip trailing "(…ppm…)" from ventilation band labels so ppm stays in captions only. */
  function stripTrailingPpmParenthetical(text) {
    if (text === null || text === undefined) return '';
    return String(text).trim().replace(/\s*[\(（][^)）]*ppm[^)）]*[\)）]\s*$/i, '').trim();
  }

  /**
   * Normalized lighting 0–5 only: calmer chip colours (dim/detail → notice; office/residential → good).
   * Raw lux mode keeps API status.
   */
  function resolveLightingDisplayStatus(kpi) {
    if (!kpi || String(kpi.key) !== 'visual_lighting_condition') return null;
    var mode = String(kpi.semantic_mode || '');
    if (mode === 'raw_lux') return null;
    var lvl = kpi.lighting_level;
    if (lvl === undefined || lvl === null) {
      var vn = kpi.value_numeric;
      if (vn !== undefined && vn !== null && Number.isFinite(Number(vn))) {
        lvl = Math.round(Number(vn));
      }
    }
    if (lvl === undefined || lvl === null || !Number.isFinite(Number(lvl))) return null;
    var n = Math.max(0, Math.min(5, Math.round(Number(lvl))));
    if (n === 0 || n >= 5) return 'warning';
    return 'good';
  }

  function resolveEffectiveKpiStatus(kpi, boundModule) {
    if (kpi && kpi.interpretation_status) {
      const m = {
        efficient: 'good',
        moderate: 'warning',
        high: 'warning',
        needs_calibration: 'warning',
        efficient_baseline: 'good',
        elevated_standby_load: 'warning',
        excessive_overnight_load: 'critical'
      };
      if (m[kpi.interpretation_status]) return m[kpi.interpretation_status];
    }
    if (boundModule !== 'iaq' || !kpi) return String(kpi.status || '');
    var ls = resolveLightingDisplayStatus(kpi);
    if (ls) return ls;
    return String(kpi.status || '');
  }

  function ventilationHeadlineParts(kpi) {
    if (!kpi || String(kpi.key) !== 'ventilation_quality_index') return null;
    var raw = String(kpi.value || '').trim();
    var cleaned = stripTrailingPpmParenthetical(raw);
    if (!cleaned) return null;
    return { value: cleaned, unit: '' };
  }

  /** Environmental safety: headline and badge follow KPI status (not a static server string). */
  function environmentalSafetyLabelForStatus(displayStatus, kpi) {
    var s = String(displayStatus || (kpi && kpi.status) || '').toLowerCase();
    if (s === 'insufficient_data') {
      return t('insufficient_data', 'insufficient data');
    }
    if (s === 'good' || s === 'normal' || s === 'low') {
      return t('iaq_env_safety_good', 'Good quality');
    }
    if (s === 'warning' || s === 'medium' || s === 'notice') {
      return t('iaq_env_safety_moderate', 'Moderate quality');
    }
    if (s === 'critical' || s === 'high' || s === 'crowded') {
      return t('iaq_env_safety_high', 'Poor quality');
    }
    var vn = kpi && kpi.value_numeric;
    if (vn !== undefined && vn !== null && Number.isFinite(Number(vn))) {
      var n = Math.round(Number(vn));
      if (n <= 0) return t('iaq_env_safety_good', 'Good quality');
      if (n === 1) return t('iaq_env_safety_moderate', 'Moderate burden');
      return t('iaq_env_safety_high', 'High burden');
    }
    return '';
  }

  function environmentalSafetyHeadlineParts(kpi, displayStatus) {
    if (!kpi || String(kpi.key) !== 'environmental_safety_index') return null;
    var label = environmentalSafetyLabelForStatus(displayStatus, kpi);
    if (!label) return null;
    return { value: label, unit: '' };
  }

  function lightingLevelNumber(kpi) {
    if (!kpi || String(kpi.key) !== 'visual_lighting_condition') return null;
    var lvl = kpi.lighting_level;
    if (lvl === undefined || lvl === null) {
      var vn = kpi.value_numeric;
      if (vn !== undefined && vn !== null && Number.isFinite(Number(vn))) {
        lvl = Math.round(Number(vn));
      }
    }
    if (lvl === undefined || lvl === null || !Number.isFinite(Number(lvl))) return null;
    return Math.max(0, Math.min(5, Math.round(Number(lvl))));
  }

  function lightingHeadlineParts(kpi) {
    if (!kpi || String(kpi.key) !== 'visual_lighting_condition') return null;
    var mode = String(kpi.semantic_mode || '');
    if (mode === 'raw_lux') {
      var lux = kpi.value_numeric;
      if (lux !== undefined && lux !== null && Number.isFinite(Number(lux))) {
        return { value: String(Math.round(Number(lux))), unit: 'lux' };
      }
      return null;
    }
    var n = lightingLevelNumber(kpi);
    if (n === null) return null;
    return { value: String(n), unit: t('iaq_lighting_level_of', '/5') };
  }

  function lightingValueCaptionHtml(kpi) {
    if (!kpi || String(kpi.key) !== 'visual_lighting_condition') return '';
    if (String(kpi.semantic_mode || '') === 'raw_lux') {
      var cap = String(kpi.value_caption || '').trim();
      if (!cap) return '';
      return '<p class="overview-kpi-card__value-caption overview-kpi-card__value-caption--lighting">' + escapeHtml(cap) + '</p>';
    }
    return '';
  }

  /** IAQ-only: semantic mode strip (uses server-translated labels from SMACA_IAQ_SEMANTICS). */
  function buildIaqSemanticRowHtml(kpi, boundModule) {
    if (boundModule !== 'iaq' || !kpi) return '';
    var sem = global.SMACA_IAQ_SEMANTICS || {};
    var key = String(kpi.key || '');
    if (key === 'environmental_safety_index') {
      var rows = [];
      var pm25 = kpi.pm25_ugm3;
      var pm10 = kpi.pm10_ugm3;
      if (pm25 !== null && pm25 !== undefined && Number.isFinite(Number(pm25))) {
        rows.push(
          '<p class="overview-kpi-card__semantic-row" role="note"><span class="overview-kpi-card__semantic-key">' + escapeHtml(t('labels_pm25', 'PM2.5')) + '</span><span class="overview-kpi-card__semantic-sep">: </span><span class="overview-kpi-card__semantic-val">' + escapeHtml(String(Number(pm25).toFixed(1))) + ' µg/m³</span></p>'
        );
      }
      if (pm10 !== null && pm10 !== undefined && Number.isFinite(Number(pm10))) {
        rows.push(
          '<p class="overview-kpi-card__semantic-row" role="note"><span class="overview-kpi-card__semantic-key">' + escapeHtml(t('labels_pm10', 'PM10')) + '</span><span class="overview-kpi-card__semantic-sep">: </span><span class="overview-kpi-card__semantic-val">' + escapeHtml(String(Number(pm10).toFixed(1))) + ' µg/m³</span></p>'
        );
      }
      var tv = String(sem.tvoc_mode_label || '').trim();
      if (tv) {
        rows.push(
          '<p class="overview-kpi-card__semantic-row" role="note"><span class="overview-kpi-card__semantic-key">' + escapeHtml(t('iaq_semantic_row_tvoc', 'TVOC')) + '</span><span class="overview-kpi-card__semantic-sep">: </span><span class="overview-kpi-card__semantic-val">' + escapeHtml(tv) + '</span></p>'
        );
      }
      return rows.join('');
    }
    if (key === 'visual_lighting_condition') {
      var lm = String(sem.light_mode_label || '').trim();
      var lvl = lightingLevelNumber(kpi);
      if (lvl === null && !lm) return '';
      var valHtml = lvl !== null
        ? '<span class="overview-kpi-card__semantic-val overview-kpi-card__semantic-val--level">' + escapeHtml(String(lvl)) + '</span>'
          + '<span class="overview-kpi-card__semantic-val-suffix"> / 5</span>'
          + (lm ? '<span class="overview-kpi-card__semantic-val-meta"> · ' + escapeHtml(lm) + '</span>' : '')
        : escapeHtml(lm);
      return '<p class="overview-kpi-card__semantic-row overview-kpi-card__semantic-row--lighting" role="note"><span class="overview-kpi-card__semantic-key">'
        + escapeHtml(t('iaq_semantic_row_light_level', 'Level')) + '</span><span class="overview-kpi-card__semantic-sep">: </span>'
        + valHtml + '</p>';
    }
    if (key === 'ventilation_quality_index' || key === 'iaq_thermal_comfort') {
      return '<p class="overview-kpi-card__semantic-row overview-kpi-card__semantic-row--muted" role="note">' + escapeHtml(t('iaq_semantic_row_direct', 'Direct measurements')) + '</p>';
    }
    return '';
  }

  // Tiny category icon, rendered top-right of each KPI card. Picked from a
  // small fixed library — no new assets, no new translations, just inline
  // 16px SVGs that match the existing nav iconography. Falls back to a dot.
  var CATEGORY_ICONS = {
    iaq: '<path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
    occupancy: '<path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />',
    energy: '<path d="M13 10V3L4 14h7v7l9-11h-7z" />',
    comfort: '<path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2v16z" />',
    environmental: '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />',
  };

  function categoryIconSvg(category) {
    var key = String(category || '').toLowerCase();
    var path = CATEGORY_ICONS[key];
    if (!path) {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" /></svg>';
    }
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }

  function pillStyle() {
    return 'display:inline-block;padding:1px 6px;border-radius:4px;background:rgba(148,163,184,0.18);font-size:10px;color:var(--muted);margin-left:4px;text-transform:uppercase;letter-spacing:0.4px;';
  }

  function sourceTypeLabel(sourceType) {
    const s = String(sourceType || '').toLowerCase();
    if (s === 'measured') return t('source_type_measured', 'measured');
    if (s === 'estimated') return t('source_type_estimated', 'estimated');
    if (s === 'proxy') return t('source_type_proxy', 'proxy');
    return s;
  }

  function environmentalUnitExplanation(kpi) {
    var sem = global.SMACA_IAQ_SEMANTICS || {};
    var mode = String((kpi && kpi.semantic_mode) || sem.tvoc_semantic_mode || 'iaq_rating_level');
    var tvocPart = mode === 'raw_tvoc_ugm3'
      ? t('kpi_help_environmental_unit_tvoc_ugm3', 'TVOC (µg/m³)')
      : t('kpi_help_environmental_unit_tvoc_rating', 'TVOC (IAQ Rating)');
    var template = t(
      'kpi_help_environmental_units',
      'PM2.5 (µg/m³), PM10 (µg/m³), :tvoc. The card shows a categorical quality level (good / moderate / poor), not a single concentration.'
    );
    return template.replace(':tvoc', tvocPart);
  }

  function resolveUnitExplanation(kpi) {
    if (!kpi) return '';
    if (String(kpi.key || '') === 'environmental_safety_index') {
      return environmentalUnitExplanation(kpi);
    }
    return kpi.unit_explanation ? String(kpi.unit_explanation) : '';
  }

  function resolveUnitLabel(kpi) {
    if (kpi && String(kpi.key || '') === 'environmental_safety_index') {
      return t('kpi_help_measurement_units', 'Measurement unit');
    }
    return t('kpi_help_unit', 'Unit');
  }

  function isCompactIaqHelpKpi(kpi) {
    var key = kpi ? String(kpi.key || '') : '';
    return key === 'environmental_safety_index'
      || key === 'ventilation_quality_index'
      || key === 'iaq_thermal_comfort';
  }

  function isCompactEnvironmentalHelpKpi(kpi) {
    var key = kpi ? String(kpi.key || '') : '';
    return key === 'uv_exposure_risk' || key === 'visual_lighting_condition';
  }

  function isCompactModuleHelpKpi(kpi) {
    return isCompactIaqHelpKpi(kpi) || isCompactEnvironmentalHelpKpi(kpi);
  }

  function showHelpUnitLine(kpi) {
    return kpi && String(kpi.key || '') === 'environmental_safety_index';
  }

  // Build the collapsible "How to read this" details block for a KPI card.
  // For user/student we keep it short (plain definition + unit + limitations).
  // For admin/researcher we include technical definition, sensors, formula.
  function buildHelpBlock(kpi) {
    if (!kpi) return '';
    const showTech = shouldShowTechnicalDetail();
    const showConf = shouldShowConfidenceFlag();
    const help = t('kpi_help_how_to_read', 'How to read this');
    const helpHint = t('kpi_help_hint', 'Click to learn more');

    const plainDef = kpi.plain_definition ? escapeHtml(kpi.plain_definition) : '';
    const unitExpRaw = resolveUnitExplanation(kpi);
    const unitExp = unitExpRaw ? escapeHtml(unitExpRaw) : '';
    const statusMeaning = kpi.status_meaning ? escapeHtml(kpi.status_meaning) : '';
    const limitationsSimple = kpi.limitations_simple ? escapeHtml(kpi.limitations_simple) : '';
    const limitations = kpi.limitations ? escapeHtml(kpi.limitations) : limitationsSimple;
    const techDef = kpi.technical_definition ? escapeHtml(kpi.technical_definition) : '';
    const calc = kpi.calculation_summary ? escapeHtml(kpi.calculation_summary) : '';
    const sensors = Array.isArray(kpi.sensors_used) && kpi.sensors_used.length
      ? kpi.sensors_used.map(escapeHtml).join(', ')
      : '';
    const sourceType = kpi.source_type ? escapeHtml(sourceTypeLabel(kpi.source_type)) : '';
    const confidence = showConf && kpi.confidence ? escapeHtml(formatConfidence(kpi.confidence)) : '';
    const kpiCategory = kpi.kpi_category ? escapeHtml(kpi.kpi_category) : '';

    if (!plainDef && !unitExp && !statusMeaning && !techDef && !limitations) {
      return '';
    }

    var parts = [];
    parts.push('<details class="kpi-help" style="margin-top:var(--space-2);">');
    parts.push('  <summary class="kpi-help__summary" style="cursor:pointer;font-size:11px;color:var(--muted);user-select:none;">'
      + escapeHtml(help)
      + ' <span style="opacity:0.6;">— ' + escapeHtml(helpHint) + '</span>'
      + '</summary>');
    parts.push('  <div class="kpi-help__body" style="margin-top:var(--space-2);font-size:12px;line-height:1.5;color:var(--text);">');

    if (plainDef) {
      parts.push('<p style="margin:0 0 var(--space-1) 0;">' + plainDef + '</p>');
    }
    if (kpi.semantic_explainer && !isCompactModuleHelpKpi(kpi)) {
      parts.push('<p style="margin:0 0 var(--space-1) 0;color:var(--muted);font-size:11px;">' + escapeHtml(kpi.semantic_explainer) + '</p>');
    }
    if (unitExp && showHelpUnitLine(kpi)) {
      parts.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + escapeHtml(resolveUnitLabel(kpi)) + ':</strong> ' + unitExp + '</p>');
    }
    if (statusMeaning && !isCompactModuleHelpKpi(kpi)) {
      parts.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + escapeHtml(t('kpi_help_current_status', 'Current status')) + ':</strong> ' + statusMeaning + '</p>');
    }
    if (showTech) {
      if (techDef && !isCompactModuleHelpKpi(kpi)) {
        parts.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + escapeHtml(t('kpi_help_technical', 'Technical definition')) + ':</strong> ' + techDef + '</p>');
      }
      if (calc && !isCompactModuleHelpKpi(kpi)) {
        parts.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + escapeHtml(t('kpi_help_formula', 'Calculation')) + ':</strong> ' + calc + '</p>');
      }
      if (sensors && !isCompactModuleHelpKpi(kpi)) {
        parts.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + escapeHtml(t('kpi_help_sensors', 'Sensors used')) + ':</strong> ' + sensors + '</p>');
      }
      if (sourceType || kpiCategory) {
        var meta = [];
        if (kpiCategory) meta.push('<span style="' + pillStyle() + '">' + kpiCategory + '</span>');
        if (sourceType) meta.push('<span style="' + pillStyle() + '">' + sourceType + '</span>');
        if (confidence) meta.push('<span style="' + pillStyle() + '">' + escapeHtml(t('kpi_help_confidence', 'confidence')) + ': ' + confidence + '</span>');
        parts.push('<p style="margin:0 0 var(--space-1) 0;">' + meta.join(' ') + '</p>');
      }
    }
    if (limitations && !isCompactModuleHelpKpi(kpi)) {
      var lim = showTech ? limitations : (limitationsSimple || limitations);
      parts.push('<p style="margin:0;color:var(--muted);"><strong>' + escapeHtml(t('kpi_help_limitations', 'Limitations')) + ':</strong> ' + lim + '</p>');
    }

    parts.push('  </div>');
    parts.push('</details>');
    return parts.join('');
  }

  // Energy module: short "What is this metric?" panel (plain definition only).
  function buildEnergyMetricHelpBlock(kpi) {
    if (!kpi) return '';
    var plainDef = kpi.plain_definition ? String(kpi.plain_definition).trim() : '';
    if (!plainDef) return '';

    var parts = [];
    parts.push('<details class="kpi-help kpi-help--energy" style="margin-top:var(--space-2);">');
    parts.push('  <summary class="kpi-help__summary" style="cursor:pointer;font-size:11px;color:var(--muted);user-select:none;">'
      + escapeHtml(t('kpi_what_is_this_metric', 'What is this metric?'))
      + '</summary>');
    parts.push('  <div class="kpi-help__body" style="margin-top:var(--space-2);font-size:12px;line-height:1.5;color:var(--text);">');
    parts.push('<p style="margin:0;">' + escapeHtml(plainDef) + '</p>');
    if (kpi.key === 'normalized_energy_intensity') {
      parts.push('<p style="margin:var(--space-1) 0 0 0;color:var(--muted);font-size:11px;">'
        + escapeHtml(t('kpi_note_occupancy_estimate', 'This is an estimate based on available people-counter data, not exact live headcount.'))
        + '</p>');
    }
    parts.push('  </div>');
    parts.push('</details>');
    return parts.join('');
  }

  function render(containerId, payload, options) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const renderOptions = options || {};
    const compact = Boolean(renderOptions.compact);
    const allowedKeys = Array.isArray(renderOptions.allowedKeys) ? renderOptions.allowedKeys : null;
    const maxItems = Number.isFinite(renderOptions.maxItems) ? Math.max(0, renderOptions.maxItems) : null;
    let list = Array.isArray(payload && payload.kpis) ? payload.kpis : [];
    if (allowedKeys && allowedKeys.length) {
      list = list.filter(function (kpi) {
        return kpi && allowedKeys.indexOf(kpi.key) !== -1;
      });
    }
    const boundModule = String(container.getAttribute('data-kpi-module') || '').toLowerCase();
    if (boundModule === 'occupancy') {
      list = list.filter(function (kpi) {
        if (!kpi) return false;
        return kpi.key === 'crowd_density_level' || kpi.key === 'movement_activity_index';
      });
    }
    if (maxItems !== null) {
      list = list.slice(0, maxItems);
    }
    if (!list.length) {
      var hasLocation = Boolean(payload && payload.location);
      var emptyKey = 'kpi_empty_' + (boundModule || 'overview');
      var fallbackByModule = {
        iaq: 'No air-quality sensors are installed for this selected zone.',
        energy: 'No energy meter is available for this selected location.',
        occupancy: 'No movement counters are available for this selected zone.',
        environmental: 'No UV/environmental sensor is available for this selected location.'
      };
      var defaultMsg = hasLocation
        ? (fallbackByModule[boundModule] || t('no_data_available', 'No KPI data available for this scope.'))
        : t('no_data_available', 'No KPI data available.');
      var msg = hasLocation ? t(emptyKey, fallbackByModule[boundModule] || defaultMsg) : defaultMsg;
      container.innerHTML = '<p class="overview-live-note">' + msg + '</p>';
      return;
    }

    const showConfidence = shouldShowConfidenceFlag();
    const showModuleSource = Boolean(renderOptions.showModuleSource);

    var cards = list.map(function (kpi) {
      const confidence = formatConfidence(kpi.confidence);
      const compactStyle = compact ? ' style="min-height: 124px;"' : '';
      const descriptionText = kpi.key === 'environmental_safety_index' || boundModule === 'energy'
        ? ''
        : (kpi.description || '');
      const showHelp = renderOptions.showHelp !== false && !compact;
      const helpBlock = boundModule === 'energy'
        ? buildEnergyMetricHelpBlock(kpi)
        : (showHelp ? buildHelpBlock(kpi) : '');
      var vu = splitValueUnit(kpi);
      const displayStatus = resolveEffectiveKpiStatus(kpi, boundModule);
      var ventHead = ventilationHeadlineParts(kpi);
      if (ventHead && ventHead.value) {
        vu = { value: ventHead.value, unit: ventHead.unit };
      }
      var envHead = environmentalSafetyHeadlineParts(kpi, displayStatus);
      if (envHead && envHead.value) {
        vu = { value: envHead.value, unit: envHead.unit };
      }
      var lightHead = lightingHeadlineParts(kpi);
      if (lightHead && lightHead.value) {
        vu = { value: lightHead.value, unit: lightHead.unit };
      }
      const snapshotLayout = compact && showModuleSource;
      const interpLabel = formatInterpretationLabel(kpi);
      let badgeText = interpLabel || formatStatus(displayStatus);
      if (kpi.key === 'environmental_safety_index') {
        var envBadge = environmentalSafetyLabelForStatus(displayStatus, kpi);
        if (envBadge) badgeText = envBadge;
      }
      if (kpi.key === 'visual_lighting_condition' && kpi.value) {
        badgeText = String(kpi.value);
      }
      if (snapshotLayout && kpi.key === 'uv_exposure_risk') {
        badgeText = t('overview_uv_high_exposure', 'High exposure');
        var uvStatus = String(displayStatus || '').toLowerCase();
        if (uvStatus === 'good' || uvStatus === 'normal' || uvStatus === 'low') {
          badgeText = t('overview_uv_low_exposure', 'Low exposure');
        } else if (uvStatus === 'notice' || uvStatus === 'medium' || uvStatus === 'moderate') {
          badgeText = t('overview_uv_moderate_exposure', 'Moderate exposure');
        }
      }
      if (snapshotLayout && kpi.key === 'remaining_inside_daily') {
        badgeText = t('estimated', 'estimated');
      }
      const cardTitle = boundModule === 'energy'
        ? ''
        : (kpi.semantic_explainer ? escapeHtml(kpi.semantic_explainer) : '');
      const valueCaption = ((snapshotLayout || !compact) && kpi.value_caption)
        ? (kpi.key === 'ventilation_quality_index'
          ? `<p class="overview-kpi-card__value-caption overview-kpi-card__value-caption--vent-co2">${formatCo2InText(kpi.value_caption)}</p>`
          : kpi.key === 'visual_lighting_condition'
            ? lightingValueCaptionHtml(kpi)
            : `<p class="overview-kpi-card__value-caption">${escapeHtml(String(kpi.value_caption))}</p>`)
        : (kpi.key === 'visual_lighting_condition' && !compact ? lightingValueCaptionHtml(kpi) : '');
      const semanticRow = buildIaqSemanticRowHtml(kpi, boundModule);
      const moduleKeyAttr = kpi.overview_module_key ? ` data-overview-module="${escapeHtml(kpi.overview_module_key)}"` : '';
      const moduleSourceHtml = (snapshotLayout && kpi.overview_module_source)
        ? `<p class="overview-kpi-card__source">${escapeHtml(kpi.overview_module_source)}</p>`
        : '';
      const hintText = (snapshotLayout && !kpi.value_caption && (kpi.semantic_explainer || kpi.description))
        ? String(kpi.semantic_explainer || kpi.description).trim()
        : '';
      const hintHtml = hintText
        ? `<p class="overview-kpi-card__hint" title="${escapeHtml(hintText)}">${escapeHtml(hintText.length > 88 ? hintText.slice(0, 85) + '…' : hintText)}</p>`
        : '';
      const iaqCardClass = (boundModule === 'iaq' && !compact) ? ' overview-kpi-card--iaq' : '';
      const lightingCardClass = kpi.key === 'visual_lighting_condition' ? ' overview-kpi-card--lighting' : '';
      const snapshotClass = snapshotLayout ? ' overview-kpi-card--snapshot' : '';
      const valueHtml = vu.unit
        ? `<span class="stat-card__value-number">${escapeHtml(vu.value)}</span><span class="stat-card__value-unit">${escapeHtml(vu.unit)}</span>`
        : `<span class="stat-card__value-number">${escapeHtml(vu.value)}</span>`;
      const iconKey = String(kpi.kpi_category || '').toLowerCase();
      const pillarKey = (kpi.overview_module_key || boundModule || iconKey || '').toLowerCase();
      const iconHtml = (typeof window !== 'undefined' && window.SMACAIcons && window.SMACAIcons.chipHtml)
        ? window.SMACAIcons.chipHtml(pillarKey, 'md', { className: 'overview-kpi-card__icon' })
        : `<span class="overview-kpi-card__icon" data-category="${escapeHtml(iconKey)}" aria-hidden="true">${categoryIconSvg(iconKey)}</span>`;
      const dotClass = 'overview-kpi-card__dot overview-kpi-card__dot--' + statusDotClass(displayStatus);
      return `
        <article class="stat-card overview-kpi-card${iaqCardClass}${lightingCardClass}${compact ? ' overview-kpi-card--compact' : ''}${snapshotClass}"${moduleKeyAttr}${compactStyle}${cardTitle ? ` title="${cardTitle}"` : ''}>
          ${iconHtml}
          <div class="stat-card__content">
            <div class="stat-card__label">${resolveLabel(kpi)}</div>
            <div class="stat-card__value">${valueHtml}</div>
            <div class="stat-card__meta">
              <span class="badge ${statusClass(displayStatus)} badge--sm overview-kpi-card__badge"><span class="${dotClass}"></span>${escapeHtml(badgeText)}</span>
              ${!compact && showConfidence && confidence && boundModule !== 'iaq' ? `<span class="overview-trend overview-trend--neutral">${confidence}</span>` : ''}
            </div>
            ${hintHtml}
            ${moduleSourceHtml}
            ${valueCaption}
            ${semanticRow}
            ${compact || !String(descriptionText).trim() ? '' : `<p class="overview-live-note overview-kpi-card__desc">${escapeHtml(descriptionText)}</p>`}
            ${helpBlock}
          </div>
        </article>
      `;
    });

    if (renderOptions.withStatusCompanion && list.length === 1) {
      cards.push(buildStatusCompanionCard(list[0]));
    }

    container.innerHTML = cards.join('');
  }

  function formatOccupancyMetricValue(value) {
    if (value === null || value === undefined) return '--';
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '--';
    var rounded = Math.round(numeric * 10) / 10;
    return String(Math.round(rounded) === rounded ? Math.round(rounded) : rounded);
  }

  function floorLabelForOccupancy(floorCode) {
    var code = String(floorCode || '').trim();
    if (!code || code === '—') return '—';
    if (code === 'AUD') return t('occupancy_group_auditorium', 'Auditorium');
    if (code === 'B1') return t('occupancy_group_basement_1', 'Basement 1');
    if (code === 'B2') return t('occupancy_group_basement_2', 'Basement 2');
    if (code === 'F0') return t('occupancy_group_ground_floor', 'Ground Floor');
    if (code === 'F1') return t('occupancy_group_first_floor', '1st Floor');
    if (global.SMACASpatial && typeof global.SMACASpatial.labelFor === 'function') {
      var spatialLabel = global.SMACASpatial.labelFor(code);
      if (spatialLabel) return spatialLabel;
    }
    return code;
  }

  function floorSortWeight(code) {
    var key = String(code || '').toUpperCase();
    if (key === 'AUD') return -2;
    if (key === 'B2') return -1;
    if (key === 'B1') return 0;
    if (key === 'F0') return 1;
    if (key === 'F1') return 2;
    return 50;
  }

  function floorCodeLabel(code) {
    var key = String(code || '').toUpperCase();
    if (key === 'AUD' || key === 'B1' || key === 'B2' || key === 'F0' || key === 'F1') return key;
    return key || '—';
  }

  function floorIconSvg(code) {
    var key = String(code || '').toUpperCase();
    if (key === 'AUD') {
      return '<path d="M4 19v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M6 10V8a2 2 0 0 1 2-2h1M18 10V8a2 2 0 0 0-2-2h-1M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01" />';
    }
    if (/^B\d+$/.test(key)) {
      return '<path d="M7 4h10M7 9h10M7 14h6M10 20l4-4 4 4" />';
    }
    if (key === 'F0') {
      return '<path d="M3 10 12 3l9 7M5 9v11h14V9M9 20v-6h6v6" />';
    }
    return '<path d="M7 4h10M7 9h10M7 14h6M10 16l4 4 4-4" />';
  }

  function resolveReadableSensorLabel(sensor) {
    if (!sensor) return '';
    var candidates = [
      sensor.spatial_label,
      sensor.location_label,
      sensor.name,
      sensor.sensor_location
    ];
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (candidate === null || candidate === undefined) continue;
      var clean = String(candidate).trim();
      if (clean) return clean;
    }
    return '';
  }

  function sensorLabelParts(sensor) {
    if (!sensor) return { primary: '—', secondary: '' };
    var primary = resolveReadableSensorLabel(sensor);
    var spatialProbe = sensor.sensor_location || '';
    if (spatialProbe && global.SMACASpatial && typeof global.SMACASpatial.labelFor === 'function') {
      var resolved = global.SMACASpatial.labelFor(String(spatialProbe));
      if (resolved && resolved !== spatialProbe && (!primary || primary === String(spatialProbe))) {
        primary = String(resolved);
      }
    }
    if (!primary) primary = t('occupancy_sensor_table_sensor', 'Sensor');

    var secondary = sensor.sensor_location || '';
    secondary = secondary ? String(secondary).trim() : '';
    if (secondary && secondary === primary) secondary = '';
    return { primary: primary, secondary: secondary };
  }

  function occupancyImbalanceWarning(sensor) {
    var entries = Number(sensor && sensor.people_in);
    var exits = Number(sensor && sensor.people_out);
    if (!Number.isFinite(entries) || !Number.isFinite(exits)) return false;
    var max = Math.max(entries, exits);
    if (max <= 0) return false;
    return Math.abs(entries - exits) / max > 0.5;
  }

  function sumOccupancySensors(sensors, key) {
    return sensors.reduce(function (sum, sensor) {
      var value = Number(sensor && sensor[key]);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }

  function buildOccupancySensorCard(sensor, windowNote) {
    var labels = sensorLabelParts(sensor);
    var isWarning = occupancyImbalanceWarning(sensor);
    var warning = isWarning
      ? '<span class="badge badge--warning badge--sm occupancy-sensor-card__warning">' + escapeHtml(t('occupancy_sensor_imbalance_warning', 'Possible entry/exit imbalance')) + '</span>'
      : '';
    var okBadge = isWarning
      ? ''
      : '<span class="badge badge--success badge--sm occupancy-sensor-card__ok">' + escapeHtml(t('occupancy_sensor_ok', 'OK')) + '</span>';
    var auditoriumBadge = sensor.is_auditorium_sensor
      ? '<span class="badge badge--warning badge--sm occupancy-sensor-badge">AUD</span>'
      : '';
    var secondary = labels.secondary
      ? '<span class="occupancy-sensor-card__secondary">' + escapeHtml(labels.secondary) + '</span>'
      : '';
    var statusChip = isWarning
      ? '<span class="occupancy-sensor-card__status-chip occupancy-sensor-card__status-chip--warning">' + escapeHtml(t('warning', 'Warning')) + '</span>'
      : '<span class="occupancy-sensor-card__status-chip occupancy-sensor-card__status-chip--ok">' + escapeHtml(t('stable', 'Stable')) + '</span>';
    var details = [
      { label: t('occupancy_sensor_details_location', 'Location'), value: sensor.sensor_location || '—' },
      { label: t('occupancy_sensor_details_floor', 'Floor'), value: sensor.sensor_floor || '—' },
      { label: t('occupancy_metric_people_in', 'Entries'), value: formatOccupancyMetricValue(sensor.people_in) },
      { label: t('occupancy_metric_people_out', 'Exits'), value: formatOccupancyMetricValue(sensor.people_out) },
      { label: t('occupancy_sensor_balance_label', 'Calculated balance'), value: formatOccupancyMetricValue(sensor.remaining_inside) },
      { label: t('occupancy_sensor_details_auditorium', 'Auditorium sensor'), value: sensor.is_auditorium_sensor ? t('occupancy_details_yes', 'Yes') : t('occupancy_details_no', 'No') }
    ];
    if (windowNote) {
      details.push({ label: t('occupancy_sensor_details_window', 'Calculation window'), value: windowNote });
    }
    var detailRows = details.map(function (row) {
      return '<div class="occupancy-sensor-card__detail-row"><span>' + escapeHtml(row.label) + '</span><strong>' + escapeHtml(String(row.value)) + '</strong></div>';
    }).join('');

    return (
      '<article class="occupancy-sensor-card">' +
      '<button type="button" class="occupancy-sensor-card__trigger" aria-expanded="false">' +
      '<span class="occupancy-sensor-card__main">' +
      '<span class="occupancy-sensor-card__identity">' +
      '<span class="occupancy-sensor-card__name">' + escapeHtml(labels.primary) + '</span>' +
      secondary +
      '<span class="occupancy-sensor-card__badges">' + auditoriumBadge + warning + okBadge + '</span>' +
      '</span>' +
      '<span class="occupancy-sensor-card__metrics">' +
      '<span><small>' + escapeHtml(t('occupancy_metric_people_in', 'Entries')) + '</small><strong>' + escapeHtml(formatOccupancyMetricValue(sensor.people_in)) + '</strong></span>' +
      '<span><small>' + escapeHtml(t('occupancy_metric_people_out', 'Exits')) + '</small><strong>' + escapeHtml(formatOccupancyMetricValue(sensor.people_out)) + '</strong></span>' +
      '<span><small>' + escapeHtml(t('occupancy_sensor_balance_label', 'Calculated balance')) + '</small><strong>' + escapeHtml(formatOccupancyMetricValue(sensor.remaining_inside)) + '</strong></span>' +
      '</span>' +
      '<span class="occupancy-sensor-card__side">' + statusChip + '<span class="occupancy-sensor-card__chevron" aria-hidden="true">›</span></span>' +
      '</span>' +
      '</button>' +
      '<div class="occupancy-sensor-card__details" hidden>' +
      '<div class="occupancy-sensor-card__details-inner">' +
      '<div class="occupancy-sensor-card__details-title">' + escapeHtml(t('occupancy_sensor_details_title', 'Sensor details')) + '</div>' +
      detailRows +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  function occupancyBreakdownFingerprint(sensors, windowNote) {
    var scope = '';
    try {
      scope = (global.SMACA_LOCATION || '').toString().trim();
    } catch (e) { /* noop */ }
    var parts = [scope, windowNote || ''];
    sensors.forEach(function (sensor) {
      if (!sensor) return;
      parts.push(
        String(sensor.id || sensor.sensor_id || '') + ':' +
        String(sensor.people_in ?? '') + ':' +
        String(sensor.people_out ?? '') + ':' +
        String(sensor.remaining_inside ?? '')
      );
    });
    return parts.join('|');
  }

  function renderVirtualSensorList(listEl, items, buildHtml, options) {
    if (!listEl) return;
    if (typeof listEl.__smacaVirtualDestroy === 'function') {
      listEl.__smacaVirtualDestroy();
      listEl.__smacaVirtualDestroy = null;
    }
    if (global.SMACAListVirtual && typeof global.SMACAListVirtual.renderVisible === 'function') {
      var handle = global.SMACAListVirtual.renderVisible(listEl, items, buildHtml, options || {});
      listEl.__smacaVirtualDestroy = handle && typeof handle.destroy === 'function' ? handle.destroy : null;
      return;
    }
    listEl.innerHTML = items.map(function (item, idx) {
      return buildHtml(item, idx);
    }).join('');
  }

  function renderOccupancyFloorCards(floorEl, container) {
    if (!floorEl || !container || floorEl.getAttribute('data-floor-cards-ready') === '1') return;
    var floorCode = floorEl.getAttribute('data-floor-code');
    var groups = container.__smacaOccupancyGroups;
    if (!groups || !groups[floorCode]) return;
    var windowNote = container.__smacaOccupancyWindowNote || '';
    var sensors = groups[floorCode];
    var listEl = floorEl.querySelector('.occupancy-sensor-list');
    if (listEl) {
      renderVirtualSensorList(listEl, sensors, function (sensor) {
        return buildOccupancySensorCard(sensor, windowNote);
      }, { threshold: 12, rowHeight: 112 });
    }
    floorEl.setAttribute('data-floor-cards-ready', '1');
  }

  function bindOccupancySensorGroupInteractions(container) {
    if (!container || container.__smacaOccupancyGroupsBound) return;
    container.__smacaOccupancyGroupsBound = true;
    function setFloorState(floor, open) {
      if (!floor) return;
      floor.classList.toggle('is-open', open);
      var trigger = floor.querySelector('.occupancy-sensor-floor__trigger');
      var body = floor.querySelector('.occupancy-sensor-floor__body');
      if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (body) body.hidden = !open;
      if (open) renderOccupancyFloorCards(floor, container);
      var floorCode = floor.getAttribute('data-floor-code');
      if (!floorCode) return;
      if (!container.__smacaFloorState) container.__smacaFloorState = {};
      container.__smacaFloorState[floorCode] = open;
    }
    container.addEventListener('click', function (event) {
      var floorTrigger = event.target.closest('.occupancy-sensor-floor__trigger');
      if (floorTrigger) {
        var floor = floorTrigger.closest('.occupancy-sensor-floor');
        if (floor) setFloorState(floor, !floor.classList.contains('is-open'));
        return;
      }
      var cardTrigger = event.target.closest('.occupancy-sensor-card__trigger');
      if (!cardTrigger) return;
      var card = cardTrigger.closest('.occupancy-sensor-card');
      if (!card) return;
      var details = card.querySelector('.occupancy-sensor-card__details');
      var open = !card.classList.contains('is-open');
      card.classList.toggle('is-open', open);
      cardTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (details) details.hidden = !open;
    });
    container.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var floorTrigger = event.target.closest('.occupancy-sensor-floor__trigger');
      if (floorTrigger) {
        event.preventDefault();
        floorTrigger.click();
      }
    });
  }

  var OCCUPANCY_METRIC_UI = {
    people_in: { accent: 'blue' },
    people_out: { accent: 'green' },
    remaining_inside: { accent: 'purple' },
    crowd_density: { accent: 'amber' },
    peak: { accent: 'pink' }
  };

  function occupancyMetricIconSvg(metricKey) {
    switch (metricKey) {
      case 'people_in':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
      case 'people_out':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
      case 'remaining_inside':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>';
      case 'crowd_density':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M12 11h.01"/></svg>';
      case 'peak':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
      default:
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>';
    }
  }

  function buildOccupancyMetricCard(metricKey, labelKey, subtitleKey, tooltipKey, value) {
    var label = t(labelKey, labelKey);
    var subtitle = t(subtitleKey, '');
    var tooltip = t(tooltipKey, '');
    var ui = OCCUPANCY_METRIC_UI[metricKey] || { accent: 'blue' };
    var accentClass = 'smaca-occupancy-metric-card--' + ui.accent;
    var iconHtml = occupancyMetricIconSvg(metricKey);
    return (
      '<article class="smaca-occupancy-metric-card ' + accentClass + '" data-occupancy-metric="' + escapeHtml(metricKey) + '">' +
      '<span class="smaca-occupancy-metric-card__accent" aria-hidden="true"></span>' +
      '<div class="smaca-occupancy-metric-card__content">' +
      '<div class="smaca-occupancy-metric-card__label" title="' + escapeHtml(tooltip) + '">' + escapeHtml(label) + '</div>' +
      '<div class="smaca-occupancy-metric-card__value">' + escapeHtml(formatOccupancyMetricValue(value)) + '</div>' +
      '<div class="smaca-occupancy-metric-card__subtitle">' + escapeHtml(subtitle) + '</div>' +
      '</div>' +
      '<div class="smaca-occupancy-metric-card__icon smaca-occupancy-metric-card__icon--trailing" aria-hidden="true">' + iconHtml + '</div>' +
      '</article>'
    );
  }

  function updateOccupancyKpiFooter(metrics) {
    var footer = document.getElementById('occupancy-kpi-footer');
    var windowTextEl = document.getElementById('occupancy-kpi-footer-window-text');
    var tzTextEl = document.getElementById('occupancy-kpi-footer-tz-text');
    if (!footer) return;
    if (metrics && metrics.calculation_window_start && metrics.calculation_window_end) {
      var timezone = metrics.calculation_window_timezone || 'Europe/Athens';
      if (windowTextEl) {
        windowTextEl.textContent = t('occupancy_metrics_daily_window', 'Daily window: :start – :end (:timezone)')
          .replace(':start', metrics.calculation_window_start)
          .replace(':end', metrics.calculation_window_end)
          .replace(':timezone', timezone);
      }
      if (tzTextEl) {
        tzTextEl.textContent = timezone;
      }
      footer.hidden = false;
      return;
    }
    footer.hidden = true;
    if (windowTextEl) windowTextEl.textContent = '';
    if (tzTextEl) tzTextEl.textContent = '';
  }

  function renderOccupancyMetrics(summaryContainerId, payload) {
    var container = document.getElementById(summaryContainerId);
    if (!container) return;
    var metrics = payload && payload.occupancy_metrics ? payload.occupancy_metrics : null;
    if (!metrics) {
      var hasLocation = Boolean(payload && payload.location);
      var msg = hasLocation
        ? t('kpi_empty_occupancy', 'No movement counters are available for this selected zone.')
        : t('no_occupancy_data', 'No occupancy data');
      container.innerHTML = '<p class="smaca-occupancy-kpi-grid__empty">' + escapeHtml(msg) + '</p>';
      updateOccupancyKpiFooter(null);
      return;
    }

    var cards = [
      buildOccupancyMetricCard('people_in', 'occupancy_metric_people_in', 'occupancy_metric_subtitle_people_in', 'occupancy_tooltip_people_in', metrics.people_in),
      buildOccupancyMetricCard('people_out', 'occupancy_metric_people_out', 'occupancy_metric_subtitle_people_out', 'occupancy_tooltip_people_out', metrics.people_out),
      buildOccupancyMetricCard('remaining_inside', 'occupancy_metric_remaining_inside', 'occupancy_metric_subtitle_remaining_inside', 'occupancy_tooltip_remaining_inside', metrics.remaining_inside),
      buildOccupancyMetricCard('crowd_density', 'occupancy_metric_crowd_density', 'occupancy_metric_subtitle_crowd_density', 'occupancy_tooltip_crowd_density', metrics.crowd_density),
      buildOccupancyMetricCard('peak', 'occupancy_metric_peak', 'occupancy_metric_subtitle_peak', 'occupancy_tooltip_peak', metrics.peak)
    ];

    container.innerHTML = cards.join('');
    updateOccupancyKpiFooter(metrics);
  }

  function renderOccupancySensorGroups(groupsContainerId, payload) {
    var container = document.getElementById(groupsContainerId);
    if (!container) return;
    var metrics = payload && payload.occupancy_metrics ? payload.occupancy_metrics : null;
    var sensors = metrics && Array.isArray(metrics.sensors) ? metrics.sensors : [];
    if (!sensors.length) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    container.hidden = false;

    var sensorWindowNote = '';
    if (metrics.calculation_window_start && metrics.calculation_window_end) {
      sensorWindowNote = metrics.calculation_window_start + ' – ' + metrics.calculation_window_end;
    }

    var nextFingerprint = occupancyBreakdownFingerprint(sensors, sensorWindowNote);
    if (
      container.__smacaOccupancyFingerprint === nextFingerprint &&
      container.querySelector('.occupancy-sensor-floor')
    ) {
      return;
    }
    container.__smacaOccupancyFingerprint = nextFingerprint;
    container.__smacaOccupancyWindowNote = sensorWindowNote;

    var groups = {};
    sensors.forEach(function (sensor) {
      if (!sensor) return;
      var floor = sensor.sensor_floor || '—';
      if (!groups[floor]) groups[floor] = [];
      groups[floor].push(sensor);
    });
    container.__smacaOccupancyGroups = groups;

    var floorCodes = Object.keys(groups).sort(function (a, b) {
      var weightDiff = floorSortWeight(a) - floorSortWeight(b);
      if (weightDiff !== 0) return weightDiff;
      return String(a).localeCompare(String(b));
    });

    var sections = floorCodes.map(function (floorCode) {
      var floorSensors = groups[floorCode];
      var entries = formatOccupancyMetricValue(sumOccupancySensors(floorSensors, 'people_in'));
      var exits = formatOccupancyMetricValue(sumOccupancySensors(floorSensors, 'people_out'));
      var balance = formatOccupancyMetricValue(sumOccupancySensors(floorSensors, 'remaining_inside'));
      var sensorsCount = String(floorSensors.length);
      var floorName = floorLabelForOccupancy(floorCode);
      var floorCodePill = floorCodeLabel(floorCode);
      var isOpen = false;
      if (container.__smacaFloorState && Object.prototype.hasOwnProperty.call(container.__smacaFloorState, floorCode)) {
        isOpen = Boolean(container.__smacaFloorState[floorCode]);
      } else {
        isOpen = floorCode === 'F0';
      }
      var cards = isOpen
        ? floorSensors.map(function (sensor) {
          return buildOccupancySensorCard(sensor, sensorWindowNote);
        }).join('')
        : '';

      return (
        '<section class="occupancy-sensor-floor' + (isOpen ? ' is-open' : '') + '" data-floor-code="' + escapeHtml(floorCode) + '"' +
        (isOpen ? ' data-floor-cards-ready="1"' : '') + '>' +
        '<button type="button" class="occupancy-sensor-floor__trigger" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
        '<span class="occupancy-sensor-floor__left">' +
        '<span class="occupancy-sensor-floor__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + floorIconSvg(floorCode) + '</svg></span>' +
        '<span class="occupancy-sensor-floor__identity"><span class="occupancy-sensor-floor__code">' + escapeHtml(floorCodePill) + '</span><span class="occupancy-sensor-floor__title">' + escapeHtml(floorName) + '</span></span>' +
        '</span>' +
        '<span class="occupancy-sensor-floor__metrics">' +
        '<span><small>' + escapeHtml(t('occupancy_metric_people_in', 'Entries')) + '</small><strong>' + escapeHtml(entries) + '</strong></span>' +
        '<span><small>' + escapeHtml(t('occupancy_metric_people_out', 'Exits')) + '</small><strong>' + escapeHtml(exits) + '</strong></span>' +
        '<span><small>' + escapeHtml(t('occupancy_sensor_balance_label', 'Calculated balance')) + '</small><strong>' + escapeHtml(balance) + '</strong></span>' +
        '<span><small>' + escapeHtml(t('sensors', 'Sensors')) + '</small><strong>' + escapeHtml(sensorsCount) + '</strong></span>' +
        '</span>' +
        '<span class="occupancy-sensor-floor__right">' +
        '<span class="occupancy-sensor-floor__count-badge">' + escapeHtml(sensorsCount) + '</span>' +
        '<span class="occupancy-sensor-floor__chevron" aria-hidden="true">⌄</span>' +
        '</span>' +
        '</button>' +
        '<div class="occupancy-sensor-floor__body"' + (isOpen ? '' : ' hidden') + '>' +
        '<div class="occupancy-sensor-list">' + cards + '</div>' +
        '</div>' +
        '</section>'
      );
    });

    container.innerHTML = sections.join('');
    bindOccupancySensorGroupInteractions(container);
    floorCodes.forEach(function (floorCode) {
      if (!container.__smacaFloorState || !container.__smacaFloorState[floorCode]) return;
      var floors = container.querySelectorAll('.occupancy-sensor-floor');
      for (var fi = 0; fi < floors.length; fi++) {
        if (floors[fi].getAttribute('data-floor-code') === floorCode) {
          renderOccupancyFloorCards(floors[fi], container);
          break;
        }
      }
    });
  }

  function buildStatusCompanionCard(kpi) {
    if (!kpi) return '';
    const status = String(kpi.status || 'unknown').toLowerCase();
    const isInsufficient = status === 'insufficient_data';
    const meaning = kpi.status_meaning || kpi.description || '';
    const actionLabel = t('recommended_action', 'Recommended action');
    const actionText = kpi.recommended_action || '-';
    const companionLabel = t('kpi_companion_status', 'Status');
    const valueText = isInsufficient
      ? t('insufficient_data', 'insufficient data')
      : t(status, status);

    return `
      <article class="stat-card overview-kpi-card overview-kpi-card--companion">
        <div class="stat-card__content">
          <div class="stat-card__label">${escapeHtml(companionLabel)}</div>
          <div class="stat-card__value">
            <span class="badge ${statusClass(status)} badge--lg">${escapeHtml(valueText)}</span>
          </div>
          ${meaning ? `<p class="overview-live-note" style="margin-top: var(--space-2);">${escapeHtml(meaning)}</p>` : ''}
          <p class="overview-live-note" style="margin-top: var(--space-1);"><strong>${escapeHtml(actionLabel)}:</strong> ${escapeHtml(actionText)}</p>
        </div>
      </article>
    `;
  }

  global.SMACAKPIRenderer = {
    render: render,
    renderOccupancyMetrics: renderOccupancyMetrics,
    renderOccupancySensorGroups: renderOccupancySensorGroups
  };
})(typeof window !== 'undefined' ? window : this);
