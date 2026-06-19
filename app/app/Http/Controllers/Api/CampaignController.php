<?php

namespace App\Http\Controllers\Api;

use App\Events\CombatTurnUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\CampaignResource;
use App\Models\Campaign;
use App\Models\Character;
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
            ->orderBy('name')
            ->get();

        return CampaignResource::collection($campaigns);
    }

    public function store(Request $request): CampaignResource
    {
        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
        ]);

        $campaign = $request->user()->campaigns()->create($validated);

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
        ]);

        $campaign->update($validated);

        return new CampaignResource($campaign->fresh()->load(['characters', 'combatants']));
    }

    public function destroy(Request $request, Campaign $campaign): JsonResponse
    {
        $this->authorize($request, $campaign);

        $campaign->characters()->update(['campaign_id' => null]);
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

        $character->update(['campaign_id' => $campaign->id]);

        return new CampaignResource($campaign->fresh()->load(['characters', 'combatants']));
    }

    public function removeCharacter(Request $request, Campaign $campaign, Character $character): CampaignResource
    {
        $this->authorize($request, $campaign);
        abort_if($character->campaign_id !== $campaign->id, 422, 'Ce personnage n\'appartient pas à cette campagne.');

        $character->update(['campaign_id' => null]);

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

    public function broadcastTurn(Request $request, Campaign $campaign): JsonResponse
    {
        $this->authorize($request, $campaign);
        abort_unless($campaign->share_token, 422, 'La campagne n\'est pas partagée.');

        $request->validate([
            'active_kind' => ['nullable', 'string', 'in:character,combatant'],
            'active_id'   => ['nullable', 'integer'],
            'round'       => ['required', 'integer', 'min:1'],
        ]);

        CombatTurnUpdated::dispatch(
            $campaign->share_token,
            $request->input('active_kind'),
            $request->input('active_id') ? (int) $request->input('active_id') : null,
            $request->integer('round'),
        );

        return response()->json(['ok' => true]);
    }

    private function authorize(Request $request, Campaign $campaign): void
    {
        abort_if($campaign->user_id !== $request->user()->id, 403);
    }
}
