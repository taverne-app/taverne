<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\CampaignController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\CombatantController;
use App\Http\Controllers\Api\SessionController;
use App\Http\Controllers\Api\ShareController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Auth (public) — limité à 10 tentatives/minute par IP
Route::prefix('auth')->middleware('throttle:10,1')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login',    [AuthController::class, 'login']);
});

// Mot de passe oublié (public) — limité à 5 tentatives/minute par IP
Route::middleware('throttle:5,1')->group(function () {
    Route::post('password/forgot', [PasswordResetController::class, 'sendResetLink']);
    Route::post('password/reset',  [PasswordResetController::class, 'reset']);
});

// Stripe webhook (public — signature verified inside controller)
Route::post('/billing/webhook', [BillingController::class, 'handleWebhook']);

// Vues partagées (public) — ordre important : la route spécifique avant la générique
Route::get('/share/character/{token}', [ShareController::class, 'showCharacter']);
Route::get('/share/{token}',           [ShareController::class, 'show']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user());
    Route::patch('/user', [AuthController::class, 'updateProfile']);
    Route::put('/user/password', [AuthController::class, 'updatePassword']);
    Route::post('auth/logout', [AuthController::class, 'logout']);

    // Billing
    Route::prefix('billing')->group(function () {
        Route::post('checkout', [BillingController::class, 'createCheckoutSession']);
        Route::post('portal',   [BillingController::class, 'createPortalSession']);
    });

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
        Route::patch('combatants/{combatant}/name',      [CombatantController::class, 'updateName']);
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
