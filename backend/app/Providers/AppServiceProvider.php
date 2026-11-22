<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // POST и DELETE броней: не больше N запросов в минуту с одного клиента, счётчик общий.
        // ip() — адрес клиента: за прокси Vite он берётся из X-Forwarded-For (trustProxies в bootstrap/app.php)
        RateLimiter::for('bookings', fn (Request $request) => Limit::perMinute(config('booking.rate_limit'))->by($request->ip()));
    }
}
