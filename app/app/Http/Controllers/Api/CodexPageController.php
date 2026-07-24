<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CodexPageResource;
use App\Models\Campaign;
use App\Models\CodexPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Le codex vu du MJ : il voit tout, y compris ses propres pages secrètes.
 * Le pendant joueur vit dans ShareController et ne sort jamais que du 'table'.
 */
class CodexPageController extends Controller
{
    public function index(Request $request, Campaign $campaign): AnonymousResourceCollection
    {
        $this->authorizeCampaign($request, $campaign);

        return CodexPageResource::collection($campaign->codexPages);
    }

    public function store(Request $request, Campaign $campaign): CodexPageResource
    {
        $this->authorizeCampaign($request, $campaign);

        $validated = $request->validate([
            'title'      => ['required', 'string', 'max:150'],
            'body'       => ['sometimes', 'nullable', 'string', 'max:100000'],
            'visibility' => ['sometimes', Rule::in(CodexPage::VISIBILITIES)],
            'parent_id'  => ['sometimes', 'nullable', 'integer'],
        ]);

        $validated['parent_id'] = $this->resolveParent($campaign, $validated['parent_id'] ?? null);
        $validated['position']  = $this->nextPosition($campaign, $validated['parent_id']);
        $validated['last_editor'] = 'MJ';

        return new CodexPageResource($campaign->codexPages()->create($validated));
    }

    public function update(Request $request, Campaign $campaign, CodexPage $codexPage): CodexPageResource
    {
        $this->authorizeCampaign($request, $campaign);
        abort_if($codexPage->campaign_id !== $campaign->id, 403);

        $validated = $request->validate([
            'title'      => ['sometimes', 'string', 'max:150'],
            'body'       => ['sometimes', 'nullable', 'string', 'max:100000'],
            'visibility' => ['sometimes', Rule::in(CodexPage::VISIBILITIES)],
            'position'   => ['sometimes', 'integer', 'min:0'],
            'parent_id'  => ['sometimes', 'nullable', 'integer'],
        ]);

        if (array_key_exists('parent_id', $validated)) {
            $parent = $this->resolveParent($campaign, $validated['parent_id']);
            // Se ranger sous soi-même, ou sous sa propre descendance, détacherait la
            // branche de l'arbre : elle deviendrait un cycle que rien n'affiche plus.
            abort_if($parent !== null && $this->wouldCycle($codexPage, $parent), 422, 'Une page ne peut pas être rangée sous elle-même.');
            $validated['parent_id'] = $parent;
        }

        $codexPage->update($validated);

        return new CodexPageResource($codexPage->fresh());
    }

    /** Suppression réservée au MJ, descendance comprise (cf. CodexPage). */
    public function destroy(Request $request, Campaign $campaign, CodexPage $codexPage): JsonResponse
    {
        $this->authorizeCampaign($request, $campaign);
        abort_if($codexPage->campaign_id !== $campaign->id, 403);

        $codexPage->deleteWithDescendants();

        return response()->json(null, 204);
    }

    private function authorizeCampaign(Request $request, Campaign $campaign): void
    {
        abort_if($campaign->user_id !== $request->user()->id, 403);
    }

    /** Un parent d'une AUTRE campagne est refusé, pas silencieusement mis à la racine. */
    private function resolveParent(Campaign $campaign, ?int $parentId): ?int
    {
        if ($parentId === null) {
            return null;
        }

        abort_unless($campaign->codexPages()->whereKey($parentId)->exists(), 422, 'Page parente introuvable.');

        return $parentId;
    }

    private function nextPosition(Campaign $campaign, ?int $parentId): int
    {
        return ((int) $campaign->codexPages()->where('parent_id', $parentId)->max('position')) + 1;
    }

    private function wouldCycle(CodexPage $page, int $parentId): bool
    {
        $cursor = CodexPage::find($parentId);

        while ($cursor !== null) {
            if ($cursor->id === $page->id) {
                return true;
            }
            $cursor = $cursor->parent_id ? CodexPage::find($cursor->parent_id) : null;
        }

        return false;
    }
}
