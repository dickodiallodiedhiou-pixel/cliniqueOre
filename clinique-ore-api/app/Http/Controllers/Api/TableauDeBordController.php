<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medecin;
use App\Models\Patient;
use App\Models\RendezVous;
use App\Models\Specialite;
use Illuminate\Support\Facades\DB;

class TableauDeBordController extends Controller
{
    public function index()
    {
        $aujourdhui = now()->toDateString();

        // Charge prévue sur les 7 prochains jours (rendez-vous non annulés)
        $parJour = [];
        for ($i = 0; $i < 7; $i++) {
            $date = now()->addDays($i)->toDateString();
            $parJour[] = [
                'date' => $date,
                'total' => RendezVous::whereDate('date_heure', $date)->where('statut', '!=', 'annule')->count(),
            ];
        }

        // Rendez-vous par spécialité (non annulés)
        $rdvParSpecialite = RendezVous::join('medecins', 'rendez_vous.medecin_id', '=', 'medecins.id')
            ->join('specialites', 'medecins.specialite_id', '=', 'specialites.id')
            ->where('rendez_vous.statut', '!=', 'annule')
            ->groupBy('specialites.id', 'specialites.nom')
            ->select('specialites.nom as nom', DB::raw('count(*) as total'))
            ->orderByDesc('total')
            ->limit(6)
            ->get();

        return response()->json([
            'patients' => [
                'total' => Patient::count(),
                'actifs' => Patient::whereHas('user', fn ($u) => $u->where('actif', true))->count(),
            ],
            'medecins' => [
                'total' => Medecin::count(),
                'approuves' => Medecin::where('statut_validation', Medecin::APPROVED)->count(),
                'en_attente' => Medecin::where('statut_validation', Medecin::PENDING)->count(),
                'refuses' => Medecin::where('statut_validation', Medecin::REJECTED)->count(),
                'inactifs' => Medecin::whereHas('user', fn ($u) => $u->where('actif', false))->count(),
            ],
            'rendez_vous' => [
                'aujourdhui' => RendezVous::whereDate('date_heure', $aujourdhui)->where('statut', '!=', 'annule')->count(),
                'en_attente' => RendezVous::where('statut', 'en_attente')->count(),
                'confirmes' => RendezVous::where('statut', 'confirme')->count(),
                'annules' => RendezVous::where('statut', 'annule')->count(),
                'termines' => RendezVous::where('statut', 'termine')->count(),
                'total' => RendezVous::count(),
            ],
            'conflits' => RendezVous::groupesEnConflit()->count(),
            'par_jour' => $parJour,
            'par_specialite' => $rdvParSpecialite,
            'specialites_actives' => Specialite::where('actif', true)->count(),
        ]);
    }
}
