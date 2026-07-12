<?php

use App\Models\Campaign;
use App\Models\Character;
use Illuminate\Database\Migrations\Migration;

/**
 * Les premières images uploadées ont été enregistrées avec une URL absolue bâtie
 * sur APP_URL (http://localhost:8000/storage/…). Une telle URL ne résout que depuis
 * la machine du MJ : un joueur ouvrant le lien de partage depuis son téléphone
 * obtenait une image cassée. On repasse ces références en relatif (/storage/…),
 * servi par l'origine de la page.
 */
return new class extends Migration
{
    /** Remplace le préfixe d'origine par une racine relative. */
    private function relativize(?string $url): ?string
    {
        if (! $url) {
            return $url;
        }

        return preg_replace('#^https?://[^/]+(/storage/)#', '$1', $url);
    }

    public function up(): void
    {
        Campaign::query()->select('id', 'battle_map', 'campaign_map')->chunkById(100, function ($campaigns) {
            foreach ($campaigns as $campaign) {
                $changed = false;

                foreach (['battle_map', 'campaign_map'] as $key) {
                    $map = $campaign->{$key};
                    if (is_array($map) && ! empty($map['image_url'])) {
                        $next = $this->relativize($map['image_url']);
                        if ($next !== $map['image_url']) {
                            $map['image_url'] = $next;
                            $campaign->{$key} = $map;
                            $changed = true;
                        }
                    }
                }

                if ($changed) {
                    $campaign->saveQuietly();
                }
            }
        });

        Character::query()->whereNotNull('portrait_url')->chunkById(100, function ($characters) {
            foreach ($characters as $character) {
                $next = $this->relativize($character->portrait_url);
                if ($next !== $character->portrait_url) {
                    $character->portrait_url = $next;
                    $character->saveQuietly();
                }
            }
        });
    }

    public function down(): void
    {
        // Irréversible : l'origine d'origine n'est pas récupérable, et le relatif
        // est de toute façon correct dans tous les contextes.
    }
};
