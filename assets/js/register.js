document.addEventListener('DOMContentLoaded', function () {
  // Image carousel - change every 4 seconds
  (function initCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.image-carousel .dot');
    if (slides.length === 0) return;
    const interval = 4000;
    let current = 0;

    function showSlide(index) {
      current = ((index % slides.length) + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('active', i === current); });
      dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });
    }

    function next() { showSlide(current + 1); }
    setInterval(next, interval);

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { showSlide(i); });
    });
  })();

  // Password visibility toggles
  document.querySelectorAll('.pwd-toggle').forEach(function (toggle) {
    var wrapper = toggle.closest('.input-wrapper--password');
    var input = wrapper ? wrapper.querySelector('input') : null;
    if (!input) return;
    toggle.addEventListener('click', function () {
      var type = input.type === 'password' ? 'text' : 'password';
      input.type = type;
      toggle.setAttribute('aria-label', type === 'password' ? 'Show password' : 'Hide password');
      toggle.innerHTML = type === 'password'
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    });
  });

  const form = document.getElementById('registerForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var pwd = document.getElementById('password');
    var confirm = document.getElementById('confirmPassword');
    if (pwd && confirm && pwd.value !== confirm.value) {
      alert('Passwords do not match.');
      return;
    }
    try {
      localStorage.setItem('smaca_role', 'user');
    } catch (err) {}
    window.location.href = '/dashboard';
  });
});

