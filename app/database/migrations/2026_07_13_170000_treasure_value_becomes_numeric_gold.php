<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * La valeur d'un objet du coffre était un texte libre (« 500 po », « inestimable »).
 * Impossible à additionner : la tuile « Or total » ne pouvait donc pas compter le coffre.
 *
 * Elle devient un nombre de pièces d'or (`value_gp`), nullable — un objet peut n'avoir
 * aucune valeur chiffrée.
 *
 * Rien n'est perdu : un texte qu'on ne sait pas convertir (« inestimable ») est reporté
 * dans les notes de l'objet, plutôt que jeté.
 */
return new class extends Migration
{
    /** Taux D&D 5e vers la pièce d'or. */
    private const RATES = ['pp' => 10.0, 'po' => 1.0, 'pe' => 0.5, 'pa' => 0.1, 'pc' => 0.01];

    public function up(): void
    {
        foreach (DB::table('campaigns')->whereNotNull('party_treasury')->get(['id', 'party_treasury']) as $campaign) {
            $items = json_decode($campaign->party_treasury, true);

            if (! is_array($items) || $items === []) {
                continue;
            }

            $converted = array_map(function (array $item): array {
                $raw = trim((string) ($item['value'] ?? ''));
                unset($item['value']);

                $item['value_gp'] = $this->toGold($raw);

                // Le texte n'a pas pu être chiffré : on le garde dans les notes.
                if ($item['value_gp'] === null && $raw !== '') {
                    $notes = trim((string) ($item['notes'] ?? ''));
                    $item['notes'] = $notes === '' ? "Valeur : {$raw}" : "{$notes} — Valeur : {$raw}";
                }

                return $item;
            }, $items);

            DB::table('campaigns')->where('id', $campaign->id)->update([
                'party_treasury' => json_encode($converted),
            ]);
        }
    }

    public function down(): void
    {
        foreach (DB::table('campaigns')->whereNotNull('party_treasury')->get(['id', 'party_treasury']) as $campaign) {
            $items = json_decode($campaign->party_treasury, true);

            if (! is_array($items) || $items === []) {
                continue;
            }

            $reverted = array_map(function (array $item): array {
                $gp = $item['value_gp'] ?? null;
                unset($item['value_gp']);
                $item['value'] = $gp === null ? '' : rtrim(rtrim(number_format((float) $gp, 2, '.', ''), '0'), '.').' po';

                return $item;
            }, $items);

            DB::table('campaigns')->where('id', $campaign->id)->update([
                'party_treasury' => json_encode($reverted),
            ]);
        }
    }

    /**
     * « 500 po » → 500 · « 1 500 » → 1500 · « 25 pa » → 2.5 · « inestimable » → null.
     * Sans unité, on suppose des pièces d'or.
     */
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
