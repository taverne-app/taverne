<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Projection « joueurs » d'une campagne, servie par le lien de partage public.
 *
 * Contrairement à CampaignResource (vue MJ authentifiée), elle n'expose que les
 * informations destinées aux joueurs : ni notes du MJ, ni préparation de session,
 * ni rencontres/monstres/tables réservés au MJ, et les pions cachés du plateau
 * (embuscades, pièges) sont retirés — pas seulement masqués côté client.
 */
class SharedCampaignResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'name'                => $this->name,
            'description'         => $this->description,
            'npcs'                => $this->npcs ?? [],
            'quests'              => $this->quests ?? [],
            'locations'           => $this->locations ?? [],
            'factions'            => $this->factions ?? [],
            'game_calendar'       => $this->game_calendar ?? [],
            'party_treasury'      => $this->party_treasury ?? [],
            'campaign_milestones' => $this->campaign_milestones ?? [],
            'campaign_map'        => $this->campaign_map ?? null,
            'battle_map'          => $this->playerBattleMap(),
            'time_of_day'         => $this->time_of_day,
            'characters'          => CharacterResource::collection($this->whenLoaded('characters')),
            'combatants'          => CombatantResource::collection($this->whenLoaded('combatants')),
            'sessions'            => SessionResource::collection($this->whenLoaded('sessions')),
            'created_at'          => $this->created_at,
            'updated_at'          => $this->updated_at,
        ];
    }

    /**
     * Retire les pions marqués « hidden » (réservés au MJ) avant diffusion.
     */
    private function playerBattleMap(): ?array
    {
        $map = $this->battle_map;
        if (! is_array($map)) {
            return $map;
        }

        $map['tokens'] = array_values(array_filter(
            $map['tokens'] ?? [],
            fn ($token) => empty($token['hidden']),
        ));

        return $map;
    }
}
