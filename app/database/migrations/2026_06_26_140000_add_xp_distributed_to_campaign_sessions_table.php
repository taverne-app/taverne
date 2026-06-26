<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_sessions', function (Blueprint $table) {
            $table->boolean('xp_distributed')->default(false)->after('loot_notes');
        });
    }

    public function down(): void
    {
        Schema::table('campaign_sessions', function (Blueprint $table) {
            $table->dropColumn('xp_distributed');
        });
    }
};
