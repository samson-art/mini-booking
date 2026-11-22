<?php

use App\Models\Booking;
use App\Models\Slot;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/** Часовой слот, время — по Москве: slot('2026-11-24 10:00'). */
function slot(string $startsAt): Slot
{
    $start = Carbon::parse($startsAt, 'Europe/Moscow');

    return Slot::create(['starts_at' => $start, 'ends_at' => $start->copy()->addHour()]);
}

/** Бронь на слот; cancelled: true — уже отменённая. */
function booking(Slot $slot, bool $cancelled = false): Booking
{
    $booking = Booking::create([
        'slot_id' => $slot->id,
        'customer_name' => 'Анна',
        'customer_email' => 'anna@example.com',
    ]);

    if ($cancelled) {
        $booking->cancelled_at = now();
        $booking->save();
    }

    return $booking;
}
