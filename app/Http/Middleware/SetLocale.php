<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\App;

class SetLocale
{
    public function handle($request, Closure $next)
    {
        $locale = session('locale', 'en');

        if (!in_array($locale, ['en', 'el'])) {
            $locale = 'en';
        }

        App::setLocale($locale);

        return $next($request);
    }
}
