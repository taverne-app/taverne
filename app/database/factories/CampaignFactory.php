<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class CampaignFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id'     => User::factory(),
            'name'        => 'Campagne de '.$this->faker->firstName(),
            'description' => $this->faker->sentence(),
        ];
    }
}
