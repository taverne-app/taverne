<?php

namespace App\Http\Controllers\Api;

use App\Events\CharacterUpdated;
use App\Events\DiceRolled;
use App\Events\SpellCast;
use App\Http\Controllers\Controller;
use App\Http\Resources\CharacterResource;
use App\Http\Resources\SharedCampaignResource;
use App\Http\Resources\CodexPageResource;
use App\Models\Campaign;
use App\Models\Character;
use App\Models\CodexPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

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

    /**
     * ── Écritures du joueur sur sa propre fiche ───────────────────────────────
     *
     * Le jeton de partage est une capacité au porteur : qui a le lien EST le
     * personnage. Ces routes n'offrent donc que l'AJOUT et la MODIFICATION D'UN
     * ÉTAT RÉVERSIBLE — jamais la suppression. Un lien qui circule ne doit pas
     * pouvoir vider une fiche, et rien ici ne rattraperait la perte (ni dump ni PITR).
     *
     * Elles écrivent toutes une INTENTION, jamais un état complet : « +15 po »,
     * « prépare ce sort », « ajoute cet objet ». Le serveur calcule le résultat.
     * Envoyer le tableau entier laisserait un onglet resté ouvert écraser en silence
     * ce que le MJ vient de modifier.
     */

    /**
     * Bourse : des mouvements, pas un solde. Deux joueurs qui se partagent un butin
     * écrivent en même temps ; des deltas s'additionnent là où deux soldes absolus
     * s'écraseraient. Une bourse ne peut pas devenir négative.
     */
    public function updateCurrency(string $token, Request $request): CharacterResource
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $validated = $request->validate([
            'deltas'    => ['required', 'array'],
            'deltas.pc' => ['sometimes', 'integer', 'between:-99999,99999'],
            'deltas.pa' => ['sometimes', 'integer', 'between:-99999,99999'],
            'deltas.pe' => ['sometimes', 'integer', 'between:-99999,99999'],
            'deltas.po' => ['sometimes', 'integer', 'between:-99999,99999'],
            'deltas.pp' => ['sometimes', 'integer', 'between:-99999,99999'],
        ]);

        $currency = ($character->currency ?? []) + ['pc' => 0, 'pa' => 0, 'pe' => 0, 'po' => 0, 'pp' => 0];

        foreach ($validated['deltas'] as $coin => $delta) {
            $next = (int) ($currency[$coin] ?? 0) + (int) $delta;
            abort_if($next < 0, 422, "Pas assez de {$coin} dans la bourse.");
            $currency[$coin] = $next;
        }

        $character->update(['currency' => $currency]);

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    /**
     * Prépare ou dé-prépare un sort. Le sort est désigné par son NOM et non par son
     * rang dans la liste : le MJ peut réordonner ou insérer un sort entre le moment
     * où la fiche s'affiche et celui où le joueur coche.
     */
    public function prepareSpell(string $token, Request $request): CharacterResource
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $validated = $request->validate([
            'name'     => ['required', 'string', 'max:120'],
            'prepared' => ['required', 'boolean'],
        ]);

        $spells = $character->spells_known ?? [];
        $found  = false;
        $level  = 0;

        foreach ($spells as &$spell) {
            if (($spell['name'] ?? null) === $validated['name']) {
                $level = (int) ($spell['level'] ?? 0);
                $spell['prepared'] = $validated['prepared'];
                $found = true;
            }
        }
        unset($spell);

        abort_unless($found, 404, "Ce sort n'est pas sur la fiche.");

        // Le plafond ne vaut que pour les sorts de niveau ≥ 1 (un tour de magie ne se
        // prépare pas) et que dans le sens de l'ajout — dé-préparer doit toujours
        // rester possible, y compris depuis une fiche déjà au-dessus du plafond.
        $max = $character->max_prepared_spells;
        if ($validated['prepared'] && $level > 0 && $max !== null) {
            $count = count(array_filter(
                $spells,
                fn ($s) => (int) ($s['level'] ?? 0) > 0 && ($s['prepared'] ?? false),
            ));
            abort_if(
                $count > $max,
                422,
                "Maximum atteint : {$max} sorts préparables (niveau + mod. d'incantation).",
            );
        }

        $character->update(['spells_known' => $spells]);

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    /**
     * Ajoute un sort à la fiche. Un sort déjà présent n'est pas dupliqué : la
     * réponse est alors la fiche inchangée, ce qui rend le geste idempotent — un
     * double-clic ou un renvoi réseau ne crée pas deux entrées.
     */
    public function addSpell(string $token, Request $request): CharacterResource
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:120'],
            'level'       => ['required', 'integer', 'min:0', 'max:9'],
            'damage_dice' => ['sometimes', 'nullable', 'string', 'max:40'],
        ]);

        $spells = $character->spells_known ?? [];

        $exists = collect($spells)->contains(
            fn ($s) => mb_strtolower($s['name'] ?? '') === mb_strtolower($validated['name'])
        );

        if (! $exists) {
            $spells[] = array_filter([
                'name'        => $validated['name'],
                'level'       => (int) $validated['level'],
                'prepared'    => true,
                'damage_dice' => $validated['damage_dice'] ?? null,
            ], fn ($v) => $v !== null);

            $character->update(['spells_known' => $spells]);
        }

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    /**
     * Ajoute un objet à l'inventaire. Un objet du même nom voit sa quantité
     * augmenter plutôt que d'apparaître deux fois — c'est ce qu'on attend en
     * ramassant une seconde torche.
     */
    public function addInventoryItem(string $token, Request $request): CharacterResource
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $validated = $request->validate([
            'name'     => ['required', 'string', 'max:120'],
            'quantity' => ['required', 'integer', 'min:1', 'max:9999'],
            'weight'   => ['sometimes', 'numeric', 'min:0', 'max:9999'],
            'value_gp' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999'],
            'notes'    => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $inventory = $character->inventory ?? [];
        $merged    = false;

        foreach ($inventory as &$item) {
            if (mb_strtolower($item['name'] ?? '') === mb_strtolower($validated['name'])) {
                $item['quantity'] = (int) ($item['quantity'] ?? 0) + (int) $validated['quantity'];
                $merged = true;
                break;
            }
        }
        unset($item);

        if (! $merged) {
            $inventory[] = [
                'name'     => $validated['name'],
                'quantity' => (int) $validated['quantity'],
                'weight'   => (float) ($validated['weight'] ?? 0),
                'value_gp' => $validated['value_gp'] ?? null,
                'notes'    => $validated['notes'] ?? '',
                'equipped' => false,
            ];
        }

        $character->update(['inventory' => $inventory]);

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    /** Équipe ou déséquipe un objet déjà porté — réversible, donc ouvert au joueur. */
    public function toggleInventoryEquipped(string $token, Request $request): CharacterResource
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $validated = $request->validate([
            'name'     => ['required', 'string', 'max:120'],
            'equipped' => ['required', 'boolean'],
        ]);

        $inventory = $character->inventory ?? [];
        $found     = false;

        foreach ($inventory as &$item) {
            if (($item['name'] ?? null) === $validated['name']) {
                $item['equipped'] = $validated['equipped'];
                $found = true;
            }
        }
        unset($item);

        abort_unless($found, 404, "Cet objet n'est pas dans l'inventaire.");

        $character->update(['inventory' => $inventory]);

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    /** Repos long, même règle que côté MJ : elle vit dans le modèle. */
    public function longRest(string $token): CharacterResource
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $character->applyLongRest();

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    public function shortRest(string $token, Request $request): JsonResponse
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $request->validate([
            'dice_spent' => ['required', 'integer', 'min:1'],
        ]);

        $conMod = $character->modifier($character->constitution);
        $result = $character->applyShortRest($request->integer('dice_spent'));

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return response()->json([
            'character'    => (new CharacterResource($fresh))->resolve(),
            'rolls'        => $result['rolls'],
            'modifier'     => $conMod,
            'total_healed' => $result['healed'],
        ]);
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

    /**
     * Le codex vu des joueurs : uniquement les pages 'table'. Une page 'mj' ne doit
     * apparaître d'AUCUNE façon ici — ni son titre, ni sa place dans l'arbre.
     */
    public function codexPages(string $token): AnonymousResourceCollection
    {
        $campaign = Campaign::where('share_token', $token)->firstOrFail();

        return CodexPageResource::collection(
            $campaign->codexPages()->where('visibility', 'table')->get()
        );
    }

    public function storeCodexPage(string $token, Request $request): CodexPageResource
    {
        $campaign = Campaign::where('share_token', $token)->firstOrFail();

        $validated = $request->validate([
            'title'           => ['required', 'string', 'max:150'],
            'body'            => ['sometimes', 'nullable', 'string', 'max:100000'],
            'parent_id'       => ['sometimes', 'nullable', 'integer'],
            'character_token' => ['sometimes', 'nullable', 'string'],
        ]);

        // Un joueur ne range sa page que sous une page qu'il voit. Un parent 'mj' le
        // renseignerait sur l'existence d'un secret : on le refuse comme inexistant.
        $parentId = $this->visiblePlayerParent($campaign, $validated['parent_id'] ?? null);

        $page = $campaign->codexPages()->create([
            'title'       => $validated['title'],
            'body'        => $validated['body'] ?? null,
            'parent_id'   => $parentId,
            // Jamais choisi par le joueur : ce qu'il écrit appartient à la table.
            'visibility'  => 'table',
            'position'    => ((int) $campaign->codexPages()->where('parent_id', $parentId)->max('position')) + 1,
            'last_editor' => $this->editorName($campaign, $validated['character_token'] ?? null),
        ]);

        return new CodexPageResource($page);
    }

    /**
     * Les joueurs modifient le texte, jamais la structure ni la visibilité : déplacer
     * ou rendre secrète une page reste au MJ. Ils ne suppriment pas non plus — rien
     * ne rattrape une suppression ici (ni dump, ni PITR).
     */
    public function updateCodexPage(string $token, CodexPage $codexPage, Request $request): CodexPageResource
    {
        $campaign = Campaign::where('share_token', $token)->firstOrFail();

        abort_if($codexPage->campaign_id !== $campaign->id, 403);
        abort_if($codexPage->visibility !== 'table', 404);

        $validated = $request->validate([
            'title'           => ['sometimes', 'string', 'max:150'],
            'body'            => ['sometimes', 'nullable', 'string', 'max:100000'],
            'character_token' => ['sometimes', 'nullable', 'string'],
        ]);

        $codexPage->update([
            'title'       => $validated['title'] ?? $codexPage->title,
            'body'        => array_key_exists('body', $validated) ? $validated['body'] : $codexPage->body,
            'last_editor' => $this->editorName($campaign, $validated['character_token'] ?? null),
        ]);

        return new CodexPageResource($codexPage->fresh());
    }

    private function visiblePlayerParent(Campaign $campaign, ?int $parentId): ?int
    {
        if ($parentId === null) {
            return null;
        }

        abort_unless(
            $campaign->codexPages()->whereKey($parentId)->where('visibility', 'table')->exists(),
            422,
            'Page parente introuvable.',
        );

        return $parentId;
    }

    /**
     * Le lien de campagne est le même pour toute la table : il ne dit pas qui écrit.
     * Le jeton du PERSONNAGE, lui, n'est remis qu'à son joueur — c'est la seule
     * identité disponible. À défaut, la page reste signée d'un joueur anonyme.
     */
    private function editorName(Campaign $campaign, ?string $characterToken): string
    {
        if (! $characterToken) {
            return 'Un joueur';
        }

        $character = Character::where('share_token', $characterToken)
            ->where('campaign_id', $campaign->id)
            ->first();

        return $character?->name ?? 'Un joueur';
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
