<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCharacterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'             => ['required', 'string', 'max:255'],
            'race'             => ['required', 'string', 'max:100'],
            'character_class'  => ['required', 'string', 'max:100'],
            'subclass'         => ['nullable', 'string', 'max:100'],
            'level'            => ['integer', 'min:1', 'max:20'],
            'background'       => ['nullable', 'string', 'max:100'],
            'alignment'        => ['nullable', 'string', 'max:50'],
            'experience_points' => ['integer', 'min:0'],

            'strength'         => ['integer', 'min:1', 'max:30'],
            'dexterity'        => ['integer', 'min:1', 'max:30'],
            'constitution'     => ['integer', 'min:1', 'max:30'],
            'intelligence'     => ['integer', 'min:1', 'max:30'],
            'wisdom'           => ['integer', 'min:1', 'max:30'],
            'charisma'         => ['integer', 'min:1', 'max:30'],

            'max_hp'           => ['integer', 'min:1'],
            'armor_class'      => ['integer', 'min:1', 'max:30'],
            'speed'            => ['integer', 'min:0'],

            'campaign_id'      => ['nullable', 'integer', 'exists:campaigns,id'],
            'notes'            => ['nullable', 'string'],
        ];
    }
}
