<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ __('messages.auth.reset_password') }} - SMACA</title>
  <link rel="stylesheet" href="{{ asset('assets/css/base.css') }}">
  <link rel="stylesheet" href="{{ asset('assets/css/auth.css') }}">
</head>
<body class="login-page">
  <div class="auth-wrapper">
    <div class="auth-card">
      <div class="auth-left" style="width:100%">
        <div class="form-shell">
          <div class="form-header">
            <h1 class="form-title">{{ __('messages.auth.reset_password') }}</h1>
            <p class="form-subtitle">{{ __('messages.auth.reset_password_new_value') }}</p>
          </div>
          @if ($errors->any())
            <div class="auth-error" role="alert">
              <ul class="auth-error-list">
                @foreach ($errors->all() as $message)
                  <li>{{ $message }}</li>
                @endforeach
              </ul>
            </div>
          @endif
          <form class="auth-form" method="POST" action="{{ url('/reset-password') }}">
            @csrf
            <input type="hidden" name="token" value="{{ $token }}">
            <div class="form-field">
              <label for="email" class="form-label">{{ __('messages.auth.email') }}</label>
              <div class="input-wrapper">
                <input type="email" id="email" name="email" class="form-input" required value="{{ old('email', $email ?? '') }}">
              </div>
            </div>
            <div class="form-field">
              <label for="password" class="form-label">{{ __('messages.auth.password') }}</label>
              <div class="input-wrapper">
                <input type="password" id="password" name="password" class="form-input" required minlength="8">
              </div>
            </div>
            <div class="form-field">
              <label for="password_confirmation" class="form-label">{{ __('messages.auth.confirm_password') }}</label>
              <div class="input-wrapper">
                <input type="password" id="password_confirmation" name="password_confirmation" class="form-input" required minlength="8">
              </div>
            </div>
            <button type="submit" class="btn-signin">{{ __('messages.auth.reset_password') }}</button>
          </form>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
