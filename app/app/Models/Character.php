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
        'portrait_url',
        'race',
        'character_class',
        'subclass',
        'secondary_class',
        'secondary_level',
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
        'condition_durations',
        'save_proficiencies',
        'skill_proficiencies',
        'skill_expertise',
        'initiative_roll',
        'notes',
        'adventure_notes',
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
        'attack_macros',
        'resources',
        'temp_max_hp_bonus',
        'campaign_id',
        'share_token',
        'dm_notes',
        'exhaustion_level',
        'personality_traits',
        'ideals',
        'bonds',
        'flaws',
        'languages',
        'tool_proficiencies',
    ];

    /** Jouer un personnage remonte sa campagne en tête de la liste. */
    protected $touches = ['campaign'];

    protected $casts = [
        'inspiration'        => 'boolean',
        'adventure_notes'    => 'array',
        'conditions'          => 'array',
        'condition_durations' => 'array',
        'save_proficiencies' => 'array',
        'skill_proficiencies'=> 'array',
        'skill_expertise'    => 'array',
        'spell_slots'        => 'array',
        'spells_known'       => 'array',
        'inventory'          => 'array',
        'features'           => 'array',
        'currency'           => 'array',
        'damage_modifiers'   => 'array',
        'attack_macros'      => 'array',
        'resources'          => 'array',
        'languages'          => 'array',
        'tool_proficiencies' => 'array',
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
        $profs   = $this->skill_proficiencies ?? [];
        $experts = $this->skill_expertise ?? [];
        $result  = [];
        foreach (self::SKILLS as $skill => $ability) {
            $proficient = in_array($skill, $profs);
            $expert     = $proficient && in_array($skill, $experts);
            $mod        = $this->modifier($this->$ability);
            $bonus      = $expert ? $this->proficiency_bonus * 2 : ($proficient ? $this->proficiency_bonus : 0);
            $result[$skill] = [
                'modifier'   => $mod + $bonus,
                'proficient' => $proficient,
                'expert'     => $expert,
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
        $ability = $this->spellcasting_ability ?: $this->defaultSpellcastingAbility();
        if (!$ability || !isset($this->$ability)) return 0;
        return $this->modifier($this->$ability);
    }

    /**
     * Caractéristique d'incantation déduite de la classe quand elle n'a pas été
     * saisie. En 5e elle est imposée par la classe (magicien → INT, clerc → SAG…),
     * jamais choisie. Sans ce repli, un personnage sans caractéristique renseignée
     * se retrouvait avec un modificateur de 0 : DD des sorts, bonus d'attaque et
     * plafond de sorts préparés tous faussés (le cas de Freya, magicien niv. 1).
     */
    protected function defaultSpellcastingAbility(): ?string
    {
        $class = mb_strtolower($this->character_class ?? '');

        if (in_array($class, ['magicien', 'wizard', 'artificier', 'artificer'], true)) {
            return 'intelligence';
        }
        if (in_array($class, ['clerc', 'cleric', 'druide', 'druid', 'rôdeur', 'rodeur', 'ranger'], true)) {
            return 'wisdom';
        }
        if (in_array($class, ['barde', 'bard', 'ensorceleur', 'sorcerer', 'occultiste', 'warlock', 'paladin'], true)) {
            return 'charisma';
        }

        return null;
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

    /**
     * Repos long : la règle vit ici et non dans un contrôleur, parce que le MJ et le
     * joueur la déclenchent depuis deux routes différentes. Deux implémentations
     * dériveraient — et un repos qui ne rend pas la même chose des deux côtés est
     * un bug qu'on ne verrait qu'à table.
     */
    public function applyLongRest(): void
    {
        $slots = $this->spell_slots ?? [];
        foreach ($slots as &$slot) {
            $slot['used'] = 0;
        }
        unset($slot);

        $remaining = $this->hit_dice_remaining ?? $this->level;
        $restored  = (int) ceil($this->level / 2);

        $resources = $this->resources ?? [];
        foreach ($resources as &$res) {
            if (($res['reset'] ?? '') === 'long') {
                $res['current'] = $res['max'];
            }
        }
        unset($res);

        $this->update([
            // L'effet principal d'un repos long : on récupère TOUS ses points de vie.
            'current_hp'            => $this->max_hp,
            // Les PV temporaires ne survivent pas à un repos long (PHB).
            'temporary_hp'          => 0,
            // Un repos long retire un niveau d'épuisement.
            'exhaustion_level'      => max(0, ($this->exhaustion_level ?? 0) - 1),
            'spell_slots'           => $slots,
            'death_saves_successes' => 0,
            'death_saves_failures'  => 0,
            'hit_dice_remaining'    => min($this->level, $remaining + $restored),
            'resources'             => $resources,
        ]);
    }

    /**
     * Repos court : dépense des dés de vie et rend les PV correspondants.
     * Renvoie le détail des jets — la table veut voir ce qui est sorti.
     *
     * @return array{rolls: int[], healed: int}
     */
    public function applyShortRest(int $diceSpent): array
    {
        $remaining = $this->hit_dice_remaining ?? $this->level;
        $diceType  = $this->hit_dice_type ?? 8;
        $conMod    = $this->modifier($this->constitution);

        abort_if($diceSpent > $remaining, 422, 'Pas assez de dés de vie disponibles.');

        $rolls       = array_map(fn () => random_int(1, $diceType), range(1, $diceSpent));
        $totalHealed = max(0, array_sum($rolls) + ($conMod * $diceSpent));

        $resources = $this->resources ?? [];
        foreach ($resources as &$res) {
            if (($res['reset'] ?? '') === 'short') {
                $res['current'] = $res['max'];
            }
        }
        unset($res);

        $this->update([
            'current_hp'         => min($this->max_hp, $this->current_hp + $totalHealed),
            'hit_dice_remaining' => $remaining - $diceSpent,
            'resources'          => $resources,
        ]);

        return ['rolls' => $rolls, 'healed' => $totalHealed];
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
