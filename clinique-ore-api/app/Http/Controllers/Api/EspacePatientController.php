<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RendezVous;
use Illuminate\Http\Request;

class EspacePatientController extends Controller
{
    private const RELATIONS = ['medecin.user:id,name,photo', 'medecin.specialite:id,nom', 'medecin.specialites:id,nom'];

    // Tableau de bord du patient connecté
    public function tableauDeBord(Request $request)
    {
        $user = $request->user();
        $id = $user->patient?->id ?? 0;
        $maintenant = now();

        $base = fn () => RendezVous::where('patient_id', $id);
        $aVenir = fn () => $base()->whereIn('statut', ['en_attente', 'confirme'])->where('date_heure', '>=', $maintenant);

        $prochain = $aVenir()->with(self::RELATIONS)->orderBy('date_heure')->first();
        $this->marquer($prochain);

        return response()->json([
            'rendez_vous' => [
                'a_venir' => $aVenir()->count(),
                'en_attente' => $aVenir()->where('statut', 'en_attente')->count(),
                'confirmes' => $aVenir()->where('statut', 'confirme')->count(),
                'termines' => $base()->where('statut', 'termine')->count(),
                // annulés ou refusés
                'annules' => $base()->whereIn('statut', ['annule', 'refuse'])->count(),
            ],
            'prochain' => $prochain,
            'notifications' => [
                'non_lues' => $user->unreadNotifications()->count(),
                'recentes' => $user->notifications()->limit(3)->get(),
            ],
        ]);
    }

    // Mes rendez-vous : ?onglet=avenir|passes|annules &page=
    public function rendezVous(Request $request)
    {
        $user = $request->user();
        $id = $user->patient?->id ?? 0;
        $maintenant = now();

        $onglet = $request->query('onglet', 'avenir');
        abort_unless(in_array($onglet, ['avenir', 'passes', 'annules'], true), 422, 'Onglet invalide.');

        $requete = [
            // à venir : demandes en attente ou confirmées dont la date n'est pas passée
            'avenir' => fn () => RendezVous::where('patient_id', $id)->whereIn('statut', ['en_attente', 'confirme'])->where('date_heure', '>=', $maintenant),
            // passés : consultations terminées ou rendez-vous dont la date est dépassée (hors annulés)
            'passes' => fn () => RendezVous::where('patient_id', $id)->whereNotIn('statut', ['annule', 'refuse'])->where('date_heure', '<', $maintenant),
            // annulés ou refusés
            'annules' => fn () => RendezVous::where('patient_id', $id)->whereIn('statut', ['annule', 'refuse']),
        ];

        $sens = $onglet === 'avenir' ? 'asc' : 'desc';
        $page = $requete[$onglet]()->with(self::RELATIONS)->orderBy('date_heure', $sens)->orderBy('id', $sens)->paginate(8);

        // Le patient lit le compte rendu de ses consultations
        $page->getCollection()->each(function ($r) {
            $r->makeVisible('notes_medecin');
            $this->marquer($r);
        });

        return response()->json(array_merge($page->toArray(), [
            'compteurs' => [
                'avenir' => $requete['avenir']()->count(),
                'passes' => $requete['passes']()->count(),
                'annules' => $requete['annules']()->count(),
            ],
        ]));
    }

    // Ajoute au rendez-vous la règle de modification de la clinique
    private function marquer(?RendezVous $r): void
    {
        if (!$r) {
            return;
        }
        $r->setAttribute('modifiable', $r->estModifiable());
        $r->setAttribute('delai_modification_heures', (int) config('clinique.delai_modification_heures'));
    }
}
