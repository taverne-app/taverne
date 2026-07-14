<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un chapitre : une section du scénario, pas une soirée de jeu. Il n'a donc pas de
 * date — il a un rang, que le MJ remanie quand les joueurs prennent un autre chemin.
 */
class Chapter extends Model
{
    protected $fillable = [
        'campaign_id', 'title', 'notes', 'xp_awarded', 'loot_notes', 'xp_distributed',
        'position', 'done', 'prep',
    ];

    protected $casts = [
        'done'           => 'boolean',
        'xp_distributed' => 'boolean',
        'prep'           => 'array',
        'position'       => 'integer',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
