<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('characters', function (Blueprint $table) {
            $table->string('secondary_class')->nullable()->after('subclass');
            $table->unsignedTinyInteger('secondary_level')->nullable()->after('secondary_class');
        });
    }
    public function down(): void {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['secondary_class', 'secondary_level']);
        });
    }
};
