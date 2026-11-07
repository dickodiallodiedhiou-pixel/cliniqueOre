<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medecin;
use App\Services\CreneauService;
use Illuminate\Http\Request;

class MedecinController extends Controller
{
    private const RELATIONS = ['user:id,name,photo', 'specialite:id,nom', 'specialites:id,nom'];

    // Annuaire public : seuls les médecins vérifiés apparaissent
    public function index(Request $request, CreneauService $creneaux)
    {
        $query = Medecin::approuves()->with(self::RELATIONS);

        // Un médecin apparaît pour chacune de ses spécialités
        if ($request->filled('specialite_id')) {
            $id = $request->integer('specialite_id');
            $query->whereHas('specialites', fn ($s) => $s->where('specialites.id', $id));
        }

        // ?avec_creneaux=1 : ajoute le prochain créneau libre de chaque médecin
        $avec = $request->boolean('avec_creneaux');

        return response()->json(
            $query->get()->map(fn (Medecin $m) => $this->publicProfile($m)
                + ($avec ? ['prochain_creneau' => $this->prochainCreneau($creneaux, $m)] : []))->values()
        );
    }

    // Profil détaillé : horaires hebdomadaires (plages actives) et prochain créneau libre
    public function show(int $id, CreneauService $creneaux)
    {
        $medecin = Medecin::approuves()->with(self::RELATIONS)->findOrFail($id);

        $horaires = $medecin->disponibilitesActives()->orderBy('jour')->orderBy('heure_debut')->get()
            ->map(fn ($d) => [
                'jour' => (int) $d->jour,
                'heure_debut' => substr($d->heure_debut, 0, 5),
                'heure_fin' => substr($d->heure_fin, 0, 5),
            ])->values();

        return response()->json($this->publicProfile($medecin) + [
            'disponibilites' => $horaires,
            'prochain_creneau' => $this->prochainCreneau($creneaux, $medecin),
        ]);
    }
        // Créneaux libres des 14 prochains jours : ['2026-10-26' => ['09:00', '09:30'], ...]
    public function creneaux(int $id, CreneauService $creneaux)
    {
        $medecin = Medecin::approuves()->findOrFail($id);

        // (object) pour renvoyer {} (et non []) quand il n'y a aucun créneau
        return response()->json((object) $creneaux->creneauxParJour($medecin));
    }

    private function prochainCreneau(CreneauService $creneaux, Medecin $medecin): ?array
    {
        $libres = $creneaux->creneauxParJour($medecin);
        $jour = array_key_first($libres);

        return $jour ? ['date' => $jour, 'heure' => $libres[$jour][0]] : null;
    }

    // Seules les informations publiques sont exposées (ni email, ni téléphone, ni justificatifs)
    private function publicProfile(Medecin $m): array
    {
        return [
            'id' => $m->id,
            'nom' => $m->user->name,
            'photo_url' => $m->user->photo_url,
            'specialite_id' => $m->specialite_id,
            'specialite' => $m->specialite?->nom, // spécialité principale
            'specialites' => $m->specialitesOrdonnees()->map(fn ($s) => ['id' => $s->id, 'nom' => $s->nom])->all(),
            'specialites_libelle' => $m->specialites_libelle,
            'tarif_consultation' => $m->tarif_consultation,
            'biographie' => $m->biographie,
            'jours_travail' => $m->jours_travail,
            'heure_debut' => $m->heure_debut,
            'heure_fin' => $m->heure_fin,
        ];
    }
}
