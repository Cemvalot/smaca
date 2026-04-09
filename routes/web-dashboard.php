<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

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
	// Check session
	if(!session()->has('user_id')) {
		return redirect('/login');
	}
    return view('dashboard.pages.overview', smacaDashboardViewData('overview'));
});

Route::get('/dashboard/iaq', function () {
    return view('dashboard.pages.iaq', smacaDashboardViewData('iaq'));
});

Route::get('/dashboard/occupancy', function () {
    return view('dashboard.pages.occupancy', smacaDashboardViewData('occupancy'));
});

Route::get('/dashboard/environmental', function () {
    return view('dashboard.pages.environmental', smacaDashboardViewData('environmental'));
});

Route::get('/dashboard/connectivity', function () {
    return view('dashboard.pages.connectivity', smacaDashboardViewData('connectivity'));
});

Route::get('/dashboard/ai-insights', function () {
    return view('dashboard.pages.ai-insights', smacaDashboardViewData('ai-insights'));
});

Route::get('/dashboard/energy', function () {
    return view('dashboard.pages.energy', smacaDashboardViewData('energy'));
});

Route::get('/dashboard/management', function () {
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
