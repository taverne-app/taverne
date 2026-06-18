<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->integer('hit_dice_type')->default(8)->after('currency');
            $table->integer('hit_dice_remaining')->nullable()->after('hit_dice_type');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['hit_dice_type', 'hit_dice_remaining']);
        });
    }
};
