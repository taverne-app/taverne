<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SessionResource;
use App\Models\Campaign;
use App\Models\CampaignSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SessionController extends Controller
{
    public function index(Request $request, Campaign $campaign): AnonymousResourceCollection
    {
        $this->authorize($request, $campaign);

        return SessionResource::collection($campaign->sessions);
    }

    public function store(Request $request, Campaign $campaign): SessionResource
    {
        $this->authorize($request, $campaign);

        $validated = $request->validate([
            'title'        => ['required', 'string', 'max:255'],
            'session_date' => ['sometimes', 'nullable', 'date'],
            'notes'        => ['sometimes', 'nullable', 'string'],
        ]);

        $session = $campaign->sessions()->create($validated);

        return new SessionResource($session);
    }

    public function update(Request $request, Campaign $campaign, CampaignSession $session): SessionResource
    {
        $this->authorize($request, $campaign);
        abort_if($session->campaign_id !== $campaign->id, 403);

        $validated = $request->validate([
            'title'        => ['sometimes', 'string', 'max:255'],
            'session_date' => ['sometimes', 'nullable', 'date'],
            'notes'        => ['sometimes', 'nullable', 'string'],
        ]);

        $session->update($validated);

        return new SessionResource($session->fresh());
    }

    public function destroy(Request $request, Campaign $campaign, CampaignSession $session): JsonResponse
    {
        $this->authorize($request, $campaign);
        abort_if($session->campaign_id !== $campaign->id, 403);

        $session->delete();

        return response()->json(null, 204);
    }

    private function authorize(Request $request, Campaign $campaign): void
    {
        abort_if($campaign->user_id !== $request->user()->id, 403);
    }
}
