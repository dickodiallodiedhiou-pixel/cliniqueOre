<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activite;
use App\Models\Patient;
use App\Services\CompteService;
use Illuminate\Http\Request;

class AdminPatientController extends Controller
{
    // Colonnes retournées : pas de données médicales (groupe sanguin, antécédents) pour l'administrateur
    private const COLONNES = ['id', 'user_id', 'date_naissance', 'created_at'];
    private const USER = 'user:id,name,email,telephone,photo,actif,created_at';

    // Liste paginée : ?q= (nom, email, téléphone) &actif= &page= &per_page=
    public function index(Request $request)
    {
        $query = Patient::select(self::COLONNES)->with(self::USER)->withCount('rendezVous');

        if ($request->filled('actif')) {
            $actif = filter_var($request->query('actif'), FILTER_VALIDATE_BOOLEAN);
            $query->whereHas('user', fn ($u) => $u->where('actif', $actif));
        }
        if ($request->filled('q')) {
            $mot = '%' . mb_strtolower(trim($request->query('q'))) . '%';
            $query->whereHas('user', fn ($u) => $u->where(function ($w) use ($mot) {
                $w->whereRaw('LOWER(name) LIKE ?', [$mot])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$mot])
                    ->orWhere('telephone', 'like', $mot);
            }));
        }

        $parPage = min(100, max(1, (int) $request->query('per_page', 15)));

        return response()->json($query->orderByDesc('created_at')->orderByDesc('id')->paginate($parPage));
    }

    public function show(Patient $patient)
    {
        $patient = Patient::select(self::COLONNES)->with(self::USER)->withCount('rendezVous')->findOrFail($patient->id);

        $parStatut = $patient->rendezVous()
            ->selectRaw('statut, count(*) as total')
            ->groupBy('statut')
            ->pluck('total', 'statut');

        return response()->json(array_merge($patient->toArray(), ['rendez_vous_par_statut' => $parStatut]));
    }

    public function basculerActif(Request $request, Patient $patient, CompteService $comptes)
    {
        $data = $request->validate(['actif' => 'required|boolean']);
        $actif = (bool) $data['actif'];

        $comptes->changerActivite($patient->user, $actif);

        Activite::enregistrer($request->user(), $actif ? 'compte_active' : 'compte_desactive', 'patient', $patient->id, [
            'nom' => $patient->user->name,
        ]);

        return response()->json([
            'message' => $actif ? 'Compte activé.' : 'Compte désactivé : le patient ne peut plus se connecter.',
            'patient' => Patient::select(self::COLONNES)->with(self::USER)->withCount('rendezVous')->find($patient->id),
        ]);
    }
}
