<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->json('save_proficiencies')->nullable()->after('conditions');
            $table->json('skill_proficiencies')->nullable()->after('save_proficiencies');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['save_proficiencies', 'skill_proficiencies']);
        });
    }
};
