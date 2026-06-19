<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CampaignController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\CombatantController;
use App\Http\Controllers\Api\SessionController;
use App\Http\Controllers\Api\ShareController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Auth (public)
Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login',    [AuthController::class, 'login']);
});

// Vues partagées (public)
Route::get('/share/{token}',           [ShareController::class, 'show']);
Route::get('/share/character/{token}', [ShareController::class, 'showCharacter']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user());
    Route::post('auth/logout', [AuthController::class, 'logout']);

    // Campagnes
    Route::apiResource('campaigns', CampaignController::class);
    Route::prefix('campaigns/{campaign}')->group(function () {
        Route::post('characters',               [CampaignController::class, 'addCharacter']);
        Route::delete('characters/{character}', [CampaignController::class, 'removeCharacter']);
        Route::post('share',                    [CampaignController::class, 'share']);
        Route::delete('share',                  [CampaignController::class, 'revokeShare']);
        Route::post('combat-turn',              [CampaignController::class, 'broadcastTurn']);
        Route::apiResource('sessions', SessionController::class)->except(['show']);
        Route::apiResource('combatants', CombatantController::class)->except(['show', 'update']);
        Route::patch('combatants/{combatant}/hp',         [CombatantController::class, 'updateHp']);
        Route::patch('combatants/{combatant}/initiative', [CombatantController::class, 'updateInitiative']);
        Route::patch('combatants/{combatant}/conditions', [CombatantController::class, 'updateConditions']);
        Route::patch('combatants/{combatant}/faction',    [CombatantController::class, 'updateFaction']);
    });

    // Personnages
    Route::apiResource('characters', CharacterController::class);

    Route::prefix('characters/{character}')->group(function () {
        Route::patch('hp',          [CharacterController::class, 'updateHp']);
        Route::patch('conditions',  [CharacterController::class, 'updateConditions']);
        Route::patch('death-saves', [CharacterController::class, 'updateDeathSaves']);
        Route::patch('spell-slot',  [CharacterController::class, 'useSpellSlot']);
        Route::patch('currency',     [CharacterController::class, 'updateCurrency']);
        Route::post('rest',          [CharacterController::class, 'longRest']);
        Route::post('short-rest',    [CharacterController::class, 'shortRest']);
        Route::post('roll',         [CharacterController::class, 'roll']);
        Route::post('share',        [CharacterController::class, 'share']);
        Route::delete('share',      [CharacterController::class, 'revokeShare']);
    });
});
