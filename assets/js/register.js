document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('registerForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    try {
      localStorage.setItem('smaca_role', 'user');
    } catch (err) {}
    window.location.href = 'smaca-dashboard.html';
  });
});

