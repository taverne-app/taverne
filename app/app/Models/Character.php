<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Character extends Model
{
    use HasFactory;

    public const SKILLS = [
        'acrobatics'      => 'dexterity',
        'animal_handling' => 'wisdom',
        'arcana'          => 'intelligence',
        'athletics'       => 'strength',
        'deception'       => 'charisma',
        'history'         => 'intelligence',
        'insight'         => 'wisdom',
        'intimidation'    => 'charisma',
        'investigation'   => 'intelligence',
        'medicine'        => 'wisdom',
        'nature'          => 'intelligence',
        'perception'      => 'wisdom',
        'performance'     => 'charisma',
        'persuasion'      => 'charisma',
        'religion'        => 'intelligence',
        'sleight_of_hand' => 'dexterity',
        'stealth'         => 'dexterity',
        'survival'        => 'wisdom',
    ];

    protected $fillable = [
        'name',
        'race',
        'character_class',
        'subclass',
        'level',
        'background',
        'alignment',
        'experience_points',
        'strength',
        'dexterity',
        'constitution',
        'intelligence',
        'wisdom',
        'charisma',
        'max_hp',
        'current_hp',
        'temporary_hp',
        'armor_class',
        'speed',
        'inspiration',
        'death_saves_successes',
        'death_saves_failures',
        'conditions',
        'save_proficiencies',
        'skill_proficiencies',
        'initiative_roll',
        'notes',
        'spell_slots',
        'spells_known',
        'spellcasting_ability',
        'inventory',
        'features',
        'currency',
        'hit_dice_type',
        'hit_dice_remaining',
        'damage_modifiers',
        'concentrating_on',
        'campaign_id',
    ];

    protected $casts = [
        'inspiration'        => 'boolean',
        'conditions'         => 'array',
        'save_proficiencies' => 'array',
        'skill_proficiencies'=> 'array',
        'spell_slots'        => 'array',
        'spells_known'       => 'array',
        'inventory'          => 'array',
        'features'           => 'array',
        'currency'           => 'array',
        'damage_modifiers'   => 'array',
    ];

    /** Modificateur d'une caractéristique : floor((score - 10) / 2) */
    public function modifier(?int $score): int
    {
        return (int) floor((($score ?? 10) - 10) / 2);
    }

    /** Bonus de maîtrise selon le niveau (règle D&D 5e) */
    public function getProficiencyBonusAttribute(): int
    {
        return (int) ceil($this->level / 4) + 1;
    }

    public function getInitiativeAttribute(): int
    {
        return $this->modifier($this->dexterity);
    }

    public function getSavingThrowsAttribute(): array
    {
        $profs = $this->save_proficiencies ?? [];
        $result = [];
        foreach (['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as $ability) {
            $proficient = in_array($ability, $profs);
            $mod = $this->modifier($this->$ability);
            $result[$ability] = [
                'modifier'   => $mod + ($proficient ? $this->proficiency_bonus : 0),
                'proficient' => $proficient,
            ];
        }
        return $result;
    }

    public function getSkillsAttribute(): array
    {
        $profs = $this->skill_proficiencies ?? [];
        $result = [];
        foreach (self::SKILLS as $skill => $ability) {
            $proficient = in_array($skill, $profs);
            $mod = $this->modifier($this->$ability);
            $result[$skill] = [
                'modifier'   => $mod + ($proficient ? $this->proficiency_bonus : 0),
                'proficient' => $proficient,
                'ability'    => $ability,
            ];
        }
        return $result;
    }

    public function getPassivePerceptionAttribute(): int
    {
        return 10 + $this->skills['perception']['modifier'];
    }

    public function getSpellcastingModifierAttribute(): int
    {
        $ability = $this->spellcasting_ability;
        if (!$ability || !isset($this->$ability)) return 0;
        return $this->modifier($this->$ability);
    }

    public function getSpellSaveDcAttribute(): int
    {
        return 8 + $this->proficiency_bonus + $this->spellcasting_modifier;
    }

    public function getSpellAttackBonusAttribute(): int
    {
        return $this->proficiency_bonus + $this->spellcasting_modifier;
    }

    public function isAlive(): bool
    {
        return $this->death_saves_failures < 3;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
