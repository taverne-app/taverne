<?php

use App\Models\Character;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('character.{characterId}', function ($user, int $characterId) {
    return Character::where('id', $characterId)
        ->where('user_id', $user->id)
        ->exists();
});
