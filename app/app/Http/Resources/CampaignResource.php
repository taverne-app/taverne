<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Http\Resources\SessionResource;

class CampaignResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'description' => $this->description,
            'share_token' => $this->share_token,
            'characters'  => CharacterResource::collection($this->whenLoaded('characters')),
            'combatants'  => CombatantResource::collection($this->whenLoaded('combatants')),
            'sessions'    => SessionResource::collection($this->whenLoaded('sessions')),
            'created_at'  => $this->created_at,
            'updated_at'  => $this->updated_at,
        ];
    }
}
