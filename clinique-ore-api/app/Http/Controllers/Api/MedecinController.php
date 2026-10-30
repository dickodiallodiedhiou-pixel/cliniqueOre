<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medecin;
use App\Services\CreneauService;
use Illuminate\Http\Request;

class MedecinController extends Controller
{
    // Annuaire public : seuls les médecins vérifiés apparaissent
    public function index(Request $request)
    {
        $query = Medecin::approuves()->with(['user:id,name,photo', 'specialite:id,nom']);

        if ($request->filled('specialite_id')) {
            $query->where('specialite_id', $request->integer('specialite_id'));
        }

        return response()->json(
            $query->get()->map(fn (Medecin $m) => $this->publicProfile($m))->values()
        );
    }

    public function show(int $id)
    {
        $medecin = Medecin::approuves()->with(['user:id,name,photo', 'specialite:id,nom'])->findOrFail($id);

        return response()->json($this->publicProfile($medecin));
    }

    // Créneaux libres des 14 prochains jours : ['2026-10-26' => ['09:00', '09:30'], ...]
    public function creneaux(int $id, CreneauService $creneaux)
    {
        $medecin = Medecin::approuves()->findOrFail($id);

        // (object) pour renvoyer {} (et non []) quand il n'y a aucun créneau
        return response()->json((object) $creneaux->creneauxParJour($medecin));
    }

    // Seules les informations publiques sont exposées (ni email, ni téléphone, ni justificatifs)
    private function publicProfile(Medecin $m): array
    {
        return [
            'id' => $m->id,
            'nom' => $m->user->name,
            'photo_url' => $m->user->photo_url,
            'specialite' => $m->specialite?->nom,
            'tarif_consultation' => $m->tarif_consultation,
            'biographie' => $m->biographie,
            'jours_travail' => $m->jours_travail,
            'heure_debut' => $m->heure_debut,
            'heure_fin' => $m->heure_fin,
        ];
    }
}
