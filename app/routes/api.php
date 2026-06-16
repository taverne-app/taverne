<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CharacterController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Auth (public)
Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login',    [AuthController::class, 'login']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user());
    Route::post('auth/logout', [AuthController::class, 'logout']);

    // Personnages
    Route::apiResource('characters', CharacterController::class);

    Route::prefix('characters/{character}')->group(function () {
        Route::patch('hp',          [CharacterController::class, 'updateHp']);
        Route::patch('conditions',  [CharacterController::class, 'updateConditions']);
        Route::patch('death-saves', [CharacterController::class, 'updateDeathSaves']);
        Route::patch('spell-slot',  [CharacterController::class, 'useSpellSlot']);
        Route::post('rest',         [CharacterController::class, 'longRest']);
        Route::post('roll',         [CharacterController::class, 'roll']);
    });
});
