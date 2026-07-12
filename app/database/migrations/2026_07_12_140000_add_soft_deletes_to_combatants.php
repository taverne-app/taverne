<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Suppression réversible des combattants.
 *
 * Une suppression définitive rendait l'annulation impossible : recréer un combattant
 * lui donnerait un NOUVEL identifiant, et les pions du plateau qui le référencent
 * (ref_id) pointeraient dans le vide. Le soft delete conserve l'identifiant, donc
 * restaurer remet vraiment les choses en place — plateau compris.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_combatants', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('campaign_combatants', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
