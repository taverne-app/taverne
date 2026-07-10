<?php

namespace Tests\Feature\Api;

use App\Events\BattleMapUpdated;
use App\Models\Campaign;
use App\Models\Character;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class CampaignTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['plan' => 'guild']);
    }

    public function test_destroy_takes_its_characters_with_it(): void
    {
        $campaign = Campaign::factory()->create(['user_id' => $this->user->id]);
        $characters = Character::factory(2)->create([
            'user_id'     => $this->user->id,
            'campaign_id' => $campaign->id,
        ]);

        $this->actingAs($this->user)
            ->deleteJson("/api/campaigns/{$campaign->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('campaigns', ['id' => $campaign->id]);
        foreach ($characters as $character) {
            $this->assertDatabaseMissing('characters', ['id' => $character->id]);
        }
    }

    public function test_destroy_forbids_someone_elses_campaign(): void
    {
        $campaign = Campaign::factory()->create();

        $this->actingAs($this->user)
            ->deleteJson("/api/campaigns/{$campaign->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('campaigns', ['id' => $campaign->id]);
    }

    public function test_index_lists_the_most_recently_touched_campaign_first(): void
    {
        $older = Campaign::factory()->create(['user_id' => $this->user->id, 'name' => 'Ancienne']);
        $newer = Campaign::factory()->create(['user_id' => $this->user->id, 'name' => 'Récente']);

        // Playing in the older campaign must bubble it back to the top.
        $character = Character::factory()->create([
            'user_id'     => $this->user->id,
            'campaign_id' => $older->id,
        ]);
        $this->travel(1)->minutes();
        $character->update(['current_hp' => 3]);

        $this->actingAs($this->user)
            ->getJson('/api/campaigns')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Ancienne')
            ->assertJsonPath('data.1.name', 'Récente');

        $this->assertTrue($older->fresh()->updated_at->gt($newer->fresh()->updated_at));
    }

    public function test_update_persists_the_battle_map(): void
    {
        $campaign = Campaign::factory()->create(['user_id' => $this->user->id]);
        $map = [
            'image_url' => 'https://example.test/donjon.png',
            'grid'      => null,
            'tokens'    => [
                ['id' => 't1', 'ref_type' => 'combatant', 'ref_id' => 7, 'label' => 'Gobelin', 'x' => 12.5, 'y' => 40.0, 'color' => 'red', 'size' => 'md'],
                ['id' => 't2', 'ref_type' => null, 'ref_id' => null, 'label' => 'Coffre', 'x' => 80.0, 'y' => 20.0, 'color' => 'amber', 'size' => 'sm'],
            ],
        ];

        $this->actingAs($this->user)
            ->patchJson("/api/campaigns/{$campaign->id}", ['battle_map' => $map])
            ->assertOk()
            ->assertJsonPath('data.battle_map.tokens.1.label', 'Coffre');

        $this->assertEquals($map, $campaign->fresh()->battle_map);
    }

    public function test_moving_a_token_broadcasts_to_a_shared_campaign(): void
    {
        Event::fake([BattleMapUpdated::class]);
        $campaign = Campaign::factory()->create([
            'user_id'     => $this->user->id,
            'share_token' => 'tok-123',
        ]);

        $this->actingAs($this->user)
            ->patchJson("/api/campaigns/{$campaign->id}", ['battle_map' => ['image_url' => '', 'grid' => null, 'tokens' => []]])
            ->assertOk();

        Event::assertDispatched(BattleMapUpdated::class);
    }

    public function test_battle_map_change_does_not_broadcast_without_a_share_token(): void
    {
        Event::fake([BattleMapUpdated::class]);
        $campaign = Campaign::factory()->create(['user_id' => $this->user->id, 'share_token' => null]);

        $this->actingAs($this->user)
            ->patchJson("/api/campaigns/{$campaign->id}", ['battle_map' => ['image_url' => '', 'grid' => null, 'tokens' => []]])
            ->assertOk();

        Event::assertNotDispatched(BattleMapUpdated::class);
    }
}
