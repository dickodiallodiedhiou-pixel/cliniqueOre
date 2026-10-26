<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('medecins', function (Blueprint $table) {
            $table->string('numero_ordre')->nullable()->unique(); // n° d'inscription à l'Ordre des médecins
            $table->text('biographie')->nullable();
            // pending (en attente), approved (validé), rejected (refusé)
            $table->string('statut_validation')->default('pending')->index();
            $table->text('motif_rejet')->nullable();
            $table->timestamp('valide_le')->nullable();
            $table->foreignId('valide_par')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('medecins', function (Blueprint $table) {
            $table->dropConstrainedForeignId('valide_par');
            $table->dropIndex(['statut_validation']);
            $table->dropUnique(['numero_ordre']);
            $table->dropColumn(['numero_ordre', 'biographie', 'statut_validation', 'motif_rejet', 'valide_le']);
        });
    }
};
