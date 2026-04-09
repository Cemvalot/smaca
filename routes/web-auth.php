<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;

Route::get('/login', function () {
	// Check session
	if(session()->has('user_id')) {
		return redirect('/dashboard');
	}
	return view('login');
});

Route::post('/login', function (Request $request) {
	$email = $request->email;
	$password = $request->password;
	$search_for = DB::table('users')->where('email', $email)->first();
	if (!$search_for) {
		return redirect('/login');
	}
	if($search_for->password === $password) {
		// Save data in session
		session(['user_id' => $search_for->id, 'user_email' => $email]);
		return redirect('/dashboard');
	}
	return redirect('/login');
});

Route::get('/register', function () {
    return view('register');
});

Route::get('/logout', function (Request $request) {
	// Clear all session data
    $request->session()->flush();
    return redirect('/landing');
});
