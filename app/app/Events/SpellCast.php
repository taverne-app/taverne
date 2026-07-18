<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * « Freya lance Armure de mage » — l'annonce d'un sort à la table.
 *
 * Même canal privé que DiceRolled, et pour la même raison : c'est la console du MJ qui
 * écoute `character.{id}` et tient le journal. Le canal public de la campagne serait un
 * mauvais choix — il est lisible par quiconque a le lien, alors qu'annoncer un sort
 * relève du même flux que les jets de dés.
 */
class SpellCast implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $characterId,
        public readonly string $characterName,
        public readonly string $spellName,
        public readonly int $level,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("character.{$this->characterId}")];
    }

    public function broadcastAs(): string
    {
        return 'spell.cast';
    }

    public function broadcastWith(): array
    {
        return [
            'character_id'   => $this->characterId,
            'character_name' => $this->characterName,
            'spell_name'     => $this->spellName,
            'level'          => $this->level,
            'timestamp'      => now()->toISOString(),
        ];
    }
}
