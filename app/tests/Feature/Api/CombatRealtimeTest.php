<?php

namespace Tests\Feature\Api;

use App\Events\CharacterUpdated;
use App\Events\CombatantRemoved;
use App\Events\CombatantUpdated;
use App\Events\CombatTurnUpdated;
use App\Models\Campaign;
use App\Models\Character;
use App\Models\Combatant;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\Broadcaster;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use ReflectionMethod;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Tests\TestCase;

class CombatRealtimeTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['plan' => 'guild']);
    }

    private function campaign(array $attrs = []): Campaign
    {
        return Campaign::factory()->create(['user_id' => $this->user->id] + $attrs);
    }

    private function combatant(Campaign $campaign, array $attrs = []): Combatant
    {
        return $campaign->combatants()->create([
            'name'       => 'Gobelin',
            'faction'    => 'ennemi',
            'max_hp'     => 12,
            'current_hp' => 12,
            'conditions' => [],
        ] + $attrs);
    }

    private function names(array $channels): array
    {
        return array_map(fn ($c) => $c->name, $channels);
    }

    // ─────────────────────── Diffusion depuis les contrôleurs ───────────────────────

    public function test_creating_a_combatant_broadcasts_combatant_updated(): void
    {
        Event::fake([CombatantUpdated::class]);
        $campaign = $this->campaign();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/combatants", [
                'name' => 'Ogre', 'faction' => 'ennemi', 'max_hp' => 30,
            ])
            ->assertCreated();

        Event::assertDispatched(CombatantUpdated::class);
    }

    public function test_damaging_a_combatant_broadcasts_combatant_updated(): void
    {
        Event::fake([CombatantUpdated::class]);
        $campaign = $this->campaign();
        $combatant = $this->combatant($campaign);

        $this->actingAs($this->user)
            ->patchJson("/api/campaigns/{$campaign->id}/combatants/{$combatant->id}/hp", [
                'amount' => 5, 'type' => 'damage',
            ])
            ->assertOk();

        Event::assertDispatched(CombatantUpdated::class);
    }

    public function test_setting_combatant_conditions_broadcasts_combatant_updated(): void
    {
        Event::fake([CombatantUpdated::class]);
        $campaign = $this->campaign();
        $combatant = $this->combatant($campaign);

        $this->actingAs($this->user)
            ->patchJson("/api/campaigns/{$campaign->id}/combatants/{$combatant->id}/conditions", [
                'conditions' => ['poisoned'],
            ])
            ->assertOk();

        Event::assertDispatched(CombatantUpdated::class);
    }

    public function test_deleting_a_combatant_broadcasts_combatant_removed(): void
    {
        Event::fake([CombatantRemoved::class]);
        $campaign = $this->campaign();
        $combatant = $this->combatant($campaign);

        $this->actingAs($this->user)
            ->deleteJson("/api/campaigns/{$campaign->id}/combatants/{$combatant->id}")
            ->assertNoContent();

        Event::assertDispatched(
            CombatantRemoved::class,
            fn (CombatantRemoved $e) => $e->campaignId === $campaign->id && $e->combatantId === $combatant->id,
        );
    }

    // ─────────────────────── Suppression réversible (undo) ───────────────────────

    public function test_deleting_a_combatant_only_soft_deletes_it(): void
    {
        $campaign = $this->campaign();
        $combatant = $this->combatant($campaign);

        $this->actingAs($this->user)
            ->deleteJson("/api/campaigns/{$campaign->id}/combatants/{$combatant->id}")
            ->assertNoContent();

        // Plus visible dans le combat…
        $this->assertSame(0, $campaign->combatants()->count());
        // …mais toujours en base, donc restaurable.
        $this->assertSame(1, Combatant::onlyTrashed()->where('id', $combatant->id)->count());
    }

    public function test_restoring_a_combatant_keeps_its_id_and_rebroadcasts_it(): void
    {
        Event::fake([CombatantUpdated::class]);
        $campaign = $this->campaign();
        $combatant = $this->combatant($campaign);
        $id = $combatant->id;
        $combatant->delete();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/combatants/{$id}/restore")
            ->assertOk()
            // L'identifiant est CONSERVÉ : c'est ce qui garde valides les pions du
            // plateau qui référencent ce combattant par ref_id.
            ->assertJsonPath('data.id', $id);

        $this->assertSame(1, $campaign->combatants()->count());
        $this->assertNull(Combatant::find($id)->deleted_at);

        // Même événement qu'une création : les vues font un upsert et le voient revenir.
        Event::assertDispatched(CombatantUpdated::class);
    }

    public function test_restore_forbids_a_combatant_from_another_campaign(): void
    {
        $mine = $this->campaign();
        $other = $this->campaign();
        $combatant = $this->combatant($other);
        $combatant->delete();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$mine->id}/combatants/{$combatant->id}/restore")
            ->assertForbidden();

        $this->assertSame(0, $other->combatants()->count());
    }

    public function test_restore_forbids_someone_elses_campaign(): void
    {
        $campaign = Campaign::factory()->create(); // autre MJ
        $combatant = $this->combatant($campaign);
        $combatant->delete();

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/combatants/{$combatant->id}/restore")
            ->assertForbidden();
    }

    public function test_damaging_a_character_broadcasts_character_updated(): void
    {
        Event::fake([CharacterUpdated::class]);
        $campaign = $this->campaign();
        $character = Character::factory()->create([
            'user_id' => $this->user->id, 'campaign_id' => $campaign->id,
        ]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/hp", ['amount' => 3, 'type' => 'damage'])
            ->assertOk();

        Event::assertDispatched(CharacterUpdated::class);
    }

    public function test_setting_character_conditions_broadcasts_character_updated(): void
    {
        Event::fake([CharacterUpdated::class]);
        $campaign = $this->campaign();
        $character = Character::factory()->create([
            'user_id' => $this->user->id, 'campaign_id' => $campaign->id,
        ]);

        $this->actingAs($this->user)
            ->patchJson("/api/characters/{$character->id}/conditions", ['conditions' => ['blinded']])
            ->assertOk();

        Event::assertDispatched(CharacterUpdated::class);
    }

    public function test_broadcast_turn_requires_a_share_token_and_dispatches(): void
    {
        Event::fake([CombatTurnUpdated::class]);
        $campaign = $this->campaign(['share_token' => 'tok-turn']);

        $this->actingAs($this->user)
            ->postJson("/api/campaigns/{$campaign->id}/combat-turn", [
                'active_kind' => 'combatant', 'active_id' => 42, 'round' => 3,
            ])
            ->assertOk();

        Event::assertDispatched(
            CombatTurnUpdated::class,
            fn (CombatTurnUpdated $e) => $e->shareToken === 'tok-turn' && $e->round === 3,
        );
    }

    // ─────────────────────── Forme de la diffusion (canaux/payload) ───────────────────────

    public function test_combatant_updated_broadcasts_on_private_and_campaign_channels(): void
    {
        $campaign = $this->campaign();
        $combatant = $this->combatant($campaign);

        // Les canaux privés sont préfixés « private- » par Laravel.
        $channels = $this->names((new CombatantUpdated($combatant))->broadcastOn());

        $this->assertContains("private-combatant.{$combatant->id}", $channels);
        $this->assertContains("private-campaign.{$campaign->id}", $channels);
        // Non partagée : pas de canal public.
        $this->assertStringNotContainsString('campaign-share.', implode('|', $channels));

        $event = new CombatantUpdated($combatant);
        $this->assertSame('combatant.updated', $event->broadcastAs());
        $this->assertArrayHasKey('combatant', $event->broadcastWith());
    }

    public function test_combatant_updated_also_broadcasts_to_a_shared_campaign(): void
    {
        $campaign = $this->campaign(['share_token' => 'tok-abc']);
        $combatant = $this->combatant($campaign);

        $channels = $this->names((new CombatantUpdated($combatant))->broadcastOn());

        $this->assertContains("private-campaign.{$campaign->id}", $channels);
        $this->assertContains('campaign-share.tok-abc', $channels);
    }

    public function test_combatant_removed_targets_campaign_channel_and_optional_share(): void
    {
        // Sans partage : uniquement le canal privé campagne (MJ↔MJ).
        $private = new CombatantRemoved(7, 99);
        $this->assertEquals([new PrivateChannel('campaign.7')], $private->broadcastOn());
        $this->assertSame('combatant.removed', $private->broadcastAs());
        $this->assertSame(['id' => 99], $private->broadcastWith());

        // Avec partage : canal privé campagne + canal public joueurs.
        $shared = new CombatantRemoved(7, 99, 'tok-xyz');
        $names = $this->names($shared->broadcastOn());
        $this->assertContains('private-campaign.7', $names);
        $this->assertContains('campaign-share.tok-xyz', $names);
    }

    public function test_character_updated_broadcasts_on_private_and_campaign_channels(): void
    {
        $campaign = $this->campaign();
        $character = Character::factory()->create([
            'user_id' => $this->user->id, 'campaign_id' => $campaign->id,
        ]);

        $channels = $this->names((new CharacterUpdated($character))->broadcastOn());

        $this->assertContains("private-character.{$character->id}", $channels);
        $this->assertContains("private-campaign.{$campaign->id}", $channels);
        $this->assertSame('character.updated', (new CharacterUpdated($character))->broadcastAs());
    }

    // ─────────────────────── Autorisation des canaux privés (routes/channels.php) ───────────────────────

    private function channelAuthorizes(User $user, string $channel): bool
    {
        /** @var Broadcaster $broadcaster */
        $broadcaster = \Illuminate\Support\Facades\Broadcast::driver();
        $request = Request::create('/api/broadcasting/auth', 'POST', ['channel_name' => $channel]);
        $request->setUserResolver(fn () => $user);

        // verifyUserCanAccessChannel() lève AccessDeniedHttpException quand le
        // callback refuse, et renvoie une réponse signée quand il autorise.
        $verify = new ReflectionMethod($broadcaster, 'verifyUserCanAccessChannel');
        $verify->setAccessible(true);

        // Autorisé → réponse signée (≠ false) ; refusé → exception ;
        // aucun canal correspondant (ex. channels.php non chargé) → false.
        try {
            return $verify->invoke($broadcaster, $request, $channel) !== false;
        } catch (AccessDeniedHttpException) {
            return false;
        }
    }

    public function test_campaign_channel_is_authorized_for_its_owner_only(): void
    {
        $campaign = $this->campaign();
        $stranger = User::factory()->create();

        $this->assertTrue($this->channelAuthorizes($this->user, "campaign.{$campaign->id}"));
        $this->assertFalse($this->channelAuthorizes($stranger, "campaign.{$campaign->id}"));
    }

    public function test_combatant_channel_is_authorized_for_its_owner_only(): void
    {
        $campaign = $this->campaign();
        $combatant = $this->combatant($campaign);
        $stranger = User::factory()->create();

        $this->assertTrue($this->channelAuthorizes($this->user, "combatant.{$combatant->id}"));
        $this->assertFalse($this->channelAuthorizes($stranger, "combatant.{$combatant->id}"));
    }
}
