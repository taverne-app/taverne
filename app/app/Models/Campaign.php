<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Campaign extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'name', 'description', 'dm_notes', 'saved_encounters', 'npcs', 'game_calendar', 'party_treasury', 'locations', 'share_token'];

    protected $casts = [
        'saved_encounters' => 'array',
        'npcs'             => 'array',
        'game_calendar'    => 'array',
        'party_treasury'   => 'array',
        'locations'        => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function characters(): HasMany
    {
        return $this->hasMany(Character::class)->orderBy('name');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(CampaignSession::class)->orderByDesc('session_date')->orderByDesc('id');
    }

    public function combatants(): HasMany
    {
        return $this->hasMany(Combatant::class)->orderBy('created_at');
    }
}
