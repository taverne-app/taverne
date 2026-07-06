<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class CampaignTimeUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        private string $shareToken,
        private ?string $timeOfDay
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel("campaign-share.{$this->shareToken}");
    }

    public function broadcastAs(): string
    {
        return 'campaign.time-updated';
    }

    public function broadcastWith(): array
    {
        return ['time_of_day' => $this->timeOfDay];
    }
}
