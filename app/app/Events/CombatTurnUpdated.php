<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CombatTurnUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $shareToken,
        public readonly ?string $activeKind,
        public readonly ?int    $activeId,
        public readonly int     $round,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel("campaign-share.{$this->shareToken}");
    }

    public function broadcastAs(): string
    {
        return 'combat.turn-updated';
    }

    public function broadcastWith(): array
    {
        return [
            'active_kind' => $this->activeKind,
            'active_id'   => $this->activeId,
            'round'       => $this->round,
        ];
    }
}
