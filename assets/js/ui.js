/**
 * UI Helpers - Toasts, Accordions
 * Minimal global surface, pure vanilla JS.
 */
(function (global) {
  'use strict';

  const TOAST_CONTAINER_ID = 'smaca-toast-container';

  /**
   * Show a small toast message
   * @param {string} message
   * @param {object} options { type: 'info'|'success'|'error'|'default', duration: number }
   */
  function toast(message, options) {
    const opts = { type: 'default', duration: 3000, ...options };
    let container = document.getElementById(TOAST_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = TOAST_CONTAINER_ID;
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.className = `smaca-toast smaca-toast--${opts.type}`;
    el.textContent = message;
    container.appendChild(el);

    requestAnimationFrame(() => el.classList.add('is-visible'));

    setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 300);
    }, opts.duration);
  }

  /**
   * Initialize collapsible accordions
   * @param {string} selector - e.g. '.smaca-accordion'
   */
  function initAccordions(selector) {
    const accordions = document.querySelectorAll(selector);
    accordions.forEach((acc) => {
      const trigger = acc.querySelector('.smaca-accordion__trigger');
      const body = acc.querySelector('.smaca-accordion__body');
      if (!trigger || !body) return;

      const isCollapsed = acc.classList.contains('smaca-accordion--collapsed');
      if (isCollapsed) body.setAttribute('hidden', '');
      else body.removeAttribute('hidden');

      trigger.addEventListener('click', () => {
        const hidden = body.hasAttribute('hidden');
        if (hidden) {
          body.removeAttribute('hidden');
          acc.classList.remove('smaca-accordion--collapsed');
        } else {
          body.setAttribute('hidden', '');
          acc.classList.add('smaca-accordion--collapsed');
        }
      });
    });
  }

  global.SMACAUI = {
    toast,
    initAccordions
  };
})(typeof window !== 'undefined' ? window : this);
