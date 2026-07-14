<?php

namespace App\Http\Controllers\Api;

use App\Events\CharacterUpdated;
use App\Events\DiceRolled;
use App\Http\Controllers\Controller;
use App\Http\Resources\CharacterResource;
use App\Http\Resources\SharedCampaignResource;
use App\Models\Campaign;
use App\Models\Character;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShareController extends Controller
{
    public function show(string $token): SharedCampaignResource
    {
        $campaign = Campaign::where('share_token', $token)
            ->with(['characters', 'combatants'])
            ->firstOrFail();

        return new SharedCampaignResource($campaign);
    }

    public function showCharacter(string $token): CharacterResource
    {
        $character = Character::where('share_token', $token)->with('campaign')->firstOrFail();

        return new CharacterResource($character);
    }

    public function updateHp(string $token, Request $request): CharacterResource
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:999'],
            'type'   => ['required', 'in:damage,heal'],
        ]);

        $amount = $request->integer('amount');

        match ($request->string('type')->value()) {
            'damage' => $this->applyDamage($character, $amount),
            'heal'   => $this->applyHeal($character, $amount),
        };

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    public function rollDice(string $token, Request $request): JsonResponse
    {
        $character = Character::where('share_token', $token)->firstOrFail();

        $request->validate([
            'label'        => ['sometimes', 'string', 'max:100'],
            'count'        => ['sometimes', 'integer', 'min:1', 'max:20'],
            'sides'        => ['required', 'integer', 'in:4,6,8,10,12,20,100'],
            'modifier'     => ['sometimes', 'integer', 'min:-20', 'max:30'],
            'advantage'    => ['sometimes', 'boolean'],
            'disadvantage' => ['sometimes', 'boolean'],
        ]);

        $count        = $request->integer('count', 1);
        $sides        = $request->integer('sides');
        $modifier     = $request->integer('modifier', 0);
        $advantage    = $request->boolean('advantage');
        $disadvantage = $request->boolean('disadvantage');

        $numRolls = ($advantage || $disadvantage) ? 2 : $count;
        $rolls    = array_map(fn () => random_int(1, $sides), range(1, $numRolls));

        if ($advantage) {
            $result = max($rolls);
        } elseif ($disadvantage) {
            $result = min($rolls);
        } else {
            $result = array_sum($rolls);
        }

        $roll = [
            'character_id'   => $character->id,
            'character_name' => $character->name,
            'label'          => $request->string('label', "{$count}d{$sides}")->value(),
            'count'          => $count,
            'sides'          => $sides,
            'rolls'          => $rolls,
            'modifier'       => $modifier,
            'total'          => $result + $modifier,
            'advantage'      => $advantage,
            'disadvantage'   => $disadvantage,
            'timestamp'      => now()->toISOString(),
        ];

        DiceRolled::dispatch($roll);

        return response()->json($roll);
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
}
