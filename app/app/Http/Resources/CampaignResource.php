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
            'id'               => $this->id,
            'name'             => $this->name,
            'description'      => $this->description,
            'dm_notes'         => $this->dm_notes,
            'saved_encounters' => $this->saved_encounters ?? [],
            'npcs'             => $this->npcs ?? [],
            'game_calendar'    => $this->game_calendar ?? [],
            'party_treasury'   => $this->party_treasury ?? [],
            'locations'        => $this->locations ?? [],
            'session_prep'     => $this->session_prep ?? null,
            'custom_monsters'  => $this->custom_monsters ?? [],
            'factions'         => $this->factions ?? [],
            'random_tables'    => $this->random_tables ?? [],
            'campaign_map'          => $this->campaign_map ?? null,
            'battle_map'            => $this->battle_map ?? null,
            'campaign_milestones'   => $this->campaign_milestones ?? [],
            'quests'                => $this->quests ?? [],
            'share_token'      => $this->share_token,
            'time_of_day'      => $this->time_of_day,
            'characters'  => CharacterResource::collection($this->whenLoaded('characters')),
            'combatants'  => CombatantResource::collection($this->whenLoaded('combatants')),
            'sessions'    => SessionResource::collection($this->whenLoaded('sessions')),
            'sessions_count' => $this->whenCounted('sessions'),
            'created_at'  => $this->created_at,
            'updated_at'  => $this->updated_at,
        ];
    }
}
