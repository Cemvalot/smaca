/**
 * SMACA Spatial Intelligence Layer — frontend.
 *
 * Renders the global location selector inside [data-smaca-spatial-slot] and
 * wires it to the rest of the dashboard via the `smaca:scope-change` event.
 *
 * Module + role aware:
 *   - sources groups from window.SMACA_SPATIAL (Blade-bootstrapped, already
 *     filtered by current page + role) and falls back to
 *     GET /api/spatial/locations?module=<page>&role=<role>
 *   - never displays passage-level codes to non-admin/non-researcher users
 *   - never displays codes that don't support the current page module
 *   - if the previously selected location is not valid for the current page,
 *     resets selection to "All Campus" and broadcasts the change so KPI cards
 *     re-render with campus scope (no stale numbers)
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'smaca_location_v1';
  var SELECTOR_ID = 'smaca-spatial-selector';

  function safeRead() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; }
    catch (e) { return ''; }
  }

  function safeWrite(value) {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  function t(key, fallback) {
    var dict = (window.SMACA_TRANSLATIONS || {});
    var v = dict[key];
    return (v && String(v).trim()) ? v : (fallback || key);
  }

  function isValidCode(code) {
    if (!code) return false;
    return /^[A-Z0-9][A-Z0-9-]{0,31}$/.test(String(code).toUpperCase());
  }

  function normalize(code) {
    if (!code) return '';
    var u = String(code).toUpperCase().trim();
    return isValidCode(u) ? u : '';
  }

  function currentModule() {
    var page = window.SMACA_CURRENT_PAGE || 'overview';
    return String(page).toLowerCase();
  }

  function currentRole() {
    var role = (window.SMACA_USER && window.SMACA_USER.role) || 'user';
    role = String(role).toLowerCase();
    if (role === 'admin' || role === 'researcher') return role;
    return 'user';
  }

  function isAdminLike() {
    var r = currentRole();
    return r === 'admin' || r === 'researcher';
  }

  function getBootstrappedGroups() {
    var data = window.SMACA_SPATIAL;
    if (!data || typeof data !== 'object') return null;
    if (!data.groups || typeof data.groups !== 'object') return null;
    return data.groups;
  }

  function applyClientSideRoleFilter(groups) {
    // Defence-in-depth: even if the server didn't filter (older bootstrap),
    // never expose passages to non-admin/non-researcher.
    if (isAdminLike()) return groups;
    if (!groups || typeof groups !== 'object') return groups;
    var out = {};
    Object.keys(groups).forEach(function (key) {
      if (key === 'passages') return;
      out[key] = groups[key];
    });
    return out;
  }

  async function loadGroups() {
    var bootstrapped = getBootstrappedGroups();
    if (bootstrapped && hasAnyItems(bootstrapped)) {
      return applyClientSideRoleFilter(bootstrapped);
    }
    if (!window.SMACAApi || typeof window.SMACAApi.fetchSpatialLocations !== 'function') {
      return null;
    }
    try {
      var payload = await window.SMACAApi.fetchSpatialLocations({
        module: currentModule(),
        role: currentRole()
      });
      var groups = (payload && payload.groups) || null;
      return applyClientSideRoleFilter(groups);
    } catch (err) {
      return null;
    }
  }

  function hasAnyItems(groups) {
    if (!groups || typeof groups !== 'object') return false;
    return Object.keys(groups).some(function (k) {
      return groups[k] && Array.isArray(groups[k].items) && groups[k].items.length > 0;
    });
  }

  function collectValidCodes(groups) {
    var set = Object.create(null);
    if (!groups || typeof groups !== 'object') return set;
    Object.keys(groups).forEach(function (k) {
      var items = (groups[k] && groups[k].items) || [];
      items.forEach(function (item) {
        if (item && item.code) set[String(item.code).toUpperCase()] = true;
      });
    });
    return set;
  }

  function buildSelectMarkup(groups, currentValue) {
    var allLabel = t('spatial_all_campus', 'All campus');
    var html = '<select id="' + SELECTOR_ID + '" class="input smaca-spatial-selector" '
      + 'aria-label="' + t('spatial_label', 'Location scope') + '">'
      + '<option value="">' + allLabel + '</option>';

    var groupKeys = Object.keys(groups).sort(function (a, b) {
      var oa = (groups[a] && groups[a].order) || 0;
      var ob = (groups[b] && groups[b].order) || 0;
      return oa - ob;
    });

    var groupLabelKeys = {
      floors: 'spatial_group_floors',
      basements: 'spatial_group_basements',
      special_spaces: 'spatial_group_special_spaces',
      passages: 'spatial_group_passages'
    };

    groupKeys.forEach(function (key) {
      var group = groups[key];
      if (!group || !Array.isArray(group.items) || !group.items.length) return;
      var label = t(groupLabelKeys[key] || ('spatial_group_' + key), group.label || key);
      html += '<optgroup label="' + escapeAttr(label) + '">';
      group.items.forEach(function (item) {
        if (!item || !item.code) return;
        var sel = (currentValue && item.code === currentValue) ? ' selected' : '';
        html += '<option value="' + escapeAttr(item.code) + '"' + sel + '>'
          + escapeText(item.label || item.code)
          + (item.code !== item.label ? ' (' + escapeText(item.code) + ')' : '')
          + '</option>';
      });
      html += '</optgroup>';
    });

    html += '</select>';
    return html;
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeText(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function dispatchScopeChange(code, label) {
    try {
      var event = new CustomEvent('smaca:scope-change', {
        detail: { location: code || null, label: label || null, module: currentModule() }
      });
      window.dispatchEvent(event);
    } catch (e) {
      var fallback = document.createEvent('Event');
      fallback.initEvent('smaca:scope-change', true, true);
      window.dispatchEvent(fallback);
    }
  }

  function applyValue(code, options) {
    var normalized = normalize(code);
    window.SMACA_LOCATION = normalized || null;
    if (options && options.persist !== false) {
      safeWrite(normalized);
    }
    var label = lookupLabel(normalized);
    dispatchScopeChange(normalized, label);
  }

  function lookupLabel(code) {
    if (!code) return null;
    // Search the active page's groups first, then the full topology shipped
    // for code→label resolvers (admin-only fallback for raw-code rendering).
    var sources = [
      getBootstrappedGroups(),
      (window.SMACA_SPATIAL_ALL && window.SMACA_SPATIAL_ALL.groups) || null
    ];
    for (var s = 0; s < sources.length; s++) {
      var groups = sources[s];
      if (!groups) continue;
      var keys = Object.keys(groups);
      for (var i = 0; i < keys.length; i++) {
        var items = (groups[keys[i]] && groups[keys[i]].items) || [];
        for (var j = 0; j < items.length; j++) {
          if (items[j] && items[j].code === code) {
            return items[j].label || code;
          }
        }
      }
    }
    return code;
  }

  // Public label resolver. Tries the bootstrapped groups first; falls back to
  // a derived "<parent label> – <suffix>" when the code is a passage that
  // wasn't shipped in the current page's groups (e.g. user-locale view).
  function publicLabelFor(rawCode) {
    if (!rawCode) return null;
    var code = String(rawCode).toUpperCase().trim();
    if (!code) return null;
    var fromGroups = lookupLabel(code);
    if (fromGroups && fromGroups !== code) return fromGroups;

    var dash = code.indexOf('-');
    if (dash > 0) {
      var parent = code.substring(0, dash);
      var suffix = code.substring(dash + 1);
      var parentLabel = lookupLabel(parent);
      if (parentLabel && parentLabel !== parent) {
        var sep = (window.SMACA_LOCALE === 'el') ? ' – Πέρασμα ' : ' – Passage ';
        return parentLabel + sep + suffix;
      }
    }
    return code;
  }

  function renderLoading(slot) {
    if (!slot) return;
    slot.innerHTML = '<span class="smaca-spatial-selector__wrap" aria-busy="true">'
      + '<span class="smaca-spatial-selector__icon" aria-hidden="true">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/>'
      + '<circle cx="12" cy="10" r="3"/></svg>'
      + '</span>'
      + '<span class="smaca-spatial-selector__loading">' + escapeText(t('loading_data', 'Loading...')) + '</span>'
      + '</span>';
  }

  async function init() {
    var slot = document.querySelector('[data-smaca-spatial-slot]');
    if (!slot) return;

    // 1) Restore previously selected location BEFORE first KPI fetch fires.
    var stored = normalize(safeRead());
    if (stored) {
      window.SMACA_LOCATION = stored;
    }

    // 2) Show a loading affordance while we resolve the module-scoped groups.
    renderLoading(slot);

    var groups = await loadGroups();
    if (!groups || !hasAnyItems(groups)) {
      // No locations are valid for this module/role: clear any stale scope
      // and broadcast so KPIs rerender at campus scope.
      slot.innerHTML = '';
      if (stored) {
        window.SMACA_LOCATION = null;
        safeWrite('');
        dispatchScopeChange(null, null);
      }
      return;
    }

    // 3) Cache merged groups for lookupLabel + downstream consumers.
    window.SMACA_SPATIAL = window.SMACA_SPATIAL || {};
    window.SMACA_SPATIAL.groups = groups;

    // 4) If the previously stored location is not in the (already module/role
    //    filtered) groups, reset to "All Campus" silently and broadcast.
    var validCodes = collectValidCodes(groups);
    var current = stored && validCodes[stored] ? stored : '';
    if (stored && !validCodes[stored]) {
      window.SMACA_LOCATION = null;
      safeWrite('');
      dispatchScopeChange(null, null);
    }

    // 5) Render the actual selector.
    slot.innerHTML = '<label class="smaca-spatial-selector__wrap" '
      + 'title="' + t('spatial_label', 'Location scope') + '">'
      + '<span class="smaca-spatial-selector__icon" aria-hidden="true">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/>'
      + '<circle cx="12" cy="10" r="3"/></svg>'
      + '</span>'
      + buildSelectMarkup(groups, current)
      + '</label>';

    var select = document.getElementById(SELECTOR_ID);
    if (!select) return;

    select.addEventListener('change', function (e) {
      applyValue(e.target.value || '', { persist: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SMACASpatial = {
    setLocation: function (code) { applyValue(code || '', { persist: true }); },
    getLocation: function () { return window.SMACA_LOCATION || null; },
    labelFor: publicLabelFor,
    currentModule: currentModule,
    currentRole: currentRole
  };
})();
