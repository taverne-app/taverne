<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CombatantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'campaign_id'     => $this->campaign_id,
            'name'            => $this->name,
            'max_hp'          => $this->max_hp,
            'current_hp'      => $this->current_hp,
            'armor_class'     => $this->armor_class,
            'initiative_roll' => $this->initiative_roll,
            'conditions'      => $this->conditions ?? [],
            'created_at'      => $this->created_at,
            'updated_at'      => $this->updated_at,
        ];
    }
}
