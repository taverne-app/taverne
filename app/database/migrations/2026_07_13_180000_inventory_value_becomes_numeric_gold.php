<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Même bascule que pour le coffre du groupe : la valeur d'un objet d'inventaire
 * était un texte libre (« 500 po »), elle devient un nombre de pièces d'or.
 *
 * On peut ainsi additionner la fortune portée par les personnages, et « Distribuer »
 * n'a plus besoin de reformater la valeur en traversant du coffre vers l'inventaire.
 *
 * Rien n'est perdu : un texte qu'on ne sait pas chiffrer part dans les notes.
 */
return new class extends Migration
{
    /** Taux 5e vers la pièce d'or. */
    private const RATES = ['pp' => 10.0, 'po' => 1.0, 'pe' => 0.5, 'pa' => 0.1, 'pc' => 0.01];

    public function up(): void
    {
        $this->convert(fn (array $item) => $this->toNumeric($item));
    }

    public function down(): void
    {
        $this->convert(function (array $item): array {
            $gp = $item['value_gp'] ?? null;
            unset($item['value_gp']);
            $item['value'] = $gp === null ? null : rtrim(rtrim(number_format((float) $gp, 2, '.', ''), '0'), '.').' po';

            return $item;
        });
    }

    /** @param callable(array): array $transform */
    private function convert(callable $transform): void
    {
        foreach (DB::table('characters')->whereNotNull('inventory')->get(['id', 'inventory']) as $character) {
            $items = json_decode($character->inventory, true);

            if (! is_array($items) || $items === []) {
                continue;
            }

            DB::table('characters')->where('id', $character->id)->update([
                'inventory' => json_encode(array_map($transform, $items)),
            ]);
        }
    }

    private function toNumeric(array $item): array
    {
        $raw = trim((string) ($item['value'] ?? ''));
        unset($item['value']);

        $item['value_gp'] = $this->toGold($raw);

        if ($item['value_gp'] === null && $raw !== '') {
            $notes = trim((string) ($item['notes'] ?? ''));
            $item['notes'] = $notes === '' ? "Valeur : {$raw}" : "{$notes} — Valeur : {$raw}";
        }

        return $item;
    }

    /** « 500 po » → 500 · « 25 pa » → 2.5 · « inestimable » → null. Sans unité : des po. */
    private function toGold(string $raw): ?float
    {
        if ($raw === '') {
            return null;
        }

        $normalized = str_replace([' ', "\u{202f}", "\u{a0}", ','], ['', '', '', '.'], mb_strtolower($raw));

        if (! preg_match('/^(\d+(?:\.\d+)?)(pp|po|pe|pa|pc)?$/', $normalized, $m)) {
            return null;
        }

        return round((float) $m[1] * self::RATES[$m[2] ?? 'po'], 2);
    }
};
