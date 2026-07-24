<?php

namespace Tests\Feature\Api;

use App\Models\Campaign;
use App\Models\Character;
use App\Models\User;
use App\Models\CodexPage;
use Tests\TestCase;

class CodexPageTest extends TestCase
{
    private User $user;
    private Campaign $campaign;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['plan' => 'guild']);
        $this->campaign = Campaign::factory()->create([
            'user_id'     => $this->user->id,
            'share_token' => 'codex-test-token',
        ]);
    }

    private function page(array $attrs = []): CodexPage
    {
        // $attrs À GAUCHE : avec l'union de tableaux, c'est l'opérande de gauche qui
        // l'emporte. L'inverse écraserait en silence toute valeur passée par le test.
        return $this->campaign->codexPages()->create($attrs + [
            'title'      => 'Une page',
            'visibility' => 'table',
        ]);
    }

    public function test_le_mj_cree_une_page_a_la_racine_et_une_sous_page(): void
    {
        $racine = $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$this->campaign->id}/codex-pages", ['title' => 'Le monde'])
            ->assertCreated()
            ->json('data');

        $this->assertNull($racine['parent_id']);
        $this->assertSame('MJ', $racine['last_editor']);

        $enfant = $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$this->campaign->id}/codex-pages", [
                'title'     => 'Les Terres Grises',
                'parent_id' => $racine['id'],
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame($racine['id'], $enfant['parent_id']);
    }

    public function test_supprimer_une_page_emporte_sa_descendance(): void
    {
        $racine = $this->page(['title' => 'Racine']);
        $enfant = $this->page(['title' => 'Enfant', 'parent_id' => $racine->id]);
        $petit  = $this->page(['title' => 'Petit-enfant', 'parent_id' => $enfant->id]);
        $voisin = $this->page(['title' => 'Voisin']);

        $this->actingAs($this->user)
            ->deleteJson("/api/campaigns/{$this->campaign->id}/codex-pages/{$racine->id}")
            ->assertNoContent();

        $this->assertSoftDeleted('codex_pages', ['id' => $racine->id]);
        $this->assertSoftDeleted('codex_pages', ['id' => $enfant->id]);
        $this->assertSoftDeleted('codex_pages', ['id' => $petit->id]);
        // La branche voisine ne doit pas avoir bougé.
        $this->assertNotSoftDeleted('codex_pages', ['id' => $voisin->id]);
    }

    public function test_une_page_ne_peut_pas_etre_rangee_sous_sa_propre_descendance(): void
    {
        $racine = $this->page(['title' => 'Racine']);
        $enfant = $this->page(['title' => 'Enfant', 'parent_id' => $racine->id]);

        $this->actingAs($this->user)
            ->putJson("/api/campaigns/{$this->campaign->id}/codex-pages/{$racine->id}", [
                'parent_id' => $enfant->id,
            ])
            ->assertStatus(422);
    }

    /**
     * Le cœur du modèle de visibilité : une page 'mj' ne doit apparaître d'AUCUNE
     * façon côté joueurs — savoir qu'un secret existe, c'est déjà l'éventer.
     */
    public function test_les_joueurs_ne_voient_aucune_trace_des_pages_du_mj(): void
    {
        $this->page(['title' => 'Auberge du Poney', 'visibility' => 'table']);
        $this->page(['title' => 'Le traître est Alric', 'visibility' => 'mj']);

        $pages = $this->getJson('/api/share/codex-test-token/codex')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $pages);
        $this->assertSame('Auberge du Poney', $pages[0]['title']);
        $this->assertStringNotContainsString('Alric', json_encode($pages));
    }

    public function test_un_joueur_ne_peut_pas_modifier_une_page_du_mj(): void
    {
        $secrete = $this->page(['title' => 'Secret', 'visibility' => 'mj']);

        $this->putJson("/api/share/codex-test-token/codex/{$secrete->id}", ['body' => 'coucou'])
            ->assertNotFound();

        $this->assertSame('Secret', $secrete->fresh()->title);
    }

    public function test_une_page_ecrite_par_un_joueur_est_signee_et_visible_de_la_table(): void
    {
        $character = Character::factory()->create([
            'user_id'     => $this->user->id,
            'campaign_id' => $this->campaign->id,
            'name'        => 'Freya',
            'share_token' => 'freya-token',
        ]);

        $page = $this->postJson('/api/share/codex-test-token/codex', [
            'title'           => 'Ce qu’on sait du culte',
            'body'            => 'Ils portent un masque de fer.',
            'character_token' => $character->share_token,
        ])->assertCreated()->json('data');

        $this->assertSame('Freya', $page['last_editor']);
        // Un joueur n'écrit jamais de page secrète, même s'il la demande.
        $this->assertSame('table', $page['visibility']);
    }

    public function test_un_joueur_ne_choisit_pas_la_visibilite_de_sa_page(): void
    {
        $page = $this->postJson('/api/share/codex-test-token/codex', [
            'title'      => 'Tentative',
            'visibility' => 'mj',
        ])->assertCreated()->json('data');

        $this->assertSame('table', $page['visibility']);
        $this->assertSame('Un joueur', $page['last_editor']);
    }

    public function test_le_codex_d_une_autre_campagne_est_inaccessible(): void
    {
        $autre = User::factory()->create(['plan' => 'guild']);
        $page  = $this->page(['title' => 'Privé']);

        $this->actingAs($autre)
            ->getJson("/api/campaigns/{$this->campaign->id}/codex-pages")
            ->assertForbidden();

        $this->actingAs($autre)
            ->putJson("/api/campaigns/{$this->campaign->id}/codex-pages/{$page->id}", ['title' => 'Volé'])
            ->assertForbidden();
    }
}
