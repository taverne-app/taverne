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

    // ── file des séances à venir ──────────────────────────────────────────────

    public function test_a_new_session_is_planned_and_queued_at_the_end(): void
    {
        $campaign = $this->campaign();

        $first = $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/sessions", ['title' => 'Première'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'planned')
            ->assertJsonPath('data.position', 1);

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/sessions", ['title' => 'Deuxième'])
            ->assertCreated()
            ->assertJsonPath('data.position', 2);

        $this->assertSame(1, $first->json('data.position'));
    }

    public function test_a_played_session_leaves_the_queue(): void
    {
        $campaign = $this->campaign();
        $session  = $campaign->sessions()->create([
            'title' => 'À jouer', 'status' => 'planned', 'position' => 3,
        ]);

        $this->actingAs($this->user)
            ->patchJson("/api/campaigns/{$campaign->id}/sessions/{$session->id}", ['status' => 'played'])
            ->assertOk()
            ->assertJsonPath('data.status', 'played')
            ->assertJsonPath('data.position', 0);
    }

    public function test_reorder_moves_a_session_up_the_queue(): void
    {
        $campaign = $this->campaign();
        $a = $campaign->sessions()->create(['title' => 'A', 'status' => 'planned', 'position' => 1]);
        $b = $campaign->sessions()->create(['title' => 'B', 'status' => 'planned', 'position' => 2]);
        $c = $campaign->sessions()->create(['title' => 'C', 'status' => 'planned', 'position' => 3]);

        // Les joueurs filent droit sur C : elle passe en tête.
        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/sessions/reorder", [
                'ids' => [$c->id, $a->id, $b->id],
            ])
            ->assertOk();

        $this->assertSame(1, $c->fresh()->position);
        $this->assertSame(2, $a->fresh()->position);
        $this->assertSame(3, $b->fresh()->position);
    }

    public function test_reorder_never_touches_another_campaigns_session(): void
    {
        $mine     = $this->campaign();
        $stranger = Campaign::factory()->create(['user_id' => User::factory()->create()->id]);

        $ours   = $mine->sessions()->create(['title' => 'Mienne', 'status' => 'planned', 'position' => 1]);
        $theirs = $stranger->sessions()->create(['title' => 'Autre', 'status' => 'planned', 'position' => 1]);

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$mine->id}/sessions/reorder", [
                'ids' => [$theirs->id, $ours->id],
            ])
            ->assertOk();

        // L'id étranger est ignoré, jamais déplacé.
        $this->assertSame(1, $theirs->fresh()->position);
        $this->assertSame(1, $ours->fresh()->position);
    }

    public function test_reorder_is_forbidden_for_someone_elses_campaign(): void
    {
        $stranger = Campaign::factory()->create(['user_id' => User::factory()->create()->id]);

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$stranger->id}/sessions/reorder", ['ids' => []])
            ->assertForbidden();
    }
}
