<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->json('custom_monsters')->nullable()->after('session_prep');
        });
    }
    public function down(): void {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('custom_monsters');
        });
    }
};
