<?php

namespace Tests\Unit;

use App\Models\Character;
use Tests\TestCase;

class CharacterSpellcastingTest extends TestCase
{
    public function test_le_modificateur_dincantation_se_deduit_de_la_classe_si_absent(): void
    {
        // Freya : magicien niveau 1, INT 16, sans caractéristique d'incantation saisie.
        $c = (new Character())->forceFill([
            'character_class'      => 'Magicien',
            'level'                => 1,
            'intelligence'         => 16,
            'spellcasting_ability' => null,
        ]);

        $this->assertSame(3, $c->spellcasting_modifier);   // INT 16 → +3, déduit de la classe
        $this->assertSame(13, $c->spell_save_dc);          // 8 + maîtrise 2 + 3
        $this->assertSame(5, $c->spell_attack_bonus);      // maîtrise 2 + 3
    }

    public function test_la_caracteristique_saisie_a_la_priorite_sur_le_defaut(): void
    {
        $c = (new Character())->forceFill([
            'character_class'      => 'Magicien',
            'level'                => 1,
            'intelligence'         => 16,
            'charisma'             => 20,
            'spellcasting_ability' => 'charisma',
        ]);

        $this->assertSame(5, $c->spellcasting_modifier);   // CHA 20 → +5 : la valeur explicite prime
    }

    public function test_une_classe_non_lanceuse_reste_a_zero(): void
    {
        $c = (new Character())->forceFill([
            'character_class'      => 'Barbare',
            'level'                => 3,
            'spellcasting_ability' => null,
        ]);

        $this->assertSame(0, $c->spellcasting_modifier);
    }

    // ── Plafond de sorts préparés ────────────────────────────────────────────
    //
    // Règle portée du TypeScript vers PHP : la fiche joueur est publique derrière son
    // jeton, un plafond qui n'existe que dans l'interface ne plafonne rien.

    public function test_le_plafond_vaut_niveau_de_classe_plus_modificateur(): void
    {
        // Magicien niv. 5, INT 16 (+3) → 5 + 3 = 8.
        $c = (new Character())->forceFill([
            'character_class' => 'Magicien',
            'level'           => 5,
            'intelligence'    => 16,
        ]);

        $this->assertSame(8, $c->max_prepared_spells);
    }

    /** Un demi-lanceur ne compte que la moitié de son niveau : paladin à l'inférieur. */
    public function test_le_paladin_arrondit_son_demi_niveau_a_linferieur(): void
    {
        // Paladin niv. 5 → 2, CHA 16 (+3) → 2 + 3 = 5.
        $c = (new Character())->forceFill([
            'character_class' => 'Paladin',
            'level'           => 5,
            'charisma'        => 16,
        ]);

        $this->assertSame(5, $c->max_prepared_spells);
    }

    /** L'artificier arrondit au supérieur — c'est la seule classe dans ce cas. */
    public function test_lartificier_arrondit_son_demi_niveau_au_superieur(): void
    {
        // Artificier niv. 5 → 3, INT 14 (+2) → 3 + 2 = 5.
        $c = (new Character())->forceFill([
            'character_class' => 'Artificier',
            'level'           => 5,
            'intelligence'    => 14,
        ]);

        $this->assertSame(5, $c->max_prepared_spells);
    }

    /** Une classe qui « connaît » ses sorts n'a rien à préparer : pas de plafond. */
    public function test_une_classe_qui_connait_ses_sorts_na_pas_de_plafond(): void
    {
        foreach (['Ensorceleur', 'Barde', 'Occultiste', 'Rôdeur', 'Roublard'] as $classe) {
            $c = (new Character())->forceFill([
                'character_class' => $classe,
                'level'           => 10,
                'charisma'        => 18,
            ]);

            $this->assertNull($c->max_prepared_spells, "{$classe} ne devrait pas avoir de plafond");
        }
    }

    public function test_le_multiclassage_somme_les_parts_de_chaque_classe(): void
    {
        // Clerc 3 (+3 SAG → 6) + Magicien 2 (+3 → 5) = 11. Un seul modificateur est
        // stocké : il s'applique aux deux parts.
        $c = (new Character())->forceFill([
            'character_class'      => 'Clerc',
            'level'                => 3,
            'secondary_class'      => 'Magicien',
            'secondary_level'      => 2,
            'wisdom'               => 16,
            'spellcasting_ability' => 'wisdom',
        ]);

        $this->assertSame(11, $c->max_prepared_spells);
    }

    /** Minimum 1 par classe : un modificateur négatif ne descend pas sous 1. */
    public function test_le_plafond_ne_descend_jamais_sous_un(): void
    {
        // Magicien niv. 1, INT 6 (−2) → 1 − 2 = −1, ramené à 1.
        $c = (new Character())->forceFill([
            'character_class' => 'Magicien',
            'level'           => 1,
            'intelligence'    => 6,
        ]);

        $this->assertSame(1, $c->max_prepared_spells);
    }

    /** Les accents et la casse ne doivent pas décider s'il y a un plafond. */
    public function test_la_classe_se_reconnait_sans_accent_ni_casse(): void
    {
        foreach (['magicien', 'MAGICIEN', ' Magicien '] as $ecriture) {
            $c = (new Character())->forceFill([
                'character_class' => $ecriture,
                'level'           => 3,
                'intelligence'    => 14,
            ]);

            $this->assertSame(5, $c->max_prepared_spells, "« {$ecriture} » devrait être reconnu");
        }
    }

    public function test_le_compte_de_prepares_ignore_les_tours_de_magie(): void
    {
        $c = (new Character())->forceFill(['spells_known' => [
            ['name' => 'Trait de feu', 'level' => 0, 'prepared' => true],
            ['name' => 'Bouclier',     'level' => 1, 'prepared' => true],
            ['name' => 'Sommeil',      'level' => 1, 'prepared' => false],
        ]]);

        $this->assertSame(1, $c->prepared_spells_count);
    }
}
