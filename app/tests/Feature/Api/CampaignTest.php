<?php

namespace Tests\Feature\Api;

use App\Models\Campaign;
use App\Models\Character;
use App\Models\User;
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
}
