<?php

namespace App\Http\Controllers\Api;

use App\Events\CharacterUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCharacterRequest;
use App\Http\Requests\UpdateCharacterRequest;
use App\Http\Resources\CharacterResource;
use App\Models\Character;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CharacterController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $characters = $request->user()
            ->characters()
            ->orderBy('name')
            ->get();

        return CharacterResource::collection($characters);
    }

    public function store(StoreCharacterRequest $request): CharacterResource
    {
        $character = $request->user()
            ->characters()
            ->create([
                ...$request->validated(),
                'current_hp' => $request->validated('max_hp', 1),
            ]);

        return new CharacterResource($character);
    }

    public function show(Request $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        return new CharacterResource($character);
    }

    public function update(UpdateCharacterRequest $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        $character->update($request->validated());
        $character->refresh();
        CharacterUpdated::dispatch($character);

        return new CharacterResource($character);
    }

    public function destroy(Request $request, Character $character): JsonResponse
    {
        $this->authorizeCharacter($request, $character);

        $character->delete();

        return response()->json(null, 204);
    }

    public function updateHp(Request $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        $request->validate([
            'amount' => ['required', 'integer'],
            'type'   => ['required', 'in:damage,heal,temporary'],
        ]);

        $amount = $request->integer('amount');

        match ($request->string('type')->value()) {
            'damage' => $this->applyDamage($character, $amount),
            'heal'   => $this->applyHeal($character, $amount),
            'temporary' => $character->update(['temporary_hp' => max(0, $amount)]),
        };

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    public function updateConditions(Request $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        $request->validate([
            'conditions'   => ['required', 'array'],
            'conditions.*' => ['string', 'in:blinded,charmed,deafened,exhaustion,frightened,grappled,incapacitated,invisible,paralyzed,petrified,poisoned,prone,restrained,stunned,unconscious'],
        ]);

        $character->update(['conditions' => array_values(array_unique($request->conditions))]);

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    public function useSpellSlot(Request $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        $request->validate([
            'level'  => ['required', 'integer', 'min:1', 'max:9'],
            'action' => ['required', 'in:use,restore'],
        ]);

        $slots = $character->spell_slots ?? [];
        $level = (string) $request->integer('level');

        abort_unless(isset($slots[$level]), 422, "Aucun emplacement configuré pour le niveau $level.");

        $max  = (int) $slots[$level]['max'];
        $used = (int) ($slots[$level]['used'] ?? 0);

        $slots[$level]['used'] = $request->string('action') === 'use'
            ? min($max, $used + 1)
            : max(0, $used - 1);

        $character->update(['spell_slots' => $slots]);
        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    public function longRest(Request $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        $slots = $character->spell_slots ?? [];
        foreach ($slots as &$slot) {
            $slot['used'] = 0;
        }
        unset($slot);

        $character->update([
            'spell_slots'           => $slots,
            'death_saves_successes' => 0,
            'death_saves_failures'  => 0,
        ]);
        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    public function updateDeathSaves(Request $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        $request->validate([
            'successes' => ['sometimes', 'integer', 'min:0', 'max:3'],
            'failures'  => ['sometimes', 'integer', 'min:0', 'max:3'],
        ]);

        $character->update([
            'death_saves_successes' => $request->input('successes', $character->death_saves_successes),
            'death_saves_failures'  => $request->input('failures', $character->death_saves_failures),
        ]);

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    private function applyDamage(Character $character, int $amount): void
    {
        $remaining = max(0, $amount - $character->temporary_hp);
        $character->update([
            'temporary_hp' => max(0, $character->temporary_hp - $amount),
            'current_hp'   => max(-$character->max_hp, $character->current_hp - $remaining),
        ]);
    }

    private function applyHeal(Character $character, int $amount): void
    {
        $character->update([
            'current_hp' => min($character->max_hp, $character->current_hp + $amount),
        ]);
    }

    private function authorizeCharacter(Request $request, Character $character): void
    {
        abort_if($character->user_id !== $request->user()->id, 403);
    }
}
