document.addEventListener('DOMContentLoaded', function () {
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.pwd-toggle').forEach(function (toggle) {
    var wrapper = toggle.closest('.input-wrapper--password');
    var input = wrapper ? wrapper.querySelector('input') : null;
    if (!input) {
      return;
    }

    toggle.addEventListener('click', function () {
      var type = input.type === 'password' ? 'text' : 'password';
      input.type = type;
      toggle.setAttribute('aria-label', type === 'password' ? 'Show password' : 'Hide password');
      toggle.innerHTML = type === 'password'
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    });
  });

  var form = document.getElementById('loginForm');
  if (!form) {
    return;
  }

  form.addEventListener('submit', function () {
    var submitButton = form.querySelector('.btn-signin');
    if (!submitButton || submitButton.classList.contains('is-loading')) {
      return;
    }

    submitButton.classList.add('is-loading');
    submitButton.disabled = true;
    if (!prefersReducedMotion) {
      submitButton.textContent = submitButton.getAttribute('data-loading-label') || submitButton.textContent;
    }
  });
});
