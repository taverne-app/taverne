<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // La carte de combat courante d'une campagne : une image de fond et des
        // pions positionnés. Un seul plateau à la fois, vidé entre deux combats.
        Schema::table('campaigns', function (Blueprint $table) {
            $table->json('battle_map')->nullable()->after('campaign_map');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('battle_map');
        });
    }
};
