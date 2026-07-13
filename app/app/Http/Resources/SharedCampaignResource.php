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
            'sessions'            => $this->playerSessions(),
            'created_at'          => $this->created_at,
            'updated_at'          => $this->updated_at,
        ];
    }

    /**
     * Le journal des séances JOUÉES, et rien d'autre.
     *
     * Une séance à venir porte sa préparation (`prep`) : scènes, accroches, trésors,
     * rencontres à monter. C'est du matériau de MJ — le diffuser vendrait la mèche.
     * On ne renvoie donc ni les séances à venir, ni le champ `prep`.
     */
    private function playerSessions(): array
    {
        if (! $this->resource->relationLoaded('sessions')) {
            return [];
        }

        return $this->sessions
            ->where('status', '!=', \App\Models\CampaignSession::STATUS_PLANNED)
            ->map(fn ($session) => [
                'id'           => $session->id,
                'title'        => $session->title,
                'session_date' => $session->session_date?->toDateString(),
                'notes'        => $session->notes,
                'xp_awarded'   => $session->xp_awarded,
                'loot_notes'   => $session->loot_notes,
            ])
            ->values()
            ->all();
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
