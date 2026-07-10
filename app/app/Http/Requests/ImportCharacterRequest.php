<?php

namespace App\Http\Requests;

use App\Models\Character;

/**
 * A character restored from an archive arrives whole: it carries the state a
 * live sheet has (current HP, conditions, purse) that no other endpoint accepts
 * in one go. Everything else reuses the update rules.
 */
class ImportCharacterRequest extends UpdateCharacterRequest
{
    public function rules(): array
    {
        $skills = implode(',', array_keys(Character::SKILLS));

        return array_merge(parent::rules(), [
            'name'            => ['required', 'string', 'max:255'],
            'race'            => ['required', 'string', 'max:100'],
            'character_class' => ['required', 'string', 'max:100'],

            'current_hp'   => ['sometimes', 'integer'],
            'temporary_hp' => ['sometimes', 'integer', 'min:0'],

            'conditions'   => ['sometimes', 'nullable', 'array'],
            'conditions.*' => ['string', 'in:blinded,charmed,deafened,exhaustion,frightened,grappled,incapacitated,invisible,paralyzed,petrified,poisoned,prone,restrained,stunned,unconscious'],

            'death_saves_successes' => ['sometimes', 'integer', 'min:0', 'max:3'],
            'death_saves_failures'  => ['sometimes', 'integer', 'min:0', 'max:3'],

            'currency'    => ['sometimes', 'nullable', 'array'],
            'currency.pc' => ['sometimes', 'integer', 'min:0'],
            'currency.pa' => ['sometimes', 'integer', 'min:0'],
            'currency.pe' => ['sometimes', 'integer', 'min:0'],
            'currency.po' => ['sometimes', 'integer', 'min:0'],
            'currency.pp' => ['sometimes', 'integer', 'min:0'],

            'skill_expertise.*' => ['string', 'in:'.$skills],

            // The target campaign comes from the route, never from the payload.
            'campaign_id' => ['prohibited'],
            'share_token' => ['prohibited'],
        ]);
    }
}
