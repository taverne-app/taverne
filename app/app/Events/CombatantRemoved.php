<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CombatantRemoved implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $shareToken,
        public readonly int    $combatantId,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel("campaign-share.{$this->shareToken}");
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
