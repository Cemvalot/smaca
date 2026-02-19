/**
 * RBAC (Role-Based Access Control) Module
 * Front-end only simulation - no backend. Uses localStorage for role.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'smaca_role';
  const ROLES = { admin: 'admin', user: 'user' };

  /**
   * Resolve current role from: query param (?role=admin|user) > localStorage > default 'user'
   */
  function getRole() {
    const params = new URLSearchParams(window.location.search);
    const paramRole = params.get('role');
    if (paramRole === ROLES.admin || paramRole === ROLES.user) {
      return paramRole;
    }
    return localStorage.getItem(STORAGE_KEY) || ROLES.user;
  }

  /**
   * Store role in localStorage
   */
  function setRole(role) {
    if (role === ROLES.admin || role === ROLES.user) {
      try {
        localStorage.setItem(STORAGE_KEY, role);
        return true;
      } catch (e) {}
    }
    return false;
  }

  /**
   * Check if current user is admin
   */
  function isAdmin() {
    return getRole() === ROLES.admin;
  }

  /**
   * Admin-only section IDs (hash targets)
   */
  const ADMIN_ONLY_SECTIONS = ['management'];

  /**
   * Sections that require admin for full view (e.g. Connectivity full details)
   */
  const ADMIN_FULL_SECTIONS = ['connectivity'];

  /**
   * Whether user can access a section
   */
  function canAccessSection(sectionId) {
    if (isAdmin()) return true;
    return !ADMIN_ONLY_SECTIONS.includes(sectionId);
  }

  /**
   * Whether user gets full (detailed) view for a section (e.g. connectivity)
   */
  function hasFullAccess(sectionId) {
    if (isAdmin()) return true;
    return !ADMIN_FULL_SECTIONS.includes(sectionId) || sectionId !== 'connectivity';
  }

  /**
   * Check if section is admin-only
   */
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
