<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('characters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('campaign_id')->nullable()->index();

            // Identité
            $table->string('name');
            $table->string('race');
            $table->string('character_class');
            $table->string('subclass')->nullable();
            $table->unsignedTinyInteger('level')->default(1);
            $table->string('background')->nullable();
            $table->string('alignment')->nullable();
            $table->unsignedInteger('experience_points')->default(0);

            // Caractéristiques (1–30)
            $table->unsignedTinyInteger('strength')->default(10);
            $table->unsignedTinyInteger('dexterity')->default(10);
            $table->unsignedTinyInteger('constitution')->default(10);
            $table->unsignedTinyInteger('intelligence')->default(10);
            $table->unsignedTinyInteger('wisdom')->default(10);
            $table->unsignedTinyInteger('charisma')->default(10);

            // Combat
            $table->unsignedSmallInteger('max_hp')->default(1);
            $table->smallInteger('current_hp')->default(1);
            $table->unsignedSmallInteger('temporary_hp')->default(0);
            $table->unsignedTinyInteger('armor_class')->default(10);
            $table->unsignedTinyInteger('speed')->default(30);

            // État
            $table->boolean('inspiration')->default(false);
            $table->unsignedTinyInteger('death_saves_successes')->default(0);
            $table->unsignedTinyInteger('death_saves_failures')->default(0);
            $table->json('conditions')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('characters');
    }
};
