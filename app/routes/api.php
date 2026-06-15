<?php

use App\Http\Controllers\Api\CharacterController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user());

    // Personnages
    Route::apiResource('characters', CharacterController::class);

    Route::prefix('characters/{character}')->group(function () {
        Route::patch('hp',          [CharacterController::class, 'updateHp']);
        Route::patch('conditions',  [CharacterController::class, 'updateConditions']);
        Route::patch('death-saves', [CharacterController::class, 'updateDeathSaves']);
    });
});
