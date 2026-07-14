<?php

namespace Tests\Feature\Api;

use App\Models\Campaign;
use App\Models\User;
use Tests\TestCase;

class ChapterTest extends TestCase
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

    public function test_index_returns_chapters_in_reading_order(): void
    {
        $campaign = $this->campaign();
        $campaign->chapters()->create(['title' => 'Chapitre 2', 'position' => 2]);
        $campaign->chapters()->create(['title' => 'Chapitre 1', 'position' => 1]);
        $campaign->chapters()->create(['title' => 'Chapitre 3', 'position' => 3]);

        $this->actingAs($this->user)
            ->getJson("/api/campaigns/{$campaign->id}/chapters")
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.title', 'Chapitre 1')
            ->assertJsonPath('data.2.title', 'Chapitre 3');
    }

    /** Un chapitre terminé tombe en fin de liste — sans perdre son rang face aux autres terminés. */
    public function test_done_chapters_sink_to_the_end_keeping_their_order(): void
    {
        $campaign = $this->campaign();
        $campaign->chapters()->create(['title' => 'Fini en premier', 'position' => 1, 'done' => true]);
        $campaign->chapters()->create(['title' => 'En cours',        'position' => 2]);
        $campaign->chapters()->create(['title' => 'Fini ensuite',    'position' => 3, 'done' => true]);

        $this->actingAs($this->user)
            ->getJson("/api/campaigns/{$campaign->id}/chapters")
            ->assertOk()
            ->assertJsonPath('data.0.title', 'En cours')
            ->assertJsonPath('data.1.title', 'Fini en premier')
            ->assertJsonPath('data.2.title', 'Fini ensuite');
    }

    public function test_index_forbids_someone_elses_campaign(): void
    {
        $campaign = Campaign::factory()->create(); // autre propriétaire

        $this->actingAs($this->user)
            ->getJson("/api/campaigns/{$campaign->id}/chapters")
            ->assertForbidden();
    }

    // ── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_a_chapter(): void
    {
        $campaign = $this->campaign();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/chapters", [
                'title'      => 'Le réveil du dragon',
                'notes'      => 'Les héros arrivent à Padhiver.',
                'xp_awarded' => 450,
            ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Le réveil du dragon')
            ->assertJsonPath('data.xp_awarded', 450)
            ->assertJsonPath('data.done', false)
            ->assertJsonPath('data.xp_distributed', false);

        $this->assertDatabaseHas('chapters', [
            'campaign_id' => $campaign->id,
            'title'       => 'Le réveil du dragon',
        ]);
    }

    public function test_store_requires_a_title(): void
    {
        $campaign = $this->campaign();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/chapters", ['notes' => 'sans titre'])
            ->assertStatus(422);
    }

    /** Le champ `prep` est un tableau JSON : ses clés doivent survivre à l'écriture. */
    public function test_store_keeps_the_prep_payload(): void
    {
        $campaign = $this->campaign();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/chapters", [
                'title' => 'Avec scènes',
                'prep'  => [
                    'scenes'          => [['id' => 'abc', 'kind' => 'combat', 'title' => 'Embuscade', 'done' => false]],
                    'npc_names'       => ['Gundren'],
                    'location_names'  => ['Padhiver'],
                    'encounter_names' => ['Gobelins'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.prep.scenes.0.title', 'Embuscade')
            ->assertJsonPath('data.prep.npc_names.0', 'Gundren');
    }

    public function test_store_forbids_someone_elses_campaign(): void
    {
        $campaign = Campaign::factory()->create();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/chapters", ['title' => 'Intrusion'])
            ->assertForbidden();

        $this->assertDatabaseMissing('chapters', ['title' => 'Intrusion']);
    }

    public function test_a_new_chapter_is_queued_at_the_end(): void
    {
        $campaign = $this->campaign();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/chapters", ['title' => 'Premier'])
            ->assertCreated()
            ->assertJsonPath('data.position', 1);

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/chapters", ['title' => 'Deuxième'])
            ->assertCreated()
            ->assertJsonPath('data.position', 2);
    }

    // ── update ───────────────────────────────────────────────────────────────

    public function test_update_patches_the_chapter(): void
    {
        $campaign = $this->campaign();
        $chapter = $campaign->chapters()->create(['title' => 'Brouillon', 'xp_awarded' => 0]);

        $this->actingAs($this->user)
            ->patchJson("/api/campaigns/{$campaign->id}/chapters/{$chapter->id}", [
                'title'          => 'Version finale',
                'xp_awarded'     => 1200,
                'xp_distributed' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.title', 'Version finale')
            ->assertJsonPath('data.xp_awarded', 1200)
            ->assertJsonPath('data.xp_distributed', true);
    }

    /** Cocher un chapitre ne lui fait pas perdre son rang : il le garde pour se ranger entre terminés. */
    public function test_marking_done_keeps_the_position(): void
    {
        $campaign = $this->campaign();
        $chapter  = $campaign->chapters()->create(['title' => 'À jouer', 'position' => 3]);

        $this->actingAs($this->user)
            ->patchJson("/api/campaigns/{$campaign->id}/chapters/{$chapter->id}", ['done' => true])
            ->assertOk()
            ->assertJsonPath('data.done', true)
            ->assertJsonPath('data.position', 3);
    }

    public function test_update_rejects_a_chapter_from_another_campaign(): void
    {
        $campaignA = $this->campaign();
        $campaignB = $this->campaign();
        $chapter = $campaignA->chapters()->create(['title' => 'Chez A']);

        // Le jeton de route pointe B, mais le chapitre appartient à A → 403.
        $this->actingAs($this->user)
            ->patchJson("/api/campaigns/{$campaignB->id}/chapters/{$chapter->id}", ['title' => 'Volé'])
            ->assertForbidden();

        $this->assertSame('Chez A', $chapter->fresh()->title);
    }

    // ── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_the_chapter(): void
    {
        $campaign = $this->campaign();
        $chapter = $campaign->chapters()->create(['title' => 'À supprimer']);

        $this->actingAs($this->user)
            ->deleteJson("/api/campaigns/{$campaign->id}/chapters/{$chapter->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('chapters', ['id' => $chapter->id]);
    }

    public function test_destroy_rejects_a_chapter_from_another_campaign(): void
    {
        $campaignA = $this->campaign();
        $campaignB = $this->campaign();
        $chapter = $campaignA->chapters()->create(['title' => 'Protégé']);

        $this->actingAs($this->user)
            ->deleteJson("/api/campaigns/{$campaignB->id}/chapters/{$chapter->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('chapters', ['id' => $chapter->id]);
    }

    public function test_destroy_forbids_someone_elses_campaign(): void
    {
        $campaign = Campaign::factory()->create();
        $chapter = $campaign->chapters()->create(['title' => 'Autre MJ']);

        $this->actingAs($this->user)
            ->deleteJson("/api/campaigns/{$campaign->id}/chapters/{$chapter->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('chapters', ['id' => $chapter->id]);
    }

    // ── ordre de la file ─────────────────────────────────────────────────────

    public function test_reorder_moves_a_chapter_up_the_queue(): void
    {
        $campaign = $this->campaign();
        $a = $campaign->chapters()->create(['title' => 'A', 'position' => 1]);
        $b = $campaign->chapters()->create(['title' => 'B', 'position' => 2]);
        $c = $campaign->chapters()->create(['title' => 'C', 'position' => 3]);

        // Les joueurs filent droit sur C : elle passe en tête.
        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/chapters/reorder", [
                'ids' => [$c->id, $a->id, $b->id],
            ])
            ->assertOk();

        $this->assertSame(1, $c->fresh()->position);
        $this->assertSame(2, $a->fresh()->position);
        $this->assertSame(3, $b->fresh()->position);
    }

    public function test_reorder_never_touches_another_campaigns_chapter(): void
    {
        $mine     = $this->campaign();
        $stranger = Campaign::factory()->create(['user_id' => User::factory()->create()->id]);

        $ours   = $mine->chapters()->create(['title' => 'Mien', 'position' => 1]);
        $theirs = $stranger->chapters()->create(['title' => 'Autre', 'position' => 1]);

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$mine->id}/chapters/reorder", [
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
            ->postJson("/api/campaigns/{$stranger->id}/chapters/reorder", ['ids' => []])
            ->assertForbidden();
    }
}
