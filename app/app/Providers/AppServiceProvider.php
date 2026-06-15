<?php

namespace App\Providers;

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Broadcast::routes(['prefix' => 'api', 'middleware' => ['auth:sanctum']]);
    }
}
