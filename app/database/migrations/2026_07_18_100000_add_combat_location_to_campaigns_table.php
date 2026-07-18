<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Nom du lieu (section Monde) qui sert de théâtre au combat en cours. Sert à
     * réafficher aux joueurs où ils se battent ; c'est le nom du lieu, pas son image
     * (celle-ci vit déjà dans battle_map.image_url).
     */
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->string('combat_location')->nullable()->after('combat_round');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('combat_location');
        });
    }
};
