<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Specialite;

class SpecialiteController extends Controller
{
    // Liste publique des spécialités (utilisée par le formulaire d'inscription médecin)
    public function index()
    {
        return response()->json(Specialite::where('actif', true)->orderBy('nom')->get(['id', 'nom']));
    }
}
