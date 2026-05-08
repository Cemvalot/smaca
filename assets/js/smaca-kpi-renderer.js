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

  function formatValue(kpi) {
    if (!kpi) return '--';
    if (kpi.value === null || kpi.value === undefined) return '--';
    var unitDisplay = kpi.unit_label || kpi.unit || '';
    if (kpi.unit === 'ratio') return Number(kpi.value || 0).toFixed(2);
    return `${kpi.value}${unitDisplay ? ` ${unitDisplay}` : ''}`;
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

    container.innerHTML = list.map(function (kpi) {
      const confidence = formatConfidence(kpi.confidence);
      const actionLabel = t('recommended_action', 'Recommended action');
      const compactStyle = compact ? ' style="min-height: 132px;"' : '';
      const descriptionText = kpi.description || '';
      const actionText = kpi.recommended_action || '-';
      const helpBlock = compact ? '' : buildHelpBlock(kpi);
      return `
        <article class="stat-card overview-kpi-card${compact ? ' overview-kpi-card--compact' : ''}"${compactStyle}>
          <div class="stat-card__content">
            <div class="stat-card__label">${resolveLabel(kpi)}</div>
            <div class="stat-card__value">${formatValue(kpi)}</div>
            <div class="stat-card__meta">
              <span class="badge ${statusClass(kpi.status)} badge--sm">${formatStatus(kpi.status)}</span>
              ${!compact && showConfidence && confidence ? `<span class="overview-trend overview-trend--neutral">${confidence}</span>` : ''}
            </div>
            ${compact ? '' : `<p class="overview-live-note" style="margin-top: var(--space-2);">${descriptionText}</p>`}
            ${compact ? '' : `<p class="overview-live-note" style="margin-top: var(--space-1);"><strong>${actionLabel}:</strong> ${actionText}</p>`}
            ${helpBlock}
          </div>
        </article>
      `;
    }).join('');
  }

  global.SMACAKPIRenderer = {
    render: render
  };
})(typeof window !== 'undefined' ? window : this);
