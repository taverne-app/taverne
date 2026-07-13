<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SessionResource;
use App\Models\Campaign;
use App\Models\CampaignSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

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
            'xp_awarded'   => ['sometimes', 'nullable', 'integer', 'min:0'],
            'loot_notes'   => ['sometimes', 'nullable', 'string'],
            'status'       => ['sometimes', Rule::in([CampaignSession::STATUS_PLANNED, CampaignSession::STATUS_PLAYED])],
            'prep'         => ['sometimes', 'nullable', 'array'],
        ]);

        // Une séance à venir s'ajoute en fin de liste ; une séance jouée n'a pas de rang
        // (elle se classe par date dans le journal).
        $validated['status'] ??= CampaignSession::STATUS_PLANNED;
        $validated['position'] = $validated['status'] === CampaignSession::STATUS_PLANNED
            ? ((int) $campaign->sessions()->where('status', CampaignSession::STATUS_PLANNED)->max('position')) + 1
            : 0;

        $session = $campaign->sessions()->create($validated);

        return new SessionResource($session);
    }

    public function update(Request $request, Campaign $campaign, CampaignSession $session): SessionResource
    {
        $this->authorize($request, $campaign);
        abort_if($session->campaign_id !== $campaign->id, 403);

        $validated = $request->validate([
            'title'          => ['sometimes', 'string', 'max:255'],
            'session_date'   => ['sometimes', 'nullable', 'date'],
            'notes'          => ['sometimes', 'nullable', 'string'],
            'xp_awarded'     => ['sometimes', 'nullable', 'integer', 'min:0'],
            'loot_notes'     => ['sometimes', 'nullable', 'string'],
            'xp_distributed' => ['sometimes', 'boolean'],
            'status'         => ['sometimes', Rule::in([CampaignSession::STATUS_PLANNED, CampaignSession::STATUS_PLAYED])],
            'prep'           => ['sometimes', 'nullable', 'array'],
            'position'       => ['sometimes', 'integer', 'min:0'],
        ]);

        // Une séance qui bascule au journal quitte la file d'attente.
        if (($validated['status'] ?? null) === CampaignSession::STATUS_PLAYED) {
            $validated['position'] = 0;
        }

        $session->update($validated);

        return new SessionResource($session->fresh());
    }

    /**
     * Réordonne les séances à venir. Les joueurs prennent un chemin imprévu :
     * le MJ fait remonter ou descendre une séance sans rien ressaisir.
     */
    public function reorder(Request $request, Campaign $campaign): AnonymousResourceCollection
    {
        $this->authorize($request, $campaign);

        $validated = $request->validate([
            'ids'   => ['required', 'array'],
            'ids.*' => ['integer'],
        ]);

        // On ne réordonne que des séances de CETTE campagne : un id étranger est ignoré,
        // jamais déplacé.
        $owned = $campaign->sessions()
            ->where('status', CampaignSession::STATUS_PLANNED)
            ->pluck('id')
            ->all();

        $position = 0;

        foreach ($validated['ids'] as $id) {
            if (! in_array($id, $owned, true)) {
                continue;
            }

            CampaignSession::where('id', $id)->update(['position' => ++$position]);
        }

        return SessionResource::collection($campaign->sessions()->get());
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
