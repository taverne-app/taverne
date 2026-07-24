<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Une « séance » n'en était plus une : ce qu'on manipule est une section de scénario,
 * pas une soirée de jeu. On la nomme « chapitre », et on en tire les conséquences.
 *
 *   - `session_date` disparaît : un chapitre n'a pas de date, il a un rang. La
 *     chronologie, c'est l'ordre de la liste.
 *   - `status` (planned|played) devient `done` : une seule coche, pas un cycle de vie.
 *   - `campaigns.campaign_milestones` disparaît : les jalons faisaient doublon avec les
 *     chapitres côté MJ, et leur seul rôle propre (montrer le passé aux joueurs) revient
 *     au futur codex joueurs.
 *
 * Les chapitres terminés gardent leur ordre : ils passent en fin de file, ils ne se
 * mélangent pas. D'où la renumérotation ci-dessous — les séances jouées avaient toutes
 * `position = 0`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('campaign_sessions', 'chapters');

        Schema::table('chapters', function (Blueprint $table) {
            $table->boolean('done')->default(false);
        });

        DB::table('chapters')->where('status', 'played')->update(['done' => true]);

        // Les chapitres terminés se rangent après les chapitres en cours, dans leur
        // ordre d'origine (l'id, faute de mieux : ils n'avaient pas de rang).
        $campaignIds = DB::table('chapters')->distinct()->pluck('campaign_id');

        foreach ($campaignIds as $campaignId) {
            $position = (int) DB::table('chapters')
                ->where('campaign_id', $campaignId)
                ->where('done', false)
                ->max('position');

            $doneIds = DB::table('chapters')
                ->where('campaign_id', $campaignId)
                ->where('done', true)
                ->orderBy('id')
                ->pluck('id');

            foreach ($doneIds as $id) {
                DB::table('chapters')->where('id', $id)->update(['position' => ++$position]);
            }
        }

        Schema::table('chapters', function (Blueprint $table) {
            $table->dropColumn(['session_date', 'status']);
        });

        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('campaign_milestones');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->json('campaign_milestones')->nullable();
        });

        Schema::table('chapters', function (Blueprint $table) {
            $table->date('session_date')->nullable();
            $table->string('status', 16)->default('planned');
        });

        DB::table('chapters')->where('done', true)->update(['status' => 'played', 'position' => 0]);

        Schema::table('chapters', function (Blueprint $table) {
            $table->dropColumn('done');
        });

        Schema::rename('chapters', 'campaign_sessions');
    }
};
