<?php

use App\Http\Controllers\BookingController;
use App\Http\Controllers\SlotController;
use Illuminate\Support\Facades\Route;

Route::get('/slots', [SlotController::class, 'index']);

// Лимит запросов на клиента — AppServiceProvider, лимитер 'bookings'
Route::middleware('throttle:bookings')->group(function () {
    Route::post('/bookings', [BookingController::class, 'store']);
    // Только число до 18 цифр: иначе "abc" или число больше bigint ушли бы в Postgres и дали 500
    Route::delete('/bookings/{booking}', [BookingController::class, 'destroy'])
        ->where('booking', '[0-9]{1,18}');
});
