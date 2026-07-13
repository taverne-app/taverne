<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Une séance a désormais un cycle de vie : on la prépare (statut « planned »,
 * avec ses scènes), on la joue, elle devient une entrée de journal (« played »).
 *
 * Avant, c'étaient deux choses distinctes :
 *   - campaigns.session_prep : UNE seule « prochaine session », scènes comprises ;
 *   - campaign_sessions      : le journal des séances jouées.
 *
 * On fusionne dans campaign_sessions. La colonne campaigns.session_prep n'est
 * volontairement PAS supprimée ici : sa donnée est recopiée, pas déplacée, pour
 * qu'un rollback n'en perde aucune. On la supprimera dans une migration ultérieure.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_sessions', function (Blueprint $table) {
            // Ordre choisi par le MJ : les joueurs dévient, on remonte/descend les séances.
            $table->unsignedInteger('position')->default(0);
            $table->string('status', 16)->default('planned');
            // { scenes, npc_names, location_names, encounter_names } — la forme de SessionPrep
            // moins titre/date/notes, qui ont déjà leurs colonnes.
            $table->json('prep')->nullable();
        });

        // Tout ce qui existait dans le journal a, par définition, déjà été joué.
        DB::table('campaign_sessions')->update(['status' => 'played']);

        // Chaque « prochaine session » devient une séance à venir, en tête de liste.
        $campaigns = DB::table('campaigns')
            ->whereNotNull('session_prep')
            ->select('id', 'session_prep')
            ->get();

        foreach ($campaigns as $campaign) {
            $prep = json_decode($campaign->session_prep, true);

            if (! is_array($prep)) {
                continue;
            }

            $date = $prep['date'] ?? null;

            DB::table('campaign_sessions')->insert([
                'campaign_id'  => $campaign->id,
                'title'        => $prep['title'] ?: 'Prochaine séance',
                'session_date' => $date ?: null,
                'notes'        => $prep['notes'] ?? null,
                'status'       => 'planned',
                'position'     => 1,
                'prep'         => json_encode([
                    'scenes'          => $prep['scenes'] ?? [],
                    'npc_names'       => $prep['npc_names'] ?? [],
                    'location_names'  => $prep['location_names'] ?? [],
                    'encounter_names' => $prep['encounter_names'] ?? [],
                ]),
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Les séances à venir n'existaient pas avant : elles retournent dans session_prep
        // (la première de chaque campagne — l'ancien modèle n'en portait qu'une).
        DB::table('campaign_sessions')
            ->where('status', 'planned')
            ->orderBy('position')
            ->orderBy('id')
            ->get()
            ->groupBy('campaign_id')
            ->each(function ($sessions, $campaignId) {
                $first = $sessions->first();
                $prep  = json_decode($first->prep ?? '{}', true) ?: [];

                DB::table('campaigns')->where('id', $campaignId)->update([
                    'session_prep' => json_encode([
                        'title'           => $first->title,
                        'date'            => $first->session_date ?? '',
                        'notes'           => $first->notes ?? '',
                        'scenes'          => $prep['scenes'] ?? [],
                        'npc_names'       => $prep['npc_names'] ?? [],
                        'location_names'  => $prep['location_names'] ?? [],
                        'encounter_names' => $prep['encounter_names'] ?? [],
                    ]),
                ]);
            });

        DB::table('campaign_sessions')->where('status', 'planned')->delete();

        Schema::table('campaign_sessions', function (Blueprint $table) {
            $table->dropColumn(['position', 'status', 'prep']);
        });
    }
};
