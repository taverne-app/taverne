<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCharacterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'             => ['sometimes', 'string', 'max:255'],
            'race'             => ['sometimes', 'string', 'max:100'],
            'character_class'  => ['sometimes', 'string', 'max:100'],
            'subclass'         => ['sometimes', 'nullable', 'string', 'max:100'],
            'level'            => ['sometimes', 'integer', 'min:1', 'max:20'],
            'background'       => ['sometimes', 'nullable', 'string', 'max:100'],
            'alignment'        => ['sometimes', 'nullable', 'string', 'max:50'],
            'experience_points' => ['sometimes', 'integer', 'min:0'],

            'strength'         => ['sometimes', 'integer', 'min:1', 'max:30'],
            'dexterity'        => ['sometimes', 'integer', 'min:1', 'max:30'],
            'constitution'     => ['sometimes', 'integer', 'min:1', 'max:30'],
            'intelligence'     => ['sometimes', 'integer', 'min:1', 'max:30'],
            'wisdom'           => ['sometimes', 'integer', 'min:1', 'max:30'],
            'charisma'         => ['sometimes', 'integer', 'min:1', 'max:30'],

            'max_hp'           => ['sometimes', 'integer', 'min:1'],
            'armor_class'      => ['sometimes', 'integer', 'min:1', 'max:30'],
            'speed'            => ['sometimes', 'integer', 'min:0'],
            'inspiration'         => ['sometimes', 'boolean'],
            'initiative_roll'     => ['sometimes', 'nullable', 'integer', 'min:-10', 'max:30'],
            'notes'               => ['sometimes', 'nullable', 'string'],

            'save_proficiencies'    => ['sometimes', 'array'],
            'save_proficiencies.*'  => ['string', 'in:strength,dexterity,constitution,intelligence,wisdom,charisma'],
            'skill_proficiencies'   => ['sometimes', 'array'],
            'skill_proficiencies.*' => ['string', 'in:' . implode(',', array_keys(\App\Models\Character::SKILLS))],

            'inventory'                => ['sometimes', 'nullable', 'array'],
            'inventory.*.name'         => ['required_with:inventory', 'string', 'max:100'],
            'inventory.*.quantity'     => ['sometimes', 'integer', 'min:0'],
            'inventory.*.weight'       => ['sometimes', 'numeric', 'min:0'],
            'inventory.*.value'        => ['sometimes', 'nullable', 'string', 'max:50'],
            'inventory.*.equipped'     => ['sometimes', 'boolean'],

            'spellcasting_ability'  => ['sometimes', 'nullable', 'string', 'in:strength,dexterity,constitution,intelligence,wisdom,charisma'],
            'spell_slots'           => ['sometimes', 'nullable', 'array'],
            'spells_known'          => ['sometimes', 'nullable', 'array'],
            'spells_known.*.name'   => ['required_with:spells_known', 'string', 'max:100'],
            'spells_known.*.level'  => ['required_with:spells_known', 'integer', 'min:0', 'max:9'],
            'spells_known.*.prepared' => ['sometimes', 'boolean'],

            'campaign_id'      => ['sometimes', 'nullable', 'integer', 'exists:campaigns,id'],
        ];
    }
}
