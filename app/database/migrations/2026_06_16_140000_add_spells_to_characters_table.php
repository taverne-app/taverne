<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->json('spell_slots')->nullable()->after('notes');
            $table->json('spells_known')->nullable()->after('spell_slots');
            $table->string('spellcasting_ability', 20)->nullable()->after('spells_known');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['spell_slots', 'spells_known', 'spellcasting_ability']);
        });
    }
};
