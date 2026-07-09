<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Combatant extends Model
{
    protected $table = 'campaign_combatants';

    protected $fillable = [
        'campaign_id',
        'name',
        'faction',
        'max_hp',
        'current_hp',
        'armor_class',
        'initiative_roll',
        'conditions',
        'condition_durations',
    ];

    /** Un combat en cours remonte sa campagne en tête de la liste. */
    protected $touches = ['campaign'];

    protected $casts = [
        'conditions'          => 'array',
        'condition_durations' => 'array',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
