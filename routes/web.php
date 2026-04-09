<?php

use Illuminate\Support\Facades\Route;

// Page routes
Route::get('/', function () {
    return redirect('/landing');
});

Route::get('/landing', function () {
    return view('landing');
});

require __DIR__ . '/web-auth.php';
require __DIR__ . '/web-dashboard.php';
require __DIR__ . '/web-api-legacy.php';