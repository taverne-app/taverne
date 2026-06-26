<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignSession extends Model
{
    protected $table = 'campaign_sessions';

    protected $fillable = ['campaign_id', 'title', 'session_date', 'notes', 'xp_awarded', 'loot_notes', 'xp_distributed'];

    protected $casts = ['session_date' => 'date', 'xp_distributed' => 'boolean'];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
