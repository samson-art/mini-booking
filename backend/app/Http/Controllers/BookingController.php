<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreBookingRequest;
use App\Models\Booking;
use App\Models\Slot;
use Dedoc\Scramble\Attributes\HeaderParameter;
use Dedoc\Scramble\Attributes\IgnoreResponse;
use Dedoc\Scramble\Attributes\Response as ApiResponse;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    /**
     * Забронировать слот.
     */
    #[HeaderParameter('Idempotency-Key', 'UUID попытки: повтор с тем же ключом вернёт ту же бронь, а не 409', required: false, type: 'string', format: 'uuid')]
    #[ApiResponse(201, 'Бронь создана (или повтор с тем же ключом)', type: 'array{data: array{id: int}}')]
    #[ApiResponse(409, 'Слот уже занят или уже прошёл', type: 'array{message: string}')]
    #[IgnoreResponse(200)] // Scramble выводит лишний 200 из response()->json(); настоящий успех — 201
    public function store(StoreBookingRequest $request): JsonResponse
    {
        $key = $request->validated('idempotency_key');
        $slot = Slot::findOrFail($request->validated('slot_id'));

        // Тот же ключ — это повтор моего же запроса: отдать исходный результат
        if ($replay = $this->replay($key, $slot)) {
            return $replay;
        }

        if ($slot->starts_at <= now()) {
            return response()->json(['message' => 'Этот слот уже прошёл.'], 409);
        }

        // Проверки «занят ли слот» нет: единственный источник истины — уникальный индекс.
        // Транзакция нужна, потому что в Postgres ошибка уникальности ломает текущую транзакцию;
        // в тестах DB::transaction становится savepoint, и после отката тест читает базу дальше.
        try {
            $booking = DB::transaction(fn () => Booking::create($request->validated()));
        } catch (UniqueConstraintViolationException) {
            // Два одновременных запроса с одним ключом: второй найдёт бронь первого
            return $this->replay($key, $slot)
                ?? response()->json(['message' => 'Этот слот уже занят.'], 409);
        }

        return response()->json(['data' => ['id' => $booking->id]], 201);
    }

    /**
     * Отменить бронирование.
     */
    public function destroy(Booking $booking): JsonResponse|Response
    {
        // Уже отменена — ничего не меняем: повторная отмена безопасна
        if ($booking->cancelled_at === null) {
            if ($booking->slot->starts_at <= now()) {
                return response()->json(['message' => 'Этот слот уже прошёл, бронь нельзя отменить.'], 409);
            }

            // Присваивание, а не update(): cancelled_at нет в $fillable
            $booking->cancelled_at = now();
            $booking->save();
        }

        return response()->noContent();
    }

    private function replay(?string $key, Slot $slot): ?JsonResponse
    {
        $booking = $key === null ? null : Booking::where('idempotency_key', $key)->first();

        if ($booking === null) {
            return null;
        }

        if ($booking->slot_id !== $slot->id) {
            throw ValidationException::withMessages([
                'idempotency_key' => 'Ключ уже использован для другого слота.',
            ]);
        }

        return response()->json(['data' => ['id' => $booking->id]], 201);
    }
}
