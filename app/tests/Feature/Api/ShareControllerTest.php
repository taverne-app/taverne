<?php

namespace Tests\Feature\Api;

use App\Events\CharacterUpdated;
use App\Events\DiceRolled;
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
        $response->assertJsonMissingPath('data.share_token');
    }

    public function test_show_still_exposes_player_facing_fields(): void
    {
        $campaign = $this->sharedCampaign([
            'npcs'   => [['name' => 'Aubergiste', 'role' => 'ami']],
            'quests' => [['title' => 'Sauver le village']],
        ]);

        $this->getJson("/api/share/{$campaign->share_token}")
            ->assertOk()
            ->assertJsonPath('data.npcs.0.name', 'Aubergiste')
            ->assertJsonPath('data.quests.0.title', 'Sauver le village');
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
}
