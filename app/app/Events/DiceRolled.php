<?php

namespace App\Events;

use App\Models\Character;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DiceRolled implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly array $roll) {}

    /**
     * Rattache le jet à la campagne du personnage, l'inscrit au journal commun, le diffuse
     * à la table, et renvoie la charge utile propre (sans le jeton de routage) à retourner
     * au client. Sans campagne, le jet reste un simple événement privé, comme avant.
     */
    public static function record(Character $character, array $roll): array
    {
        $campaign = $character->campaign;
        if ($campaign) {
            $roll['campaign_id'] = $campaign->id;
            if ($campaign->share_token) {
                $roll['campaign_share_token'] = $campaign->share_token;
            }
        }

        self::dispatch($roll);

        $clean = collect($roll)->except('campaign_share_token')->all();
        $campaign?->pushRecentRoll($clean);

        return $clean;
    }

    public function broadcastOn(): array
    {
        // Le canal du personnage alimente les vues qui le pistent nommément (console MJ).
        $channels = [new PrivateChannel("character.{$this->roll['character_id']}")];

        // Les canaux de campagne portent le jet à TOUTE la table — c'est ce qui permet au
        // lanceur de dés de montrer l'historique commun, pas seulement les jets locaux.
        // Privé pour le MJ authentifié, public pour les joueurs via le lien de partage.
        if (! empty($this->roll['campaign_id'])) {
            $channels[] = new PrivateChannel("campaign.{$this->roll['campaign_id']}");
        }
        if (! empty($this->roll['campaign_share_token'])) {
            $channels[] = new Channel("campaign-share.{$this->roll['campaign_share_token']}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'dice.rolled';
    }

    public function broadcastWith(): array
    {
        // Le jeton de partage ne sert qu'au routage du canal : inutile dans la charge utile.
        return collect($this->roll)->except('campaign_share_token')->all();
    }
}
