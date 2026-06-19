<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->text('personality_traits')->nullable()->after('dm_notes');
            $table->text('ideals')->nullable()->after('personality_traits');
            $table->text('bonds')->nullable()->after('ideals');
            $table->text('flaws')->nullable()->after('bonds');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['personality_traits', 'ideals', 'bonds', 'flaws']);
        });
    }
};
