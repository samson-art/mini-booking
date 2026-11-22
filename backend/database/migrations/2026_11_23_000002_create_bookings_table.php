<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('slot_id')->constrained();
            $table->string('customer_name');
            $table->string('customer_email');
            // Отмена = заполненное поле; строка остаётся в истории
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampsTz();
        });

        // Одно активное бронирование на слот. Частичный индекс: отменённые брони в него не входят,
        // поэтому слот после отмены можно занять снова. Schema Builder так не умеет — сырой SQL.
        DB::statement('CREATE UNIQUE INDEX bookings_active_slot_unique ON bookings (slot_id) WHERE cancelled_at IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
