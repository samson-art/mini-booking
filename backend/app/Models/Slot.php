<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Slot extends Model
{
    public $timestamps = false;

    protected $fillable = ['starts_at', 'ends_at'];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    /** @return HasOne<Booking, $this> */
    public function activeBooking(): HasOne
    {
        return $this->hasOne(Booking::class)->whereNull('cancelled_at');
    }
}
