<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Une plage inactive est conservée mais ne génère plus de créneaux
        Schema::table('disponibilites', function (Blueprint $table) {
            $table->boolean('actif')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('disponibilites', function (Blueprint $table) {
            $table->dropColumn('actif');
        });
    }
};
