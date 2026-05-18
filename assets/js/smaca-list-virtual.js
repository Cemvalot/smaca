/**
 * Lightweight windowed list renderer for long sensor / passage lists.
 */
(function (global) {
  'use strict';

  function renderVisible(listEl, items, buildHtml, options) {
    var opts = options || {};
    var threshold = Number.isFinite(Number(opts.threshold)) ? Number(opts.threshold) : 12;
    var rowHeight = Number.isFinite(Number(opts.rowHeight)) ? Number(opts.rowHeight) : 108;
    var overscan = Number.isFinite(Number(opts.overscan)) ? Number(opts.overscan) : 2;
    var rows = Array.isArray(items) ? items : [];

    if (!listEl) {
      return { destroy: function () {} };
    }

    if (rows.length <= threshold) {
      listEl.classList.remove('smaca-virtual-list--active');
      listEl.innerHTML = rows.map(function (item, idx) {
        return buildHtml(item, idx);
      }).join('');
      return { destroy: function () {} };
    }

    listEl.classList.add('smaca-virtual-list--active');
    listEl.innerHTML = '';
    var spacer = document.createElement('div');
    spacer.className = 'smaca-virtual-list__spacer';
    spacer.style.height = String(rows.length * rowHeight) + 'px';
    spacer.setAttribute('aria-hidden', 'true');
    var windowEl = document.createElement('div');
    windowEl.className = 'smaca-virtual-list__window';
    listEl.appendChild(spacer);
    listEl.appendChild(windowEl);

    function paint() {
      var scrollTop = listEl.scrollTop || 0;
      var viewH = listEl.clientHeight || 360;
      var start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
      var end = Math.min(rows.length, Math.ceil((scrollTop + viewH) / rowHeight) + overscan);
      windowEl.style.transform = 'translateY(' + String(start * rowHeight) + 'px)';
      var html = [];
      for (var i = start; i < end; i++) {
        html.push('<div class="smaca-virtual-list__row" style="min-height:' + rowHeight + 'px">');
        html.push(buildHtml(rows[i], i));
        html.push('</div>');
      }
      windowEl.innerHTML = html.join('');
    }

    listEl.addEventListener('scroll', paint, { passive: true });
    paint();

    return {
      destroy: function () {
        listEl.removeEventListener('scroll', paint);
        listEl.classList.remove('smaca-virtual-list--active');
      }
    };
  }

  global.SMACAListVirtual = {
    renderVisible: renderVisible
  };
})(typeof window !== 'undefined' ? window : this);
