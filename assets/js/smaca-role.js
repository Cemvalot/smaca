/**
 * SMACA Role-aware View helper (Phase 5 — UX/RBAC presentation layer).
 *
 * Centralizes role-based rendering decisions. The session role is bootstrapped
 * by the layout into `window.SMACA_USER.role` (one of: admin, researcher,
 * user, student, …). This helper exposes a small, stable API so the renderer
 * and pages don't sprinkle `if (admin)` branches.
 *
 * Roles are mapped to three views:
 *   - "admin"      → full diagnostics, technical labels, confidence chips
 *   - "researcher" → technical labels + confidence, but no admin operational
 *                    diagnostics (admin sections in blades are still hidden)
 *   - "user"       → simplified labels, no confidence, no diagnostics
 *                    (covers `user`, `student`, and any unknown role)
 *
 * No backend permission systems are introduced; this is purely presentation.
 */
(function (global) {
  'use strict';

  function readRole() {
    var raw = (global.SMACA_USER && global.SMACA_USER.role)
      ? String(global.SMACA_USER.role).toLowerCase().trim()
      : '';
    if (raw === 'admin') return 'admin';
    if (raw === 'researcher') return 'researcher';
    return 'user';
  }

  function isAdminView() { return readRole() === 'admin'; }
  function isResearcherView() { return readRole() === 'researcher'; }
  function isSimpleView() {
    var r = readRole();
    return r !== 'admin' && r !== 'researcher';
  }

  function shouldShowConfidence() {
    var r = readRole();
    return r === 'admin' || r === 'researcher';
  }

  function shouldShowOperationalDiagnostics() {
    return isAdminView();
  }

  function shouldShowTechnicalLabels() {
    var r = readRole();
    return r === 'admin' || r === 'researcher';
  }

  function tr(key, fb) {
    var d = (global.SMACA_TRANSLATIONS || {});
    var v = d[key];
    return (v && String(v).trim()) ? v : (fb || key);
  }

  // KPI key → simple-label translation key.
  var SIMPLE_LABEL_KEY_MAP = {
    normalized_energy_intensity: 'simple_normalized_energy_intensity',
    base_load_index: 'simple_base_load_index',
    crowd_density_level: 'simple_crowd_density_level',
    movement_activity_index: 'simple_movement_activity_index',
    uv_exposure_risk: 'simple_uv_exposure_risk',
    environmental_safety_index: 'simple_environmental_safety_index',
    iaq_thermal_comfort: 'simple_iaq_thermal_comfort',
    ventilation_quality_index: 'simple_ventilation_quality_index',
    visual_lighting_condition: 'simple_visual_lighting_condition',
    thermal_comfort_index: 'simple_thermal_comfort_index',
    visual_comfort_kpi: 'simple_visual_comfort_kpi'
  };

  /**
   * Returns a label for the KPI: the technical label for admin/researcher,
   * the simplified label (when one is configured) for everyone else.
   */
  function getRoleAwareLabel(key, technicalLabel) {
    var fallback = (technicalLabel === undefined || technicalLabel === null) ? key : technicalLabel;
    if (shouldShowTechnicalLabels()) return fallback;
    var simpleKey = SIMPLE_LABEL_KEY_MAP[key];
    if (!simpleKey) return fallback;
    return tr(simpleKey, fallback);
  }

  /**
   * Returns a friendlier rendering of an operational status string for the
   * simple view; admin/researcher get the original verb verbatim.
   */
  function getRoleAwareStatus(status, fallback) {
    if (shouldShowTechnicalLabels()) return fallback;
    var s = String(status || '').toLowerCase();
    if (s === 'operational') return tr('simple_operational', fallback);
    if (s === 'data_freshness') return tr('simple_data_freshness', fallback);
    return fallback;
  }

  function applyAdminVisibility() {
    var admin = isAdminView();
    var res = isResearcherView();
    var nodes = document.querySelectorAll('[data-admin-only]');
    Array.prototype.forEach.call(nodes, function (el) {
      el.hidden = !admin;
      if (!admin) {
        el.setAttribute('aria-hidden', 'true');
      } else {
        el.removeAttribute('aria-hidden');
      }
    });
    // [data-tech-only] = visible for admin and researcher (technical view).
    var techNodes = document.querySelectorAll('[data-tech-only]');
    Array.prototype.forEach.call(techNodes, function (el) {
      var visible = admin || res;
      el.hidden = !visible;
      if (!visible) {
        el.setAttribute('aria-hidden', 'true');
      } else {
        el.removeAttribute('aria-hidden');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAdminVisibility);
  } else {
    applyAdminVisibility();
  }

  global.SMACARoleView = {
    getRole: readRole,
    isAdminView: isAdminView,
    isResearcherView: isResearcherView,
    isSimpleView: isSimpleView,
    shouldShowConfidence: shouldShowConfidence,
    shouldShowOperationalDiagnostics: shouldShowOperationalDiagnostics,
    shouldShowTechnicalLabels: shouldShowTechnicalLabels,
    getRoleAwareLabel: getRoleAwareLabel,
    getRoleAwareStatus: getRoleAwareStatus,
    applyAdminVisibility: applyAdminVisibility
  };
})(typeof window !== 'undefined' ? window : this);
