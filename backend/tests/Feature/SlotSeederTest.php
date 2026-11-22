<?php

use App\Models\Booking;
use App\Models\Slot;
use Database\Seeders\SlotSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-11-23 12:30', 'Europe/Moscow'));
});

function bookSlot(Slot $slot): Booking
{
    return Booking::create([
        'slot_id' => $slot->id,
        'customer_name' => 'Анна',
        'customer_email' => 'anna@example.com',
    ]);
}

it('creates 7 days of hourly slots from 09:00 to 18:00, including this morning', function () {
    $this->seed(SlotSeeder::class);

    $expected = [];
    foreach (range(0, 6) as $day) {
        foreach (range(9, 17) as $hour) {
            $start = Carbon::parse('2026-11-23 00:00', 'Europe/Moscow')->addDays($day)->setTime($hour, 0);
            $expected[] = $start->format('Y-m-d H:i').'–'.$start->copy()->addHour()->format('H:i');
        }
    }

    $actual = Slot::orderBy('starts_at')->get()
        ->map(fn (Slot $slot) => $slot->starts_at->format('Y-m-d H:i').'–'.$slot->ends_at->format('H:i'))
        ->all();

    expect($actual)->toHaveCount(63)->toBe($expected)
        // 09:00 по Москве — это 06:00 UTC: пояс сессии Postgres совпадает с поясом приложения
        ->and(DB::scalar("select min(starts_at) at time zone 'UTC' from slots"))->toBe('2026-11-23 06:00:00');
});

it('does not duplicate slots or touch bookings when run again', function () {
    $this->seed(SlotSeeder::class);
    $ids = Slot::orderBy('id')->pluck('id')->all();
    $booking = bookSlot(Slot::orderByDesc('starts_at')->first());

    $this->seed(SlotSeeder::class);

    expect(Slot::orderBy('id')->pluck('id')->all())->toBe($ids)
        ->and($booking->fresh())->not->toBeNull();
});

it('adds only the missing day when run the next day', function () {
    $this->seed(SlotSeeder::class);
    $booking = bookSlot(Slot::orderByDesc('starts_at')->first());

    $this->travel(1)->days();
    $this->seed(SlotSeeder::class);

    expect(Slot::count())->toBe(72)
        ->and($booking->fresh())->not->toBeNull();
});

it('counts "today" in the app timezone, not in UTC', function () {
    // 01:00 по Москве — ещё 22 ноября по UTC
    $this->travelTo(Carbon::parse('2026-11-23 01:00', 'Europe/Moscow'));

    $this->seed(SlotSeeder::class);

    expect(Slot::orderBy('starts_at')->first()->starts_at->format('Y-m-d H:i'))->toBe('2026-11-23 09:00');
});
