<?php

use Illuminate\Support\Facades\DB;
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

        return [
            'smacaPage' => $smacaPage,
            'sites' => $sites,
            'sensors' => $sensors,
            'sensor_latest' => $sensor_latest,
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
    $loginRedirect = smaca_dashboard_require_login();
    if ($loginRedirect) {
        return $loginRedirect;
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
