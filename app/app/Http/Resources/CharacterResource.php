<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CharacterResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'race'       => $this->race,
            'class'      => $this->character_class,
            'subclass'   => $this->subclass,
            'level'      => $this->level,
            'background' => $this->background,
            'alignment'  => $this->alignment,
            'experience_points' => $this->experience_points,

            'abilities' => [
                'strength'     => $this->strength,
                'dexterity'    => $this->dexterity,
                'constitution' => $this->constitution,
                'intelligence' => $this->intelligence,
                'wisdom'       => $this->wisdom,
                'charisma'     => $this->charisma,
            ],

            'modifiers' => [
                'strength'     => $this->modifier($this->strength),
                'dexterity'    => $this->modifier($this->dexterity),
                'constitution' => $this->modifier($this->constitution),
                'intelligence' => $this->modifier($this->intelligence),
                'wisdom'       => $this->modifier($this->wisdom),
                'charisma'     => $this->modifier($this->charisma),
            ],

            'proficiency_bonus'  => $this->proficiency_bonus,
            'saving_throws'      => $this->saving_throws,
            'skills'             => $this->skills,
            'passive_perception' => $this->passive_perception,

            'combat' => [
                'max_hp'          => $this->max_hp,
                'current_hp'      => $this->current_hp,
                'temporary_hp'    => $this->temporary_hp,
                'armor_class'     => $this->armor_class,
                'initiative'      => $this->initiative,
                'initiative_roll' => $this->initiative_roll,
                'speed'           => $this->speed,
                'inspiration'     => $this->inspiration,
                'is_alive'        => $this->isAlive(),
            ],

            'state' => [
                'death_saves_successes' => $this->death_saves_successes,
                'death_saves_failures'  => $this->death_saves_failures,
                'conditions'            => $this->conditions ?? [],
            ],

            'notes'       => $this->notes,
            'campaign_id' => $this->campaign_id,
            'created_at'  => $this->created_at,
            'updated_at'  => $this->updated_at,
        ];
    }
}
