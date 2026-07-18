<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Journal des derniers jets de dés de la campagne (10 max, plus récent en tête),
     * pour que le lanceur de dés montre l'historique de toute la table — pas seulement
     * les jets de la session en cours. Chaque entrée porte sa provenance (nom du sort /
     * arme / compétence) et le personnage lié.
     */
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->json('recent_rolls')->nullable()->after('combat_location');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('recent_rolls');
        });
    }
};
