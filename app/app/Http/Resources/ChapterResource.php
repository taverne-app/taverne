<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ChapterResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'campaign_id'    => $this->campaign_id,
            'title'          => $this->title,
            'notes'          => $this->notes,
            'xp_awarded'     => $this->xp_awarded,
            'loot_notes'     => $this->loot_notes,
            'xp_distributed' => (bool) $this->xp_distributed,
            'position'       => (int) $this->position,
            'done'           => (bool) $this->done,
            'prep'           => $this->prep,
            'created_at'     => $this->created_at,
            'updated_at'     => $this->updated_at,
        ];
    }
}
