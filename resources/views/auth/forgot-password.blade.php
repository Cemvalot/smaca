<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ __('messages.auth.forgot_password') }} - SMACA</title>
  <link rel="stylesheet" href="{{ asset('assets/css/base.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/auth.css') }}">
</head>
<body class="login-page">
  <div class="auth-wrapper">
    <div class="auth-card">
      <div class="auth-left" style="width:100%">
        <div class="form-shell">
          <div class="form-header">
            <h1 class="form-title">{{ __('messages.auth.forgot_password') }}</h1>
            <p class="form-subtitle">{{ __('messages.auth.reset_password_help') }}</p>
          </div>
          @if (session('success'))
            <div class="auth-success" role="status">{{ session('success') }}</div>
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
          <form class="auth-form" method="POST" action="{{ url('/forgot-password') }}">
            @csrf
            <div class="form-field">
              <label for="email" class="form-label">{{ __('messages.auth.email') }}</label>
              <div class="input-wrapper">
                <input type="email" id="email" name="email" class="form-input" required value="{{ old('email') }}">
              </div>
            </div>
            <button type="submit" class="btn-signin">{{ __('messages.auth.send_reset_link') }}</button>
          </form>
          <p class="form-footer"><a href="{{ url('/login') }}">{{ __('messages.auth.sign_in') }}</a></p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
