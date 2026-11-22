<?php

namespace App\Http\Resources;

use App\Models\Slot;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Slot */
class SlotResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            /** @var 'past'|'booked'|'available' */
            'status' => match (true) {
                // Прошедший — начало не позже текущего серверного времени (идущий слот тоже)
                $this->starts_at <= now() => 'past',
                $this->activeBooking !== null => 'booked',
                default => 'available',
            },
            'booking_id' => $this->activeBooking?->id,
        ];
    }
}
