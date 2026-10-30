<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Compte actif ou désactivé par l'administrateur
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('actif')->default(true);
        });

        // Spécialité encore proposée ou non
        Schema::table('specialites', function (Blueprint $table) {
            $table->boolean('actif')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('actif');
        });
        Schema::table('specialites', function (Blueprint $table) {
            $table->dropColumn('actif');
        });
    }
};
