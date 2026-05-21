<?php

use App\Support\SmacaDashboardGate;
use App\Support\SmacaDashboardViewData;
use App\Support\SmacaPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;

Route::get('/dashboard', function () {
    if ($redirect = SmacaDashboardGate::requireLogin()) {
        return $redirect;
    }

    return view('dashboard.pages.overview', SmacaDashboardViewData::build('overview'));
});

Route::get('/dashboard/iaq', function () {
    if ($redirect = SmacaDashboardGate::requireLogin()) {
        return $redirect;
    }

    return view('dashboard.pages.iaq', SmacaDashboardViewData::build('iaq'));
});

Route::get('/dashboard/occupancy', function () {
    if ($redirect = SmacaDashboardGate::requireLogin()) {
        return $redirect;
    }

    return view('dashboard.pages.occupancy', SmacaDashboardViewData::build('occupancy'));
});

Route::get('/dashboard/environmental', function () {
    if ($redirect = SmacaDashboardGate::requireLogin()) {
        return $redirect;
    }

    return view('dashboard.pages.environmental', SmacaDashboardViewData::build('environmental'));
});

Route::get('/dashboard/connectivity', function () {
    if ($redirect = SmacaDashboardGate::requireAdmin()) {
        return $redirect;
    }

    return view('dashboard.pages.connectivity', SmacaDashboardViewData::build('connectivity'));
});

Route::get('/dashboard/ai-insights', function () {
    if ($redirect = SmacaDashboardGate::requireAdmin()) {
        return $redirect;
    }

    return view('dashboard.pages.ai-insights', SmacaDashboardViewData::build('ai-insights'));
});

Route::get('/dashboard/energy', function () {
    if ($redirect = SmacaDashboardGate::requireAdmin()) {
        return $redirect;
    }

    return view('dashboard.pages.energy', SmacaDashboardViewData::build('energy'));
});

Route::get('/dashboard/management', function () {
    if ($redirect = SmacaDashboardGate::requireAdmin()) {
        return $redirect;
    }

    return view('dashboard.pages.management', SmacaDashboardViewData::build('management'));
});

Route::post('/dashboard/settings/password', function (Request $request) {
    if ($redirect = SmacaDashboardGate::requireLogin()) {
        return $redirect;
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

    if (! $user) {
        session()->flush();
        session()->invalidate();
        session()->regenerateToken();

        return redirect('/login')->with('error', 'Session expired. Please sign in again.');
    }

    if (! SmacaPassword::matches((string) $validated['current_password'], (string) $user->password)) {
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
