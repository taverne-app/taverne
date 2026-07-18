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

    public function test_long_rest_restores_all_hit_points(): void
    {
        // Le cœur d'un repos long — et c'est justement ce qui manquait : il rendait
        // les sorts et les dés de vie, mais laissait le groupe blessé.
        $character = $this->character([
            'level'            => 4,
            'max_hp'           => 40,
            'current_hp'       => 12,
            'temporary_hp'     => 5,
            'exhaustion_level' => 3,
        ]);

        $this->actingAs($this->user)
            ->postJson("/api/characters/{$character->id}/rest")
            ->assertOk()
            ->assertJsonPath('data.combat.current_hp', 40);

        $fresh = $character->fresh();
        $this->assertSame(40, $fresh->current_hp);
        // Les PV temporaires ne survivent pas au repos.
        $this->assertSame(0, $fresh->temporary_hp);
        // Un repos long retire UN niveau d'épuisement, pas tous.
        $this->assertSame(2, $fresh->exhaustion_level);
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

    // ── Sorts ────────────────────────────────────────────────────────────────

    public function test_a_spell_keeps_its_damage_dice(): void
    {
        $character = $this->character();

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}", [
                'spells_known' => [
                    ['name' => 'Trait de feu', 'level' => 0, 'prepared' => true, 'damage_dice' => '1d10'],
                    ['name' => 'Boule de feu', 'level' => 3, 'prepared' => true, 'damage_dice' => '8d6', 'concentration' => false],
                ],
            ])
            ->assertOk();

        // Les dés de dégâts étaient écartés par validated() : sans eux, le sort
        // n'apparaît jamais comme attaque en combat.
        $spells = $character->fresh()->spells_known;
        $this->assertSame('1d10', $spells[0]['damage_dice']);
        $this->assertSame('8d6', $spells[1]['damage_dice']);
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

    public function test_a_roll_is_recorded_in_its_campaigns_history_and_served(): void
    {
        Event::fake([DiceRolled::class]);
        $campaign = \App\Models\Campaign::factory()->create(['user_id' => $this->user->id, 'share_token' => 'tok-rolls']);
        $character = $this->character(['campaign_id' => $campaign->id]);

        $this->actingAs($this->user)
            ->postJson("/api/characters/{$character->id}/roll", [
                'sides' => 20, 'count' => 1, 'modifier' => 2, 'label' => 'Épée longue',
            ])
            ->assertOk();

        // Journalisé avec sa provenance et le personnage lié.
        $campaign->refresh();
        $this->assertCount(1, $campaign->recent_rolls);
        $this->assertSame('Épée longue', $campaign->recent_rolls[0]['label']);
        $this->assertSame($character->name, $campaign->recent_rolls[0]['character_name']);
        // Le jeton de routage sert au canal, il ne doit pas fuiter dans le journal.
        $this->assertArrayNotHasKey('campaign_share_token', $campaign->recent_rolls[0]);

        // Servi côté MJ (authentifié) et côté joueurs (lien de partage).
        $this->actingAs($this->user)
            ->getJson("/api/campaigns/{$campaign->id}/rolls")
            ->assertOk()
            ->assertJsonPath('data.0.label', 'Épée longue');

        $this->getJson('/api/share/tok-rolls/rolls')
            ->assertOk()
            ->assertJsonPath('data.0.character_name', $character->name);
    }

    public function test_the_campaign_roll_journal_keeps_only_the_last_ten(): void
    {
        $campaign = \App\Models\Campaign::factory()->create(['user_id' => $this->user->id]);
        foreach (range(1, 12) as $n) {
            $campaign->pushRecentRoll(['label' => "jet $n", 'total' => $n]);
        }

        $campaign->refresh();
        $this->assertCount(10, $campaign->recent_rolls);
        // Le plus récent est en tête, les deux plus anciens sont tombés.
        $this->assertSame('jet 12', $campaign->recent_rolls[0]['label']);
        $this->assertSame('jet 3', $campaign->recent_rolls[9]['label']);
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
