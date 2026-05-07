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
    // Backwards-compatible fallback if smaca-role.js is missing.
    var role = String((global.SMACA_USER && global.SMACA_USER.role) || '').toLowerCase();
    return role === 'admin';
  }

  function shouldShowConfidenceFlag() {
    var rv = getRoleView();
    if (rv && typeof rv.shouldShowConfidence === 'function') return rv.shouldShowConfidence();
    return isAdminFlag();
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
    if (kpi.unit === 'ratio') return Number(kpi.value || 0).toFixed(2);
    return `${kpi.value}${kpi.unit ? ` ${kpi.unit}` : ''}`;
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
      // Accept either the aggregate "crowd_density_level" (floor / area scope)
      // or the passage-level "movement_activity_index". The KPI engine emits
      // exactly one of the two depending on the selected location.
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
          </div>
        </article>
      `;
    }).join('');
  }

  global.SMACAKPIRenderer = {
    render: render
  };
})(typeof window !== 'undefined' ? window : this);
