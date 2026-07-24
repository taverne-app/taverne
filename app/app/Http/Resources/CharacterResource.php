<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CharacterResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'name'         => $this->name,
            'portrait_url' => $this->portrait_url,
            'race'         => $this->race,
            'character_class'  => $this->character_class,
            'subclass'         => $this->subclass,
            'secondary_class'  => $this->secondary_class,
            'secondary_level'  => $this->secondary_level,
            'level'            => $this->level,
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
                'max_hp'             => $this->max_hp,
                'temp_max_hp_bonus'  => $this->temp_max_hp_bonus ?? 0,
                'current_hp'         => $this->current_hp,
                'temporary_hp'       => $this->temporary_hp,
                'armor_class'        => $this->armor_class,
                'initiative'         => $this->initiative,
                'initiative_roll'    => $this->initiative_roll,
                'speed'              => $this->speed,
                'inspiration'        => $this->inspiration,
                'is_alive'           => $this->isAlive(),
                'hit_dice_type'      => $this->hit_dice_type ?? 8,
                'hit_dice_remaining' => $this->hit_dice_remaining ?? $this->level,
                'hit_dice_max'       => $this->level,
            ],

            'state' => [
                'death_saves_successes' => $this->death_saves_successes,
                'death_saves_failures'  => $this->death_saves_failures,
                'conditions'            => $this->conditions ?? [],
                'condition_durations'   => $this->condition_durations ?? [],
                'concentrating_on'      => $this->concentrating_on,
                'exhaustion_level'      => $this->exhaustion_level ?? 0,
            ],

            'spellcasting' => [
                'ability'      => $this->spellcasting_ability,
                'modifier'     => $this->spellcasting_modifier,
                'save_dc'      => $this->spell_save_dc,
                'attack_bonus' => $this->spell_attack_bonus,
                'slots'        => (object) ($this->spell_slots ?? []),
                'spells'       => $this->spells_known ?? [],
                // Plafond de préparation calculé par le serveur — c'est lui qui refuse,
                // l'interface ne fait que l'annoncer. `null` = classe qui « connaît »
                // ses sorts, donc rien à plafonner.
                'max_prepared' => $this->max_prepared_spells,
            ],

            'inventory' => [
                'items'    => $this->inventory ?? [],
                'capacity' => round(($this->strength ?? 10) * 6.75, 1),
            ],

            'attack_macros' => $this->attack_macros ?? [],
            'resources'     => $this->resources ?? [],
            'features'    => $this->features ?? [],
            'currency'    => $this->currency ?? ['pc' => 0, 'pa' => 0, 'pe' => 0, 'po' => 0, 'pp' => 0],
            'damage_modifiers' => [
                'resistances'     => $this->damage_modifiers['resistances']     ?? [],
                'immunities'      => $this->damage_modifiers['immunities']      ?? [],
                'vulnerabilities' => $this->damage_modifiers['vulnerabilities'] ?? [],
            ],
            'notes'              => $this->notes,
            'dm_notes'           => $this->user_id === $request->user()?->id ? $this->dm_notes : null,
            'personality_traits' => $this->personality_traits,
            'ideals'             => $this->ideals,
            'bonds'              => $this->bonds,
            'flaws'              => $this->flaws,
            'languages'          => $this->languages ?? [],
            'tool_proficiencies' => $this->tool_proficiencies ?? [],
            'campaign_id'          => $this->campaign_id,
            'share_token'          => $this->share_token,
            'campaign_share_token' => $this->campaign?->share_token,
            'campaign_time_of_day' => $this->campaign?->time_of_day,
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
