<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_combatants', function (Blueprint $table) {
            $table->json('condition_durations')->nullable()->after('conditions');
        });
    }

    public function down(): void
    {
        Schema::table('campaign_combatants', function (Blueprint $table) {
            $table->dropColumn('condition_durations');
        });
    }
};
