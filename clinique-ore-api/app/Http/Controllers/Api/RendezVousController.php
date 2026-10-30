<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medecin;
use App\Models\RendezVous;
use App\Services\CreneauService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RendezVousController extends Controller
{
    // Le contenu dépend du rôle : chacun ne voit que ce qui le concerne
    public function index(Request $request)
    {
        $user = $request->user();

        $query = RendezVous::with([
            'patient.user:id,name,telephone,photo',
            'medecin.user:id,name,photo',
            'medecin.specialite:id,nom',
        ])->orderByDesc('date_heure');

        switch ($user->role) {
            case 'patient':
                $patient = $user->patient;
                if (!$patient) {
                    return response()->json([]);
                }
                $query->where('patient_id', $patient->id);
                break;

            case 'medecin':
                $medecin = $user->medecin;
                if (!$medecin || !$medecin->estApprouve()) {
                    return response()->json([
                        'message' => "Votre compte n'est pas encore validé par l'administrateur.",
                        'statut_validation' => $medecin?->statut_validation,
                    ], 403);
                }
                $query->where('medecin_id', $medecin->id);
                break;

            case 'admin':
            case 'secretaire':
                break; // accès complet

            default:
                return response()->json(['message' => 'Accès refusé.'], 403);
        }

        return response()->json($query->get());
    }

    // Réservé aux patients (route protégée par role:patient)
    public function store(Request $request, CreneauService $creneaux)
    {
        $data = $request->validate([
            'medecin_id' => [
                'required',
                // Un rendez-vous ne peut être pris qu'avec un médecin vérifié dont le compte est actif
                function ($attribute, $value, $fail) {
                    if (!Medecin::approuves()->whereKey($value)->exists()) {
                        $fail("Ce médecin n'est pas disponible.");
                    }
                },
            ],
            'date_heure' => 'required|date|after:now',
            'motif' => 'nullable|string|max:1000',
        ], [
            'medecin_id.required' => 'Veuillez choisir un médecin.',
                        'date_heure.required' => 'La date et l\'heure sont obligatoires.',
            'date_heure.date' => 'La date et l\'heure sont invalides.',
            'date_heure.after' => 'Le rendez-vous doit être fixé dans le futur.',
        ]);

        $patient = $request->user()->patient;

        if (!$patient) {
            return response()->json(['message' => 'Profil patient non trouvé'], 404);
        }

        // Le créneau doit être proposé par le médecin et encore libre
        $medecin = Medecin::approuves()->findOrFail($data['medecin_id']);
        $dateHeure = Carbon::parse($data['date_heure']);

        if (!$creneaux->estLibre($medecin, $dateHeure)) {
            return response()->json(['message' => "Ce créneau n'est pas ou plus disponible. Choisissez un autre horaire."], 422);
        }

        $rdv = RendezVous::create([
            'patient_id' => $patient->id,
            'medecin_id' => $data['medecin_id'],
            'date_heure' => $dateHeure->format('Y-m-d H:i:00'),
            'motif' => $data['motif'] ?? null,
            'statut' => 'en_attente',
        ]);

        return response()->json([
            'message' => 'Rendez-vous réservé avec succès',
            'rendez_vous' => $rdv,
        ], 201);
    }

    // Le patient reprogramme son rendez-vous sur un autre créneau libre (il repasse en attente de confirmation)
    public function modifier(Request $request, RendezVous $rendezVous, CreneauService $creneaux)
    {
        $patient = $request->user()->patient;

        if (!$patient || $rendezVous->patient_id !== $patient->id) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        if (!in_array($rendezVous->statut, ['en_attente', 'confirme'], true)) {
            return response()->json(['message' => 'Ce rendez-vous ne peut plus être modifié.'], 422);
        }

        $data = $request->validate([
            'date_heure' => 'required|date|after:now',
            'motif' => 'nullable|string|max:1000',
        ], [
            'date_heure.required' => 'La date et l\'heure sont obligatoires.',
            'date_heure.date' => 'La date et l\'heure sont invalides.',
            'date_heure.after' => 'Le rendez-vous doit être fixé dans le futur.',
        ]);

        $dateHeure = Carbon::parse($data['date_heure']);

        if (!$rendezVous->medecin->estApprouve()) {
            return response()->json(['message' => "Ce médecin n'est plus disponible."], 422);
        }

        if (!$creneaux->estLibre($rendezVous->medecin, $dateHeure)) {
            return response()->json(['message' => "Ce créneau n'est pas ou plus disponible. Choisissez un autre horaire."], 422);
        }

        $rendezVous->update([
            'date_heure' => $dateHeure->format('Y-m-d H:i:00'),
            'motif' => array_key_exists('motif', $data) ? $data['motif'] : $rendezVous->motif,
            'statut' => 'en_attente', // le médecin doit confirmer le nouvel horaire
        ]);

        return response()->json(['message' => 'Rendez-vous modifié.', 'rendez_vous' => $rendezVous]);
    }

    // Le patient annule son propre rendez-vous
    public function annuler(Request $request, RendezVous $rendezVous)
    {
        $patient = $request->user()->patient;

        if (!$patient || $rendezVous->patient_id !== $patient->id) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        if (!in_array($rendezVous->statut, ['en_attente', 'confirme'], true)) {
            return response()->json(['message' => 'Ce rendez-vous ne peut plus être annulé.'], 422);
        }

        $rendezVous->update(['statut' => 'annule']);

        return response()->json(['message' => 'Rendez-vous annulé.', 'rendez_vous' => $rendezVous]);
    }

    // Médecin approuvé : accepter (confirme), refuser (annule) ou clôturer (termine)
    public function updateStatut(Request $request, RendezVous $rendezVous)
    {
        $medecin = $request->attributes->get('medecin'); // posé par medecin.approuve

        if ($rendezVous->medecin_id !== $medecin->id) {
            return response()->json(['message' => 'Ce rendez-vous ne vous est pas attribué.'], 403);
        }

        $data = $request->validate([
            'statut' => ['required', Rule::in(['confirme', 'annule', 'termine'])],
            'notes_medecin' => 'nullable|string|max:2000',
        ]);

        // Transitions autorisées
        $transitions = [
            'en_attente' => ['confirme', 'annule'],
            'confirme' => ['annule', 'termine'],
        ];

        if (!in_array($data['statut'], $transitions[$rendezVous->statut] ?? [], true)) {
            return response()->json(['message' => 'Changement de statut impossible depuis l\'état actuel.'], 422);
        }

        $rendezVous->update([
            'statut' => $data['statut'],
            'notes_medecin' => $data['notes_medecin'] ?? $rendezVous->notes_medecin,
        ]);

        return response()->json(['message' => 'Rendez-vous mis à jour.', 'rendez_vous' => $rendezVous]);
    }
}
