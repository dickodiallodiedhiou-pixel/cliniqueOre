<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medecin;
use App\Models\RendezVous;
use App\Services\CreneauService;
use App\Services\NotificationRendezVous;
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
            'medecin.specialites:id,nom',
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

        $liste = $query->get();

        // Compte rendu visible uniquement par le patient concerné et son médecin
        if (in_array($user->role, ['patient', 'medecin'], true)) {
            $liste->each->makeVisible('notes_medecin');
        }

        return response()->json($liste);
    }

    // Réservé aux patients (route protégée par role:patient)
    public function store(Request $request, CreneauService $creneaux, NotificationRendezVous $notifications)
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

        $notifications->notifierMedecin($rdv, 'nouvelle_demande');

        return response()->json([
            'message' => 'Rendez-vous réservé avec succès',
            'rendez_vous' => $rdv,
        ], 201);
    }

    // Le patient reprogramme son rendez-vous sur un autre créneau libre (il repasse en attente de confirmation)
    public function modifier(Request $request, RendezVous $rendezVous, CreneauService $creneaux, NotificationRendezVous $notifications)
    {
        $patient = $request->user()->patient;

        if (!$patient || $rendezVous->patient_id !== $patient->id) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        if (!in_array($rendezVous->statut, ['en_attente', 'confirme'], true)) {
            return response()->json(['message' => 'Ce rendez-vous ne peut plus être modifié.'], 422);
        }

        if (!$rendezVous->delaiRespecte()) {
            return response()->json([
                'message' => 'Un rendez-vous ne peut plus être modifié moins de ' . config('clinique.delai_modification_heures')
                    . ' heures avant sa date. Contactez la clinique si nécessaire.',
            ], 422);
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

        $notifications->notifierMedecin($rendezVous, 'demande_modifiee');

        return response()->json(['message' => 'Rendez-vous modifié.', 'rendez_vous' => $rendezVous]);
    }

    // Le patient annule son propre rendez-vous
    public function annuler(Request $request, RendezVous $rendezVous, NotificationRendezVous $notifications)
    {
        $patient = $request->user()->patient;

        if (!$patient || $rendezVous->patient_id !== $patient->id) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        if (!in_array($rendezVous->statut, ['en_attente', 'confirme'], true)) {
            return response()->json(['message' => 'Ce rendez-vous ne peut plus être annulé.'], 422);
        }

        if (!$rendezVous->delaiRespecte()) {
            return response()->json([
                'message' => 'Un rendez-vous ne peut plus être annulé moins de ' . config('clinique.delai_modification_heures')
                    . ' heures avant sa date. Contactez la clinique si nécessaire.',
            ], 422);
        }

        $rendezVous->update(['statut' => 'annule']);

        $notifications->notifierMedecin($rendezVous, 'annulation_patient');

        return response()->json(['message' => 'Rendez-vous annulé.', 'rendez_vous' => $rendezVous]);
    }

    // Médecin approuvé : accepter (confirme), refuser une demande (refuse), annuler (annule) ou clôturer (termine)
    public function updateStatut(Request $request, RendezVous $rendezVous, NotificationRendezVous $notifications)
    {
        $medecin = $request->attributes->get('medecin'); // posé par medecin.approuve

        if ($rendezVous->medecin_id !== $medecin->id) {
            return response()->json(['message' => 'Ce rendez-vous ne vous est pas attribué.'], 403);
        }

        $data = $request->validate([
            'statut' => ['required', Rule::in(['confirme', 'refuse', 'annule', 'termine'])],
            'notes_medecin' => 'nullable|string|max:5000',
        ]);

        // Transitions autorisées
        $transitions = [
            'en_attente' => ['confirme', 'refuse'],
            'confirme' => ['annule', 'termine'],
        ];

        if (!in_array($data['statut'], $transitions[$rendezVous->statut] ?? [], true)) {
            return response()->json(['message' => 'Changement de statut impossible depuis l\'état actuel.'], 422);
        }

        $statutAvant = $rendezVous->statut;

        $rendezVous->update([
            'statut' => $data['statut'],
            'notes_medecin' => $data['notes_medecin'] ?? $rendezVous->notes_medecin,
        ]);

        // Le patient est prévenu de la réponse du médecin
        // L'événement porte le nom du nouveau statut : confirme, refuse, annule ou termine
        $notifications->notifierPatient($rendezVous, $data['statut'], ['compte_rendu' => !empty($data['notes_medecin'])]);

        return response()->json(['message' => 'Rendez-vous mis à jour.', 'rendez_vous' => $rendezVous->makeVisible('notes_medecin')]);
    }

    // Historique des consultations terminées du patient connecté, avec le compte rendu du médecin
    public function historiquePatient(Request $request)
    {
        $patient = $request->user()->patient;

        $page = RendezVous::with(['medecin.user:id,name,photo', 'medecin.specialite:id,nom', 'medecin.specialites:id,nom'])
            ->where('patient_id', $patient?->id ?? 0)
            ->where('statut', 'termine')
            ->orderByDesc('date_heure')
            ->orderByDesc('id')
            ->paginate(10);

        $page->getCollection()->each->makeVisible('notes_medecin');

        return response()->json($page);
    }

    // Historique des consultations terminées du médecin : ?patient_id= &q= (nom du patient) &page=
    public function historiqueMedecin(Request $request)
    {
        $medecin = $request->attributes->get('medecin'); // posé par medecin.approuve

        $query = RendezVous::with(['patient.user:id,name,telephone,photo'])
            ->where('medecin_id', $medecin->id)
            ->where('statut', 'termine');

        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->integer('patient_id'));
        }
        if ($request->filled('q')) {
            $mot = '%' . mb_strtolower(trim($request->query('q'))) . '%';
            $query->whereHas('patient.user', fn ($u) => $u->whereRaw('LOWER(name) LIKE ?', [$mot]));
        }

        $page = $query->orderByDesc('date_heure')->orderByDesc('id')->paginate(10);
        $page->getCollection()->each->makeVisible('notes_medecin');

        return response()->json($page);
    }

    // Le médecin rédige ou corrige le compte rendu d'une de ses consultations terminées
    public function modifierNotes(Request $request, RendezVous $rendezVous)
    {
        $medecin = $request->attributes->get('medecin');

        if ($rendezVous->medecin_id !== $medecin->id) {
            return response()->json(['message' => 'Ce rendez-vous ne vous est pas attribué.'], 403);
        }

        if ($rendezVous->statut !== 'termine') {
            return response()->json(['message' => 'Le compte rendu ne peut être rédigé que pour une consultation terminée.'], 422);
        }

        $data = $request->validate([
            'notes_medecin' => 'required|string|max:5000',
        ], [
            'notes_medecin.required' => 'Le compte rendu ne peut pas être vide.',
            'notes_medecin.max' => 'Le compte rendu est trop long (5000 caractères maximum).',
        ]);

        $rendezVous->update(['notes_medecin' => $data['notes_medecin']]);

        return response()->json([
            'message' => 'Compte rendu enregistré.',
            'rendez_vous' => $rendezVous->makeVisible('notes_medecin'),
        ]);
    }
}
