<?php

namespace App\Events;

use App\Http\Resources\CombatantResource;
use App\Models\Combatant;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CombatantUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Combatant $combatant) {}

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel("combatant.{$this->combatant->id}"),
            new PrivateChannel("campaign.{$this->combatant->campaign_id}"),
        ];

        $shareToken = $this->combatant->campaign?->share_token;
        if ($shareToken) {
            $channels[] = new Channel("campaign-share.{$shareToken}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'combatant.updated';
    }

    public function broadcastWith(): array
    {
        return ['combatant' => (new CombatantResource($this->combatant))->resolve()];
    }
}
