<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

if (!function_exists('smaca_dashboard_require_login')) {
    function smaca_dashboard_require_login()
    {
        if (!session()->has('user_id')) {
            return redirect('/login');
        }

        if (!session()->has('role')) {
            $user = DB::table('users')
                ->select(['id', 'role'])
                ->where('id', session('user_id'))
                ->first();

            if (!$user) {
                session()->flush();
                session()->invalidate();
                session()->regenerateToken();

                return redirect('/login');
            }

            session(['role' => $user->role ?: 'user']);
        }

        return null;
    }
}

if (!function_exists('smaca_dashboard_require_admin')) {
    function smaca_dashboard_require_admin()
    {
        $loginRedirect = smaca_dashboard_require_login();
        if ($loginRedirect) {
            return $loginRedirect;
        }

        if (session('role') !== 'admin') {
            return redirect('/dashboard/iaq')->with('error', 'You do not have access to that page.');
        }

        return null;
    }
}

if (!function_exists('smacaDashboardViewData')) {
    function smacaDashboardViewData(string $smacaPage): array
    {
        // Only management renders server-side tables that require full datasets.
        $needsManagementData = $smacaPage === 'management';

        $sites = collect();
        $sensors = collect();
        $sensor_latest = collect();
        $currentUser = DB::table('users')
            ->select(['id', 'name', 'email', 'role'])
            ->where('id', session('user_id'))
            ->first();

        if ($needsManagementData) {
            $sites = DB::table('sites')
                ->select(['id', 'name'])
                ->get();

            $sensors = DB::table('sensors')
                ->select(['id', 'site_id', 'name', 'external_id', 'device_type', 'is_active'])
                ->orderBy('id')
                ->get();

            $sensor_latest = DB::table('sensor_latest')
                ->select(['sensor_id', 'measured_at', 'battery_pct'])
                ->get();
        }

        $iaqSemDefaults = config('smaca_sensor_semantics.defaults', []);
        $smacaIaqTvocMode = $iaqSemDefaults['tvoc_semantic_mode'] ?? 'iaq_rating_level';
        $smacaIaqLightMode = $iaqSemDefaults['light_semantic_mode'] ?? 'normalized_level_0_5';
        $smacaIaqTvocModeLabel = $smacaIaqTvocMode === 'raw_tvoc_ugm3'
            ? __('messages.iaq_semantic_mode.tvoc_raw_tvoc_ugm3')
            : __('messages.iaq_semantic_mode.tvoc_iaq_rating_level');
        $smacaIaqLightModeLabel = $smacaIaqLightMode === 'raw_lux'
            ? __('messages.iaq_semantic_mode.light_raw_lux')
            : __('messages.iaq_semantic_mode.light_normalized_level_0_5');

        return [
            'smacaPage' => $smacaPage,
            'sites' => $sites,
            'sensors' => $sensors,
            'sensor_latest' => $sensor_latest,
            'currentUser' => $currentUser,
            'smacaIaqTvocMode' => $smacaIaqTvocMode,
            'smacaIaqLightMode' => $smacaIaqLightMode,
            'smacaIaqTvocModeLabel' => $smacaIaqTvocModeLabel,
            'smacaIaqLightModeLabel' => $smacaIaqLightModeLabel,
        ];
    }
}

Route::get('/dashboard', function () {
    $loginRedirect = smaca_dashboard_require_login();
    if ($loginRedirect) {
        return $loginRedirect;
    }

    return view('dashboard.pages.overview', smacaDashboardViewData('overview'));
});

Route::get('/dashboard/iaq', function () {
    $loginRedirect = smaca_dashboard_require_login();
    if ($loginRedirect) {
        return $loginRedirect;
    }

    return view('dashboard.pages.iaq', smacaDashboardViewData('iaq'));
});

Route::get('/dashboard/occupancy', function () {
    $loginRedirect = smaca_dashboard_require_login();
    if ($loginRedirect) {
        return $loginRedirect;
    }

    return view('dashboard.pages.occupancy', smacaDashboardViewData('occupancy'));
});

Route::get('/dashboard/environmental', function () {
    $loginRedirect = smaca_dashboard_require_login();
    if ($loginRedirect) {
        return $loginRedirect;
    }

    return view('dashboard.pages.environmental', smacaDashboardViewData('environmental'));
});

Route::get('/dashboard/connectivity', function () {
    $adminRedirect = smaca_dashboard_require_admin();
    if ($adminRedirect) {
        return $adminRedirect;
    }

    return view('dashboard.pages.connectivity', smacaDashboardViewData('connectivity'));
});

Route::get('/dashboard/ai-insights', function () {
    $adminRedirect = smaca_dashboard_require_admin();
    if ($adminRedirect) {
        return $adminRedirect;
    }

    return view('dashboard.pages.ai-insights', smacaDashboardViewData('ai-insights'));
});

Route::get('/dashboard/energy', function () {
    $adminRedirect = smaca_dashboard_require_admin();
    if ($adminRedirect) {
        return $adminRedirect;
    }

    return view('dashboard.pages.energy', smacaDashboardViewData('energy'));
});

Route::get('/dashboard/management', function () {
    $adminRedirect = smaca_dashboard_require_admin();
    if ($adminRedirect) {
        return $adminRedirect;
    }

    return view('dashboard.pages.management', smacaDashboardViewData('management'));
});

Route::post('/dashboard/settings/password', function (Request $request) {
    $loginRedirect = smaca_dashboard_require_login();
    if ($loginRedirect) {
        return $loginRedirect;
    }

    $validated = $request->validate([
        'current_password' => ['required', 'string', 'min:8'],
        'new_password' => ['required', 'string', 'min:8', 'different:current_password'],
        'new_password_confirmation' => ['required', 'same:new_password'],
    ], [
        'new_password_confirmation.same' => 'Password confirmation does not match.',
    ]);

    $userId = (int) session('user_id');
    $user = DB::table('users')
        ->select(['id', 'password'])
        ->where('id', $userId)
        ->first();

    if (!$user) {
        session()->flush();
        session()->invalidate();
        session()->regenerateToken();
        return redirect('/login')->with('error', 'Session expired. Please sign in again.');
    }

    $storedPassword = (string) $user->password;
    $currentPassword = (string) $validated['current_password'];
    $currentPasswordMatches = Hash::info($storedPassword)['algo'] !== null
        ? Hash::check($currentPassword, $storedPassword)
        : hash_equals($storedPassword, $currentPassword);

    if (!$currentPasswordMatches) {
        return redirect('/dashboard/management')
            ->with('error', 'Current password is incorrect.');
    }

    DB::table('users')
        ->where('id', $userId)
        ->update([
            'password' => Hash::make((string) $validated['new_password']),
            'updated_at' => now(),
        ]);

    return redirect('/dashboard/management')
        ->with('success', 'Password updated successfully.');
});

Route::get('/dashboard-legacy', function () {
    $sites = DB::table('sites')
        ->select(['id', 'name'])
        ->get();

    $sensors = DB::table('sensors')
        ->select(['id', 'site_id', 'name', 'external_id', 'device_type', 'is_active'])
        ->orderBy('id')
        ->get();

    $sensor_latest = DB::table('sensor_latest')
        ->select(['sensor_id', 'measured_at', 'battery_pct'])
        ->get();

    return view('dashboard', [
        'sites' => $sites,
        'sensors' => $sensors,
        'sensor_latest' => $sensor_latest,
    ]);
});
