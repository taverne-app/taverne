<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Le codex de campagne. Table à part, et non colonne JSON sur `campaigns` comme les
 * PNJ ou les lieux : le MJ et les joueurs y écrivent en même temps, et réécrire tout
 * l'arbre à chaque enregistrement ferait perdre la page d'en face. Il n'y a par
 * ailleurs ni dump ni PITR — d'où le softDeletes, seul filet existant.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('codex_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            // Arborescence libre : une page sans parent est une racine.
            $table->foreignId('parent_id')->nullable()->constrained('codex_pages')->cascadeOnDelete();
            $table->string('title', 150);
            $table->text('body')->nullable();
            // 'mj' = le MJ seul ; 'table' = toute la table. Pas d'héritage : une page
            // est visible ou non par elle-même (cf. CodexPage::VISIBILITIES).
            $table->string('visibility', 10)->default('table');
            $table->integer('position')->default(0);
            // Qui a écrit en dernier, pour que la table sache d'où vient une page.
            $table->string('last_editor', 80)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['campaign_id', 'parent_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('codex_pages');
    }
};
