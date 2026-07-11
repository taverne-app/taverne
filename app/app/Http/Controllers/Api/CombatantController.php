<?php

namespace App\Http\Controllers\Api;

use App\Events\CombatantUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\CombatantResource;
use App\Models\Campaign;
use App\Models\Combatant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CombatantController extends Controller
{
    public function index(Request $request, Campaign $campaign): AnonymousResourceCollection
    {
        $this->authorize($request, $campaign);

        return CombatantResource::collection(
            $campaign->combatants()->orderBy('created_at')->get(),
        );
    }

    public function store(Request $request, Campaign $campaign): CombatantResource
    {
        $this->authorize($request, $campaign);

        $validated = $request->validate([
            'name'            => ['required', 'string', 'max:100'],
            'faction'         => ['sometimes', 'string', 'in:ennemi,allié,neutre'],
            'max_hp'          => ['required', 'integer', 'min:1', 'max:9999'],
            'armor_class'     => ['sometimes', 'nullable', 'integer', 'min:0', 'max:30'],
            'initiative_roll' => ['sometimes', 'nullable', 'integer', 'min:-10', 'max:30'],
        ]);

        $validated['current_hp'] = $validated['max_hp'];

        $combatant = $campaign->combatants()->create($validated);

        // Diffuse la création pour que les vues joueurs connectées voient
        // apparaître le combattant sans recharger.
        CombatantUpdated::dispatch($combatant);

        return new CombatantResource($combatant);
    }

    public function updateHp(Request $request, Campaign $campaign, Combatant $combatant): CombatantResource
    {
        $this->authorize($request, $campaign);
        abort_if($combatant->campaign_id !== $campaign->id, 403);

        $request->validate([
            'amount' => ['required', 'integer'],
            'type'   => ['required', 'in:damage,heal'],
        ]);

        $amount = $request->integer('amount');

        if ($request->input('type') === 'damage') {
            $combatant->update([
                'current_hp' => max(0, $combatant->current_hp - $amount),
            ]);
        } else {
            $combatant->update([
                'current_hp' => min($combatant->max_hp, $combatant->current_hp + $amount),
            ]);
        }

        $fresh = $combatant->fresh();
        CombatantUpdated::dispatch($fresh);

        return new CombatantResource($fresh);
    }

    public function updateInitiative(Request $request, Campaign $campaign, Combatant $combatant): CombatantResource
    {
        $this->authorize($request, $campaign);
        abort_if($combatant->campaign_id !== $campaign->id, 403);

        $request->validate([
            'initiative_roll' => ['nullable', 'integer', 'min:-10', 'max:30'],
        ]);

        $combatant->update(['initiative_roll' => $request->input('initiative_roll')]);

        $fresh = $combatant->fresh();
        CombatantUpdated::dispatch($fresh);

        return new CombatantResource($fresh);
    }

    public function updateConditions(Request $request, Campaign $campaign, Combatant $combatant): CombatantResource
    {
        $this->authorize($request, $campaign);
        abort_if($combatant->campaign_id !== $campaign->id, 403);

        $request->validate([
            'conditions'          => ['present', 'array'],
            'conditions.*'        => ['string', 'in:blinded,charmed,deafened,exhaustion,frightened,grappled,incapacitated,invisible,paralyzed,petrified,poisoned,prone,restrained,stunned,unconscious'],
            'condition_durations' => ['sometimes', 'nullable', 'array'],
        ]);

        $combatant->update([
            'conditions'          => array_values(array_unique($request->conditions)),
            'condition_durations' => $request->condition_durations ?? $combatant->condition_durations ?? [],
        ]);

        $fresh = $combatant->fresh();
        CombatantUpdated::dispatch($fresh);

        return new CombatantResource($fresh);
    }

    public function updateName(Request $request, Campaign $campaign, Combatant $combatant): CombatantResource
    {
        $this->authorize($request, $campaign);
        abort_if($combatant->campaign_id !== $campaign->id, 403);

        $request->validate(['name' => ['required', 'string', 'max:100']]);

        $combatant->update(['name' => $request->input('name')]);

        $fresh = $combatant->fresh();
        CombatantUpdated::dispatch($fresh);

        return new CombatantResource($fresh);
    }

    public function updateFaction(Request $request, Campaign $campaign, Combatant $combatant): CombatantResource
    {
        $this->authorize($request, $campaign);
        abort_if($combatant->campaign_id !== $campaign->id, 403);

        $request->validate([
            'faction' => ['required', 'string', 'in:ennemi,allié,neutre'],
        ]);

        $combatant->update(['faction' => $request->faction]);

        $fresh = $combatant->fresh();
        CombatantUpdated::dispatch($fresh);

        return new CombatantResource($fresh);
    }

    public function destroy(Request $request, Campaign $campaign, Combatant $combatant): JsonResponse
    {
        $this->authorize($request, $campaign);
        abort_if($combatant->campaign_id !== $campaign->id, 403);

        $combatant->delete();

        return response()->json(null, 204);
    }

    private function authorize(Request $request, Campaign $campaign): void
    {
        abort_if($campaign->user_id !== $request->user()->id, 403);
    }
}
