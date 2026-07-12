<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Combatant extends Model
{
    // Suppression réversible : l'identifiant est conservé, donc restaurer un
    // combattant remet aussi en place les pions du plateau qui le référencent.
    use SoftDeletes;

    protected $table = 'campaign_combatants';

    protected $fillable = [
        'campaign_id',
        'name',
        'cr',
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
