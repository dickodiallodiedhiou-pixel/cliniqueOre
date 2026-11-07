<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('prenom')->nullable();
            $table->string('nom')->nullable();
            $table->string('adresse')->nullable();
        });

        // Reprise des comptes existants : « Awa Diop » devient prénom « Awa » et nom « Diop »
        foreach (DB::table('users')->orderBy('id')->get(['id', 'name']) as $u) {
            $parts = preg_split('/\s+/', trim((string) $u->name), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $prenom = count($parts) > 1 ? array_shift($parts) : null;

            DB::table('users')->where('id', $u->id)->update([
                'prenom' => $prenom,
                'nom' => $parts ? implode(' ', $parts) : null,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['prenom', 'nom', 'adresse']);
        });
    }
};
