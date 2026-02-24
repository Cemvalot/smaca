(function (global) {
  'use strict';

  const STORAGE_KEY = 'smaca_role';
  const ROLES = { admin: 'admin', user: 'user' };

  // TEMP: Force admin so Management is visible
  // while proper backend RBAC is being wired.
  function getRole() {
    return ROLES.admin;
  }

  function setRole(role) {
    return false;
  }

 
  function isAdmin() {
    return getRole() === ROLES.admin;
  }

  const ADMIN_ONLY_SECTIONS = ['management'];


  const ADMIN_FULL_SECTIONS = ['connectivity'];


  function canAccessSection(sectionId) {
    if (isAdmin()) return true;
    return !ADMIN_ONLY_SECTIONS.includes(sectionId);
  }


  function hasFullAccess(sectionId) {
    if (isAdmin()) return true;
    return !ADMIN_FULL_SECTIONS.includes(sectionId) || sectionId !== 'connectivity';
  }


  function isAdminOnlySection(sectionId) {
    return ADMIN_ONLY_SECTIONS.includes(sectionId);
  }

  global.SMACARBAC = {
    getRole,
    setRole,
    isAdmin,
    canAccessSection,
    hasFullAccess,
    isAdminOnlySection,
    ROLES,
    STORAGE_KEY
  };
})(typeof window !== 'undefined' ? window : this);
