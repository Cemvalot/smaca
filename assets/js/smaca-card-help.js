/**
 * SMACA Card Help — unified "How to read this" popover.
 * ====================================================
 *
 * Replaces the two earlier in-card explanation surfaces:
 *   1) Page-authored `.smaca-accordion` blocks ("What is this graph?")
 *   2) Auto-injected `.smaca-chart-help` panels (from chart metadata)
 *
 * Both are now hidden in-flow (kept in the DOM, content preserved) and
 * surfaced through a single info icon in the top-right of every chart /
 * KPI card. Clicking the icon opens a frosted floating popover anchored
 * to the button. Popovers fade-and-scale in, click-outside / ESC closes.
 *
 * Notes:
 *  - Pure presentation layer. No backend, no API, no KPI changes.
 *  - Works for cards both with and without a `.card__header`. When a
 *    header exists, the icon is appended there. Otherwise the icon is
 *    floated absolutely in the card's top-right corner.
 *  - Preserves accessibility: `aria-haspopup="dialog"`, `aria-expanded`,
 *    `aria-controls`, focus management on open/close, ESC to close.
 */
(function (global) {
  'use strict';

  var POPOVER_ID = 'smaca-card-help-popover';
  var BUTTON_CLASS = 'smaca-help-btn';
  var ATTR_BOUND = 'data-smaca-help-bound';

  // -----------------------------------------------------------------------
  // Translation helpers
  // -----------------------------------------------------------------------
  function t(key, fallback) {
    var dict = global.SMACA_TRANSLATIONS || {};
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

  // -----------------------------------------------------------------------
  // Help content extraction
  // -----------------------------------------------------------------------

  // Page-authored `.smaca-accordion` block → return inner body HTML.
  function extractFromAccordion(accordionEl) {
    if (!accordionEl) return null;
    var triggerLabel = (accordionEl.querySelector('.smaca-accordion__trigger > span') || {}).textContent;
    var bodyEl = accordionEl.querySelector('.smaca-accordion__body .accordion-content')
      || accordionEl.querySelector('.smaca-accordion__body');
    if (!bodyEl) return null;
    var html = bodyEl.innerHTML;
    if (!html || !html.trim()) return null;
    return {
      title: (triggerLabel && String(triggerLabel).trim()) || t('chart_help_how_to_read', 'How to read this chart'),
      bodyHtml: html
    };
  }

  // Chart metadata (window.SMACA_CHART_METADATA) → structured popover body.
  function extractFromChartMetadata(card) {
    var dict = (global.SMACA_CHART_METADATA && global.SMACA_CHART_METADATA.charts) || {};
    if (!dict || typeof dict !== 'object') return null;
    var ids = Object.keys(dict);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (!id) continue;
      if (card.querySelector('#' + cssEscape(id))) {
        var meta = dict[id];
        if (!meta) continue;
        var rows = [];
        function row(label, value) {
          if (!value) return;
          rows.push(
            '<p class="smaca-help-row"><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(value) + '</p>'
          );
        }
        row(t('chart_help_what', 'What this shows'), meta.what);
        row(t('chart_help_data_source', 'Data source'), meta.data_source);
        row(t('chart_help_read', 'How to read peaks and trends'), meta.how_to_read);
        row(t('chart_help_timeframe', 'Timeframe'), meta.timeframe_note);
        row(t('chart_help_actions', 'Actions to consider'), meta.actions);
        if (meta.limitations) {
          rows.push(
            '<p class="smaca-help-row smaca-help-row--muted"><strong>'
            + escapeHtml(t('chart_help_limitations', 'Limitations'))
            + ':</strong> ' + escapeHtml(meta.limitations) + '</p>'
          );
        }
        if (!rows.length) continue;
        return {
          title: t('chart_help_how_to_read', 'How to read this chart'),
          bodyHtml: rows.join('')
        };
      }
    }
    return null;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, function (ch) {
      return '\\' + ch;
    });
  }

  // -----------------------------------------------------------------------
  // Popover singleton
  // -----------------------------------------------------------------------
  var popoverEl = null;
  var activeBtn = null;

  function ensurePopover() {
    if (popoverEl && document.body.contains(popoverEl)) return popoverEl;
    popoverEl = document.createElement('div');
    popoverEl.id = POPOVER_ID;
    popoverEl.className = 'smaca-help-popover';
    popoverEl.setAttribute('role', 'dialog');
    popoverEl.setAttribute('aria-modal', 'false');
    popoverEl.setAttribute('aria-hidden', 'true');
    popoverEl.innerHTML = ''
      + '<div class="smaca-help-popover__inner">'
      + '  <header class="smaca-help-popover__header">'
      + '    <span class="smaca-help-popover__title"></span>'
      + '    <button type="button" class="smaca-help-popover__close" aria-label="' + escapeHtml(t('close', 'Close')) + '">&times;</button>'
      + '  </header>'
      + '  <div class="smaca-help-popover__body"></div>'
      + '</div>';
    document.body.appendChild(popoverEl);
    popoverEl.querySelector('.smaca-help-popover__close')
      .addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        hide();
      });
    return popoverEl;
  }

  function setContent(title, bodyHtml) {
    var pop = ensurePopover();
    pop.querySelector('.smaca-help-popover__title').textContent = title || '';
    pop.querySelector('.smaca-help-popover__body').innerHTML = bodyHtml || '';
  }

  function show(btn, title, bodyHtml) {
    if (!btn) return;
    if (activeBtn === btn && popoverEl && popoverEl.classList.contains('is-open')) {
      hide();
      return;
    }
    activeBtn = btn;
    setContent(title, bodyHtml);
    var pop = ensurePopover();
    pop.classList.add('is-positioning');
    position(btn);
    pop.classList.remove('is-positioning');
    pop.classList.add('is-open');
    pop.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onDocKeyDown, true);
    window.addEventListener('resize', repositionDeferred, true);
    window.addEventListener('scroll', repositionDeferred, true);
  }

  function hide() {
    if (!popoverEl) return;
    popoverEl.classList.remove('is-open');
    popoverEl.setAttribute('aria-hidden', 'true');
    if (activeBtn) {
      activeBtn.setAttribute('aria-expanded', 'false');
      try { activeBtn.focus(); } catch (e) {}
    }
    activeBtn = null;
    document.removeEventListener('mousedown', onDocMouseDown, true);
    document.removeEventListener('keydown', onDocKeyDown, true);
    window.removeEventListener('resize', repositionDeferred, true);
    window.removeEventListener('scroll', repositionDeferred, true);
  }

  function repositionDeferred() {
    if (!activeBtn || !popoverEl || !popoverEl.classList.contains('is-open')) return;
    position(activeBtn);
  }

  function onDocMouseDown(ev) {
    if (!popoverEl) return;
    if (popoverEl.contains(ev.target)) return;
    if (activeBtn && activeBtn.contains(ev.target)) return;
    hide();
  }

  function onDocKeyDown(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      hide();
    }
  }

  // Position the popover so it stays inside the viewport, anchored to the
  // bottom-right corner of the trigger button by default.
  function position(btn) {
    var pop = ensurePopover();
    var rect = btn.getBoundingClientRect();
    var popRect = pop.getBoundingClientRect();
    var margin = 8;
    var viewportW = window.innerWidth || document.documentElement.clientWidth;
    var viewportH = window.innerHeight || document.documentElement.clientHeight;

    // Default: anchored to the right edge of the trigger, opens below.
    var left = rect.right - popRect.width;
    var top = rect.bottom + margin;

    // Flip up if not enough space below.
    if (top + popRect.height > viewportH - margin) {
      top = rect.top - popRect.height - margin;
    }
    // Clamp horizontally.
    if (left < margin) left = margin;
    if (left + popRect.width > viewportW - margin) {
      left = viewportW - popRect.width - margin;
    }

    pop.style.position = 'fixed';
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(Math.max(margin, top)) + 'px';
  }

  // -----------------------------------------------------------------------
  // Button injection
  // -----------------------------------------------------------------------
  function buildHelpButton(label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BUTTON_CLASS;
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', POPOVER_ID);
    btn.title = label || t('chart_help_how_to_read', 'How to read this chart');
    btn.setAttribute('aria-label', btn.title);
    btn.innerHTML = ''
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<circle cx="12" cy="12" r="9" />'
      + '<line x1="12" y1="11" x2="12" y2="16" />'
      + '<circle cx="12" cy="8" r="0.6" fill="currentColor" />'
      + '</svg>';
    return btn;
  }

  function attachToCard(card) {
    if (!card || card.getAttribute(ATTR_BOUND) === '1') return;

    // Collect help sources in priority order: page-authored accordion(s)
    // first (richer copy), then fallback to chart metadata.
    var sources = [];
    var accordions = card.querySelectorAll('.smaca-accordion');
    accordions.forEach(function (acc) {
      var src = extractFromAccordion(acc);
      if (src) sources.push(src);
    });

    var metaSrc = extractFromChartMetadata(card);
    if (metaSrc) sources.push(metaSrc);

    if (!sources.length) return;

    // Mark the card so we don't re-bind. Hide the in-flow accordions; they
    // remain in the DOM as the canonical source of truth so that, if this
    // module fails to load for any reason, the content stays accessible.
    card.setAttribute(ATTR_BOUND, '1');
    card.classList.add('has-card-help');

    // Pick the first source as the popover content. Multiple accordions in
    // a single card are very rare; if more than one is found we concat.
    var combinedTitle = sources[0].title;
    var combinedBody = sources.map(function (s) { return s.bodyHtml; }).join('<hr class="smaca-help-row__divider" />');

    var btn = buildHelpButton(combinedTitle);
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      show(btn, combinedTitle, combinedBody);
    });

    var header = card.querySelector('.card__header');
    if (header) {
      // Mount inside the header. The header is the natural anchor.
      btn.classList.add(BUTTON_CLASS + '--inheader');
      header.appendChild(btn);
    } else {
      // Float in the card's top-right corner.
      btn.classList.add(BUTTON_CLASS + '--floating');
      // Ensure the card is the positioning context.
      try {
        var current = window.getComputedStyle(card).position;
        if (current === 'static' || !current) {
          card.style.position = 'relative';
        }
      } catch (e) {}
      card.appendChild(btn);
    }
  }

  function refresh() {
    var cards = document.querySelectorAll('.card');
    cards.forEach(attachToCard);
  }

  // -----------------------------------------------------------------------
  // Boot
  // -----------------------------------------------------------------------
  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', refresh);
    } else {
      refresh();
    }
    // Re-scan when charts mount or pages re-render.
    document.addEventListener('smaca:chart-rendered', refresh);
  }

  global.SMACACardHelp = {
    refresh: refresh,
    hide: hide
  };

  boot();
})(typeof window !== 'undefined' ? window : this);
