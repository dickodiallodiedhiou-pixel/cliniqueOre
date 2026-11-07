<?php

namespace App\Http\Controllers\Concerns;

use App\Models\User;
use Illuminate\Http\Request;

// Accepte aussi les anciens formats de requête (compatibilité avec les clients existants)
trait NormaliseLaRequete
{
    // "name" (nom complet) est découpé en prénom et nom
    protected function normaliserIdentite(Request $request): void
    {
        if (!$request->filled('nom') && !$request->filled('prenom') && $request->filled('name')) {
            [$prenom, $nom] = User::separerNomComplet((string) $request->input('name'));
            $request->merge(['prenom' => $prenom, 'nom' => $nom]);
        }
    }

    // "specialite_id" devient "specialite_ids" (liste de spécialités)
    protected function normaliserSpecialites(Request $request): void
    {
        if (!$request->has('specialite_ids') && $request->filled('specialite_id')) {
            $request->merge(['specialite_ids' => [$request->input('specialite_id')]]);
        }
    }
}
