<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
{
    /**
     * Заголовок Idempotency-Key проверяется как обычное поле.
     * merge перезаписывает одноимённое поле из тела: ключ можно передать только заголовком.
     */
    protected function prepareForValidation(): void
    {
        $this->merge(['idempotency_key' => $this->header('Idempotency-Key')]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        // exists Laravel пропускает, если integer уже не прошёл: "abc" до запроса к bigint не дойдёт.
        // uuid у ключа: без проверки кривой ключ уронил бы Postgres на колонке uuid.
        // (Комментарии здесь, а не над полями: Scramble берёт их в описание API.)
        return [
            'slot_id' => ['required', 'integer', 'exists:slots,id'],
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_email' => ['required', 'email', 'max:255'],
            'idempotency_key' => ['nullable', 'uuid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'slot_id.required' => 'Выберите слот.',
            'slot_id.integer' => 'Неверный слот.',
            'slot_id.exists' => 'Такого слота нет.',
            'customer_name.required' => 'Укажите имя.',
            'customer_name.string' => 'Укажите имя.',
            'customer_name.max' => 'Имя — не длиннее 255 символов.',
            'customer_email.required' => 'Укажите email.',
            'customer_email.email' => 'Неверный email.',
            'customer_email.max' => 'Email — не длиннее 255 символов.',
            'idempotency_key.uuid' => 'Idempotency-Key должен быть UUID.',
        ];
    }
}
