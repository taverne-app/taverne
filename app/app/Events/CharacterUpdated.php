<?php

namespace App\Events;

use App\Http\Resources\CharacterResource;
use App\Models\Character;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CharacterUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Character $character) {}

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel("character.{$this->character->id}"),
            new PrivateChannel("campaign.{$this->character->campaign_id}"),
        ];

        $shareToken = $this->character->campaign?->share_token;
        if ($shareToken) {
            $channels[] = new Channel("campaign-share.{$shareToken}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'character.updated';
    }

    public function broadcastWith(): array
    {
        return ['character' => (new CharacterResource($this->character))->resolve()];
    }
}
