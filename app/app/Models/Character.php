<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Character extends Model
{
    use HasFactory;

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
        'notes',
        'campaign_id',
    ];

    protected $casts = [
        'inspiration' => 'boolean',
        'conditions'  => 'array',
    ];

    // Modificateur d'une caractéristique : floor((score - 10) / 2)
    public function modifier(int $score): int
    {
        return (int) floor(($score - 10) / 2);
    }

    // Bonus de maîtrise selon le niveau (règle D&D 5e)
    public function getProficiencyBonusAttribute(): int
    {
        return (int) ceil($this->level / 4) + 1;
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
