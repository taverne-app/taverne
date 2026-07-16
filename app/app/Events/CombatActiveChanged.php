<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class CombatActiveChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        private string $shareToken,
        private bool $active
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel("campaign-share.{$this->shareToken}");
    }

    public function broadcastAs(): string
    {
        return 'combat.active-changed';
    }

    public function broadcastWith(): array
    {
        return ['active' => $this->active];
    }
}
