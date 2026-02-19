<?php

use Illuminate\Support\Facades\Route;

// Homepage – redirect to landing
Route::get('/', function () {
    return redirect('/landing');
});

// Landing page (homepage)
Route::get('/landing', function () {
    return view('landing');
});

// Auth
Route::get('/login', function () {
    return view('login');
});

Route::get('/register', function () {
    return view('register');
});

// Dashboard
Route::get('/dashboard', function () {
    return view('smaca-dashboard');
});
