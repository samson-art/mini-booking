<?php

use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-11-23 12:30', 'Europe/Moscow'));
});

it('returns slots from the start of today, sorted by start time', function () {
    slot('2026-11-24 09:00');
    slot('2026-11-22 10:00'); // вчера
    slot('2026-11-23 15:00');
    slot('2026-11-23 09:00');

    $this->getJson('/api/slots')
        ->assertOk()
        ->assertJsonPath('data.*.starts_at', [
            '2026-11-23T09:00:00+03:00',
            '2026-11-23T15:00:00+03:00',
            '2026-11-24T09:00:00+03:00',
        ]);
});

it('marks a slot as past once it has started, otherwise booked or available', function () {
    $past = slot('2026-11-23 11:00');
    $ongoing = slot('2026-11-23 12:00');
    $startsNow = slot('2026-11-23 12:30');
    $booked = slot('2026-11-23 14:00');
    $cancelled = slot('2026-11-23 15:00');
    $free = slot('2026-11-23 16:00');
    $pastBooked = slot('2026-11-23 10:00');

    $activeBooking = booking($booked);
    booking($cancelled, cancelled: true);
    $pastBooking = booking($pastBooked);

    $byId = collect($this->getJson('/api/slots')->assertOk()->json('data'))->keyBy('id');

    expect($byId[$past->id])->status->toBe('past')->booking_id->toBeNull()
        ->and($byId[$ongoing->id]['status'])->toBe('past')
        ->and($byId[$startsNow->id]['status'])->toBe('past')
        ->and($byId[$booked->id])->status->toBe('booked')->booking_id->toBe($activeBooking->id)
        ->and($byId[$cancelled->id])->status->toBe('available')->booking_id->toBeNull()
        ->and($byId[$free->id])->status->toBe('available')->booking_id->toBeNull()
        ->and($byId[$pastBooked->id])->status->toBe('past')->booking_id->toBe($pastBooking->id);
});

it('returns times with offset, the schedule timezone and no customer data', function () {
    booking(slot('2026-11-23 09:00'));

    $this->getJson('/api/slots')
        ->assertOk()
        ->assertExactJsonStructure([
            'data' => [['id', 'starts_at', 'ends_at', 'status', 'booking_id']],
            'meta' => ['timezone'],
        ])
        ->assertJsonPath('data.0.starts_at', '2026-11-23T09:00:00+03:00')
        ->assertJsonPath('data.0.ends_at', '2026-11-23T10:00:00+03:00')
        ->assertJsonPath('meta.timezone', 'Europe/Moscow');
});

it('sends no CORS headers to other origins', function () {
    $this->getJson('/api/slots', ['Origin' => 'https://evil.example'])
        ->assertOk()
        ->assertHeaderMissing('Access-Control-Allow-Origin');

    $this->call('OPTIONS', '/api/slots', server: [
        'HTTP_ORIGIN' => 'https://evil.example',
        'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
    ])->assertHeaderMissing('Access-Control-Allow-Origin');
});
