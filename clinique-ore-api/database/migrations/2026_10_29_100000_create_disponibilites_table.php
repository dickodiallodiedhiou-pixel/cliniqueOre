<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('disponibilites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('medecin_id')->constrained('medecins')->onDelete('cascade');
            $table->unsignedTinyInteger('jour'); // 1 = lundi ... 7 = dimanche
            $table->time('heure_debut');
            $table->time('heure_fin');
            $table->unsignedSmallInteger('duree')->default(30); // durée d'un créneau en minutes
            $table->timestamps();

            $table->index(['medecin_id', 'jour']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disponibilites');
    }
};
