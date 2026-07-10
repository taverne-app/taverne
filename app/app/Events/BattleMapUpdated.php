<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class BattleMapUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        private string $shareToken,
        private ?array $battleMap
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel("campaign-share.{$this->shareToken}");
    }

    public function broadcastAs(): string
    {
        return 'campaign.battle-map-updated';
    }

    public function broadcastWith(): array
    {
        return ['battle_map' => $this->battleMap];
    }
}
