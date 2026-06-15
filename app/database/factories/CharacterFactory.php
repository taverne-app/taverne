<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class CharacterFactory extends Factory
{
    private static array $races = [
        'Humain', 'Elfe', 'Nain', 'Halfelin', 'Gnome',
        'Demi-Elfe', 'Demi-Orc', 'Tieffelin', 'Draconide',
    ];

    private static array $classes = [
        'Barbare', 'Barde', 'Clerc', 'Druide', 'Guerrier',
        'Moine', 'Paladin', 'Rôdeur', 'Roublard', 'Ensorceleur',
        'Sorcier', 'Magicien',
    ];

    private static array $backgrounds = [
        'Acolyte', 'Artisan', 'Charlatan', 'Criminel', 'Ermite',
        'Folk Hero', 'Noble', 'Hors-la-loi', 'Sage', 'Soldat',
    ];

    private static array $alignments = [
        'Loyal Bon', 'Neutre Bon', 'Chaotique Bon',
        'Loyal Neutre', 'Neutre', 'Chaotique Neutre',
        'Loyal Mauvais', 'Neutre Mauvais', 'Chaotique Mauvais',
    ];

    public function definition(): array
    {
        $maxHp = $this->faker->numberBetween(8, 120);

        return [
            'user_id'         => User::factory(),
            'name'            => $this->faker->firstName().' '.$this->faker->lastName(),
            'race'            => $this->faker->randomElement(self::$races),
            'character_class' => $this->faker->randomElement(self::$classes),
            'subclass'        => null,
            'level'           => $this->faker->numberBetween(1, 20),
            'background'      => $this->faker->randomElement(self::$backgrounds),
            'alignment'       => $this->faker->randomElement(self::$alignments),
            'experience_points' => 0,

            'strength'     => $this->faker->numberBetween(8, 20),
            'dexterity'    => $this->faker->numberBetween(8, 20),
            'constitution' => $this->faker->numberBetween(8, 20),
            'intelligence' => $this->faker->numberBetween(8, 20),
            'wisdom'       => $this->faker->numberBetween(8, 20),
            'charisma'     => $this->faker->numberBetween(8, 20),

            'max_hp'       => $maxHp,
            'current_hp'   => $maxHp,
            'temporary_hp' => 0,
            'armor_class'  => $this->faker->numberBetween(10, 20),
            'speed'        => 30,

            'inspiration'           => false,
            'death_saves_successes' => 0,
            'death_saves_failures'  => 0,
            'conditions'            => null,
            'notes'                 => null,
        ];
    }

    public function wounded(int $damage): static
    {
        return $this->state(fn (array $a) => [
            'current_hp' => max(0, $a['max_hp'] - $damage),
        ]);
    }

    public function dying(): static
    {
        return $this->state(fn () => [
            'current_hp'            => 0,
            'death_saves_failures'  => 2,
            'death_saves_successes' => 1,
        ]);
    }
}
