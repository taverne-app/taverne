<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignSession extends Model
{
    protected $table = 'campaign_sessions';

    protected $fillable = ['campaign_id', 'title', 'session_date', 'notes', 'xp_awarded', 'loot_notes'];

    protected $casts = ['session_date' => 'date'];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
