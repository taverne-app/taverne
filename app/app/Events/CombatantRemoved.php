<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CombatantRemoved implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int     $campaignId,
        public readonly int     $combatantId,
        public readonly ?string $shareToken = null,
    ) {}

    public function broadcastOn(): array
    {
        // Canal privé campagne → autres sessions MJ ; canal public partagé → joueurs.
        $channels = [new PrivateChannel("campaign.{$this->campaignId}")];

        if ($this->shareToken) {
            $channels[] = new Channel("campaign-share.{$this->shareToken}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'combatant.removed';
    }

    public function broadcastWith(): array
    {
        return ['id' => $this->combatantId];
    }
}
