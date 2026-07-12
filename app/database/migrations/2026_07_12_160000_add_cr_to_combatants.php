<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Facteur de puissance (FP / CR) du combattant.
 *
 * L'XP de fin de combat était déduite en retrouvant la créature PAR SON NOM dans le
 * bestiaire — fragile : un combattant renommé, ou créé à la main avec un nom libre,
 * n'avait aucune XP. En stockant le FP à la création, l'XP devient dérivable
 * durablement, quel que soit le nom.
 *
 * Chaîne de caractères et non nombre : les FP valent aussi « 1/8 », « 1/4 », « 1/2 ».
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_combatants', function (Blueprint $table) {
            $table->string('cr', 10)->nullable()->after('faction');
        });
    }

    public function down(): void
    {
        Schema::table('campaign_combatants', function (Blueprint $table) {
            $table->dropColumn('cr');
        });
    }
};
