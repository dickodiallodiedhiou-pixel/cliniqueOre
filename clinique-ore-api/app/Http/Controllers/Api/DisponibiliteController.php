<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Disponibilite;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DisponibiliteController extends Controller
{
    // Disponibilités du médecin connecté (route protégée par medecin.approuve)
    public function index(Request $request)
    {
        $medecin = $request->attributes->get('medecin');

        return response()->json(
            $medecin->disponibilites()->orderBy('jour')->orderBy('heure_debut')
                ->get(['id', 'jour', 'heure_debut', 'heure_fin', 'duree'])
        );
    }

    // Remplace l'ensemble des plages horaires du médecin
    public function update(Request $request)
    {
        $medecin = $request->attributes->get('medecin');

        $data = $request->validate([
            'plages' => 'present|array|max:28',
            'plages.*.jour' => 'required|integer|between:1,7',
            'plages.*.heure_debut' => 'required|date_format:H:i',
            'plages.*.heure_fin' => 'required|date_format:H:i',
            'plages.*.duree' => 'required|integer|in:15,20,30,45,60',
        ], [
            'plages.*.jour.between' => 'Jour invalide.',
            'plages.*.heure_debut.date_format' => "L'heure de début est invalide.",
            'plages.*.heure_fin.date_format' => "L'heure de fin est invalide.",
            'plages.*.duree.in' => 'La durée doit être de 15, 20, 30, 45 ou 60 minutes.',
        ]);

        $plages = $data['plages'];

        // Cohérence des horaires : fin après début, au moins un créneau, pas de chevauchement
        foreach ($plages as $p) {
            if ($p['heure_fin'] <= $p['heure_debut']) {
                throw ValidationException::withMessages([
                    'plages' => "L'heure de fin doit être postérieure à l'heure de début.",
                ]);
            }
            $minutes = (strtotime($p['heure_fin']) - strtotime($p['heure_debut'])) / 60;
            if ($minutes < $p['duree']) {
                throw ValidationException::withMessages([
                    'plages' => 'Une plage horaire est plus courte que la durée choisie pour un créneau.',
                ]);
            }
        }

        $parJour = collect($plages)->groupBy('jour');
        foreach ($parJour as $liste) {
            $triees = $liste->sortBy('heure_debut')->values();
            for ($i = 1; $i < $triees->count(); $i++) {
                if ($triees[$i]['heure_debut'] < $triees[$i - 1]['heure_fin']) {
                    throw ValidationException::withMessages([
                        'plages' => 'Deux plages horaires se chevauchent le même jour.',
                    ]);
                }
            }
        }

        DB::transaction(function () use ($medecin, $plages) {
            $medecin->disponibilites()->delete();

            foreach ($plages as $p) {
                Disponibilite::create([
                    'medecin_id' => $medecin->id,
                    'jour' => $p['jour'],
                    'heure_debut' => $p['heure_debut'],
                    'heure_fin' => $p['heure_fin'],
                    'duree' => $p['duree'],
                ]);
            }
        });

        return response()->json([
            'message' => 'Disponibilités enregistrées.',
            'plages' => $medecin->disponibilites()->orderBy('jour')->orderBy('heure_debut')
                ->get(['id', 'jour', 'heure_debut', 'heure_fin', 'duree']),
        ]);
    }
}
