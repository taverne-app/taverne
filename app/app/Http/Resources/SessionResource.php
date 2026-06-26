<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'campaign_id'  => $this->campaign_id,
            'title'        => $this->title,
            'session_date' => $this->session_date?->toDateString(),
            'notes'        => $this->notes,
            'xp_awarded'   => $this->xp_awarded,
            'loot_notes'   => $this->loot_notes,
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
