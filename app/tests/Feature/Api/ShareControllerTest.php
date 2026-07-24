<?php

namespace Tests\Feature\Api;

use App\Events\CharacterUpdated;
use App\Events\DiceRolled;
use App\Events\SpellCast;
use App\Models\Campaign;
use App\Models\Chapter;
use App\Models\Character;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ShareControllerTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    private function sharedCampaign(array $attrs = []): Campaign
    {
        return Campaign::factory()->create(['user_id' => $this->user->id, 'share_token' => 'tok-share'] + $attrs);
    }

    // ── Consultation de la campagne (public, lecture seule) ───────────────────

    /**
     * Aucun chapitre ne part chez les joueurs — pas même un chapitre terminé.
     *
     * Un chapitre porte la préparation du MJ (accroches, trésors, secrets). Cocher
     * « terminé » ne transforme pas ces notes en compte rendu : les publier vendrait
     * la mèche. Ce que les joueurs savent du passé sera écrit pour eux, ailleurs.
     */
    public function test_share_never_leaks_chapters_even_finished_ones(): void
    {
        $campaign = $this->sharedCampaign();

        Chapter::create([
            'campaign_id' => $campaign->id,
            'title'       => 'Le piège du sorcier',
            'position'    => 1,
            'done'        => false,
            'prep'        => [
                'scenes' => [[
                    'id' => 'sc1', 'kind' => 'combat', 'title' => 'Embuscade',
                    'hook' => 'Le sorcier est en réalité le maire',
                    'treasure' => 'Anneau de Vecna',
                    'notes' => 'Ne pas révéler avant le round 3',
                    'done' => false, 'npc_names' => [], 'encounter_name' => '', 'location_name' => '',
                ]],
                'npc_names' => [], 'location_names' => [], 'encounter_names' => [],
            ],
        ]);

        Chapter::create([
            'campaign_id' => $campaign->id,
            'title'       => 'La taverne en flammes',
            'position'    => 2,
            'done'        => true,
            'notes'       => 'Le baron survit, il reviendra au chapitre 7',
        ]);

        $response = $this->getJson("/api/share/{$campaign->share_token}")->assertOk();

        $response->assertJsonMissingPath('data.chapters');

        $body = $response->getContent();
        $this->assertStringNotContainsString('Le piège du sorcier', $body);
        $this->assertStringNotContainsString('Le sorcier est en réalité le maire', $body);
        $this->assertStringNotContainsString('Anneau de Vecna', $body);
        $this->assertStringNotContainsString('Ne pas révéler avant le round 3', $body);

        // Le chapitre TERMINÉ non plus : ses notes sont des notes de MJ, pas un récit.
        $this->assertStringNotContainsString('La taverne en flammes', $body);
        $this->assertStringNotContainsString('il reviendra au chapitre 7', $body);
    }

    public function test_show_returns_the_campaign_for_a_valid_token(): void
    {
        $campaign = $this->sharedCampaign(['name' => 'La Malédiction de Strahd']);
        Character::factory(2)->create(['user_id' => $this->user->id, 'campaign_id' => $campaign->id]);

        $this->getJson("/api/share/{$campaign->share_token}")
            ->assertOk()
            ->assertJsonPath('data.name', 'La Malédiction de Strahd')
            ->assertJsonCount(2, 'data.characters');
    }

    public function test_show_returns_404_for_an_unknown_or_revoked_token(): void
    {
        $this->getJson('/api/share/jamais-vu')->assertNotFound();
    }

    public function test_show_does_not_leak_dm_only_fields(): void
    {
        $campaign = $this->sharedCampaign([
            'dm_notes'         => 'Le boss est un dragon polymorphé',
            'session_prep'     => ['scenes' => ['embuscade secrète']],
            'saved_encounters' => [['name' => 'Rencontre cachée']],
            'custom_monsters'  => [['name' => 'Liche', 'ac' => 17]],
            'random_tables'    => [['name' => 'Butin']],
        ]);

        $response = $this->getJson("/api/share/{$campaign->share_token}")->assertOk();

        $response->assertJsonMissingPath('data.dm_notes');
        $response->assertJsonMissingPath('data.session_prep');
        $response->assertJsonMissingPath('data.saved_encounters');
        $response->assertJsonMissingPath('data.custom_monsters');
        $response->assertJsonMissingPath('data.random_tables');
        $response->assertJsonMissingPath('data.quests');
        $response->assertJsonMissingPath('data.share_token');
    }

    public function test_show_still_exposes_player_facing_fields(): void
    {
        $campaign = $this->sharedCampaign([
            'npcs' => [['name' => 'Aubergiste', 'role' => 'ami']],
        ]);

        $this->getJson("/api/share/{$campaign->share_token}")
            ->assertOk()
            ->assertJsonPath('data.npcs.0.name', 'Aubergiste');
    }

    public function test_show_strips_hidden_battle_map_tokens(): void
    {
        $campaign = $this->sharedCampaign([
            'battle_map' => [
                'image_url' => 'https://example.test/donjon.png',
                'grid'      => null,
                'tokens'    => [
                    ['id' => 'trap', 'ref_type' => null, 'ref_id' => null, 'label' => 'Piège', 'x' => 10, 'y' => 10, 'color' => 'red', 'size' => 'md', 'hidden' => true],
                    ['id' => 'hero', 'ref_type' => 'character', 'ref_id' => 1, 'label' => 'Héros', 'x' => 20, 'y' => 20, 'color' => 'sky', 'size' => 'md'],
                ],
            ],
        ]);

        $response = $this->getJson("/api/share/{$campaign->share_token}")->assertOk();

        $response->assertJsonCount(1, 'data.battle_map.tokens');
        $response->assertJsonPath('data.battle_map.tokens.0.id', 'hero');
        // Le pion caché ne doit apparaître nulle part dans le payload.
        $this->assertStringNotContainsString('trap', $response->getContent());
        $this->assertStringNotContainsString('Piège', $response->getContent());
    }

    // ── Consultation d'une fiche personnage ──────────────────────────────────

    public function test_show_character_returns_the_character_for_a_valid_token(): void
    {
        $character = Character::factory()->create(['user_id' => $this->user->id, 'share_token' => 'tok-char', 'name' => 'Aria']);

        $this->getJson('/api/share/character/tok-char')
            ->assertOk()
            ->assertJsonPath('data.name', 'Aria');
    }

    public function test_show_character_returns_404_for_an_unknown_token(): void
    {
        $this->getJson('/api/share/character/inconnu')->assertNotFound();
    }

    // ── Mise à jour des PV depuis la fiche partagée ──────────────────────────

    public function test_update_hp_damages_the_character_and_broadcasts(): void
    {
        Event::fake([CharacterUpdated::class]);
        $character = Character::factory()->create([
            'user_id' => $this->user->id, 'share_token' => 'tok-hp',
            'max_hp' => 30, 'current_hp' => 30, 'temporary_hp' => 0,
        ]);

        $this->patchJson('/api/share/character/tok-hp/hp', ['amount' => 8, 'type' => 'damage'])
            ->assertOk()
            ->assertJsonPath('data.combat.current_hp', 22);

        Event::assertDispatched(CharacterUpdated::class);
    }

    public function test_update_hp_heal_is_capped_at_max(): void
    {
        $character = Character::factory()->create([
            'user_id' => $this->user->id, 'share_token' => 'tok-heal',
            'max_hp' => 20, 'current_hp' => 18, 'temporary_hp' => 0,
        ]);

        $this->patchJson('/api/share/character/tok-heal/hp', ['amount' => 10, 'type' => 'heal'])
            ->assertOk()
            ->assertJsonPath('data.combat.current_hp', 20);
    }

    public function test_update_hp_returns_404_for_a_bad_token(): void
    {
        $this->patchJson('/api/share/character/nope/hp', ['amount' => 5, 'type' => 'damage'])
            ->assertNotFound();
    }

    public function test_update_hp_validates_amount_and_type(): void
    {
        Character::factory()->create(['user_id' => $this->user->id, 'share_token' => 'tok-val']);

        $this->patchJson('/api/share/character/tok-val/hp', ['amount' => 0, 'type' => 'damage'])
            ->assertStatus(422);
        $this->patchJson('/api/share/character/tok-val/hp', ['amount' => 5, 'type' => 'vaporize'])
            ->assertStatus(422);
    }

    // ── Jet de dés depuis la fiche partagée ──────────────────────────────────

    public function test_roll_dice_returns_a_total_and_broadcasts(): void
    {
        Event::fake([DiceRolled::class]);
        $character = Character::factory()->create(['user_id' => $this->user->id, 'share_token' => 'tok-roll']);

        $this->postJson('/api/share/character/tok-roll/roll', ['sides' => 20, 'modifier' => 3])
            ->assertOk()
            ->assertJsonPath('character_id', $character->id)
            ->assertJson(fn ($json) => $json->where('total', fn ($t) => $t >= 4 && $t <= 23)->etc());

        Event::assertDispatched(DiceRolled::class);
    }

    public function test_roll_dice_returns_404_for_a_bad_token(): void
    {
        $this->postJson('/api/share/character/nope/roll', ['sides' => 20])->assertNotFound();
    }

    // ── Le joueur lance SON initiative depuis la vue Combat ──────────────────────

    public function test_player_rolls_own_initiative_and_it_lands_in_the_order(): void
    {
        Event::fake([CharacterUpdated::class, DiceRolled::class]);
        // Dextérité 16 → mod +3 : le résultat doit tomber dans [1+3, 20+3] = [4, 23].
        $character = Character::factory()->create([
            'user_id' => $this->user->id, 'share_token' => 'tok-init', 'dexterity' => 16,
        ]);

        $this->postJson('/api/share/character/tok-init/initiative')
            ->assertOk()
            ->assertJson(fn ($json) => $json->where(
                'data.combat.initiative_roll',
                fn ($v) => $v >= 4 && $v <= 23,
            )->etc());

        $roll = $character->fresh()->initiative_roll;
        $this->assertNotNull($roll);
        $this->assertGreaterThanOrEqual(4, $roll);
        $this->assertLessThanOrEqual(23, $roll);

        // La place dans l'ordre (CharacterUpdated) ET le jet au journal (DiceRolled).
        Event::assertDispatched(CharacterUpdated::class);
        Event::assertDispatched(DiceRolled::class);
    }

    public function test_roll_initiative_returns_404_for_a_bad_token(): void
    {
        $this->postJson('/api/share/character/nope/initiative')->assertNotFound();
    }

    // ── Lancer un sort depuis la fiche partagée ──────────────────────────────

    /**
     * Le cas Freya : ses six sorts (Armure de mage, Bouclier, Main de mage…) n'ont NI
     * jet d'attaque NI dégâts. Les lancer, c'est dépenser l'emplacement et l'annoncer.
     */
    public function test_casting_a_levelled_spell_spends_a_slot_and_announces_it(): void
    {
        Event::fake([SpellCast::class, CharacterUpdated::class]);
        $character = Character::factory()->create([
            'user_id' => $this->user->id, 'share_token' => 'tok-cast', 'name' => 'Freya',
            'spell_slots' => ['1' => ['max' => 2, 'used' => 0]],
        ]);

        $this->patchJson('/api/share/character/tok-cast/cast', ['name' => 'Armure de mage', 'level' => 1])
            ->assertOk()
            ->assertJsonPath('data.spellcasting.slots.1.used', 1);

        $this->assertSame(1, $character->fresh()->spell_slots['1']['used']);

        Event::assertDispatched(
            SpellCast::class,
            fn (SpellCast $e) => $e->spellName === 'Armure de mage'
                && $e->characterName === 'Freya'
                && $e->level === 1,
        );
    }

    /** Un tour de magie s'annonce mais ne consomme rien : il est à volonté. */
    public function test_casting_a_cantrip_spends_no_slot(): void
    {
        Event::fake([SpellCast::class]);
        $character = Character::factory()->create([
            'user_id' => $this->user->id, 'share_token' => 'tok-cantrip',
            'spell_slots' => ['1' => ['max' => 2, 'used' => 0]],
        ]);

        $this->patchJson('/api/share/character/tok-cantrip/cast', ['name' => 'Main de mage', 'level' => 0])
            ->assertOk();

        $this->assertSame(0, $character->fresh()->spell_slots['1']['used']);
        Event::assertDispatched(SpellCast::class);
    }

    public function test_casting_without_a_free_slot_is_refused(): void
    {
        Event::fake([SpellCast::class]);
        $character = Character::factory()->create([
            'user_id' => $this->user->id, 'share_token' => 'tok-empty-slot',
            'spell_slots' => ['1' => ['max' => 1, 'used' => 1]],
        ]);

        $this->patchJson('/api/share/character/tok-empty-slot/cast', ['name' => 'Bouclier', 'level' => 1])
            ->assertStatus(422);

        // Rien ne doit bouger, et surtout rien ne doit être annoncé.
        $this->assertSame(1, $character->fresh()->spell_slots['1']['used']);
        Event::assertNotDispatched(SpellCast::class);
    }

    public function test_casting_a_level_the_sheet_has_no_slots_for_is_refused(): void
    {
        Character::factory()->create([
            'user_id' => $this->user->id, 'share_token' => 'tok-no-slot',
            'spell_slots' => ['1' => ['max' => 2, 'used' => 0]],
        ]);

        $this->patchJson('/api/share/character/tok-no-slot/cast', ['name' => 'Boule de feu', 'level' => 3])
            ->assertStatus(422);
    }

    public function test_casting_returns_404_for_a_bad_token(): void
    {
        $this->patchJson('/api/share/character/nope/cast', ['name' => 'Bouclier', 'level' => 1])
            ->assertNotFound();
    }

    // ── Carnet d'aventure du joueur (privé) ──────────────────────────────────

    public function test_notes_are_read_and_written_against_the_character_token(): void
    {
        $character = Character::factory()->create(['user_id' => $this->user->id, 'share_token' => 'tok-notes']);

        $this->getJson('/api/share/character/tok-notes/notes')
            ->assertOk()
            ->assertExactJson(['data' => []]);

        $this->putJson('/api/share/character/tok-notes/notes', ['notes' => [[
            'id' => 'n1', 'type' => 'PNJ', 'title' => 'Le maire',
            'body' => 'Il ment sur la nuit du meurtre.',
            'created_at' => '2026-07-17T10:00:00Z', 'updated_at' => '2026-07-17T10:00:00Z',
        ]]])
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Le maire')
            ->assertJsonPath('data.0.body', 'Il ment sur la nuit du meurtre.');

        $this->assertSame('PNJ', $character->fresh()->adventure_notes[0]['type']);
    }

    /**
     * Le piège n°3 du dépôt : validate() efface en silence les clés non déclarées.
     * Deux pertes de données réelles sont venues de là. Ce test échoue si une clé de
     * note cesse d'être déclarée dans la FormRequest.
     */
    public function test_saving_notes_keeps_every_declared_key(): void
    {
        Character::factory()->create(['user_id' => $this->user->id, 'share_token' => 'tok-keys']);

        $note = [
            'id' => 'n1', 'type' => 'Libre', 'title' => 'Titre',
            'body' => 'Corps', 'created_at' => '2026-07-17T10:00:00Z',
            'updated_at' => '2026-07-17T11:00:00Z',
        ];

        $this->putJson('/api/share/character/tok-keys/notes', ['notes' => [$note]])
            ->assertOk()
            ->assertJsonPath('data.0', $note);
    }

    public function test_an_empty_list_erases_the_notebook(): void
    {
        $character = Character::factory()->create([
            'user_id' => $this->user->id, 'share_token' => 'tok-empty',
            'adventure_notes' => [['id' => 'n1', 'type' => 'Libre', 'title' => 'x', 'body' => 'y']],
        ]);

        $this->putJson('/api/share/character/tok-empty/notes', ['notes' => []])
            ->assertOk()
            ->assertExactJson(['data' => []]);

        $this->assertSame([], $character->fresh()->adventure_notes);
    }

    public function test_notes_require_an_id_and_a_type(): void
    {
        Character::factory()->create(['user_id' => $this->user->id, 'share_token' => 'tok-inv']);

        $this->putJson('/api/share/character/tok-inv/notes', ['notes' => [['body' => 'orpheline']]])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['notes.0.id', 'notes.0.type']);
    }

    public function test_notes_return_404_for_a_bad_token(): void
    {
        $this->getJson('/api/share/character/nope/notes')->assertNotFound();
        $this->putJson('/api/share/character/nope/notes', ['notes' => []])->assertNotFound();
    }

    /**
     * Les notes sont privées : elles ne doivent sortir QUE de leur route dédiée.
     * CharacterResource part à la fois vers la console MJ et vers l'événement
     * CharacterUpdated, diffusé sur le canal public de la campagne — donc à toute la
     * table. Si quelqu'un ajoute `adventure_notes` à la ressource, ce test tombe.
     */
    public function test_the_notebook_never_leaks_through_the_shared_character_or_the_campaign(): void
    {
        $campaign = $this->sharedCampaign();
        Character::factory()->create([
            'user_id' => $this->user->id, 'campaign_id' => $campaign->id,
            'share_token' => 'tok-priv',
            'adventure_notes' => [[
                'id' => 'n1', 'type' => 'Théorie', 'title' => 'Secret',
                'body' => 'Je soupçonne le barde',
            ]],
        ]);

        // On teste la structure décodée, pas le texte brut : en JSON les accents sont
        // échappés (« soupçonne » devient « soupçonne »), donc un assertDontSee sur
        // une phrase accentuée passe toujours — il ne prouve rien.
        $sheet = $this->getJson('/api/share/character/tok-priv')->assertOk();
        $this->assertArrayNotHasKey('adventure_notes', $sheet->json('data'));
        $this->assertStringNotContainsString('barde', $sheet->getContent());

        $shared = $this->getJson('/api/share/tok-share')->assertOk();
        foreach ($shared->json('data.characters') ?? [] as $c) {
            $this->assertArrayNotHasKey('adventure_notes', $c);
        }
        $this->assertStringNotContainsString('barde', $shared->getContent());
    }

    // ── Écritures du joueur sur sa propre fiche ──────────────────────────────
    //
    // Le jeton est une capacité au porteur : ces routes n'offrent que l'ajout et des
    // états réversibles. Les tests qui suivent tiennent cette frontière autant que le
    // comportement — aucune ne doit jamais permettre de retirer quoi que ce soit.

    /**
     * La factory tire la classe, le niveau et les caractéristiques au hasard. Le
     * plafond de sorts préparables en dépendant (niveau + mod. d'incantation), un
     * tirage malheureux — clerc niveau 1, sagesse 8 → plafond de 1 — faisait échouer
     * en 422 des tests qui ne parlent pas du plafond. D'où ces valeurs par défaut,
     * qui laissent une marge confortable (magicien niv. 5, INT 16 → 8 préparables).
     * `$attrs` passe avant : un test qui fixe sa classe ou son niveau garde la main.
     */
    private function playerCharacter(array $attrs = []): Character
    {
        return Character::factory()->create([
            'user_id'     => $this->user->id,
            'share_token' => 'tok-joueur',
        ] + $attrs + [
            'character_class' => 'Magicien',
            'level'           => 5,
            'intelligence'    => 16,
        ]);
    }

    public function test_le_joueur_ajoute_et_depense_des_pieces(): void
    {
        $character = $this->playerCharacter(['currency' => ['po' => 10, 'pa' => 3, 'pc' => 0, 'pe' => 0, 'pp' => 0]]);

        $this->patchJson('/api/share/character/tok-joueur/currency', ['deltas' => ['po' => 15]])
            ->assertOk()
            ->assertJsonPath('data.currency.po', 25);

        $this->patchJson('/api/share/character/tok-joueur/currency', ['deltas' => ['po' => -5, 'pa' => -3]])
            ->assertOk()
            ->assertJsonPath('data.currency.po', 20)
            ->assertJsonPath('data.currency.pa', 0);

        $this->assertSame(20, $character->fresh()->currency['po']);
    }

    /** Une bourse négative n'existe pas : la dépense de trop est refusée en bloc. */
    public function test_le_joueur_ne_peut_pas_vider_sa_bourse_en_dessous_de_zero(): void
    {
        $character = $this->playerCharacter(['currency' => ['po' => 5, 'pa' => 0, 'pc' => 0, 'pe' => 0, 'pp' => 0]]);

        $this->patchJson('/api/share/character/tok-joueur/currency', ['deltas' => ['po' => -6]])
            ->assertStatus(422);

        $this->assertSame(5, $character->fresh()->currency['po']);
    }

    public function test_le_joueur_prepare_et_deprepare_un_sort(): void
    {
        $character = $this->playerCharacter(['spells_known' => [
            ['name' => 'Projectile magique', 'level' => 1, 'prepared' => false],
            ['name' => 'Bouclier',           'level' => 1, 'prepared' => true],
        ]]);

        $this->patchJson('/api/share/character/tok-joueur/spell-prepared', [
            'name' => 'Projectile magique', 'prepared' => true,
        ])->assertOk();

        $this->patchJson('/api/share/character/tok-joueur/spell-prepared', [
            'name' => 'Bouclier', 'prepared' => false,
        ])->assertOk();

        $spells = $character->fresh()->spells_known;
        $this->assertTrue($spells[0]['prepared']);
        $this->assertFalse($spells[1]['prepared']);
    }

    /**
     * Le sort est désigné par son nom : préparer ne doit jamais pouvoir en retirer un
     * autre, ni faire disparaître une entrée que le MJ vient d'ajouter.
     */
    public function test_preparer_un_sort_ne_touche_a_aucun_autre(): void
    {
        $character = $this->playerCharacter(['spells_known' => [
            ['name' => 'Bouclier', 'level' => 1, 'prepared' => false, 'damage_dice' => '1d8', 'notes' => 'garder'],
            ['name' => 'Soins',    'level' => 1, 'prepared' => true],
        ]]);

        $this->patchJson('/api/share/character/tok-joueur/spell-prepared', [
            'name' => 'Bouclier', 'prepared' => true,
        ])->assertOk();

        $spells = $character->fresh()->spells_known;
        $this->assertCount(2, $spells);
        $this->assertSame('1d8', $spells[0]['damage_dice']);
        $this->assertSame('garder', $spells[0]['notes']);
        $this->assertSame('Soins', $spells[1]['name']);
    }

    public function test_preparer_un_sort_absent_repond_404(): void
    {
        $this->playerCharacter(['spells_known' => [['name' => 'Bouclier', 'level' => 1, 'prepared' => true]]]);

        $this->patchJson('/api/share/character/tok-joueur/spell-prepared', [
            'name' => 'Boule de feu', 'prepared' => true,
        ])->assertNotFound();
    }

    public function test_le_joueur_ajoute_un_sort_sans_le_dupliquer(): void
    {
        $character = $this->playerCharacter(['spells_known' => []]);

        $this->postJson('/api/share/character/tok-joueur/spells', [
            'name' => 'Boule de feu', 'level' => 3, 'damage_dice' => '8d6',
        ])->assertOk();

        // Deuxième envoi (double-clic, renvoi réseau) : la liste ne bouge plus.
        $this->postJson('/api/share/character/tok-joueur/spells', [
            'name' => 'boule de feu', 'level' => 3,
        ])->assertOk();

        $spells = $character->fresh()->spells_known;
        $this->assertCount(1, $spells);
        $this->assertSame('Boule de feu', $spells[0]['name']);
        $this->assertSame('8d6', $spells[0]['damage_dice']);
    }

    public function test_le_joueur_ajoute_un_objet_et_cumule_les_quantites(): void
    {
        $character = $this->playerCharacter(['inventory' => []]);

        $this->postJson('/api/share/character/tok-joueur/inventory', [
            'name' => 'Torche', 'quantity' => 2, 'weight' => 0.5, 'value_gp' => 0.01,
        ])->assertOk();

        $this->postJson('/api/share/character/tok-joueur/inventory', [
            'name' => 'torche', 'quantity' => 3,
        ])->assertOk();

        $inventory = $character->fresh()->inventory;
        $this->assertCount(1, $inventory);
        $this->assertSame(5, $inventory[0]['quantity']);
        // La valeur du premier ajout survit au cumul.
        $this->assertEqualsWithDelta(0.01, $inventory[0]['value_gp'], 0.0001);
    }

    public function test_le_joueur_equipe_et_desequipe_un_objet(): void
    {
        $character = $this->playerCharacter(['inventory' => [
            ['name' => 'Épée longue', 'quantity' => 1, 'weight' => 1.5, 'value_gp' => 15, 'notes' => '', 'equipped' => false],
        ]]);

        $this->patchJson('/api/share/character/tok-joueur/inventory-equipped', [
            'name' => 'Épée longue', 'equipped' => true,
        ])->assertOk();

        $this->assertTrue($character->fresh()->inventory[0]['equipped']);

        $this->patchJson('/api/share/character/tok-joueur/inventory-equipped', [
            'name' => 'Épée longue', 'equipped' => false,
        ])->assertOk();

        $this->assertFalse($character->fresh()->inventory[0]['equipped']);
    }

    public function test_le_joueur_prend_un_repos_long(): void
    {
        $character = $this->playerCharacter([
            'level'                 => 4,
            'max_hp'                => 30,
            'current_hp'            => 7,
            'temporary_hp'          => 4,
            'spell_slots'           => ['1' => ['max' => 4, 'used' => 3]],
            'death_saves_failures'  => 2,
        ]);

        $this->postJson('/api/share/character/tok-joueur/rest')
            ->assertOk()
            ->assertJsonPath('data.combat.current_hp', 30);

        $fresh = $character->fresh();
        $this->assertSame(0, $fresh->temporary_hp);
        $this->assertSame(0, $fresh->spell_slots['1']['used']);
        $this->assertSame(0, $fresh->death_saves_failures);
    }

    public function test_le_repos_court_refuse_plus_de_des_que_disponibles(): void
    {
        $this->playerCharacter(['level' => 3, 'hit_dice_remaining' => 1]);

        $this->postJson('/api/share/character/tok-joueur/short-rest', ['dice_spent' => 2])
            ->assertStatus(422);
    }

    /** Un jeton inconnu n'écrit rien, sur aucune de ces routes. */
    public function test_un_jeton_inconnu_ne_peut_rien_ecrire(): void
    {
        $this->patchJson('/api/share/character/inconnu/currency', ['deltas' => ['po' => 1]])->assertNotFound();
        $this->postJson('/api/share/character/inconnu/spells', ['name' => 'X', 'level' => 1])->assertNotFound();
        $this->postJson('/api/share/character/inconnu/inventory', ['name' => 'X', 'quantity' => 1])->assertNotFound();
        $this->postJson('/api/share/character/inconnu/rest')->assertNotFound();
    }

    /**
     * Le plafond doit REFUSER, pas seulement s'afficher : la fiche est publique
     * derrière son jeton, et l'interface n'est pas un garde-fou.
     */
    public function test_le_joueur_ne_depasse_pas_le_plafond_de_sorts_prepares(): void
    {
        // Magicien niv. 1, INT 16 (+3) → 4 sorts préparables.
        $character = $this->playerCharacter([
            'character_class' => 'Magicien',
            'level'           => 1,
            'intelligence'    => 16,
            'spells_known'    => [
                ['name' => 'Bouclier',           'level' => 1, 'prepared' => true],
                ['name' => 'Armure de mage',     'level' => 1, 'prepared' => true],
                ['name' => 'Projectile magique', 'level' => 1, 'prepared' => true],
                ['name' => 'Sommeil',            'level' => 1, 'prepared' => true],
                ['name' => 'Graisse',            'level' => 1, 'prepared' => false],
                ['name' => 'Trait de feu',       'level' => 0, 'prepared' => true],
            ],
        ]);

        $this->patchJson('/api/share/character/tok-joueur/spell-prepared', [
            'name' => 'Graisse', 'prepared' => true,
        ])->assertStatus(422);

        // Le refus ne doit RIEN avoir écrit.
        $this->assertFalse($character->fresh()->spells_known[4]['prepared']);
    }

    /** Dé-préparer reste toujours possible, même depuis une fiche au-dessus du plafond. */
    public function test_deprepare_reste_possible_au_dessus_du_plafond(): void
    {
        $character = $this->playerCharacter([
            'character_class' => 'Magicien',
            'level'           => 1,
            'intelligence'    => 16,
            'spells_known'    => array_map(
                fn ($i) => ['name' => "Sort {$i}", 'level' => 1, 'prepared' => true],
                range(1, 9),
            ),
        ]);

        $this->patchJson('/api/share/character/tok-joueur/spell-prepared', [
            'name' => 'Sort 1', 'prepared' => false,
        ])->assertOk();

        $this->assertFalse($character->fresh()->spells_known[0]['prepared']);
    }

    /** Un tour de magie ne se prépare pas : il échappe au plafond. */
    public function test_un_tour_de_magie_echappe_au_plafond(): void
    {
        $character = $this->playerCharacter([
            'character_class' => 'Magicien',
            'level'           => 1,
            'intelligence'    => 16,
            'spells_known'    => [
                ['name' => 'Bouclier',           'level' => 1, 'prepared' => true],
                ['name' => 'Armure de mage',     'level' => 1, 'prepared' => true],
                ['name' => 'Projectile magique', 'level' => 1, 'prepared' => true],
                ['name' => 'Sommeil',            'level' => 1, 'prepared' => true],
                ['name' => 'Trait de feu',       'level' => 0, 'prepared' => false],
            ],
        ]);

        $this->patchJson('/api/share/character/tok-joueur/spell-prepared', [
            'name' => 'Trait de feu', 'prepared' => true,
        ])->assertOk();

        $this->assertTrue($character->fresh()->spells_known[4]['prepared']);
    }

    /** Un ensorceleur « connaît » ses sorts : aucun plafond ne doit le bloquer. */
    public function test_une_classe_sans_preparation_nest_jamais_bloquee(): void
    {
        $character = $this->playerCharacter([
            'character_class' => 'Ensorceleur',
            'level'           => 1,
            'charisma'        => 16,
            'spells_known'    => array_map(
                fn ($i) => ['name' => "Sort {$i}", 'level' => 1, 'prepared' => $i > 1],
                range(1, 9),
            ),
        ]);

        $this->patchJson('/api/share/character/tok-joueur/spell-prepared', [
            'name' => 'Sort 1', 'prepared' => true,
        ])->assertOk();

        $this->assertTrue($character->fresh()->spells_known[0]['prepared']);
    }
}
