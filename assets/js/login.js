document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('loginForm');
  if (!form) return;

  // Role: query param (?role=admin|user) overrides role selector
  const params = new URLSearchParams(window.location.search);
  const paramRole = params.get('role');
  const roleSelect = document.getElementById('role-select');
  if (roleSelect && (paramRole === 'admin' || paramRole === 'user')) {
    roleSelect.value = paramRole;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var role = (paramRole === 'admin' || paramRole === 'user') ? paramRole : (roleSelect && (roleSelect.value === 'admin' || roleSelect.value === 'user') ? roleSelect.value : 'user');
    try {
      localStorage.setItem('smaca_role', role);
    } catch (err) {}
    window.location.href = 'smaca-dashboard.html';
  });
});

