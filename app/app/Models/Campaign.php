<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Campaign extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'name', 'description', 'dm_notes', 'saved_encounters', 'npcs', 'game_calendar', 'party_treasury', 'locations', 'session_prep', 'custom_monsters', 'factions', 'random_tables', 'campaign_map', 'battle_map', 'share_token', 'time_of_day', 'combat_active', 'combat_active_kind', 'combat_active_id', 'combat_round', 'combat_location', 'recent_rolls'];

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
        'recent_rolls'          => 'array',
    ];

    /** Nombre de jets conservés dans le journal de la campagne. */
    private const RECENT_ROLLS_KEPT = 10;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Ajoute un jet en tête du journal et ne garde que les plus récents. Écrit tout de
     * suite : le journal doit survivre au rechargement d'une page ouverte plus tard.
     */
    public function pushRecentRoll(array $roll): void
    {
        $recent = $this->recent_rolls ?? [];
        array_unshift($recent, $roll);
        $this->update(['recent_rolls' => array_slice($recent, 0, self::RECENT_ROLLS_KEPT)]);
    }

    public function characters(): HasMany
    {
        return $this->hasMany(Character::class)->orderBy('name');
    }

    /** L'arbre du codex à plat : le front le remonte à partir de `parent_id`. */
    public function codexPages(): HasMany
    {
        return $this->hasMany(CodexPage::class)->orderBy('position')->orderBy('id');
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
