<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Congés et indisponibilités ponctuelles d'un médecin
        Schema::create('indisponibilites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('medecin_id')->constrained('medecins')->onDelete('cascade');
            $table->date('date_debut');
            $table->date('date_fin'); // inclusive
            $table->time('heure_debut')->nullable(); // vides = journée(s) entière(s)
            $table->time('heure_fin')->nullable();
            $table->string('motif')->nullable();
            $table->timestamps();

            $table->index(['medecin_id', 'date_debut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('indisponibilites');
    }
};
