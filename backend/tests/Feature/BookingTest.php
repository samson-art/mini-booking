<?php

use App\Models\Booking;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-11-23 12:30', 'Europe/Moscow'));
});

function bookingBody(int $slotId): array
{
    return ['slot_id' => $slotId, 'customer_name' => 'Анна', 'customer_email' => 'anna@example.com'];
}

// --- Создание ---

it('books a free future slot', function () {
    $slot = slot('2026-11-24 10:00');

    $response = $this->postJson('/api/bookings', bookingBody($slot->id) + [
        // лишние поля не должны попасть в бронь
        'cancelled_at' => '2026-11-20 10:00',
        'id' => 999,
    ]);

    $response->assertCreated()->assertJsonStructure(['data' => ['id']]);
    $booking = Booking::findOrFail($response->json('data.id'));
    expect($booking->slot_id)->toBe($slot->id)
        ->and($booking->cancelled_at)->toBeNull()
        ->and($booking->id)->not->toBe(999);
});

it('returns 409 for a repeated request on a booked slot and keeps one active booking', function () {
    $slot = slot('2026-11-24 10:00');

    $this->postJson('/api/bookings', bookingBody($slot->id))->assertCreated();
    $this->postJson('/api/bookings', bookingBody($slot->id))
        ->assertStatus(409)
        ->assertExactJson(['message' => 'Этот слот уже занят.']);

    expect(Booking::where('slot_id', $slot->id)->whereNull('cancelled_at')->count())->toBe(1);
});

it('returns 409 for a slot that has already started', function (string $startsAt) {
    $slot = slot($startsAt);

    $this->postJson('/api/bookings', bookingBody($slot->id))
        ->assertStatus(409)
        ->assertExactJson(['message' => 'Этот слот уже прошёл.']);

    expect(Booking::count())->toBe(0);
})->with([
    'прошедший' => '2026-11-23 11:00',
    'идущий сейчас' => '2026-11-23 12:00',
    'начинается ровно сейчас' => '2026-11-23 12:30',
]);

it('returns 422 with a Russian error for the invalid field', function (array $override, array $headers, string $field, string $message) {
    $slot = slot('2026-11-24 10:00');
    $body = array_merge(bookingBody($slot->id), $override);

    // post(), а не postJson(): без Accept: application/json ответ всё равно JSON
    $this->post('/api/bookings', $body, $headers)
        ->assertStatus(422)
        ->assertJsonPath("errors.$field.0", $message);
})->with([
    'нет слота' => [['slot_id' => 999999], [], 'slot_id', 'Такого слота нет.'],
    'slot_id строкой' => [['slot_id' => 'abc'], [], 'slot_id', 'Неверный слот.'],
    'пустое имя' => [['customer_name' => ''], [], 'customer_name', 'Укажите имя.'],
    'имя из пробелов' => [['customer_name' => '   '], [], 'customer_name', 'Укажите имя.'],
    'длинное имя' => [['customer_name' => str_repeat('я', 256)], [], 'customer_name', 'Имя — не длиннее 255 символов.'],
    'неверный email' => [['customer_email' => 'not-an-email'], [], 'customer_email', 'Неверный email.'],
    'ключ не UUID' => [[], ['Idempotency-Key' => 'abc'], 'idempotency_key', 'Idempotency-Key должен быть UUID.'],
]);

it('returns all field errors in Russian for an empty body', function () {
    $this->post('/api/bookings')
        ->assertStatus(422)
        ->assertJsonValidationErrors(['slot_id', 'customer_name', 'customer_email'])
        ->assertJsonPath('message', 'Выберите слот. (и ещё 2 ошибки)');
});

// --- Отмена ---

it('cancels a booking, keeps the repeat cancel a no-op and frees the slot', function () {
    $slot = slot('2026-11-24 10:00');
    $booking = booking($slot);

    $this->deleteJson("/api/bookings/{$booking->id}")->assertNoContent();
    $cancelledAt = $booking->fresh()->cancelled_at;
    expect($cancelledAt)->not->toBeNull();

    $this->travel(5)->minutes();
    $this->deleteJson("/api/bookings/{$booking->id}")->assertNoContent();
    expect($booking->fresh()->cancelled_at->equalTo($cancelledAt))->toBeTrue();

    $this->postJson('/api/bookings', bookingBody($slot->id))->assertCreated();
});

it('returns 404 for an unknown booking id', function (string $id) {
    $this->deleteJson("/api/bookings/$id")
        ->assertNotFound()
        ->assertExactJson(['message' => 'Не найдено.']);
})->with([
    'нет такой брони' => '999999',
    'не число' => 'abc',
    'больше bigint' => '99999999999999999999',
]);

it('returns 409 when cancelling a booking whose slot has started', function (string $startsAt) {
    $booking = booking(slot($startsAt));

    $this->deleteJson("/api/bookings/{$booking->id}")
        ->assertStatus(409)
        ->assertExactJson(['message' => 'Этот слот уже прошёл, бронь нельзя отменить.']);

    expect($booking->fresh()->cancelled_at)->toBeNull();
})->with([
    'прошедший' => '2026-11-23 11:00',
    'идущий сейчас' => '2026-11-23 12:00',
    'начинается ровно сейчас' => '2026-11-23 12:30',
]);

it('still returns 204 for a booking cancelled before its slot started', function () {
    $booking = booking(slot('2026-11-23 14:00'), cancelled: true);

    $this->travelTo(Carbon::parse('2026-11-23 15:00', 'Europe/Moscow'));

    $this->deleteJson("/api/bookings/{$booking->id}")->assertNoContent();
});

// --- Rate limit ---

it('limits POST and DELETE per client behind the proxy', function () {
    $limit = config('booking.rate_limit');
    // Запрос пришёл от прокси Vite (частная сеть), адрес клиента — в X-Forwarded-For
    $viaProxy = fn (string $clientIp) => $this
        ->withServerVariables(['REMOTE_ADDR' => '172.18.0.5'])
        ->withHeader('X-Forwarded-For', $clientIp);

    for ($i = 0; $i < $limit; $i++) {
        // пустое тело: лимит считается до валидации, брони не создаются
        $viaProxy('203.0.113.1')->postJson('/api/bookings')->assertStatus(422);
    }

    $viaProxy('203.0.113.1')->postJson('/api/bookings')
        ->assertStatus(429)
        ->assertJsonPath('message', 'Слишком много запросов. Попробуйте через минуту.')
        ->assertHeader('Retry-After');
    $viaProxy('203.0.113.1')->deleteJson('/api/bookings/1')->assertStatus(429);

    // другой клиент за тем же прокси — свой счётчик
    $viaProxy('203.0.113.2')->postJson('/api/bookings')->assertStatus(422);
});

it('ignores X-Forwarded-For from an untrusted address', function () {
    $limit = config('booking.rate_limit');
    $direct = fn () => $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.7']);

    for ($i = 0; $i < $limit; $i++) {
        $direct()->postJson('/api/bookings')->assertStatus(422);
    }

    // подделанный заголовок с публичного адреса не даёт нового счётчика
    $direct()->withHeader('X-Forwarded-For', '203.0.113.9')->postJson('/api/bookings')->assertStatus(429);
});

// --- Идемпотентность ---

it('replays the same booking for a repeated Idempotency-Key', function () {
    $slot = slot('2026-11-24 10:00');
    $key = '3f8a1c2e-5b7d-4e9f-a1b2-c3d4e5f60718';

    $first = $this->postJson('/api/bookings', bookingBody($slot->id), ['Idempotency-Key' => $key])->assertCreated();
    $id = $first->json('data.id');

    $this->postJson('/api/bookings', bookingBody($slot->id), ['Idempotency-Key' => $key])
        ->assertCreated()->assertJsonPath('data.id', $id);
    expect(Booking::count())->toBe(1);

    // повтор после того, как слот прошёл, — тот же ответ, а не 409
    $this->travelTo(Carbon::parse('2026-11-25 12:00', 'Europe/Moscow'));
    $this->postJson('/api/bookings', bookingBody($slot->id), ['Idempotency-Key' => $key])
        ->assertCreated()->assertJsonPath('data.id', $id);

    // тот же ключ для другого слота — ошибка клиента
    $other = slot('2026-11-26 10:00');
    $this->postJson('/api/bookings', bookingBody($other->id), ['Idempotency-Key' => $key])
        ->assertStatus(422)
        ->assertJsonPath('errors.idempotency_key.0', 'Ключ уже использован для другого слота.');
});
