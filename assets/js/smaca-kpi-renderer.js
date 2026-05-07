(function (global) {
  'use strict';

  function t(key, fallback) {
    const map = global.SMACA_TRANSLATIONS || {};
    return map[key] || fallback;
  }

  function resolveLabel(kpi) {
    if (!kpi || !kpi.key) return '';
    return t(kpi.key, kpi.label || kpi.key);
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
      list = list.filter(function (kpi) {
        return kpi && kpi.key === 'crowd_density_level';
      });
    }
    if (maxItems !== null) {
      list = list.slice(0, maxItems);
    }
    if (!list.length) {
      container.innerHTML = '<p class="overview-live-note">No KPI data available.</p>';
      return;
    }
    const role = String((global.SMACA_USER && global.SMACA_USER.role) || '').toLowerCase();
    const isAdmin = role === 'admin';

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
              ${!compact && isAdmin && confidence ? `<span class="overview-trend overview-trend--neutral">${confidence}</span>` : ''}
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
