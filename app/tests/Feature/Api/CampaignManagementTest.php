<?php

namespace Tests\Feature\Api;

use App\Events\CampaignTimeUpdated;
use App\Models\Campaign;
use App\Models\Character;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class CampaignManagementTest extends TestCase
{
    // ── Création & limites de plan ───────────────────────────────────────────

    public function test_store_creates_a_campaign_for_the_user(): void
    {
        $user = User::factory()->create(['plan' => 'free']);

        $this->actingAs($user)
            ->postJson('/api/campaigns', ['name' => 'Les Mines de Phancreux'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Les Mines de Phancreux');

        $this->assertDatabaseHas('campaigns', ['user_id' => $user->id, 'name' => 'Les Mines de Phancreux']);
    }

    public function test_free_plan_is_capped_at_one_campaign(): void
    {
        $user = User::factory()->create(['plan' => 'free']);
        Campaign::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->postJson('/api/campaigns', ['name' => 'Deuxième'])
            ->assertForbidden();

        $this->assertEquals(1, $user->campaigns()->count());
    }

    public function test_paid_plan_can_create_several_campaigns(): void
    {
        $user = User::factory()->create(['plan' => 'guild']);
        Campaign::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->postJson('/api/campaigns', ['name' => 'Deuxième'])
            ->assertCreated();

        $this->assertEquals(2, $user->campaigns()->count());
    }

    // ── Partage ──────────────────────────────────────────────────────────────

    public function test_share_generates_a_token_and_revoke_clears_it(): void
    {
        $user = User::factory()->create();
        $campaign = Campaign::factory()->create(['user_id' => $user->id, 'share_token' => null]);

        $this->actingAs($user)->postJson("/api/campaigns/{$campaign->id}/share")->assertOk();
        $token = $campaign->fresh()->share_token;
        $this->assertNotNull($token);

        $this->actingAs($user)->deleteJson("/api/campaigns/{$campaign->id}/share")->assertOk();
        $this->assertNull($campaign->fresh()->share_token);
    }

    public function test_share_forbids_someone_elses_campaign(): void
    {
        $campaign = Campaign::factory()->create(['share_token' => null]);

        $this->actingAs(User::factory()->create())
            ->postJson("/api/campaigns/{$campaign->id}/share")
            ->assertForbidden();

        $this->assertNull($campaign->fresh()->share_token);
    }

    // ── Rattacher un personnage ──────────────────────────────────────────────

    public function test_add_character_moves_it_into_the_campaign(): void
    {
        $user = User::factory()->create();
        $target = Campaign::factory()->create(['user_id' => $user->id]);
        $character = Character::factory()->create(['user_id' => $user->id]); // dans une autre campagne

        $this->actingAs($user)
            ->postJson("/api/campaigns/{$target->id}/characters", ['character_id' => $character->id])
            ->assertOk();

        $this->assertEquals($target->id, $character->fresh()->campaign_id);
    }

    public function test_add_character_rejects_a_character_owned_by_someone_else(): void
    {
        $user = User::factory()->create();
        $campaign = Campaign::factory()->create(['user_id' => $user->id]);
        $foreign = Character::factory()->create(); // autre propriétaire

        $this->actingAs($user)
            ->postJson("/api/campaigns/{$campaign->id}/characters", ['character_id' => $foreign->id])
            ->assertNotFound();
    }

    public function test_free_plan_caps_characters_per_campaign_at_four(): void
    {
        $user = User::factory()->create(['plan' => 'free']);
        $campaign = Campaign::factory()->create(['user_id' => $user->id]);
        Character::factory(4)->create(['user_id' => $user->id, 'campaign_id' => $campaign->id]);
        $extra = Character::factory()->create(['user_id' => $user->id]); // dans une autre campagne

        $this->actingAs($user)
            ->postJson("/api/campaigns/{$campaign->id}/characters", ['character_id' => $extra->id])
            ->assertForbidden();

        $this->assertNotEquals($campaign->id, $extra->fresh()->campaign_id);
    }

    // ── Moment de la journée ─────────────────────────────────────────────────

    public function test_set_time_of_day_persists_and_broadcasts_when_shared(): void
    {
        Event::fake([CampaignTimeUpdated::class]);
        $user = User::factory()->create();
        $campaign = Campaign::factory()->create(['user_id' => $user->id, 'share_token' => 'tok-time']);

        $this->actingAs($user)
            ->patchJson("/api/campaigns/{$campaign->id}/time-of-day", ['time_of_day' => 'dusk'])
            ->assertOk()
            ->assertJsonPath('time_of_day', 'dusk');

        $this->assertEquals('dusk', $campaign->fresh()->time_of_day);
        Event::assertDispatched(CampaignTimeUpdated::class);
    }

    public function test_set_time_of_day_none_stores_null_and_does_not_broadcast_without_share(): void
    {
        Event::fake([CampaignTimeUpdated::class]);
        $user = User::factory()->create();
        $campaign = Campaign::factory()->create(['user_id' => $user->id, 'share_token' => null]);

        $this->actingAs($user)
            ->patchJson("/api/campaigns/{$campaign->id}/time-of-day", ['time_of_day' => 'none'])
            ->assertOk()
            ->assertJsonPath('time_of_day', null);

        $this->assertNull($campaign->fresh()->time_of_day);
        Event::assertNotDispatched(CampaignTimeUpdated::class);
    }
}
