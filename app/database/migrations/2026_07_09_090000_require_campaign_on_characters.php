<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Un personnage appartient toujours à une campagne. Les rares orphelins
        // restants sont rattachés à la première campagne de leur propriétaire ;
        // sans campagne possible, ils sont supprimés.
        DB::statement(<<<'SQL'
            UPDATE characters SET campaign_id = (
                SELECT MIN(c.id) FROM campaigns c WHERE c.user_id = characters.user_id
            ) WHERE campaign_id IS NULL
        SQL);
        DB::table('characters')->whereNull('campaign_id')->delete();

        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table('characters', function (Blueprint $table) {
                $table->foreignId('campaign_id')->nullable(false)->change();
            });

            return;
        }

        Schema::table('characters', function (Blueprint $table) {
            $table->dropForeign(['campaign_id']);
        });

        DB::statement('ALTER TABLE characters ALTER COLUMN campaign_id SET NOT NULL');

        Schema::table('characters', function (Blueprint $table) {
            $table->foreign('campaign_id')->references('id')->on('campaigns')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table('characters', function (Blueprint $table) {
                $table->foreignId('campaign_id')->nullable()->change();
            });

            return;
        }

        Schema::table('characters', function (Blueprint $table) {
            $table->dropForeign(['campaign_id']);
        });

        DB::statement('ALTER TABLE characters ALTER COLUMN campaign_id DROP NOT NULL');

        Schema::table('characters', function (Blueprint $table) {
            $table->foreign('campaign_id')->references('id')->on('campaigns')->nullOnDelete();
        });
    }
};
