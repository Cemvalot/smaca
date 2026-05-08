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
    if (s === 'warning' || s === 'medium') return 'badge--warning';
    if (s === 'crowded' || s === 'high' || s === 'critical') return 'badge--danger';
    return 'badge--danger';
  }

  function statusDotClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'insufficient_data') return 'muted';
    if (s === 'good' || s === 'normal' || s === 'low') return 'good';
    if (s === 'warning' || s === 'medium') return 'warning';
    return 'critical';
  }

  // Returns { value, unit } as separate display strings so the renderer can
  // give each its own typographic weight (value = headline, unit = secondary).
  function splitValueUnit(kpi) {
    if (!kpi || kpi.value === null || kpi.value === undefined) {
      return { value: '--', unit: '' };
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
    if (value === 'partial') return t('partial', 'partial');
    if (value === 'none') return t('insufficient_data', 'insufficient_data');
    return value;
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
    const unitExp = kpi.unit_explanation ? escapeHtml(kpi.unit_explanation) : '';
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
    const d51 = kpi.d51_category ? escapeHtml(kpi.d51_category) : '';

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
    if (unitExp) {
      parts.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + escapeHtml(t('kpi_help_unit', 'Unit')) + ':</strong> ' + unitExp + '</p>');
    }
    if (statusMeaning) {
      parts.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + escapeHtml(t('kpi_help_current_status', 'Current status')) + ':</strong> ' + statusMeaning + '</p>');
    }
    if (showTech) {
      if (techDef) {
        parts.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + escapeHtml(t('kpi_help_technical', 'Technical definition')) + ':</strong> ' + techDef + '</p>');
      }
      if (calc) {
        parts.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + escapeHtml(t('kpi_help_formula', 'Calculation')) + ':</strong> ' + calc + '</p>');
      }
      if (sensors) {
        parts.push('<p style="margin:0 0 var(--space-1) 0;"><strong>' + escapeHtml(t('kpi_help_sensors', 'Sensors used')) + ':</strong> ' + sensors + '</p>');
      }
      if (sourceType || d51) {
        var meta = [];
        if (d51) meta.push('<span style="' + pillStyle() + '">D5.1: ' + d51 + '</span>');
        if (sourceType) meta.push('<span style="' + pillStyle() + '">' + sourceType + '</span>');
        if (confidence) meta.push('<span style="' + pillStyle() + '">' + escapeHtml(t('kpi_help_confidence', 'confidence')) + ': ' + confidence + '</span>');
        parts.push('<p style="margin:0 0 var(--space-1) 0;">' + meta.join(' ') + '</p>');
      }
    }
    if (limitations) {
      var lim = showTech ? limitations : (limitationsSimple || limitations);
      parts.push('<p style="margin:0;color:var(--muted);"><strong>' + escapeHtml(t('kpi_help_limitations', 'Limitations')) + ':</strong> ' + lim + '</p>');
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

    var cards = list.map(function (kpi) {
      const confidence = formatConfidence(kpi.confidence);
      const compactStyle = compact ? ' style="min-height: 124px;"' : '';
      const descriptionText = kpi.description || '';
      const helpBlock = compact ? '' : buildHelpBlock(kpi);
      const vu = splitValueUnit(kpi);
      const valueHtml = vu.unit
        ? `<span class="stat-card__value-number">${escapeHtml(vu.value)}</span><span class="stat-card__value-unit">${escapeHtml(vu.unit)}</span>`
        : `<span class="stat-card__value-number">${escapeHtml(vu.value)}</span>`;
      const iconKey = String(kpi.d51_category || '').toLowerCase();
      const iconHtml = `<span class="overview-kpi-card__icon" data-category="${escapeHtml(iconKey)}" aria-hidden="true">${categoryIconSvg(iconKey)}</span>`;
      const dotClass = 'overview-kpi-card__dot overview-kpi-card__dot--' + statusDotClass(kpi.status);
      return `
        <article class="stat-card overview-kpi-card${compact ? ' overview-kpi-card--compact' : ''}"${compactStyle}>
          ${iconHtml}
          <div class="stat-card__content">
            <div class="stat-card__label">${resolveLabel(kpi)}</div>
            <div class="stat-card__value">${valueHtml}</div>
            <div class="stat-card__meta">
              <span class="badge ${statusClass(kpi.status)} badge--sm overview-kpi-card__badge"><span class="${dotClass}"></span>${formatStatus(kpi.status)}</span>
              ${!compact && showConfidence && confidence ? `<span class="overview-trend overview-trend--neutral">${confidence}</span>` : ''}
            </div>
            ${compact ? '' : `<p class="overview-live-note overview-kpi-card__desc">${descriptionText}</p>`}
            ${helpBlock}
          </div>
        </article>
      `;
    });

    // Optional: when the module response carries a single KPI, append a
    // derived "status companion" card so the KPI grid is never lonely. The
    // companion uses the same KPI item — no new data, no new API call.
    if (renderOptions.withStatusCompanion && list.length === 1) {
      cards.push(buildStatusCompanionCard(list[0]));
    }

    container.innerHTML = cards.join('');
  }

  // Produce a sibling card that surfaces status + plain definition + action
  // prominently. Uses the same payload as the primary KPI card, so it never
  // introduces new data or new API calls.
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
    render: render
  };
})(typeof window !== 'undefined' ? window : this);
