<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Le tour actif n'était que DIFFUSÉ : le MJ le gardait dans son localStorage et
     * l'émettait en changeant de tour. Une page joueur ouverte en cours de combat
     * n'avait donc aucun moyen de savoir de qui était le tour — elle restait sur
     * « tour inconnu » jusqu'au prochain clic du MJ, ce qui grisait ses actions.
     *
     * On le persiste pour que la vue joueurs puisse s'initialiser. Effet de bord utile :
     * un arbitrage du tour côté serveur devient possible, ce qui était impossible tant
     * que rien n'était stocké.
     */
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->string('combat_active_kind')->nullable()->after('combat_active');
            $table->unsignedBigInteger('combat_active_id')->nullable()->after('combat_active_kind');
            $table->unsignedInteger('combat_round')->default(1)->after('combat_active_id');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn(['combat_active_kind', 'combat_active_id', 'combat_round']);
        });
    }
};
