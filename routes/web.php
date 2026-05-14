<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\App;
use App\Http\Middleware\SetLocale;

Route::get('/favicon.ico', function () {
    $publicIco = public_path('favicon.ico');
    if (is_file($publicIco)) {
        return response()->file($publicIco, [
            'Content-Type' => 'image/x-icon',
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }
    $sourceIco = base_path('assets/brand/favicon.ico');
    if (is_file($sourceIco)) {
        return response()->file($sourceIco, [
            'Content-Type' => 'image/x-icon',
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }
    abort(404);
})->name('smaca.favicon');

Route::middleware([SetLocale::class])->group(function () {
    // Page routes
    Route::get('/', function () {
        return redirect('/landing');
    });

    Route::get('/landing', function () {
        return view('landing');
    });

    Route::get('/language/{locale}', function (string $locale) {
        $supportedLocales = ['en', 'el'];
        $nextLocale = in_array($locale, $supportedLocales, true) ? $locale : 'en';

        session(['locale' => $nextLocale]);
        App::setLocale($nextLocale);

        return redirect(url()->previous() ?: '/dashboard');
    });

    require __DIR__ . '/web-auth.php';
    require __DIR__ . '/web-dashboard.php';
    require __DIR__ . '/web-api-legacy.php';
});