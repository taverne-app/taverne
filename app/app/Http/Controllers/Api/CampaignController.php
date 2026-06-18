<?php

namespace App\Http\Controllers\Api;

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
            'name'        => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
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

    private function authorize(Request $request, Campaign $campaign): void
    {
        abort_if($campaign->user_id !== $request->user()->id, 403);
    }
}
