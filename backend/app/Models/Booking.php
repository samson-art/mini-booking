<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    // cancelled_at и id массовым присваиванием не задать
    protected $fillable = ['slot_id', 'customer_name', 'customer_email'];

    protected function casts(): array
    {
        return [
            'cancelled_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Slot, $this> */
    public function slot(): BelongsTo
    {
        return $this->belongsTo(Slot::class);
    }
}
