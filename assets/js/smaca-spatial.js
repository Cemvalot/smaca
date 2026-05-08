/**
 * SMACA Spatial Intelligence Layer — frontend.
 *
 * Renders the global location selector inside [data-smaca-spatial-slot] and
 * wires it to the rest of the dashboard via the `smaca:scope-change` event.
 *
 * UX in this build:
 *   - Trigger button shows the currently selected location.
 *   - Click opens a floating popover with a sticky search input and
 *     grouped, scrollable sections. Keyboard-friendly:
 *       ↑/↓ navigate, Enter selects, Esc closes, /-key focuses search.
 *   - Normal users: labels only.
 *   - Admin/researcher: labels + raw codes in muted secondary text.
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
  var POPOVER_ID = 'smaca-spatial-popover';

  // -----------------------------------------------------------------------
  // Storage + small helpers
  // -----------------------------------------------------------------------
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

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) { return escapeHtml(value); }

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

  // -----------------------------------------------------------------------
  // Group resolution (unchanged contract — kept compatible)
  // -----------------------------------------------------------------------
  function getBootstrappedGroups() {
    var data = window.SMACA_SPATIAL;
    if (!data || typeof data !== 'object') return null;
    if (!data.groups || typeof data.groups !== 'object') return null;
    return data.groups;
  }

  function applyClientSideRoleFilter(groups) {
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

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  var state = {
    groups: null,
    flatItems: [], // [{ code, label, groupKey }]
    selectedCode: '',
    triggerEl: null,
    triggerLabelEl: null,
    popoverEl: null,
    searchEl: null,
    listEl: null,
    activeIndex: -1,
    filtered: []
  };

  function flatten(groups) {
    var out = [];
    var keys = Object.keys(groups || {}).sort(function (a, b) {
      var oa = (groups[a] && groups[a].order) || 0;
      var ob = (groups[b] && groups[b].order) || 0;
      return oa - ob;
    });
    keys.forEach(function (k) {
      var items = (groups[k] && groups[k].items) || [];
      items.forEach(function (item) {
        if (!item || !item.code) return;
        out.push({
          code: String(item.code).toUpperCase(),
          label: item.label || item.code,
          groupKey: k
        });
      });
    });
    return out;
  }

  // -----------------------------------------------------------------------
  // Popover rendering
  // -----------------------------------------------------------------------
  function groupLabel(key, fallback) {
    var keys = {
      floors: 'spatial_group_floors',
      basements: 'spatial_group_basements',
      special_spaces: 'spatial_group_special_spaces',
      passages: 'spatial_group_passages'
    };
    return t(keys[key] || ('spatial_group_' + key), fallback || key);
  }

  function lookupLabel(code) {
    if (!code) return null;
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

  function currentLabel() {
    if (!state.selectedCode) return t('spatial_all_campus', 'All campus');
    return publicLabelFor(state.selectedCode) || state.selectedCode;
  }

  function renderTriggerLabel() {
    if (!state.triggerLabelEl) return;
    state.triggerLabelEl.textContent = currentLabel();
  }

  function buildList(query) {
    var q = String(query || '').trim().toLowerCase();
    var groups = state.groups || {};
    var keys = Object.keys(groups).sort(function (a, b) {
      var oa = (groups[a] && groups[a].order) || 0;
      var ob = (groups[b] && groups[b].order) || 0;
      return oa - ob;
    });

    var html = '';
    state.filtered = [];

    // "All campus" pseudo-item, always first.
    var allLabel = t('spatial_all_campus', 'All campus');
    if (!q || allLabel.toLowerCase().indexOf(q) !== -1) {
      var allSel = !state.selectedCode ? ' is-selected' : '';
      html += '<button type="button" role="option" data-code=""'
        + ' class="smaca-spatial-popover__row smaca-spatial-popover__row--all' + allSel + '"'
        + ' aria-selected="' + (!state.selectedCode ? 'true' : 'false') + '">'
        + '<span class="smaca-spatial-popover__row-label">' + escapeHtml(allLabel) + '</span>'
        + (allSel ? checkSvg() : '')
        + '</button>';
      state.filtered.push({ code: '', label: allLabel, groupKey: '' });
    }

    keys.forEach(function (k) {
      var group = groups[k];
      if (!group || !Array.isArray(group.items) || !group.items.length) return;
      var sectionLabel = groupLabel(k, group.label || k);

      var matchedItems = group.items.filter(function (item) {
        if (!item || !item.code) return false;
        if (!q) return true;
        return (
          String(item.label || '').toLowerCase().indexOf(q) !== -1
          || String(item.code).toLowerCase().indexOf(q) !== -1
        );
      });
      if (!matchedItems.length) return;

      html += '<div class="smaca-spatial-popover__group" role="group">'
        + '<div class="smaca-spatial-popover__group-label">' + escapeHtml(sectionLabel) + '</div>';

      matchedItems.forEach(function (item) {
        var code = String(item.code).toUpperCase();
        var label = item.label || code;
        var sel = (code === state.selectedCode) ? ' is-selected' : '';
        var includeRawCode = isAdminLike() && code !== label;
        html += '<button type="button" role="option" data-code="' + escapeAttr(code) + '"'
          + ' class="smaca-spatial-popover__row' + sel + '"'
          + ' aria-selected="' + (sel ? 'true' : 'false') + '">'
          + '<span class="smaca-spatial-popover__row-label">' + escapeHtml(label) + '</span>'
          + (includeRawCode ? '<span class="smaca-spatial-popover__row-code">' + escapeHtml(code) + '</span>' : '')
          + (sel ? checkSvg() : '')
          + '</button>';
        state.filtered.push({ code: code, label: label, groupKey: k });
      });

      html += '</div>';
    });

    if (!state.filtered.length) {
      html = '<div class="smaca-spatial-popover__empty">'
        + escapeHtml(t('no_results', 'No matches'))
        + '</div>';
    }

    if (state.listEl) {
      state.listEl.innerHTML = html;
      // Reset active index to the currently selected entry, if visible;
      // otherwise to the first entry.
      var idx = -1;
      for (var i = 0; i < state.filtered.length; i++) {
        if (state.filtered[i].code === state.selectedCode) { idx = i; break; }
      }
      if (idx === -1 && state.filtered.length) idx = 0;
      setActiveIndex(idx);

      var rows = state.listEl.querySelectorAll('.smaca-spatial-popover__row');
      rows.forEach(function (row) {
        row.addEventListener('click', function () {
          var code = row.getAttribute('data-code') || '';
          applyValue(code, { persist: true });
          renderTriggerLabel();
          close();
        });
        row.addEventListener('mousemove', function () {
          var idx = Array.prototype.indexOf.call(rows, row);
          if (idx >= 0) setActiveIndex(idx);
        });
      });
    }
  }

  function checkSvg() {
    return '<svg class="smaca-spatial-popover__check" width="14" height="14" viewBox="0 0 24 24" '
      + 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<polyline points="5 12 10 17 19 7" />'
      + '</svg>';
  }

  function setActiveIndex(idx) {
    state.activeIndex = idx;
    if (!state.listEl) return;
    var rows = state.listEl.querySelectorAll('.smaca-spatial-popover__row');
    rows.forEach(function (r, i) {
      if (i === idx) {
        r.classList.add('is-active');
        // Scroll into view if needed.
        var rRect = r.getBoundingClientRect();
        var lRect = state.listEl.getBoundingClientRect();
        if (rRect.top < lRect.top) r.scrollIntoView({ block: 'nearest' });
        else if (rRect.bottom > lRect.bottom) r.scrollIntoView({ block: 'nearest' });
      } else {
        r.classList.remove('is-active');
      }
    });
  }

  // -----------------------------------------------------------------------
  // Open / close + keyboard handling
  // -----------------------------------------------------------------------
  function ensurePopover() {
    if (state.popoverEl && document.body.contains(state.popoverEl)) return state.popoverEl;
    var el = document.createElement('div');
    el.id = POPOVER_ID;
    el.className = 'smaca-spatial-popover';
    el.setAttribute('role', 'listbox');
    el.setAttribute('aria-label', t('spatial_label', 'Location scope'));
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = ''
      + '<div class="smaca-spatial-popover__search-wrap">'
      + '  <svg class="smaca-spatial-popover__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '    <circle cx="11" cy="11" r="7" />'
      + '    <line x1="21" y1="21" x2="16.65" y2="16.65" />'
      + '  </svg>'
      + '  <input type="search" class="smaca-spatial-popover__search" placeholder="' + escapeAttr(t('search', 'Search')) + '..." aria-label="' + escapeAttr(t('search', 'Search')) + '" autocomplete="off" />'
      + '</div>'
      + '<div class="smaca-spatial-popover__list" role="presentation"></div>';
    document.body.appendChild(el);
    state.popoverEl = el;
    state.searchEl = el.querySelector('.smaca-spatial-popover__search');
    state.listEl = el.querySelector('.smaca-spatial-popover__list');

    state.searchEl.addEventListener('input', function () {
      buildList(state.searchEl.value);
    });
    state.searchEl.addEventListener('keydown', onSearchKeydown);
    return el;
  }

  function onSearchKeydown(ev) {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      var next = Math.min(state.filtered.length - 1, state.activeIndex + 1);
      if (next >= 0) setActiveIndex(next);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      var prev = Math.max(0, state.activeIndex - 1);
      setActiveIndex(prev);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (state.activeIndex >= 0 && state.activeIndex < state.filtered.length) {
        var pick = state.filtered[state.activeIndex];
        applyValue(pick.code || '', { persist: true });
        renderTriggerLabel();
        close();
      }
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
    }
  }

  function position() {
    var trigger = state.triggerEl;
    var pop = state.popoverEl;
    if (!trigger || !pop) return;
    var rect = trigger.getBoundingClientRect();
    var popRect = pop.getBoundingClientRect();
    var margin = 6;
    var viewportW = window.innerWidth || document.documentElement.clientWidth;
    var viewportH = window.innerHeight || document.documentElement.clientHeight;

    // Default: anchor under the trigger, right-aligned to it.
    var left = rect.right - popRect.width;
    var top = rect.bottom + margin;

    if (top + popRect.height > viewportH - margin) {
      top = rect.top - popRect.height - margin;
    }
    if (left < margin) left = margin;
    if (left + popRect.width > viewportW - margin) {
      left = viewportW - popRect.width - margin;
    }
    pop.style.position = 'fixed';
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(Math.max(margin, top)) + 'px';
  }

  function open() {
    var pop = ensurePopover();
    pop.classList.add('is-positioning');
    state.searchEl.value = '';
    buildList('');
    pop.classList.remove('is-positioning');
    pop.classList.add('is-open');
    pop.setAttribute('aria-hidden', 'false');
    if (state.triggerEl) state.triggerEl.setAttribute('aria-expanded', 'true');
    position();
    setTimeout(function () { try { state.searchEl.focus(); } catch (e) {} }, 0);
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onDocKeyDown, true);
    window.addEventListener('resize', position, true);
    window.addEventListener('scroll', position, true);
  }

  function close() {
    if (!state.popoverEl) return;
    state.popoverEl.classList.remove('is-open');
    state.popoverEl.setAttribute('aria-hidden', 'true');
    if (state.triggerEl) state.triggerEl.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDocMouseDown, true);
    document.removeEventListener('keydown', onDocKeyDown, true);
    window.removeEventListener('resize', position, true);
    window.removeEventListener('scroll', position, true);
  }

  function onDocMouseDown(ev) {
    if (!state.popoverEl) return;
    if (state.popoverEl.contains(ev.target)) return;
    if (state.triggerEl && state.triggerEl.contains(ev.target)) return;
    close();
  }

  function onDocKeyDown(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
    }
  }

  // -----------------------------------------------------------------------
  // Value application + scope-change broadcast
  // -----------------------------------------------------------------------
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
    state.selectedCode = normalized;
    window.SMACA_LOCATION = normalized || null;
    if (options && options.persist !== false) {
      safeWrite(normalized);
    }
    var label = lookupLabel(normalized);
    dispatchScopeChange(normalized, label);
  }

  // -----------------------------------------------------------------------
  // Boot
  // -----------------------------------------------------------------------
  function renderLoading(slot) {
    if (!slot) return;
    slot.innerHTML = '<span class="smaca-spatial-trigger smaca-spatial-trigger--loading" aria-busy="true">'
      + spatialIconSvg()
      + '<span class="smaca-spatial-trigger__label">' + escapeHtml(t('loading_data', 'Loading...')) + '</span>'
      + '</span>';
  }

  function spatialIconSvg() {
    return '<span class="smaca-spatial-trigger__icon" aria-hidden="true">'
      + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/>'
      + '<circle cx="12" cy="10" r="3"/></svg>'
      + '</span>';
  }

  function chevronSvg() {
    return '<span class="smaca-spatial-trigger__chevron" aria-hidden="true">'
      + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<polyline points="6 9 12 15 18 9" /></svg>'
      + '</span>';
  }

  function renderTrigger(slot) {
    slot.innerHTML = '<button type="button" class="smaca-spatial-trigger" '
      + 'aria-haspopup="listbox" aria-expanded="false" aria-controls="' + POPOVER_ID + '" '
      + 'title="' + escapeAttr(t('spatial_label', 'Location scope')) + '">'
      + spatialIconSvg()
      + '<span class="smaca-spatial-trigger__label">' + escapeHtml(currentLabel()) + '</span>'
      + chevronSvg()
      + '</button>';
    state.triggerEl = slot.querySelector('.smaca-spatial-trigger');
    state.triggerLabelEl = slot.querySelector('.smaca-spatial-trigger__label');
    state.triggerEl.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (state.popoverEl && state.popoverEl.classList.contains('is-open')) close();
      else open();
    });
    state.triggerEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  }

  async function init() {
    var slot = document.querySelector('[data-smaca-spatial-slot]');
    if (!slot) return;

    // 1) Restore previously selected location BEFORE first KPI fetch fires.
    var stored = normalize(safeRead());
    if (stored) {
      state.selectedCode = stored;
      window.SMACA_LOCATION = stored;
    }

    // 2) Loading affordance.
    renderLoading(slot);

    var groups = await loadGroups();
    if (!groups || !hasAnyItems(groups)) {
      slot.innerHTML = '';
      if (stored) {
        state.selectedCode = '';
        window.SMACA_LOCATION = null;
        safeWrite('');
        dispatchScopeChange(null, null);
      }
      return;
    }

    state.groups = groups;
    state.flatItems = flatten(groups);
    window.SMACA_SPATIAL = window.SMACA_SPATIAL || {};
    window.SMACA_SPATIAL.groups = groups;

    var validCodes = collectValidCodes(groups);
    if (stored && !validCodes[stored]) {
      state.selectedCode = '';
      window.SMACA_LOCATION = null;
      safeWrite('');
      dispatchScopeChange(null, null);
    }

    renderTrigger(slot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SMACASpatial = {
    setLocation: function (code) {
      applyValue(code || '', { persist: true });
      renderTriggerLabel();
    },
    getLocation: function () { return window.SMACA_LOCATION || null; },
    labelFor: publicLabelFor,
    currentModule: currentModule,
    currentRole: currentRole
  };
})();
