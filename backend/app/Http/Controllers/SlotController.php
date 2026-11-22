<?php

namespace App\Http\Controllers;

use App\Http\Resources\SlotResource;
use App\Models\Slot;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SlotController extends Controller
{
    /**
     * Расписание с начала сегодняшнего дня.
     */
    public function index(): AnonymousResourceCollection
    {
        $slots = Slot::with('activeBooking')
            ->where('starts_at', '>=', today())
            ->orderBy('starts_at')
            ->get();

        return SlotResource::collection($slots)
            ->additional(['meta' => ['timezone' => config('app.timezone')]]);
    }
}
