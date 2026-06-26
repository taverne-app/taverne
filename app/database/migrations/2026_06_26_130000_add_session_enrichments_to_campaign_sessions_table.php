<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_sessions', function (Blueprint $table) {
            $table->integer('xp_awarded')->nullable()->after('notes');
            $table->text('loot_notes')->nullable()->after('xp_awarded');
        });
    }

    public function down(): void
    {
        Schema::table('campaign_sessions', function (Blueprint $table) {
            $table->dropColumn(['xp_awarded', 'loot_notes']);
        });
    }
};
