<?php

namespace App\Http\Controllers\Api;

use App\Events\CharacterUpdated;
use App\Events\DiceRolled;
use App\Http\Controllers\Controller;
use App\Http\Requests\ImportCharacterRequest;
use App\Http\Requests\StoreCharacterRequest;
use App\Http\Requests\UpdateCharacterRequest;
use App\Http\Resources\CharacterResource;
use App\Models\Campaign;
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
            ->when($request->integer('campaign'), fn ($q, $id) => $q->where('campaign_id', $id))
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

    /**
     * Restore a character from an archive into a campaign. The campaign comes
     * from the route and is checked against the caller, so a hand-edited file
     * cannot drop a character into someone else's campaign.
     */
    public function import(ImportCharacterRequest $request, Campaign $campaign): CharacterResource
    {
        abort_if($campaign->user_id !== $request->user()->id, 403);

        $data = $request->validated();

        $character = $request->user()->characters()->create([
            ...$data,
            'campaign_id' => $campaign->id,
            'current_hp'  => $data['current_hp'] ?? $data['max_hp'] ?? 1,
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
            'conditions'          => ['present', 'array'],
            'conditions.*'        => ['string', 'in:blinded,charmed,deafened,exhaustion,frightened,grappled,incapacitated,invisible,paralyzed,petrified,poisoned,prone,restrained,stunned,unconscious'],
            'condition_durations' => ['sometimes', 'nullable', 'array'],
        ]);

        $character->update([
            'conditions'          => array_values(array_unique($request->conditions)),
            'condition_durations' => $request->condition_durations ?? $character->condition_durations ?? [],
        ]);

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

    public function roll(Request $request, Character $character): JsonResponse
    {
        $this->authorizeCharacter($request, $character);

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

    public function shortRest(Request $request, Character $character): JsonResponse
    {
        $this->authorizeCharacter($request, $character);

        $request->validate([
            'dice_spent' => ['required', 'integer', 'min:1'],
        ]);

        $diceSpent = $request->integer('dice_spent');
        $remaining = $character->hit_dice_remaining ?? $character->level;
        $diceType  = $character->hit_dice_type ?? 8;
        $conMod    = $character->modifier($character->constitution);

        abort_if($diceSpent > $remaining, 422, 'Pas assez de dés de vie disponibles.');

        $rolls = array_map(fn () => random_int(1, $diceType), range(1, $diceSpent));
        $totalHealed = max(0, array_sum($rolls) + ($conMod * $diceSpent));

        $resources = $character->resources ?? [];
        foreach ($resources as &$res) {
            if (($res['reset'] ?? '') === 'short') {
                $res['current'] = $res['max'];
            }
        }
        unset($res);

        $character->update([
            'current_hp'         => min($character->max_hp, $character->current_hp + $totalHealed),
            'hit_dice_remaining' => $remaining - $diceSpent,
            'resources'          => $resources,
        ]);

        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return response()->json([
            'character'    => (new CharacterResource($fresh))->resolve(),
            'rolls'        => $rolls,
            'modifier'     => $conMod,
            'total_healed' => $totalHealed,
        ]);
    }

    public function longRest(Request $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        $slots = $character->spell_slots ?? [];
        foreach ($slots as &$slot) {
            $slot['used'] = 0;
        }
        unset($slot);

        $remaining = $character->hit_dice_remaining ?? $character->level;
        $restored  = (int) ceil($character->level / 2);

        $resources = $character->resources ?? [];
        foreach ($resources as &$res) {
            if (($res['reset'] ?? '') === 'long') {
                $res['current'] = $res['max'];
            }
        }
        unset($res);

        $character->update([
            'spell_slots'           => $slots,
            'death_saves_successes' => 0,
            'death_saves_failures'  => 0,
            'hit_dice_remaining'    => min($character->level, $remaining + $restored),
            'resources'             => $resources,
        ]);
        $fresh = $character->fresh();
        CharacterUpdated::dispatch($fresh);

        return new CharacterResource($fresh);
    }

    public function updateCurrency(Request $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        $request->validate([
            'pc' => ['sometimes', 'integer', 'min:0'],
            'pa' => ['sometimes', 'integer', 'min:0'],
            'pe' => ['sometimes', 'integer', 'min:0'],
            'po' => ['sometimes', 'integer', 'min:0'],
            'pp' => ['sometimes', 'integer', 'min:0'],
        ]);

        $current = $character->currency ?? ['pc' => 0, 'pa' => 0, 'pe' => 0, 'po' => 0, 'pp' => 0];
        $character->update(['currency' => array_merge($current, $request->only(['pc', 'pa', 'pe', 'po', 'pp']))]);

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

    public function share(Request $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        if (! $character->share_token) {
            $character->update(['share_token' => bin2hex(random_bytes(16))]);
        }

        return new CharacterResource($character->fresh());
    }

    public function revokeShare(Request $request, Character $character): CharacterResource
    {
        $this->authorizeCharacter($request, $character);

        $character->update(['share_token' => null]);

        return new CharacterResource($character->fresh());
    }

    private function authorizeCharacter(Request $request, Character $character): void
    {
        abort_if($character->user_id !== $request->user()->id, 403);
    }
}
