<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ __('messages.auth.register_title') }}</title>
  <link rel="icon" type="image/x-icon" href="{{ asset('assets/brand/favicon.ico') }}">
  <link rel="icon" type="image/png" sizes="32x32" href="{{ asset('assets/brand/smaca-favicon-32.png') }}">
  <link rel="icon" type="image/svg+xml" href="{{ asset('assets/brand/smaca-favicon.svg') }}">
  <link rel="shortcut icon" href="{{ asset('assets/brand/favicon.ico') }}">
  <link rel="apple-touch-icon" sizes="180x180" href="{{ asset('assets/brand/smaca-favicon-180.png') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/base.css') }}?v=4">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-logo.css') }}?v={{ time() }}">
  <link rel="stylesheet" href="{{ asset('assets/css/auth.css') }}?v={{ time() }}">
</head>
<body class="register-page">
  <div class="auth-wrapper">
    <div class="auth-card">
      <!-- Left Panel (Form) -->
      <div class="auth-left">
        <div class="form-shell">
          <div class="left-top">
            <div class="logo-group">
              <div class="smaca-logo smaca-logo--auth" aria-label="SMACA">
                <div class="smaca-logo__row">
                  <img
                    src="{{ asset('assets/brand/smaca-icon-light.svg') }}"
                    alt="SMACA icon"
                    class="smaca-logo__icon smaca-logo__icon--auth"
                    width="48"
                    height="48"
                  >
                  <span class="smaca-logo__wordmark smaca-logo__wordmark--auth">SMACA</span>
                </div>
              </div>
              <span class="smaca-logo__caption">{{ __('messages.auth.smart_campus_platform') }}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
            <a href="{{ url('/landing') }}" class="back-btn">{{ __('messages.auth.back_to_website') }} →</a>
            <a href="{{ url('/language/en') }}" class="back-btn">{{ __('messages.language.english') }}</a>
            <a href="{{ url('/language/el') }}" class="back-btn">{{ __('messages.language.greek') }}</a>
          </div>
          </div>
          <div class="form-header">
            <h1 class="form-title">{{ __('messages.auth.create_account') }}</h1>
            <p class="form-subtitle">{{ __('messages.auth.join_smaca') }}</p>
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

          <form class="auth-form" id="registerForm" method="POST" action="{{ url('/register') }}">
            @csrf
            <div class="form-field">
              <label for="name" class="form-label">{{ __('messages.auth.full_name') }}</label>
              <div class="input-wrapper">
                <input type="text" id="name" name="name" class="form-input @error('name') is-invalid @enderror" placeholder="John Doe" required value="{{ old('name') }}">
              </div>
              @error('name')
                <p class="field-error" role="alert">{{ $message }}</p>
              @enderror
            </div>
            <div class="form-field">
              <label for="email" class="form-label">{{ __('messages.auth.email') }}</label>
              <div class="input-wrapper">
                <input type="email" id="email" name="email" class="form-input @error('email') is-invalid @enderror" placeholder="you@company.com" required value="{{ old('email') }}">
              </div>
              @error('email')
                <p class="field-error" role="alert">{{ $message }}</p>
              @enderror
            </div>
            <div class="form-field">
              <label for="password" class="form-label">{{ __('messages.auth.password') }}</label>
              <div class="input-wrapper input-wrapper--password">
                <input type="password" id="password" name="password" class="form-input @error('password') is-invalid @enderror" placeholder="••••••••" required>
                <button type="button" class="pwd-toggle" aria-label="{{ __('messages.auth.toggle_password_visibility') }}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              @error('password')
                <p class="field-error" role="alert">{{ $message }}</p>
              @enderror
            </div>
            <div class="form-field">
              <label for="confirmPassword" class="form-label">{{ __('messages.auth.confirm_password') }}</label>
              <div class="input-wrapper input-wrapper--password">
                <input type="password" id="confirmPassword" name="confirmPassword" class="form-input @error('confirmPassword') is-invalid @enderror" placeholder="••••••••" required>
                <button type="button" class="pwd-toggle pwd-toggle--confirm" aria-label="{{ __('messages.auth.toggle_password_visibility') }}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              @error('confirmPassword')
                <p class="field-error" role="alert">{{ $message }}</p>
              @enderror
            </div>
            <div class="options-row options-row--terms">
              <label class="remember-me">
                <input type="checkbox" name="terms" id="terms" required>
                <span class="checkbox-box"></span>
                <span>{{ __('messages.auth.agree_terms') }} <a href="#">{{ __('messages.public.terms') }}</a> {{ __('messages.public.terms_and') }} <a href="#">{{ __('messages.auth.privacy_policy') }}</a></span>
              </label>
            </div>
            <button type="submit" class="btn-signin">{{ __('messages.auth.sign_up') }}</button>
          </form>

          <p class="form-footer">{{ __('messages.auth.already_have_account') }} <a href="{{ url('/login') }}">{{ __('messages.auth.sign_in') }}</a></p>
        </div>
      </div>

      <!-- Right Panel (Visual) -->
      <div class="auth-right">
        <div class="visual-panel">
          <div class="visual-copy">
            <h2 class="headline">{{ __('messages.auth.create_workspace_title') }}</h2>
            <p class="subline">{{ __('messages.auth.create_workspace_subtitle') }}</p>
          </div>
          <img src="{{ asset('assets/register.svg') }}" alt="Authentication dashboard illustration" class="auth-illustration">
        </div>
      </div>
    </div>
  </div>

  <script src="{{ asset('assets/js/register.js') }}"></script>
</body>
</html>
