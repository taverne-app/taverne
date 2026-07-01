<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;

class PasswordResetController extends Controller
{
    public function sendResetLink(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        Password::sendResetLink($request->only('email'));

        return response()->json(['message' => 'Si cet email existe, un lien de réinitialisation a été envoyé.']);
    }

    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'token'    => ['required', 'string'],
            'email'    => ['required', 'email'],
            'password' => ['required', 'string', 'confirmed', PasswordRule::min(8)],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->update(['password' => Hash::make($password)]);
                $user->tokens()->delete();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Mot de passe réinitialisé avec succès.']);
        }

        return response()->json(['message' => 'Le lien de réinitialisation est invalide ou expiré.'], 422);
    }
}
