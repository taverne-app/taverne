<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Projection « joueurs » d'une campagne, servie par le lien de partage public.
 *
 * Contrairement à CampaignResource (vue MJ authentifiée), elle n'expose que les
 * informations destinées aux joueurs : ni notes du MJ, ni rencontres/monstres/tables
 * réservés au MJ, et les pions cachés du plateau (embuscades, pièges) sont retirés
 * — pas seulement masqués côté client. Les quêtes elles-mêmes ne sont plus publiées :
 * ce que les joueurs savent de l'aventure viendra de leur codex, pas de mes objectifs.
 *
 * Les chapitres n'y figurent PAS, même terminés. Un chapitre porte la préparation du
 * MJ — secrets, accroches, trésors à venir : le publier vendrait la mèche. Ce que les
 * joueurs savent du passé sera leur codex, écrit pour eux, pas un sous-produit de mes
 * notes.
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
            'locations'           => $this->locations ?? [],
            'factions'            => $this->factions ?? [],
            'game_calendar'       => $this->game_calendar ?? [],
            'party_treasury'      => $this->party_treasury ?? [],
            'campaign_map'        => $this->campaign_map ?? null,
            'battle_map'          => $this->playerBattleMap(),
            'time_of_day'         => $this->time_of_day,
            'combat_active'       => (bool) $this->combat_active,
            // Le tour en cours, pour qu'une page joueur ouverte au milieu d'un combat
            // sache de qui c'est le tour sans attendre le prochain clic du MJ.
            'combat_active_kind'  => $this->combat_active_kind,
            'combat_active_id'    => $this->combat_active_id ? (int) $this->combat_active_id : null,
            'combat_round'        => (int) ($this->combat_round ?? 1),
            'combat_location'     => $this->combat_location,
            'characters'          => CharacterResource::collection($this->whenLoaded('characters')),
            'combatants'          => CombatantResource::collection($this->whenLoaded('combatants')),
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
