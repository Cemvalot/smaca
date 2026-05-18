(function (global) {
  'use strict';

  const STORAGE_KEY = 'smaca_role_readonly';
  const ROLES = { admin: 'admin', user: 'user' };
  function readRoleFromBootContext() {
    const role = global.SMACA_USER && global.SMACA_USER.role
      ? String(global.SMACA_USER.role).trim().toLowerCase()
      : '';
    return role === ROLES.admin ? ROLES.admin : ROLES.user;
  }

  function getRole() {
    return readRoleFromBootContext();
  }

  function setRole() {
    // Frontend role mutations are intentionally disabled.
    return false;
  }

 
  function isAdmin() {
    return getRole() === ROLES.admin;
  }

  const ADMIN_ONLY_SECTIONS = [
    'management',
    'ai-insights',
    'energy',
    'connectivity'
  ];

  function canAccessSection(sectionId) {
    if (isAdmin()) return true;
    return !ADMIN_ONLY_SECTIONS.includes(String(sectionId || '').toLowerCase());
  }

  function hasFullAccess(sectionId) {
    return canAccessSection(sectionId);
  }


  function isAdminOnlySection(sectionId) {
    return ADMIN_ONLY_SECTIONS.includes(sectionId);
  }

  function applySidebarNavAccess() {
    var nav = document.querySelector('.sidebar__nav');
    if (!nav) return;

    nav.querySelectorAll('[data-section]').forEach(function (link) {
      var section = link.getAttribute('data-section');
      if (!canAccessSection(section)) {
        link.remove();
      }
    });

    nav.querySelectorAll('.sidebar__group').forEach(function (group) {
      if (!group.querySelector('[data-section]')) {
        group.remove();
      }
    });
  }

  function applyAdminVisibility() {
    var admin = isAdmin();
    document.querySelectorAll('[data-admin-only]').forEach(function (el) {
      if (admin) {
        el.hidden = false;
        el.removeAttribute('aria-hidden');
      } else {
        el.remove();
      }
    });
    applySidebarNavAccess();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAdminVisibility);
  } else {
    applyAdminVisibility();
  }

  global.SMACARBAC = {
    getRole,
    setRole,
    isAdmin,
    canAccessSection,
    hasFullAccess,
    isAdminOnlySection,
    applySidebarNavAccess,
    applyAdminVisibility,
    ROLES,
    STORAGE_KEY
  };
})(typeof window !== 'undefined' ? window : this);
