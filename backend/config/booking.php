<?php

// Все настройки бронирования. Код читает их через config('booking.…'), не через env().
return [
    'days' => (int) env('BOOKING_DAYS', 7),
    'open_hour' => (int) env('BOOKING_OPEN_HOUR', 9),
    'close_hour' => (int) env('BOOKING_CLOSE_HOUR', 18),
];
