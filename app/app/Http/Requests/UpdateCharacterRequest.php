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
            'inspiration'      => ['sometimes', 'boolean'],
            'notes'            => ['sometimes', 'nullable', 'string'],

            'campaign_id'      => ['sometimes', 'nullable', 'integer', 'exists:campaigns,id'],
        ];
    }
}
