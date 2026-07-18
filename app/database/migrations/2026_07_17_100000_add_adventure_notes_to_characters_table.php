<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            // Le carnet d'aventure du JOUEUR : une liste de notes classées par type.
            // À ne pas confondre avec `notes` (bloc libre de la fiche, déjà pris) ni
            // avec `dm_notes` (au MJ). Ces notes-ci n'appartiennent qu'au joueur : elles
            // ne sortent que par /share/character/{token}/notes, jamais par
            // CharacterResource — qui part à la fois vers la console MJ et vers le canal
            // public de la campagne, donc vers toute la table.
            $table->json('adventure_notes')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn('adventure_notes');
        });
    }
};
