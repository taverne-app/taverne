<?php

namespace App\Http\Controllers\Api;

use App\Events\CharacterUpdated;
use App\Events\DiceRolled;
use App\Events\SpellCast;
use App\Http\Controllers\Controller;
use App\Http\Resources\CharacterResource;
use App\Http\Resources\SharedCampaignResource;
use App\Models\Campaign;
use App\Models\Character;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShareController extends Controller
{
    public function show(string $token): SharedCampaignResource
    {
        $campaign = Campaign::where('share_token', $token)
            ->with(['characters', 'combatants'])
            ->firstOrFail();

        return new SharedCampaignResource($campaign);
    }

    /**
     * Journal des derniers jets de la campagne, pour le lanceur de dés côté joueurs.
     * Public : posséder le lien de partage suffit, comme pour le reste de la vue partagée.
     */
    public function campaignRolls(string $token): JsonResponse
    {
        $campaign = Campaign::where('share_token', $token)->firstOrFail();

        return response()->json(['data' => $campaign->recent_rolls ?? []]);
    }

    public function showCharacter(string $token): CharacterResource
    {
        $character = Character::where('share_token', $token)->with('campaign')->firstOrFail();

        return new CharacterResource($character);
    }

    /**
     * Carnet d'aventure du joueur. Volontairement servi à part de CharacterResource :
     * celle-ci part vers la console MJ ET vers l'événement CharacterUpdated, diffusé sur
     * le canal public de la campagne — donc à toute la table. Ces notes sont privées :
     * elles ne doivent sortir que d'ici, contre le jeton de la fiche.
     */
    public function notes(string $token): JsonResponse
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        return response()->json(['data' => $character->adventure_notes ?? []]);
    }

    /**
     * Remplace le carnet en bloc. Pas de diffusion temps réel : une note privée n'a
     * personne à qui être annoncée.
     */
    public function updateNotes(string $token, Request $request): JsonResponse
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        // Piège connu : validate() efface en silence toute clé non déclarée. Chaque clé
        // d'une note doit figurer ici, sinon elle disparaît à chaque enregistrement.
        $validated = $request->validate([
            'notes'              => ['present', 'array', 'max:500'],
            'notes.*.id'         => ['required', 'string', 'max:64'],
            'notes.*.type'       => ['required', 'string', 'max:40'],
            'notes.*.title'      => ['nullable', 'string', 'max:150'],
            'notes.*.body'       => ['nullable', 'string', 'max:20000'],
            'notes.*.created_at' => ['nullable', 'string', 'max:40'],
            'notes.*.updated_at' => ['nullable', 'string', 'max:40'],
        ]);

        $character->update(['adventure_notes' => $validated['notes']]);

        return response()->json(['data' => $character->fresh()->adventure_notes ?? []]);
    }

    public function updateHp(string $token, Request $request): CharacterResource
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:999'],
            'type'   => ['required', 'in:damage,heal'],
        ]);

        $amount = $request->integer('amount');

        match ($request->string('type')->value()) {
            'damage' => $this->applyDamage($character, $amount),
            'heal'   => $this->applyHeal($character, $amount),
        };

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    /**
     * Le joueur lance un sort depuis sa fiche ou le dock de combat.
     *
     * Beaucoup de sorts n'ont NI jet d'attaque NI dégâts (Armure de mage, Bouclier,
     * Détection de la magie…) : les lancer, c'est dépenser l'emplacement et le dire à
     * la table. C'est la seule action que le dock leur offrait pas, d'où cette route.
     */
    public function castSpell(string $token, Request $request): CharacterResource
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $validated = $request->validate([
            'name'  => ['required', 'string', 'max:120'],
            'level' => ['required', 'integer', 'min:0', 'max:9'],
        ]);

        $level = (int) $validated['level'];

        // Niveau 0 = tour de magie : il s'annonce mais ne consomme rien, à volonté.
        if ($level >= 1) {
            $slots = $character->spell_slots ?? [];
            $key   = (string) $level;

            abort_unless(isset($slots[$key]), 422, "Aucun emplacement de niveau {$level} sur la fiche.");

            $max  = (int) $slots[$key]['max'];
            $used = (int) ($slots[$key]['used'] ?? 0);
            abort_if($used >= $max, 422, "Plus d'emplacement de niveau {$level} disponible.");

            $slots[$key]['used'] = $used + 1;
            $character->update(['spell_slots' => $slots]);
        }

        $fresh = $character->fresh();

        SpellCast::dispatch($fresh->id, $fresh->name, $validated['name'], $level);
        // Les emplacements ont bougé : la console MJ et la fiche doivent le voir.
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    public function rollDice(string $token, Request $request): JsonResponse
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $request->validate([
            'label'        => ['sometimes', 'string', 'max:100'],
            'count'        => ['sometimes', 'integer', 'min:1', 'max:20'],
            'sides'        => ['required', 'integer', 'in:4,6,8,10,12,20,100'],
            'modifier'     => ['sometimes', 'integer', 'min:-20', 'max:30'],
            'advantage'    => ['sometimes', 'boolean'],
            'disadvantage' => ['sometimes', 'boolean'],
        ]);

        $count        = $request->integer('count', 1);
        $sides        = $request->integer('sides');
        $modifier     = $request->integer('modifier', 0);
        $advantage    = $request->boolean('advantage');
        $disadvantage = $request->boolean('disadvantage');

        $numRolls = ($advantage || $disadvantage) ? 2 : $count;
        $rolls    = array_map(fn () => random_int(1, $sides), range(1, $numRolls));

        if ($advantage) {
            $result = max($rolls);
        } elseif ($disadvantage) {
            $result = min($rolls);
        } else {
            $result = array_sum($rolls);
        }

        $roll = [
            'character_id'   => $character->id,
            'character_name' => $character->name,
            'label'          => $request->string('label', "{$count}d{$sides}")->value(),
            'count'          => $count,
            'sides'          => $sides,
            'rolls'          => $rolls,
            'modifier'       => $modifier,
            'total'          => $result + $modifier,
            'advantage'      => $advantage,
            'disadvantage'   => $disadvantage,
            'timestamp'      => now()->toISOString(),
        ];

        $roll = DiceRolled::record($character, $roll);

        return response()->json($roll);
    }

    /**
     * Le joueur lance SON initiative depuis la vue Combat. C'est le serveur qui tire
     * (1d20 + mod. de Dextérité) : le résultat est une place dans l'ordre du combat, pas
     * un jet décoratif — le laisser au client permettrait de choisir son initiative. Le
     * jet apparaît aussi au journal de la table, comme un jet de dé ordinaire, et
     * CharacterUpdated l'inscrit dans l'ordre chez le MJ et les autres joueurs.
     */
    public function rollInitiative(string $token): CharacterResource
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $modifier = $character->modifier($character->dexterity);
        $die      = random_int(1, 20);
        $total    = $die + $modifier;

        $character->update(['initiative_roll' => $total]);
        $fresh = $character->fresh();

        DiceRolled::record($fresh, [
            'character_id'   => $fresh->id,
            'character_name' => $fresh->name,
            'label'          => 'Initiative',
            'count'          => 1,
            'sides'          => 20,
            'rolls'          => [$die],
            'modifier'       => $modifier,
            'total'          => $total,
            'advantage'      => false,
            'disadvantage'   => false,
            'timestamp'      => now()->toISOString(),
        ]);

        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    private function applyDamage(Character $character, int $amount): void
    {
        $remaining = max(0, $amount - $character->temporary_hp);
        $character->update([
            'temporary_hp' => max(0, $character->temporary_hp - $amount),
            'current_hp'   => max(-$character->max_hp, $character->current_hp - $remaining),
        ]);
    }

    private function applyHeal(Character $character, int $amount): void
    {
        $character->update([
            'current_hp' => min($character->max_hp, $character->current_hp + $amount),
        ]);
    }
}
