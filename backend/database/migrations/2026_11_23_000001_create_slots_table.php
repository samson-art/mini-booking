<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('slots', function (Blueprint $table) {
            $table->id();
            // Уникальность начала — на ней держится повторный запуск сидера без дублей
            $table->timestampTz('starts_at')->unique();
            $table->timestampTz('ends_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('slots');
    }
};
