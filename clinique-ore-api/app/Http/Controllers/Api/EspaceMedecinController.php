<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\RendezVous;
use App\Services\CreneauService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EspaceMedecinController extends Controller
{
    private const PATIENT = 'patient.user:id,name,telephone,photo';

    // Tableau de bord du médecin connecté
    public function tableauDeBord(Request $request, CreneauService $creneaux)
    {
        $medecin = $request->attributes->get('medecin');
        $maintenant = now();
        $aujourdhui = $maintenant->toDateString();

        $base = fn () => RendezVous::where('medecin_id', $medecin->id);

        $parJour = [];
        for ($i = 0; $i < 7; $i++) {
            $date = $maintenant->copy()->addDays($i)->toDateString();
            $parJour[] = [
                'date' => $date,
                'total' => $base()->whereDate('date_heure', $date)->whereNotIn('statut', ['annule', 'refuse'])->count(),
            ];
        }

        $libres = $creneaux->creneauxParJour($medecin);
        $premierJour = array_key_first($libres);

        $indispo = $medecin->indisponibilites()
            ->where('date_fin', '>=', $aujourdhui)
            ->orderBy('date_debut')
            ->first();

        return response()->json([
            'rendez_vous' => [
                'aujourdhui' => $base()->whereDate('date_heure', $aujourdhui)->whereNotIn('statut', ['annule', 'refuse'])->count(),
                'en_attente' => $base()->where('statut', 'en_attente')->count(),
                'confirmes' => $base()->where('statut', 'confirme')->count(),
                'termines' => $base()->where('statut', 'termine')->count(),
                'termines_mois' => $base()->where('statut', 'termine')
                    ->whereYear('date_heure', $maintenant->year)->whereMonth('date_heure', $maintenant->month)->count(),
                'refuses' => $base()->where('statut', 'refuse')->count(),
                'annules' => $base()->where('statut', 'annule')->count(),
            ],
            'aujourdhui_liste' => $base()->with(self::PATIENT)
                ->whereDate('date_heure', $aujourdhui)->whereNotIn('statut', ['annule', 'refuse'])
                ->orderBy('date_heure')->get(),
            'en_attente_liste' => $base()->with(self::PATIENT)
                ->where('statut', 'en_attente')->where('date_heure', '>=', $maintenant->copy()->startOfDay())
                ->orderBy('date_heure')->limit(5)->get(),
            'prochains' => $base()->with(self::PATIENT)
                ->whereIn('statut', ['en_attente', 'confirme'])->where('date_heure', '>=', $maintenant)
                ->orderBy('date_heure')->limit(5)->get(),
            'par_jour' => $parJour,
            'prochain_creneau' => $premierJour ? ['date' => $premierJour, 'heure' => $libres[$premierJour][0]] : null,
            'prochaine_indisponibilite' => $indispo,
        ]);
    }

    // Liste paginée : ?statut= &du= &au= &patient= (nom) &patient_id= &tri= &page= &per_page=
    public function rendezVous(Request $request)
    {
        $medecin = $request->attributes->get('medecin');

        $request->validate([
            'statut' => ['nullable', Rule::in(['en_attente', 'confirme', 'refuse', 'annule', 'termine'])],
            'du' => 'nullable|date',
            'au' => 'nullable|date',
        ]);

        $query = RendezVous::with(self::PATIENT)->where('medecin_id', $medecin->id);

        if ($request->filled('statut')) {
            $query->where('statut', $request->query('statut'));
        }
        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->integer('patient_id'));
        }
        if ($request->filled('du')) {
            $query->whereDate('date_heure', '>=', $request->query('du'));
        }
        if ($request->filled('au')) {
            $query->whereDate('date_heure', '<=', $request->query('au'));
        }
        if ($request->filled('patient')) {
            $mot = '%' . mb_strtolower(trim($request->query('patient'))) . '%';
            $query->whereHas('patient.user', fn ($u) => $u->whereRaw('LOWER(name) LIKE ?', [$mot]));
        }

        // À traiter / confirmés : le plus proche d'abord ; terminés / annulés : le plus récent d'abord
        $statut = $request->query('statut');
        $sens = $request->query('tri') ?: (in_array($statut, ['en_attente', 'confirme'], true) ? 'asc' : 'desc');
        $sens = $sens === 'asc' ? 'asc' : 'desc';

        $parPage = min(50, max(1, (int) $request->query('per_page', 10)));
        $page = $query->orderBy('date_heure', $sens)->orderBy('id', $sens)->paginate($parPage);

        // Le médecin peut lire ses propres comptes rendus
        $page->getCollection()->each->makeVisible('notes_medecin');

        $compteurs = RendezVous::where('medecin_id', $medecin->id)
            ->selectRaw('statut, count(*) as total')
            ->groupBy('statut')
            ->pluck('total', 'statut');

        return response()->json(array_merge($page->toArray(), ['compteurs' => $compteurs]));
    }

    // Fiche d'un patient : uniquement s'il a (eu) un rendez-vous avec ce médecin
    public function patient(Request $request, Patient $patient)
    {
        $medecin = $request->attributes->get('medecin');

        $rdvs = fn () => RendezVous::where('medecin_id', $medecin->id)->where('patient_id', $patient->id);

        abort_unless($rdvs()->exists(), 403, "Ce patient n'a aucun rendez-vous avec vous.");

        $patient->load('user:id,name,telephone,photo');

        return response()->json([
            'id' => $patient->id,
            'nom' => $patient->user->name,
            'telephone' => $patient->user->telephone,
            'photo_url' => $patient->user->photo_url,
            'nb_consultations' => $rdvs()->where('statut', 'termine')->count(),
            'nb_annules' => $rdvs()->where('statut', 'annule')->count(),
            'nb_refuses' => $rdvs()->where('statut', 'refuse')->count(),
            'premiere_consultation' => $rdvs()->where('statut', 'termine')->min('date_heure'),
            'derniere_consultation' => $rdvs()->where('statut', 'termine')->max('date_heure'),
            'prochain_rdv' => $rdvs()->whereIn('statut', ['en_attente', 'confirme'])->where('date_heure', '>=', now())->min('date_heure'),
        ]);
    }

    // Planning d'une semaine : ?debut=YYYY-MM-DD (n'importe quel jour de la semaine voulue)
    public function planning(Request $request, CreneauService $creneaux)
    {
        $medecin = $request->attributes->get('medecin');

        $request->validate(['debut' => 'nullable|date']);

        $lundi = Carbon::parse($request->query('debut', now()->toDateString()))->startOfWeek(Carbon::MONDAY);

        return response()->json($creneaux->planningSemaine($medecin, $lundi));
    }
}
