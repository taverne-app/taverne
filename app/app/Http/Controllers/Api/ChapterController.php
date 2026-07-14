<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ChapterResource;
use App\Models\Campaign;
use App\Models\Chapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ChapterController extends Controller
{
    public function index(Request $request, Campaign $campaign): AnonymousResourceCollection
    {
        $this->authorize($request, $campaign);

        return ChapterResource::collection($campaign->chapters);
    }

    public function store(Request $request, Campaign $campaign): ChapterResource
    {
        $this->authorize($request, $campaign);

        $validated = $request->validate([
            'title'      => ['required', 'string', 'max:255'],
            'notes'      => ['sometimes', 'nullable', 'string'],
            'xp_awarded' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'loot_notes' => ['sometimes', 'nullable', 'string'],
            'done'       => ['sometimes', 'boolean'],
            'prep'       => ['sometimes', 'nullable', 'array'],
        ]);

        // Un chapitre s'ajoute en fin de file : c'est la suite du scénario.
        $validated['position'] = ((int) $campaign->chapters()->max('position')) + 1;

        $chapter = $campaign->chapters()->create($validated);

        return new ChapterResource($chapter);
    }

    public function update(Request $request, Campaign $campaign, Chapter $chapter): ChapterResource
    {
        $this->authorize($request, $campaign);
        abort_if($chapter->campaign_id !== $campaign->id, 403);

        $validated = $request->validate([
            'title'          => ['sometimes', 'string', 'max:255'],
            'notes'          => ['sometimes', 'nullable', 'string'],
            'xp_awarded'     => ['sometimes', 'nullable', 'integer', 'min:0'],
            'loot_notes'     => ['sometimes', 'nullable', 'string'],
            'xp_distributed' => ['sometimes', 'boolean'],
            'done'           => ['sometimes', 'boolean'],
            'prep'           => ['sometimes', 'nullable', 'array'],
            'position'       => ['sometimes', 'integer', 'min:0'],
        ]);

        $chapter->update($validated);

        return new ChapterResource($chapter->fresh());
    }

    /**
     * Réordonne les chapitres. Les joueurs prennent un chemin imprévu : le MJ fait
     * remonter ou descendre un chapitre sans rien ressaisir.
     *
     * Terminés compris — un chapitre coché reste à sa place dans le récit, il est
     * simplement rejeté en fin de liste à l'affichage.
     */
    public function reorder(Request $request, Campaign $campaign): AnonymousResourceCollection
    {
        $this->authorize($request, $campaign);

        $validated = $request->validate([
            'ids'   => ['required', 'array'],
            'ids.*' => ['integer'],
        ]);

        // On ne réordonne que des chapitres de CETTE campagne : un id étranger est
        // ignoré, jamais déplacé.
        $owned = $campaign->chapters()->pluck('id')->all();

        $position = 0;

        foreach ($validated['ids'] as $id) {
            if (! in_array($id, $owned, true)) {
                continue;
            }

            Chapter::where('id', $id)->update(['position' => ++$position]);
        }

        return ChapterResource::collection($campaign->chapters()->get());
    }

    public function destroy(Request $request, Campaign $campaign, Chapter $chapter): JsonResponse
    {
        $this->authorize($request, $campaign);
        abort_if($chapter->campaign_id !== $campaign->id, 403);

        $chapter->delete();

        return response()->json(null, 204);
    }

    private function authorize(Request $request, Campaign $campaign): void
    {
        abort_if($campaign->user_id !== $request->user()->id, 403);
    }
}
