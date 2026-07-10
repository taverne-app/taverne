<?php

namespace Tests\Feature\Api;

use App\Models\Campaign;
use App\Models\Character;
use App\Models\User;
use Tests\TestCase;

class CharacterTest extends TestCase
{

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public function test_index_returns_only_own_characters(): void
    {
        Character::factory(3)->create(['user_id' => $this->user->id]);
        Character::factory(2)->create(); // autres joueurs

        $this->actingAs($this->user)
            ->getJson('/api/characters')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_store_creates_character_with_full_hp(): void
    {
        $campaign = Campaign::factory()->create(['user_id' => $this->user->id]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/characters', [
                'name'            => 'Legolas',
                'race'            => 'Elfe',
                'character_class' => 'Rôdeur',
                'max_hp'          => 45,
                'armor_class'     => 16,
                'campaign_id'     => $campaign->id,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.name', 'Legolas')
            ->assertJsonPath('data.combat.current_hp', 45);

        $this->assertDatabaseHas('characters', [
            'name'        => 'Legolas',
            'user_id'     => $this->user->id,
            'campaign_id' => $campaign->id,
        ]);
    }

    public function test_store_requires_a_campaign(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/characters', [
                'name'            => 'Orphelin',
                'race'            => 'Elfe',
                'character_class' => 'Rôdeur',
                'max_hp'          => 45,
                'armor_class'     => 16,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('campaign_id');
    }

    public function test_store_rejects_a_campaign_owned_by_someone_else(): void
    {
        $other = Campaign::factory()->create();

        $this->actingAs($this->user)
            ->postJson('/api/characters', [
                'name'            => 'Intrus',
                'race'            => 'Orc',
                'character_class' => 'Barbare',
                'max_hp'          => 45,
                'armor_class'     => 16,
                'campaign_id'     => $other->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('campaign_id');
    }

    public function test_import_restores_a_character_into_a_campaign(): void
    {
        $campaign = Campaign::factory()->create(['user_id' => $this->user->id]);

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/characters/import", [
                'name'            => 'Freya',
                'race'            => 'Elfe',
                'character_class' => 'Rôdeur',
                'level'           => 5,
                'max_hp'          => 40,
                'current_hp'      => 12,
                'temporary_hp'    => 3,
                'armor_class'     => 16,
                'conditions'      => ['poisoned'],
                'currency'        => ['po' => 25],
                'notes'           => 'Rescapée',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.name', 'Freya')
            ->assertJsonPath('data.combat.current_hp', 12)
            ->assertJsonPath('data.combat.temporary_hp', 3)
            ->assertJsonPath('data.state.conditions', ['poisoned'])
            ->assertJsonPath('data.campaign_id', $campaign->id);
    }

    public function test_import_defaults_current_hp_to_max(): void
    {
        $campaign = Campaign::factory()->create(['user_id' => $this->user->id]);

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/characters/import", [
                'name' => 'Anok', 'race' => 'Nain', 'character_class' => 'Clerc', 'max_hp' => 30,
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.combat.current_hp', 30);
    }

    public function test_import_forbids_a_campaign_owned_by_someone_else(): void
    {
        $other = Campaign::factory()->create();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$other->id}/characters/import", [
                'name' => 'Intrus', 'race' => 'Orc', 'character_class' => 'Barbare', 'max_hp' => 10,
            ])
            ->assertStatus(403);

        $this->assertDatabaseMissing('characters', ['name' => 'Intrus']);
    }

    public function test_import_ignores_a_campaign_id_smuggled_in_the_payload(): void
    {
        $mine  = Campaign::factory()->create(['user_id' => $this->user->id]);
        $other = Campaign::factory()->create();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$mine->id}/characters/import", [
                'name' => 'Ruse', 'race' => 'Elfe', 'character_class' => 'Barde', 'max_hp' => 10,
                'campaign_id' => $other->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('campaign_id');
    }

    public function test_update_cannot_move_a_character_into_someone_elses_campaign(): void
    {
        $character = Character::factory()->create(['user_id' => $this->user->id]);
        $other     = Campaign::factory()->create();

        $this->actingAs($this->user)
            ->putJson("/api/characters/{$character->id}", ['campaign_id' => $other->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('campaign_id');
    }

    public function test_index_can_be_scoped_to_a_campaign(): void
    {
        $a = Campaign::factory()->create(['user_id' => $this->user->id]);
        $b = Campaign::factory()->create(['user_id' => $this->user->id]);
        Character::factory(2)->create(['user_id' => $this->user->id, 'campaign_id' => $a->id]);
        Character::factory(1)->create(['user_id' => $this->user->id, 'campaign_id' => $b->id]);

        $this->actingAs($this->user)
            ->getJson('/api/characters?campaign='.$a->id)
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/characters', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'race', 'character_class']);
    }

    public function test_show_returns_character_with_computed_fields(): void
    {
        $character = Character::factory()->create([
            'user_id'   => $this->user->id,
            'strength'  => 16,
            'level'     => 5,
        ]);

        $response = $this->actingAs($this->user)
            ->getJson("/api/characters/{$character->id}");

        $response->assertOk()
            ->assertJsonPath('data.modifiers.strength', 3)    // (16-10)/2
            ->assertJsonPath('data.proficiency_bonus', 3);    // niveau 5
    }

    public function test_show_forbids_other_user(): void
    {
        $other     = User::factory()->create();
        $character = Character::factory()->create(['user_id' => $other->id]);

        $this->actingAs($this->user)
            ->getJson("/api/characters/{$character->id}")
            ->assertStatus(403);
    }

    public function test_update_patches_character(): void
    {
        $character = Character::factory()->create(['user_id' => $this->user->id, 'level' => 1]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}", ['level' => 5])
            ->assertOk()
            ->assertJsonPath('data.level', 5);
    }

    public function test_destroy_deletes_character(): void
    {
        $character = Character::factory()->create(['user_id' => $this->user->id]);

        $this->actingAs($this->user)
            ->deleteJson("/api/characters/{$character->id}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('characters', ['id' => $character->id]);
    }

    // ── HP ───────────────────────────────────────────────────────────────────

    public function test_hp_damage_absorbs_temporary_hp_first(): void
    {
        $character = Character::factory()->create([
            'user_id'      => $this->user->id,
            'max_hp'       => 30,
            'current_hp'   => 30,
            'temporary_hp' => 5,
        ]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/hp", ['amount' => 8, 'type' => 'damage'])
            ->assertOk()
            ->assertJsonPath('data.combat.temporary_hp', 0)
            ->assertJsonPath('data.combat.current_hp', 27);
    }

    public function test_hp_heal_cannot_exceed_max(): void
    {
        $character = Character::factory()->wounded(10)->create(['user_id' => $this->user->id]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/hp", ['amount' => 999, 'type' => 'heal'])
            ->assertOk()
            ->assertJsonPath('data.combat.current_hp', $character->max_hp);
    }

    public function test_hp_rejects_invalid_type(): void
    {
        $character = Character::factory()->create(['user_id' => $this->user->id]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/hp", ['amount' => 5, 'type' => 'resurrect'])
            ->assertStatus(422);
    }

    // ── Conditions ───────────────────────────────────────────────────────────

    public function test_conditions_are_updated(): void
    {
        $character = Character::factory()->create(['user_id' => $this->user->id]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/conditions", [
                'conditions' => ['poisoned', 'prone'],
            ])
            ->assertOk()
            ->assertJsonPath('data.state.conditions', ['poisoned', 'prone']);
    }

    public function test_conditions_rejects_unknown_condition(): void
    {
        $character = Character::factory()->create(['user_id' => $this->user->id]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/conditions", [
                'conditions' => ['on_fire'],
            ])
            ->assertStatus(422);
    }

    // ── Jets de sauvegarde contre la mort ────────────────────────────────────

    public function test_death_saves_are_updated(): void
    {
        $character = Character::factory()->dying()->create(['user_id' => $this->user->id]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/death-saves", [
                'successes' => 3,
                'failures'  => 2,
            ])
            ->assertOk()
            ->assertJsonPath('data.state.death_saves_successes', 3)
            ->assertJsonPath('data.state.death_saves_failures', 2);
    }
}
