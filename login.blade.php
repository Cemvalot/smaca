<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ __('messages.auth.login_title') }}</title>
  @include('partials.favicons')
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="{{ asset('assets/css/base.css') }}?v=4">
  <link rel="stylesheet" href="{{ asset('assets/css/smaca-logo.css') }}?v={{ time() }}">
  <link rel="stylesheet" href="{{ asset('assets/css/auth.css') }}?v={{ time() }}">
</head>
<body class="login-page">
  <div class="auth-wrapper">
    <div class="auth-card">
      <div class="auth-card-header">
        <nav class="auth-locale" aria-label="{{ __('messages.language.label') }}">
          <a href="{{ url('/language/en') }}" class="auth-locale__link @if(app()->getLocale() === 'en') is-active @endif">{{ __('messages.language.english') }}</a>
          <a href="{{ url('/language/el') }}" class="auth-locale__link @if(app()->getLocale() === 'el') is-active @endif">{{ __('messages.language.greek') }}</a>
        </nav>
        <a href="{{ url('/landing') }}" class="auth-card-back">{{ __('messages.auth.back_to_website') }} →</a>
      </div>
      <div class="auth-card-body">
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
          </div>
          <div class="form-header">
            <h1 class="form-title">{{ __('messages.auth.sign_in') }}</h1>
            <p class="form-subtitle">{{ __('messages.auth.welcome_back') }}</p>
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
              <label for="email" class="form-label">{{ __('messages.auth.email') }}</label>
              <div class="input-wrapper">
                <input type="email" id="email" name="email" class="form-input @error('email') is-invalid @enderror" placeholder="you@company.com" required value="{{ old('email') }}">
              </div>
            </div>
            <div class="form-field">
              <label for="password" class="form-label">{{ __('messages.auth.password') }}</label>
              <div class="input-wrapper input-wrapper--password">
                <input type="password" id="password" name="password" class="form-input @error('password') is-invalid @enderror" placeholder="••••••••" required>
                <button type="button" class="pwd-toggle" aria-label="{{ __('messages.auth.toggle_password_visibility') }}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>
            <div class="options-row">
              <label class="remember-me">
                <input type="checkbox" name="remember">
                <span class="checkbox-box"></span>
                <span>{{ __('messages.auth.remember_me') }}</span>
              </label>
              <a href="{{ url('/forgot-password') }}" class="forgot-link">{{ __('messages.auth.forgot_password') }}</a>
            </div>
            <button type="submit" class="btn-signin" data-loading-label="{{ __('messages.auth.sign_in') }}">{{ __('messages.auth.sign_in') }}</button>
          </form>

          <p class="form-footer">{{ __('messages.auth.dont_have_account') }} <a href="{{ url('/register') }}">{{ __('messages.auth.register') }}</a></p>
        </div>
      </div>

      <div class="auth-right">
        <div class="visual-stage">
          <div class="auth-telemetry-grid" aria-hidden="true"></div>
          <span class="auth-telemetry-node auth-telemetry-node--a" aria-hidden="true"></span>
          <span class="auth-telemetry-node auth-telemetry-node--b" aria-hidden="true"></span>
          <span class="auth-telemetry-node auth-telemetry-node--c" aria-hidden="true"></span>
          <div class="visual-copy">
            <h2 class="headline">{{ __('messages.auth.secure_access_title') }}</h2>
            <p class="subline">{{ __('messages.auth.secure_access_subtitle') }}</p>
          </div>
          <img src="{{ asset('assets/login.svg') }}" alt="" class="auth-illustration" aria-hidden="true">
        </div>
      </div>
      </div>
    </div>
  </div>

  <script src="{{ asset('assets/js/login.js') }}"></script>
</body>
</html>
