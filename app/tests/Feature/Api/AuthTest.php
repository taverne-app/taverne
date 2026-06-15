<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Tests\TestCase;

class AuthTest extends TestCase
{

    public function test_register_creates_user_and_returns_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name'                  => 'Gandalf',
            'email'                 => 'gandalf@taverne.app',
            'password'              => 'youshallnotpass',
            'password_confirmation' => 'youshallnotpass',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);

        $this->assertDatabaseHas('users', ['email' => 'gandalf@taverne.app']);
    }

    public function test_register_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'gandalf@taverne.app']);

        $this->postJson('/api/auth/register', [
            'name'                  => 'Gandalf 2',
            'email'                 => 'gandalf@taverne.app',
            'password'              => 'youshallnotpass',
            'password_confirmation' => 'youshallnotpass',
        ])->assertStatus(422);
    }

    public function test_login_returns_token(): void
    {
        User::factory()->create([
            'email'    => 'frodo@taverne.app',
            'password' => bcrypt('onering'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'frodo@taverne.app',
            'password' => 'onering',
        ]);

        $response->assertOk()->assertJsonStructure(['token', 'user']);
    }

    public function test_login_rejects_wrong_password(): void
    {
        User::factory()->create(['email' => 'frodo@taverne.app']);

        $this->postJson('/api/auth/login', [
            'email'    => 'frodo@taverne.app',
            'password' => 'wrongpassword',
        ])->assertStatus(401);
    }

    public function test_logout_revokes_token(): void
    {
        $user  = User::factory()->create();
        $token = $user->createToken('taverne')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/auth/logout')
            ->assertOk();

        // Sanctum's RequestGuard caches the resolved user per-instance.
        // Forgetting guards forces re-evaluation of the (now-revoked) token.
        $this->app['auth']->forgetGuards();

        // Le token est révoqué — la route protégée renvoie 401
        $this->withToken($token)
            ->getJson('/api/user')
            ->assertStatus(401);
    }

    public function test_protected_routes_require_auth(): void
    {
        $this->getJson('/api/characters')->assertStatus(401);
    }
}
