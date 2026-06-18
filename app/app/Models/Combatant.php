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
        'max_hp',
        'current_hp',
        'armor_class',
        'initiative_roll',
        'conditions',
    ];

    protected $casts = [
        'conditions' => 'array',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
