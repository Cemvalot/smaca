<?php

/**
 * Auth routes (closures). DB note: users.email has a unique index in
 * database/migrations/0001_01_01_000000_create_users_table.php — ensure production DB matches.
 */

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Validator;

if (! function_exists('smaca_password_matches')) {
    /**
     * Isolated plaintext compare; swap to Hash::check($plain, $stored) after migrating to hashed passwords.
     */
    function smaca_password_matches(string $plain, string $stored): bool
    {
        return hash_equals($stored, $plain);
    }
}

Route::get('/login', function () {
    if (session()->has('user_id')) {
        return redirect('/dashboard');
    }

    return view('login');
});

Route::post('/login', function (Request $request) {
    $validator = Validator::make($request->all(), [
        'email' => ['required', 'string', 'email', 'max:255'],
        'password' => ['required', 'string', 'min:8'],
    ]);

    if ($validator->fails()) {
        return redirect('/login')
            ->withErrors($validator)
            ->withInput($request->only('email'));
    }

    $emailNormalized = strtolower(trim((string) $request->input('email')));
    $password = (string) $request->input('password');

    $limitKey = 'login:'.sha1($request->ip().'|'.$emailNormalized);
    if (RateLimiter::tooManyAttempts($limitKey, 5)) {
        $seconds = RateLimiter::availableIn($limitKey);

        return redirect('/login')
            ->withInput($request->only('email'))
            ->with('error', 'Too many attempts. Please try again in '.$seconds.' seconds.');
    }

    $user = DB::table('users')
        ->whereRaw('LOWER(TRIM(email)) = ?', [$emailNormalized])
        ->first();

    if (! $user || ! smaca_password_matches($password, (string) $user->password)) {
        RateLimiter::hit($limitKey, 60);

        return redirect('/login')
            ->withInput($request->only('email'))
            ->withErrors(['email' => 'Invalid credentials.']);
    }

    RateLimiter::clear($limitKey);

    $request->session()->regenerate();
    session([
        'user_id' => $user->id,
        'user_email' => $user->email,
    ]);

    return redirect('/dashboard');
});

Route::get('/register', function () {
    return view('register');
});

Route::post('/register', function (Request $request) {
        $registerLimitKey = 'register:'.$request->ip();
        if (RateLimiter::tooManyAttempts($registerLimitKey, 5)) {
            $seconds = RateLimiter::availableIn($registerLimitKey);

            return redirect('/register')
                ->withInput($request->only('name', 'email'))
                ->with('error', 'Too many attempts. Please try again in '.$seconds.' seconds.');
        }

        RateLimiter::hit($registerLimitKey, 60);

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
            'confirmPassword' => ['required', 'same:password'],
        ], [
            'confirmPassword.same' => 'The password confirmation does not match.',
        ]);

        $nameTrimmed = trim((string) $request->input('name'));
        $emailNormalized = strtolower(trim((string) $request->input('email')));

        if ($validator->fails()) {
            return redirect('/register')
                ->withErrors($validator)
                ->withInput([
                    'name' => $nameTrimmed,
                    'email' => $emailNormalized,
                ]);
        }

        $exists = DB::table('users')
            ->whereRaw('LOWER(TRIM(email)) = ?', [$emailNormalized])
            ->exists();

        if ($exists) {
            return redirect('/register')
                ->withErrors(['email' => 'An account with this email already exists.'])
                ->withInput([
                    'name' => $nameTrimmed,
                    'email' => $emailNormalized,
                ]);
        }

        $role = $request->input('role') ?: 'user';

        try {
            DB::table('users')->insert([
                'name' => $nameTrimmed,
                'email' => $emailNormalized,
                'password' => $request->input('password'),
                'role' => $role,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            // Unique constraint / duplicate email (e.g. race with concurrent signups). Portable message match.
            $msg = $e->getMessage();
            if (str_contains($msg, 'Duplicate entry')
                || str_contains($msg, 'UNIQUE constraint failed')
                || str_contains($msg, 'duplicate key value violates unique constraint')) {
                return redirect('/register')
                    ->withErrors(['email' => 'An account with this email already exists.'])
                    ->withInput([
                        'name' => $nameTrimmed,
                        'email' => $emailNormalized,
                    ]);
            }

            throw $e;
        }

        return redirect('/login')->with('success', 'Account created successfully. You can sign in below.');
});

Route::get('/logout', function (Request $request) {
    $request->session()->flush();
    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect('/landing');
});
