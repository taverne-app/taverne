<?php

namespace Tests\Feature\Api;

use App\Events\CharacterUpdated;
use App\Events\DiceRolled;
use App\Models\Character;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class CharacterActionsTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    private function character(array $attrs = []): Character
    {
        return Character::factory()->create(['user_id' => $this->user->id] + $attrs);
    }

    // ── Repos long ───────────────────────────────────────────────────────────

    public function test_long_rest_resets_spell_slots_death_saves_and_restores_hit_dice(): void
    {
        $character = $this->character([
            'level'                 => 4,
            'spell_slots'           => ['1' => ['max' => 3, 'used' => 3], '2' => ['max' => 1, 'used' => 1]],
            'hit_dice_remaining'    => 0,
            'death_saves_successes' => 2,
            'death_saves_failures'  => 1,
        ]);

        $this->actingAs($this->user)
            ->postJson("/api/characters/{$character->id}/rest")
            ->assertOk();

        $fresh = $character->fresh();
        $this->assertSame(0, $fresh->spell_slots['1']['used']);
        $this->assertSame(0, $fresh->spell_slots['2']['used']);
        $this->assertSame(0, $fresh->death_saves_successes);
        $this->assertSame(0, $fresh->death_saves_failures);
        // ceil(niveau/2) = 2 dés de vie récupérés, plafonné au niveau.
        $this->assertSame(2, $fresh->hit_dice_remaining);
    }

    // ── Repos court ──────────────────────────────────────────────────────────

    public function test_short_rest_spends_hit_dice_and_heals(): void
    {
        Event::fake([CharacterUpdated::class]);
        $character = $this->character([
            'level'              => 5,
            'constitution'       => 14, // +2
            'max_hp'             => 50,
            'current_hp'         => 10,
            'hit_dice_type'      => 8,
            'hit_dice_remaining' => 5,
        ]);

        $this->actingAs($this->user)
            ->postJson("/api/characters/{$character->id}/short-rest", ['dice_spent' => 2])
            ->assertOk()
            ->assertJsonPath('character.id', $character->id);

        $fresh = $character->fresh();
        $this->assertSame(3, $fresh->hit_dice_remaining);
        $this->assertGreaterThan(10, $fresh->current_hp);
        $this->assertLessThanOrEqual(50, $fresh->current_hp);
        Event::assertDispatched(CharacterUpdated::class);
    }

    public function test_short_rest_rejects_spending_more_dice_than_available(): void
    {
        $character = $this->character(['level' => 3, 'hit_dice_remaining' => 1]);

        $this->actingAs($this->user)
            ->postJson("/api/characters/{$character->id}/short-rest", ['dice_spent' => 2])
            ->assertStatus(422);

        $this->assertSame(1, $character->fresh()->hit_dice_remaining);
    }

    // ── Emplacements de sorts ────────────────────────────────────────────────

    public function test_use_spell_slot_increments_then_restores(): void
    {
        $character = $this->character(['spell_slots' => ['1' => ['max' => 2, 'used' => 0]]]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/spell-slot", ['level' => 1, 'action' => 'use'])
            ->assertOk();
        $this->assertSame(1, $character->fresh()->spell_slots['1']['used']);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/spell-slot", ['level' => 1, 'action' => 'restore'])
            ->assertOk();
        $this->assertSame(0, $character->fresh()->spell_slots['1']['used']);
    }

    public function test_use_spell_slot_never_exceeds_the_maximum(): void
    {
        $character = $this->character(['spell_slots' => ['1' => ['max' => 1, 'used' => 1]]]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/spell-slot", ['level' => 1, 'action' => 'use'])
            ->assertOk();

        $this->assertSame(1, $character->fresh()->spell_slots['1']['used']);
    }

    public function test_use_spell_slot_rejects_an_unconfigured_level(): void
    {
        $character = $this->character(['spell_slots' => ['1' => ['max' => 2, 'used' => 0]]]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/spell-slot", ['level' => 5, 'action' => 'use'])
            ->assertStatus(422);
    }

    // ── Monnaie ──────────────────────────────────────────────────────────────

    public function test_update_currency_merges_with_existing_values(): void
    {
        $character = $this->character(['currency' => ['pc' => 5, 'pa' => 0, 'pe' => 0, 'po' => 0, 'pp' => 0]]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/currency", ['po' => 12])
            ->assertOk();

        $currency = $character->fresh()->currency;
        $this->assertSame(12, $currency['po']);
        $this->assertSame(5, $currency['pc']); // valeur existante préservée
    }

    // ── Jet de dés ───────────────────────────────────────────────────────────

    public function test_roll_returns_a_total_and_broadcasts(): void
    {
        Event::fake([DiceRolled::class]);
        $character = $this->character();

        $this->actingAs($this->user)
            ->postJson("/api/characters/{$character->id}/roll", [
                'sides' => 20, 'count' => 1, 'modifier' => 5,
            ])
            ->assertOk()
            ->assertJsonPath('character_id', $character->id)
            ->assertJson(fn ($json) => $json->where('total', fn ($t) => $t >= 6 && $t <= 25)->etc());

        Event::assertDispatched(DiceRolled::class);
    }

    // ── Partage de fiche ─────────────────────────────────────────────────────

    public function test_share_generates_a_token_and_revoke_clears_it(): void
    {
        $character = $this->character(['share_token' => null]);

        $this->actingAs($this->user)->postJson("/api/characters/{$character->id}/share")->assertOk();
        $this->assertNotNull($character->fresh()->share_token);

        $this->actingAs($this->user)->deleteJson("/api/characters/{$character->id}/share")->assertOk();
        $this->assertNull($character->fresh()->share_token);
    }

    public function test_action_forbids_another_users_character(): void
    {
        $foreign = Character::factory()->create();

        $this->actingAs($this->user)
            ->postJson("/api/characters/{$foreign->id}/rest")
            ->assertForbidden();
    }
}
