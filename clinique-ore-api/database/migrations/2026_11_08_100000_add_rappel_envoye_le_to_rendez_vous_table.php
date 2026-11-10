<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Date d'envoi du rappel au patient : évite d'envoyer deux fois le même rappel
        Schema::table('rendez_vous', function (Blueprint $table) {
            $table->timestamp('rappel_envoye_le')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('rendez_vous', function (Blueprint $table) {
            $table->dropColumn('rappel_envoye_le');
        });
    }
};
