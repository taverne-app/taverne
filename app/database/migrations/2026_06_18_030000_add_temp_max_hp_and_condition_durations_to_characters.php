<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->integer('temp_max_hp_bonus')->default(0)->after('temporary_hp');
            $table->json('condition_durations')->nullable()->after('conditions');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['temp_max_hp_bonus', 'condition_durations']);
        });
    }
};
