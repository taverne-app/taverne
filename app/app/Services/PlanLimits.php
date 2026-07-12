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

    /**
     * Poids cumulé de la bibliothèque. Le plafond en nombre d'images ne suffit
     * pas : 10 images à 5 Mo pèseraient 50 Mo. Les deux limites s'appliquent.
     */
    public static function maxStorageBytes(string $plan): int
    {
        return match ($plan) {
            'adventurer', 'guild' => PHP_INT_MAX,
            default => 25 * 1024 * 1024, // 25 Mo
        };
    }
}
