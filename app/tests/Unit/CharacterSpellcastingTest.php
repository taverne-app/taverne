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
}
