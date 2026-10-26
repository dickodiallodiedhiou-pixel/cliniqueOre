<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medecin;
use Illuminate\Http\Request;

class MedecinController extends Controller
{
    // Annuaire public : seuls les médecins vérifiés apparaissent
    public function index(Request $request)
    {
        $query = Medecin::approuves()->with(['user:id,name', 'specialite:id,nom']);

        if ($request->filled('specialite_id')) {
            $query->where('specialite_id', $request->integer('specialite_id'));
        }

        return response()->json(
            $query->get()->map(fn (Medecin $m) => $this->publicProfile($m))->values()
        );
    }

    public function show(int $id)
    {
        $medecin = Medecin::approuves()->with(['user:id,name', 'specialite:id,nom'])->findOrFail($id);

        return response()->json($this->publicProfile($medecin));
    }

    // Seules les informations publiques sont exposées (ni email, ni téléphone, ni justificatifs)
    private function publicProfile(Medecin $m): array
    {
        return [
            'id' => $m->id,
            'nom' => $m->user->name,
            'specialite' => $m->specialite?->nom,
            'tarif_consultation' => $m->tarif_consultation,
            'biographie' => $m->biographie,
            'jours_travail' => $m->jours_travail,
            'heure_debut' => $m->heure_debut,
            'heure_fin' => $m->heure_fin,
        ];
    }
}
