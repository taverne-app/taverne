<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'portrait_url'     => ['sometimes', 'nullable', 'string', 'max:2048'],
            'race'             => ['sometimes', 'string', 'max:100'],
            'character_class'  => ['sometimes', 'string', 'max:100'],
            'subclass'         => ['sometimes', 'nullable', 'string', 'max:100'],
            'secondary_class'  => ['sometimes', 'nullable', 'string', 'max:100'],
            'secondary_level'  => ['sometimes', 'nullable', 'integer', 'min:1', 'max:20'],
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
            'hit_dice_type'       => ['sometimes', 'integer', 'in:4,6,8,10,12'],
            'hit_dice_remaining'  => ['sometimes', 'nullable', 'integer', 'min:0'],
            'temp_max_hp_bonus'   => ['sometimes', 'integer', 'min:0'],
            'condition_durations' => ['sometimes', 'nullable', 'array'],

            'damage_modifiers'                    => ['sometimes', 'nullable', 'array'],
            'damage_modifiers.resistances'        => ['sometimes', 'array'],
            'damage_modifiers.resistances.*'      => ['string', 'in:acid,bludgeoning,cold,fire,force,lightning,necrotic,piercing,poison,psychic,radiant,slashing,thunder'],
            'damage_modifiers.immunities'         => ['sometimes', 'array'],
            'damage_modifiers.immunities.*'       => ['string', 'in:acid,bludgeoning,cold,fire,force,lightning,necrotic,piercing,poison,psychic,radiant,slashing,thunder'],
            'damage_modifiers.vulnerabilities'    => ['sometimes', 'array'],
            'damage_modifiers.vulnerabilities.*'  => ['string', 'in:acid,bludgeoning,cold,fire,force,lightning,necrotic,piercing,poison,psychic,radiant,slashing,thunder'],
            'concentrating_on'    => ['sometimes', 'nullable', 'string', 'max:150'],
            'exhaustion_level'    => ['sometimes', 'integer', 'min:0', 'max:6'],
            'attack_macros'                   => ['sometimes', 'nullable', 'array'],
            'attack_macros.*.name'            => ['required_with:attack_macros', 'string', 'max:80'],
            'attack_macros.*.attack_bonus'    => ['nullable', 'integer', 'min:-20', 'max:30'],
            'attack_macros.*.damage_dice'     => ['required_with:attack_macros', 'string', 'max:40'],
            'attack_macros.*.damage_type'     => ['sometimes', 'nullable', 'string', 'max:40'],
            'attack_macros.*.crit_dice'       => ['sometimes', 'nullable', 'string', 'max:20'],
            'resources'                 => ['sometimes', 'nullable', 'array'],
            'resources.*.name'          => ['required_with:resources', 'string', 'max:80'],
            'resources.*.max'           => ['required_with:resources', 'integer', 'min:0'],
            'resources.*.current'       => ['required_with:resources', 'integer', 'min:0'],
            'resources.*.reset'         => ['required_with:resources', 'string', 'in:short,long,manual'],
            'notes'              => ['sometimes', 'nullable', 'string'],
            'dm_notes'           => ['sometimes', 'nullable', 'string'],
            'languages'          => ['sometimes', 'nullable', 'array'],
            'languages.*'        => ['string', 'max:80'],
            'tool_proficiencies'   => ['sometimes', 'nullable', 'array'],
            'tool_proficiencies.*' => ['string', 'max:80'],
            'personality_traits' => ['sometimes', 'nullable', 'string'],
            'ideals'             => ['sometimes', 'nullable', 'string'],
            'bonds'              => ['sometimes', 'nullable', 'string'],
            'flaws'              => ['sometimes', 'nullable', 'string'],

            'save_proficiencies'    => ['sometimes', 'array'],
            'save_proficiencies.*'  => ['string', 'in:strength,dexterity,constitution,intelligence,wisdom,charisma'],
            'skill_proficiencies'   => ['sometimes', 'array'],
            'skill_proficiencies.*' => ['string', 'in:' . implode(',', array_keys(\App\Models\Character::SKILLS))],
            'skill_expertise'       => ['sometimes', 'nullable', 'array'],
            'skill_expertise.*'     => ['string', 'in:' . implode(',', array_keys(\App\Models\Character::SKILLS))],

            'inventory'                => ['sometimes', 'nullable', 'array'],
            'inventory.*.name'         => ['required_with:inventory', 'string', 'max:100'],
            'inventory.*.quantity'     => ['sometimes', 'integer', 'min:0'],
            'inventory.*.weight'       => ['sometimes', 'numeric', 'min:0'],
            'inventory.*.value'        => ['sometimes', 'nullable', 'string', 'max:50'],
            'inventory.*.equipped'     => ['sometimes', 'boolean'],

            'features'                    => ['sometimes', 'nullable', 'array'],
            'features.*.name'             => ['required_with:features', 'string', 'max:150'],
            'features.*.source'           => ['sometimes', 'nullable', 'string', 'max:100'],
            'features.*.description'      => ['sometimes', 'nullable', 'string'],

            'spellcasting_ability'  => ['sometimes', 'nullable', 'string', 'in:strength,dexterity,constitution,intelligence,wisdom,charisma'],
            'spell_slots'           => ['sometimes', 'nullable', 'array'],
            'spells_known'          => ['sometimes', 'nullable', 'array'],
            'spells_known.*.name'   => ['required_with:spells_known', 'string', 'max:100'],
            'spells_known.*.level'  => ['required_with:spells_known', 'integer', 'min:0', 'max:9'],
            'spells_known.*.prepared' => ['sometimes', 'boolean'],
            // Sans ces règles, validated() les écartait en silence : un sort ne pouvait
            // donc JAMAIS conserver ses dés de dégâts, et n'apparaissait jamais comme
            // attaque en combat (le combat ne propose que les sorts qui infligent des dégâts).
            'spells_known.*.damage_dice'   => ['sometimes', 'nullable', 'string', 'max:20'],
            'spells_known.*.concentration' => ['sometimes', 'boolean'],
            'spells_known.*.notes'         => ['sometimes', 'nullable', 'string', 'max:500'],

            'campaign_id'      => [
                'sometimes', 'integer',
                Rule::exists('campaigns', 'id')->where('user_id', $this->user()->id),
            ],
        ];
    }
}
