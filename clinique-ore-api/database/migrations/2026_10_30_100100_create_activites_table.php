<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Journal des actions de l'administrateur (traçabilité)
        Schema::create('activites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('cible_type')->nullable(); // medecin, patient, specialite, rendez_vous
            $table->unsignedBigInteger('cible_id')->nullable();
            $table->text('details')->nullable(); // JSON
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activites');
    }
};
