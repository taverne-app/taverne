<?php

namespace App\Http\Controllers\Api;

use App\Events\BattleMapUpdated;
use App\Events\CampaignTimeUpdated;
use App\Events\CombatActiveChanged;
use App\Events\CombatTurnUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\CampaignResource;
use App\Models\Campaign;
use App\Models\Character;
use App\Services\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CampaignController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $campaigns = $request->user()
            ->campaigns()
            ->with(['characters', 'combatants'])
            // Compte seulement : la barre latérale affiche un badge, elle n'a pas
            // besoin du contenu des chapitres.
            ->withCount('chapters')
            ->orderByDesc('updated_at')
            ->get();

        return CampaignResource::collection($campaigns);
    }

    public function store(Request $request): CampaignResource
    {
        $user = $request->user();
        $max  = PlanLimits::maxCampaigns($user->plan ?? 'free');
        abort_if(
            $user->campaigns()->count() >= $max,
            403,
            'Limite de campagnes atteinte pour votre plan.'
        );

        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
        ]);

        $campaign = $user->campaigns()->create($validated);

        return new CampaignResource($campaign->load(['characters', 'combatants']));
    }

    public function show(Request $request, Campaign $campaign): CampaignResource
    {
        $this->authorize($request, $campaign);

        return new CampaignResource($campaign->load(['characters', 'combatants']));
    }

    public function update(Request $request, Campaign $campaign): CampaignResource
    {
        $this->authorize($request, $campaign);

        $validated = $request->validate([
            'name'             => ['sometimes', 'string', 'max:255'],
            'description'      => ['sometimes', 'nullable', 'string'],
            'dm_notes'         => ['sometimes', 'nullable', 'string'],
            'saved_encounters' => ['sometimes', 'nullable', 'array'],
            'npcs'             => ['sometimes', 'nullable', 'array'],
            'game_calendar'    => ['sometimes', 'nullable', 'array'],
            'party_treasury'   => ['sometimes', 'nullable', 'array'],
            'locations'        => ['sometimes', 'nullable', 'array'],
            'session_prep'     => ['sometimes', 'nullable', 'array'],
            'custom_monsters'  => ['sometimes', 'nullable', 'array'],
            'factions'         => ['sometimes', 'nullable', 'array'],
            'random_tables'    => ['sometimes', 'nullable', 'array'],
            'campaign_map'          => ['sometimes', 'nullable', 'array'],
            'battle_map'            => ['sometimes', 'nullable', 'array'],
            'combat_active'         => ['sometimes', 'boolean'],
            'combat_location'       => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $wasActive = $campaign->combat_active;

        $campaign->update($validated);

        // Déplacer un pion doit se voir en direct sur l'écran des joueurs.
        if (array_key_exists('battle_map', $validated) && $campaign->share_token) {
            BattleMapUpdated::dispatch($campaign->share_token, $campaign->battle_map, $campaign->combat_location);
        }

        // Ouvrir/fermer le combat fait apparaître ou disparaître la vue Combat dans
        // la barre latérale des joueurs, en direct.
        if (array_key_exists('combat_active', $validated)
            && $campaign->combat_active !== $wasActive
            && $campaign->share_token) {
            CombatActiveChanged::dispatch($campaign->share_token, $campaign->combat_active);
        }

        return new CampaignResource($campaign->fresh()->load(['characters', 'combatants']));
    }

    public function destroy(Request $request, Campaign $campaign): JsonResponse
    {
        $this->authorize($request, $campaign);

        // A character cannot exist outside a campaign, so the database cascade
        // takes them with it. The campaign list warns before getting here.
        $campaign->delete();

        return response()->json(null, 204);
    }

    public function addCharacter(Request $request, Campaign $campaign): CampaignResource
    {
        $this->authorize($request, $campaign);

        $request->validate([
            'character_id' => ['required', 'integer', 'exists:characters,id'],
        ]);

        $character = Character::where('id', $request->integer('character_id'))
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $max = PlanLimits::maxCharactersPerCampaign($request->user()->plan ?? 'free');
        abort_if(
            $campaign->characters()->count() >= $max,
            403,
            'Limite de joueurs atteinte pour votre plan.'
        );

        $character->update(['campaign_id' => $campaign->id]);

        return new CampaignResource($campaign->fresh()->load(['characters', 'combatants']));
    }

    public function share(Request $request, Campaign $campaign): CampaignResource
    {
        $this->authorize($request, $campaign);

        $campaign->update(['share_token' => bin2hex(random_bytes(32))]);

        return new CampaignResource($campaign->fresh()->load(['characters', 'combatants']));
    }

    public function revokeShare(Request $request, Campaign $campaign): CampaignResource
    {
        $this->authorize($request, $campaign);

        $campaign->update(['share_token' => null]);

        return new CampaignResource($campaign->fresh()->load(['characters', 'combatants']));
    }

    public function setTimeOfDay(Request $request, Campaign $campaign): JsonResponse
    {
        $this->authorize($request, $campaign);

        $validated = $request->validate([
            'time_of_day' => ['nullable', 'string', 'in:none,dawn,morning,noon,afternoon,dusk,night,midnight'],
        ]);

        $timeOfDay = $validated['time_of_day'] === 'none' ? null : ($validated['time_of_day'] ?? null);
        $campaign->update(['time_of_day' => $timeOfDay]);

        if ($campaign->share_token) {
            CampaignTimeUpdated::dispatch($campaign->share_token, $timeOfDay);
        }

        return response()->json(['time_of_day' => $timeOfDay]);
    }

    public function broadcastTurn(Request $request, Campaign $campaign): JsonResponse
    {
        $this->authorize($request, $campaign);
        abort_unless($campaign->share_token, 422, 'La campagne n\'est pas partagée.');

        $request->validate([
            'active_kind' => ['nullable', 'string', 'in:character,combatant'],
            'active_id'   => ['nullable', 'integer'],
            'round'       => ['required', 'integer', 'min:1'],
        ]);

        $kind  = $request->input('active_kind');
        $id    = $request->input('active_id') ? (int) $request->input('active_id') : null;
        $round = $request->integer('round');

        // On persiste AVANT de diffuser : l'événement ne touche que les pages déjà
        // ouvertes. Une page joueur qui arrive après doit pouvoir lire le tour en cours,
        // sinon elle reste sur « tour inconnu » et grise ses propres actions.
        $campaign->update([
            'combat_active_kind' => $kind,
            'combat_active_id'   => $id,
            'combat_round'       => $round,
        ]);

        CombatTurnUpdated::dispatch($campaign->share_token, $kind, $id, $round);

        return response()->json(['ok' => true]);
    }

    private function authorize(Request $request, Campaign $campaign): void
    {
        abort_if($campaign->user_id !== $request->user()->id, 403);
    }
}
