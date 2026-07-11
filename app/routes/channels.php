<?php

use App\Models\Campaign;
use App\Models\Character;
use App\Models\Combatant;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Canal à l'échelle de la campagne, réservé au MJ propriétaire. Sert à diffuser
// les changements structurels du combat (ajout/retrait de combattant) à toutes
// les sessions MJ ouvertes, indépendamment des combattants déjà connus.
Broadcast::channel('campaign.{campaignId}', function ($user, int $campaignId) {
    return Campaign::where('id', $campaignId)
        ->where('user_id', $user->id)
        ->exists();
});

Broadcast::channel('character.{characterId}', function ($user, int $characterId) {
    return Character::where('id', $characterId)
        ->where('user_id', $user->id)
        ->exists();
});

Broadcast::channel('combatant.{combatantId}', function ($user, int $combatantId) {
    return Combatant::where('id', $combatantId)
        ->whereHas('campaign', fn ($q) => $q->where('user_id', $user->id))
        ->exists();
});
