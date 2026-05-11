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

  var passwordInput = document.getElementById('password');
  var confirmInput = document.getElementById('confirmPassword');
  var strengthMeter = document.getElementById('passwordStrength');
  var matchHint = document.getElementById('passwordMatchHint');

  function scorePassword(value) {
    var score = 0;
    if (!value) {
      return 0;
    }
    if (value.length >= 8) {
      score += 1;
    }
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) {
      score += 1;
    }
    if (/\d/.test(value)) {
      score += 1;
    }
    if (/[^A-Za-z0-9]/.test(value)) {
      score += 1;
    }
    return score;
  }

  function updatePasswordStrength() {
    if (!passwordInput || !strengthMeter) {
      return;
    }

    var level = scorePassword(passwordInput.value);
    if (level > 0) {
      strengthMeter.setAttribute('data-level', String(level));
      strengthMeter.removeAttribute('aria-hidden');
    } else {
      strengthMeter.removeAttribute('data-level');
      strengthMeter.setAttribute('aria-hidden', 'true');
    }
  }

  function updatePasswordMatch() {
    if (!passwordInput || !confirmInput || !matchHint) {
      return;
    }

    if (!confirmInput.value) {
      matchHint.textContent = '';
      matchHint.className = 'field-hint';
      return;
    }

    if (passwordInput.value === confirmInput.value) {
      matchHint.textContent = 'Passwords match.';
      matchHint.className = 'field-hint is-match';
    } else {
      matchHint.textContent = 'Passwords do not match.';
      matchHint.className = 'field-hint is-mismatch';
    }
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', function () {
      updatePasswordStrength();
      updatePasswordMatch();
    });
  }

  if (confirmInput) {
    confirmInput.addEventListener('input', updatePasswordMatch);
  }

  var form = document.getElementById('registerForm');
  if (!form) {
    return;
  }

  form.addEventListener('submit', function (event) {
    var pwd = document.getElementById('password');
    var confirm = document.getElementById('confirmPassword');
    if (pwd && confirm && pwd.value !== confirm.value) {
      event.preventDefault();
      updatePasswordMatch();
      return;
    }

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
