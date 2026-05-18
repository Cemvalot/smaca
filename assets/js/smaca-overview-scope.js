/**
 * Overview compact scope selector (OVERVIEW-VISUAL-2).
 * Uses SMACA_SPATIAL (already filtered server-side by role/module).
 */
(function (global) {
  'use strict';

  var GROUP_KEYS = ['floors', 'basements', 'special_spaces'];

  function t(key, fb) {
    var dict = global.SMACA_TRANSLATIONS || {};
    var v = dict[key];
    return (v && String(v).trim()) ? v : (fb || key);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function isAdminLike() {
    if (global.SMACARoleView) {
      if (typeof global.SMACARoleView.isAdminView === 'function' && global.SMACARoleView.isAdminView()) return true;
      if (typeof global.SMACARoleView.isResearcherView === 'function' && global.SMACARoleView.isResearcherView()) return true;
    }
    var role = (global.SMACA_USER && global.SMACA_USER.role) || 'user';
    role = String(role).toLowerCase();
    return role === 'admin' || role === 'researcher';
  }

  function getGroups() {
    var data = global.SMACA_SPATIAL && global.SMACA_SPATIAL.groups;
    return (data && typeof data === 'object') ? data : {};
  }

  function collectItems(groups) {
    var out = [];
    GROUP_KEYS.forEach(function (key) {
      var list = (groups[key] && groups[key].items) || [];
      list.forEach(function (item) {
        if (!item || !item.code) return;
        out.push({
          code: String(item.code).toUpperCase(),
          label: item.label || item.code,
          groupKey: key
        });
      });
    });
    return out;
  }

  function groupLabel(key) {
    var map = {
      floors: ['spatial_section_floors', 'Floors'],
      basements: ['spatial_section_basements', 'Basements'],
      special_spaces: ['spatial_section_special_spaces', 'Special spaces']
    };
    var pair = map[key] || ['spatial_section_' + key, key];
    return t(pair[0], pair[1]);
  }

  function lookupLabel(code, items) {
    if (!code) return t('spatial_all_campus', 'All campus');
    for (var i = 0; i < items.length; i++) {
      if (items[i].code === code) return items[i].label;
    }
    return code;
  }

  function setLocation(code) {
    if (global.SMACASpatial && typeof global.SMACASpatial.setLocation === 'function') {
      global.SMACASpatial.setLocation(code);
      return;
    }
    global.SMACA_LOCATION = code || null;
    try {
      global.dispatchEvent(new CustomEvent('smaca:scope-change', { detail: { location: code || null } }));
    } catch (e) { /* ignore */ }
  }

  function groupsWithItems(groups) {
    return GROUP_KEYS.filter(function (key) {
      var list = (groups[key] && groups[key].items) || [];
      return list.length > 0;
    });
  }

  function resolveActiveGroup(current, items) {
    if (!current) return 'all';
    for (var i = 0; i < items.length; i++) {
      if (items[i].code === current) return items[i].groupKey;
    }
    return items.length ? items[0].groupKey : 'all';
  }

  function scopeIconSvg() {
    return '<svg class="overview-scope-control__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">'
      + '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"></path>'
      + '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>'
      + '</svg>';
  }

  function bindScopeControl(host) {
    if (host.getAttribute('data-scope-bound') === '1') return;
    host.setAttribute('data-scope-bound', '1');

    host.addEventListener('click', function (ev) {
      var tab = ev.target.closest('[data-scope-group]');
      if (tab && host.contains(tab)) {
        ev.preventDefault();
        var group = tab.getAttribute('data-scope-group') || 'all';
        host.setAttribute('data-active-group', group);
        if (group === 'all') {
          setLocation('');
          return;
        }
        render(host);
        return;
      }

      var pill = ev.target.closest('[data-spatial-pick]');
      if (pill && host.contains(pill)) {
        ev.preventDefault();
        var code = pill.getAttribute('data-spatial-pick') || '';
        var groupKey = pill.getAttribute('data-scope-group-key');
        if (groupKey) {
          host.setAttribute('data-active-group', groupKey);
        }
        setLocation(code);
      }
    });
  }

  function renderReadonly(host, item) {
    var labelText = item.label || item.code;
    var readonlyLine = escapeHtml(
      t('overview_scope_readonly', 'Scope: :location').replace(':location', labelText)
    );
    host.className = 'overview-scope-control overview-scope-control--readonly';
    host.innerHTML =
      '<div class="overview-scope-control__glass">'
      + scopeIconSvg()
      + '<span class="overview-scope-control__label">' + escapeHtml(t('overview_scope_label', 'Scope')) + '</span>'
      + '<span class="overview-scope-control__readonly-value">' + readonlyLine + '</span>'
      + '</div>';
    var current = (global.SMACA_LOCATION || '').toUpperCase();
    if (!current && item.code) {
      setLocation(item.code);
    }
  }

  function renderCompact(host) {
    var groups = getGroups();
    var items = collectItems(groups);
    var current = (global.SMACA_LOCATION || '').toUpperCase();
    var availableGroups = groupsWithItems(groups);
    var pinnedGroup = host.getAttribute('data-active-group');
    var activeGroup = pinnedGroup || resolveActiveGroup(current, items);
    if (activeGroup === 'all' && current) {
      setLocation('');
      current = '';
    }
    if (activeGroup !== 'all' && availableGroups.indexOf(activeGroup) === -1) {
      activeGroup = availableGroups[0] || 'all';
    }
    host.setAttribute('data-active-group', activeGroup);

    var segments = '';
    if (isAdminLike() || items.length > 1) {
      var allSelected = activeGroup === 'all' ? 'true' : 'false';
      segments += '<button type="button" class="overview-scope-control__segment" role="tab" '
        + 'data-scope-group="all" aria-selected="' + allSelected + '">'
        + escapeHtml(t('spatial_all_campus', 'All campus')) + '</button>';
    }
    availableGroups.forEach(function (key) {
      var pressed = activeGroup === key ? 'true' : 'false';
      segments += '<button type="button" class="overview-scope-control__segment" role="tab" '
        + 'data-scope-group="' + escapeAttr(key) + '" aria-selected="' + pressed + '">'
        + escapeHtml(groupLabel(key)) + '</button>';
    });

    var pills = '';
    var pillsRowHtml = '';
    if (activeGroup !== 'all') {
      items.forEach(function (item) {
        if (item.groupKey !== activeGroup) return;
        var pressed = current === item.code ? 'true' : 'false';
        var titleAttr = isAdminLike() ? ' title="' + escapeAttr(item.code) + '"' : '';
        pills += '<button type="button" class="overview-scope-control__pill" data-spatial-pick="'
          + escapeAttr(item.code) + '" data-scope-group-key="' + escapeAttr(item.groupKey) + '" aria-pressed="'
          + pressed + '"' + titleAttr + '>'
          + escapeHtml(item.label) + '</button>';
      });
      pillsRowHtml =
        '<div class="overview-scope-control__pills-row" role="tabpanel">'
        + '<span class="overview-scope-control__pills-heading">' + escapeHtml(groupLabel(activeGroup)) + '</span>'
        + '<div class="overview-scope-control__pills">' + pills + '</div>'
        + '</div>';
    }

    host.className = 'overview-scope-control overview-scope-control--compact'
      + (activeGroup === 'all' ? ' overview-scope-control--campus' : '');
    host.innerHTML =
      '<div class="overview-scope-control__glass">'
      + '<div class="overview-scope-control__head">'
      + scopeIconSvg()
      + '<span class="overview-scope-control__label">' + escapeHtml(t('overview_scope_label', 'Scope')) + '</span>'
      + '<div class="overview-scope-control__segments" role="tablist" aria-label="' + escapeAttr(t('overview_scope_label', 'Scope')) + '">'
      + segments
      + '</div>'
      + '</div>'
      + pillsRowHtml
      + '</div>';

    bindScopeControl(host);
  }

  function render(host) {
    if (!host) return;
    var groups = getGroups();
    var items = collectItems(groups);

    if (items.length === 1 && !isAdminLike()) {
      renderReadonly(host, items[0]);
      return;
    }

    if (!items.length && !isAdminLike()) {
      host.className = 'overview-scope-control overview-scope-control--readonly';
      host.innerHTML =
        '<div class="overview-scope-control__glass">'
        + scopeIconSvg()
        + '<span class="overview-scope-control__label">' + escapeHtml(t('overview_scope_label', 'Scope')) + '</span>'
        + '<span class="overview-scope-control__readonly-value">'
        + escapeHtml(t('overview_scope_limited_access', 'Showing data for your assigned scope.'))
        + '</span>'
        + '</div>';
      return;
    }

    renderCompact(host);
  }

  function applyOverviewNavRbac() {
    if (!global.SMACARBAC || typeof global.SMACARBAC.canAccessSection !== 'function') return;
    var cards = document.querySelectorAll('#overview .overview-module-card[data-section]');
    Array.prototype.forEach.call(cards, function (card) {
      var section = card.getAttribute('data-section');
      if (!global.SMACARBAC.canAccessSection(section)) {
        card.remove();
      }
    });
  }

  function init() {
    var host = document.getElementById('overview-spatial-zones');
    if (host) render(host);
    applyOverviewNavRbac();
  }

  global.SMACAOverviewScope = {
    init: init,
    render: render,
    applyOverviewNavRbac: applyOverviewNavRbac,
    collectItems: collectItems,
    isAdminLike: isAdminLike
  };
})(typeof window !== 'undefined' ? window : this);
