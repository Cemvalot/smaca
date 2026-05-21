<?php

namespace App\Support;

use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

final class SmacaDashboardGate
{
    public static function requireLogin(): ?RedirectResponse
    {
        if (! session()->has('user_id')) {
            return redirect('/login');
        }

        if (! session()->has('role')) {
            $user = DB::table('users')
                ->select(['id', 'role'])
                ->where('id', session('user_id'))
                ->first();

            if (! $user) {
                session()->flush();
                session()->invalidate();
                session()->regenerateToken();

                return redirect('/login');
            }

            session(['role' => $user->role ?: 'user']);
        }

        return null;
    }

    public static function requireAdmin(): ?RedirectResponse
    {
        $loginRedirect = self::requireLogin();
        if ($loginRedirect) {
            return $loginRedirect;
        }

        if (session('role') !== 'admin') {
            return redirect('/dashboard/iaq')->with('error', 'You do not have access to that page.');
        }

        return null;
    }
}
