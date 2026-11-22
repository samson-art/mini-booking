<?php

namespace Database\Seeders;

use App\Models\Slot;
use Illuminate\Database\Seeder;

class SlotSeeder extends Seeder
{
    /**
     * Расписание на config('booking.days') дней, считая сегодня, по часовым слотам.
     */
    public function run(): void
    {
        $slots = [];

        for ($day = 0; $day < config('booking.days'); $day++) {
            for ($hour = config('booking.open_hour'); $hour < config('booking.close_hour'); $hour++) {
                $start = today()->addDays($day)->setTime($hour, 0);
                $slots[] = ['starts_at' => $start, 'ends_at' => $start->copy()->addHour()];
            }
        }

        // ON CONFLICT DO NOTHING по уникальному starts_at: существующие слоты и брони не трогаются,
        // запуск в другой день добавляет только недостающие
        Slot::insertOrIgnore($slots);
    }
}
