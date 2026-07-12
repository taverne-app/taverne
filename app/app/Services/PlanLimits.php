<?php

namespace App\Services;

class PlanLimits
{
    public static function maxCampaigns(string $plan): int
    {
        return match ($plan) {
            'adventurer', 'guild' => PHP_INT_MAX,
            default => 1,
        };
    }

    public static function maxCharactersPerCampaign(string $plan): int
    {
        return match ($plan) {
            'adventurer', 'guild' => PHP_INT_MAX,
            default => 4,
        };
    }

    /**
     * Images uploadées dans la bibliothèque du compte (battle maps, cartes,
     * portraits confondus).
     */
    public static function maxImages(string $plan): int
    {
        return match ($plan) {
            'adventurer', 'guild' => PHP_INT_MAX,
            default => 10,
        };
    }
}
