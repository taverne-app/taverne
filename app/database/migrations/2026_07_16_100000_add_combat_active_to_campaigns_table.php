<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            // Un combat « lancé » : c'est ce drapeau qui ouvre l'accès de la vue
            // Combat aux joueurs. Il retombe à faux à la fin du combat.
            $table->boolean('combat_active')->default(false)->after('time_of_day');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('combat_active');
        });
    }
};
