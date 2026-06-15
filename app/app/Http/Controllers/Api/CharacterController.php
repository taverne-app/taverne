<?php

namespace App\Http\Controllers\Api;

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

        return new CharacterResource($character->fresh());
    }

    public function updateConditions(Request $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        $request->validate([
            'conditions'   => ['required', 'array'],
            'conditions.*' => ['string', 'in:blinded,charmed,deafened,exhaustion,frightened,grappled,incapacitated,invisible,paralyzed,petrified,poisoned,prone,restrained,stunned,unconscious'],
        ]);

        $character->update(['conditions' => array_values(array_unique($request->conditions))]);

        return new CharacterResource($character->fresh());
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

        return new CharacterResource($character->fresh());
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
