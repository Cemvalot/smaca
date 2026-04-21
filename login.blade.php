<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - SMACA</title>
  <link rel="stylesheet" href="{{ asset('assets/css/base.css') }}?v=4">
  <link rel="stylesheet" href="{{ asset('assets/css/auth.css') }}?v={{ time() }}">
</head>
<body class="login-page">
  <div class="auth-wrapper">
    <div class="auth-card">
      <!-- Left Panel (Form) -->
      <div class="auth-left">
        <div class="form-shell">
          <div class="left-top">
            <div class="logo-group">
              <span class="logo-text">SMACA</span>
              <span class="logo-sub">Smart Campus IoT Platform</span>
            </div>
            <a href="{{ url('/landing') }}" class="back-btn">Back to website →</a>
          </div>
          <div class="form-header">
            <h1 class="form-title">Sign in</h1>
            <p class="form-subtitle">Welcome back to SMACA</p>
          </div>

          @if (session('success'))
            <div class="auth-success" role="status">
              {{ session('success') }}
            </div>
          @endif
          @if (session('error'))
            <div class="auth-error" role="alert">
              {{ session('error') }}
            </div>
          @endif
          @if ($errors->any())
            <div class="auth-error" role="alert">
              <ul class="auth-error-list">
                @foreach ($errors->all() as $message)
                  <li>{{ $message }}</li>
                @endforeach
              </ul>
            </div>
          @endif

          <form class="auth-form" id="loginForm" method="POST" action="{{ url('/login') }}">
            @csrf
            <div class="form-field">
              <label for="email" class="form-label">Email</label>
              <div class="input-wrapper">
                <input type="email" id="email" name="email" class="form-input @error('email') is-invalid @enderror" placeholder="you@company.com" required value="{{ old('email') }}">
              </div>
            </div>
            <div class="form-field">
              <label for="password" class="form-label">Password</label>
              <div class="input-wrapper input-wrapper--password">
                <input type="password" id="password" name="password" class="form-input @error('password') is-invalid @enderror" placeholder="••••••••" required>
                <button type="button" class="pwd-toggle" aria-label="Toggle password visibility">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>
            <div class="options-row">
              <label class="remember-me">
                <input type="checkbox" name="remember">
                <span class="checkbox-box"></span>
                <span>Remember me</span>
              </label>
              <a href="#" class="forgot-link">Forgot password?</a>
            </div>
            <button type="submit" class="btn-signin">Sign in</button>
          </form>

          <p class="form-footer">Don't have an account? <a href="{{ url('/register') }}">Register</a></p>
        </div>
      </div>

      <!-- Right Panel (Visual) -->
      <div class="auth-right">
        <div class="visual-panel">
          <div class="visual-copy">
            <h2 class="headline">Secure access to the SMACA platform</h2>
            <p class="subline">View live sensor data, track system performance, and manage your smart campus environment.</p>
          </div>
          <img src="{{ asset('assets/login.svg') }}" alt="Secure access dashboard illustration" class="auth-illustration">
        </div>
      </div>
    </div>
  </div>

  <!--<script src="{{ asset('assets/js/login.js') }}"></script>-->
</body>
</html>
