<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Un médecin a 1..* spécialités ; une spécialité a 0..* médecins
        Schema::create('medecin_specialite', function (Blueprint $table) {
            $table->id();
            $table->foreignId('medecin_id')->constrained('medecins')->onDelete('cascade');
            $table->foreignId('specialite_id')->constrained('specialites')->onDelete('cascade');
            $table->unique(['medecin_id', 'specialite_id']);
        });

        // Reprise des données : la spécialité actuelle de chaque médecin devient sa première spécialité
        DB::statement('INSERT INTO medecin_specialite (medecin_id, specialite_id) SELECT id, specialite_id FROM medecins');
    }

    public function down(): void
    {
        Schema::dropIfExists('medecin_specialite');
    }
};
