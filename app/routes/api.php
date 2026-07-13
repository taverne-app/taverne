<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\ImageController;
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
Route::get('/share/character/{token}',          [ShareController::class, 'showCharacter']);
Route::patch('/share/character/{token}/hp',     [ShareController::class, 'updateHp']);
Route::post('/share/character/{token}/roll',    [ShareController::class, 'rollDice']);
Route::get('/share/{token}',                    [ShareController::class, 'show']);

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

    // Bibliothèque d'images du compte (battle maps, cartes, portraits)
    Route::apiResource('images', ImageController::class)->only(['index', 'store', 'destroy']);

    // Campagnes
    Route::apiResource('campaigns', CampaignController::class);
    Route::prefix('campaigns/{campaign}')->group(function () {
        Route::post('characters',               [CampaignController::class, 'addCharacter']);
        Route::post('characters/import',        [CharacterController::class, 'import']);
        Route::post('share',                    [CampaignController::class, 'share']);
        Route::delete('share',                  [CampaignController::class, 'revokeShare']);
        Route::post('combat-turn',              [CampaignController::class, 'broadcastTurn']);
        Route::patch('time-of-day',             [CampaignController::class, 'setTimeOfDay']);
        Route::post('sessions/reorder', [SessionController::class, 'reorder']);
        Route::apiResource('sessions', SessionController::class)->except(['show']);
        Route::apiResource('combatants', CombatantController::class)->except(['show', 'update']);
        Route::patch('combatants/{combatant}/hp',         [CombatantController::class, 'updateHp']);
        Route::patch('combatants/{combatant}/initiative', [CombatantController::class, 'updateInitiative']);
        Route::patch('combatants/{combatant}/conditions', [CombatantController::class, 'updateConditions']);
        Route::patch('combatants/{combatant}/faction',    [CombatantController::class, 'updateFaction']);
        Route::patch('combatants/{combatant}/name',      [CombatantController::class, 'updateName']);
        // withTrashed : le combattant à restaurer est justement celui qui est supprimé.
        Route::post('combatants/{combatant}/restore',    [CombatantController::class, 'restore'])->withTrashed();
        // Chemin distinct de « combatants/… » à dessein : sous DELETE, un segment
        // littéral y serait capturé par {combatant} et pris pour un identifiant.
        Route::delete('trashed-combatants',              [CombatantController::class, 'purgeTrashed']);
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
