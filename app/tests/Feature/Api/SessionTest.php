<?php

namespace Tests\Feature\Api;

use App\Models\Campaign;
use App\Models\CampaignSession;
use App\Models\User;
use Tests\TestCase;

class SessionTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    private function campaign(): Campaign
    {
        return Campaign::factory()->create(['user_id' => $this->user->id]);
    }

    // ── index ────────────────────────────────────────────────────────────────

    public function test_index_returns_sessions_newest_first(): void
    {
        $campaign = $this->campaign();
        $campaign->sessions()->create(['title' => 'Séance 1', 'session_date' => '2026-01-10']);
        $campaign->sessions()->create(['title' => 'Séance 3', 'session_date' => '2026-03-10']);
        $campaign->sessions()->create(['title' => 'Séance 2', 'session_date' => '2026-02-10']);

        $this->actingAs($this->user)
            ->getJson("/api/campaigns/{$campaign->id}/sessions")
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.title', 'Séance 3')
            ->assertJsonPath('data.2.title', 'Séance 1');
    }

    public function test_index_forbids_someone_elses_campaign(): void
    {
        $campaign = Campaign::factory()->create(); // autre propriétaire

        $this->actingAs($this->user)
            ->getJson("/api/campaigns/{$campaign->id}/sessions")
            ->assertForbidden();
    }

    // ── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_a_session(): void
    {
        $campaign = $this->campaign();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/sessions", [
                'title'        => 'Le réveil du dragon',
                'session_date' => '2026-05-01',
                'notes'        => 'Les héros arrivent à Padhiver.',
                'xp_awarded'   => 450,
            ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Le réveil du dragon')
            ->assertJsonPath('data.xp_awarded', 450)
            ->assertJsonPath('data.xp_distributed', false);

        $this->assertDatabaseHas('campaign_sessions', [
            'campaign_id' => $campaign->id,
            'title'       => 'Le réveil du dragon',
        ]);
    }

    public function test_store_requires_a_title(): void
    {
        $campaign = $this->campaign();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/sessions", ['notes' => 'sans titre'])
            ->assertStatus(422);
    }

    public function test_store_forbids_someone_elses_campaign(): void
    {
        $campaign = Campaign::factory()->create();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/sessions", ['title' => 'Intrusion'])
            ->assertForbidden();

        $this->assertDatabaseMissing('campaign_sessions', ['title' => 'Intrusion']);
    }

    // ── update ───────────────────────────────────────────────────────────────

    public function test_update_patches_the_session(): void
    {
        $campaign = $this->campaign();
        $session = $campaign->sessions()->create(['title' => 'Brouillon', 'xp_awarded' => 0]);

        $this->actingAs($this->user)
            ->patchJson("/api/campaigns/{$campaign->id}/sessions/{$session->id}", [
                'title'          => 'Version finale',
                'xp_awarded'     => 1200,
                'xp_distributed' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.title', 'Version finale')
            ->assertJsonPath('data.xp_awarded', 1200)
            ->assertJsonPath('data.xp_distributed', true);
    }

    public function test_update_rejects_a_session_from_another_campaign(): void
    {
        $campaignA = $this->campaign();
        $campaignB = $this->campaign();
        $session = $campaignA->sessions()->create(['title' => 'Chez A']);

        // Le jeton de route pointe B, mais la session appartient à A → 403.
        $this->actingAs($this->user)
            ->patchJson("/api/campaigns/{$campaignB->id}/sessions/{$session->id}", ['title' => 'Volée'])
            ->assertForbidden();

        $this->assertSame('Chez A', $session->fresh()->title);
    }

    // ── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_the_session(): void
    {
        $campaign = $this->campaign();
        $session = $campaign->sessions()->create(['title' => 'À supprimer']);

        $this->actingAs($this->user)
            ->deleteJson("/api/campaigns/{$campaign->id}/sessions/{$session->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('campaign_sessions', ['id' => $session->id]);
    }

    public function test_destroy_rejects_a_session_from_another_campaign(): void
    {
        $campaignA = $this->campaign();
        $campaignB = $this->campaign();
        $session = $campaignA->sessions()->create(['title' => 'Protégée']);

        $this->actingAs($this->user)
            ->deleteJson("/api/campaigns/{$campaignB->id}/sessions/{$session->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('campaign_sessions', ['id' => $session->id]);
    }

    public function test_destroy_forbids_someone_elses_campaign(): void
    {
        $campaign = Campaign::factory()->create();
        $session = $campaign->sessions()->create(['title' => 'Autre MJ']);

        $this->actingAs($this->user)
            ->deleteJson("/api/campaigns/{$campaign->id}/sessions/{$session->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('campaign_sessions', ['id' => $session->id]);
    }
}
