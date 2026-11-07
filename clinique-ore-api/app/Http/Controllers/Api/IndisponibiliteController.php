<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Indisponibilite;
use App\Models\RendezVous;
use Carbon\Carbon;
use Illuminate\Http\Request;

class IndisponibiliteController extends Controller
{
    // Congés et indisponibilités en cours ou à venir du médecin connecté
    public function index(Request $request)
    {
        $medecin = $request->attributes->get('medecin');

        return response()->json(
            $medecin->indisponibilites()
                ->where('date_fin', '>=', now()->format('Y-m-d'))
                ->orderBy('date_debut')
                ->get()
        );
    }

    public function store(Request $request)
    {
        $medecin = $request->attributes->get('medecin');

        $data = $request->validate([
            'date_debut' => 'required|date_format:Y-m-d|after_or_equal:today',
            'date_fin' => 'required|date_format:Y-m-d|after_or_equal:date_debut',
            'heure_debut' => 'nullable|date_format:H:i|required_with:heure_fin',
            'heure_fin' => 'nullable|date_format:H:i|required_with:heure_debut|after:heure_debut',
            'motif' => 'nullable|string|max:255',
        ], [
            'date_debut.required' => 'La date de début est obligatoire.',
            'date_debut.after_or_equal' => 'La date de début ne peut pas être dans le passé.',
            'date_fin.required' => 'La date de fin est obligatoire.',
            'date_fin.after_or_equal' => 'La date de fin doit être postérieure ou égale à la date de début.',
            'heure_debut.required_with' => "Indiquez l'heure de début et l'heure de fin, ou aucune des deux pour des journées entières.",
            'heure_fin.required_with' => "Indiquez l'heure de début et l'heure de fin, ou aucune des deux pour des journées entières.",
            'heure_fin.after' => "L'heure de fin doit être postérieure à l'heure de début.",
        ]);

        if (Carbon::parse($data['date_debut'])->diffInDays(Carbon::parse($data['date_fin'])) > 365) {
            return response()->json(['message' => 'La période ne peut pas dépasser un an.'], 422);
        }

        $indispo = Indisponibilite::create([
            'medecin_id' => $medecin->id,
            'date_debut' => $data['date_debut'],
            'date_fin' => $data['date_fin'],
            'heure_debut' => $data['heure_debut'] ?? null,
            'heure_fin' => $data['heure_fin'] ?? null,
            'motif' => $data['motif'] ?? null,
        ]);

        // Rendez-vous déjà pris sur cette période : le médecin doit les traiter lui-même
        $concernes = RendezVous::with('patient.user:id,name')
            ->where('medecin_id', $medecin->id)
            ->whereIn('statut', ['en_attente', 'confirme'])
            ->whereBetween('date_heure', [
                Carbon::parse($data['date_debut'])->startOfDay(),
                Carbon::parse($data['date_fin'])->endOfDay(),
            ])
            ->orderBy('date_heure')
            ->get()
            ->filter(function ($r) use ($data) {
                if (empty($data['heure_debut']) || empty($data['heure_fin'])) {
                    return true;
                }
                $heure = Carbon::parse($r->date_heure)->format('H:i');

                return $heure >= $data['heure_debut'] && $heure < $data['heure_fin'];
            })
            ->map(fn ($r) => [
                'id' => $r->id,
                'date_heure' => $r->date_heure,
                'statut' => $r->statut,
                'patient' => $r->patient?->user?->name,
            ])
            ->values();

        return response()->json([
            'message' => 'Indisponibilité enregistrée : ces créneaux ne sont plus proposés aux patients.',
            'indisponibilite' => $indispo,
            'rendez_vous_concernes' => $concernes,
        ], 201);
    }

    public function destroy(Request $request, int $id)
    {
        $medecin = $request->attributes->get('medecin');

        $medecin->indisponibilites()->findOrFail($id)->delete();

        return response()->json(['message' => 'Indisponibilité supprimée : les créneaux sont de nouveau proposés.']);
    }
}
