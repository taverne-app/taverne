<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignSession extends Model
{
    protected $table = 'campaign_sessions';

    /** Une séance se prépare, puis se joue : le journal, ce sont les séances jouées. */
    public const STATUS_PLANNED = 'planned';
    public const STATUS_PLAYED  = 'played';

    protected $fillable = [
        'campaign_id', 'title', 'session_date', 'notes', 'xp_awarded', 'loot_notes', 'xp_distributed',
        'position', 'status', 'prep',
    ];

    protected $casts = [
        'session_date'    => 'date',
        'xp_distributed'  => 'boolean',
        'prep'            => 'array',
        'position'        => 'integer',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
