<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Les quêtes faisaient doublon avec les chapitres côté MJ et n'ont plus de vue
 * joueurs. La fonctionnalité est retirée ; la colonne part avec elle.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('quests');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->json('quests')->nullable();
        });
    }
};
