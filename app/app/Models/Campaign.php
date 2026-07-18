<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Campaign extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'name', 'description', 'dm_notes', 'saved_encounters', 'npcs', 'game_calendar', 'party_treasury', 'locations', 'session_prep', 'custom_monsters', 'factions', 'random_tables', 'campaign_map', 'battle_map', 'share_token', 'time_of_day', 'combat_active', 'combat_active_kind', 'combat_active_id', 'combat_round', 'combat_location'];

    protected $casts = [
        'saved_encounters' => 'array',
        'npcs'             => 'array',
        'game_calendar'    => 'array',
        'party_treasury'   => 'array',
        'locations'        => 'array',
        'session_prep'     => 'array',
        'custom_monsters'  => 'array',
        'factions'         => 'array',
        'random_tables'    => 'array',
        'campaign_map'          => 'array',
        'battle_map'            => 'array',
        'combat_active'         => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function characters(): HasMany
    {
        return $this->hasMany(Character::class)->orderBy('name');
    }

    /**
     * Les chapitres, dans l'ordre où ils se lisent : les terminés tombent en fin de
     * liste sans perdre leur rang les uns par rapport aux autres.
     */
    public function chapters(): HasMany
    {
        return $this->hasMany(Chapter::class)
            ->orderBy('done')
            ->orderBy('position')
            ->orderBy('id');
    }

    public function combatants(): HasMany
    {
        return $this->hasMany(Combatant::class)->orderBy('created_at');
    }
}
