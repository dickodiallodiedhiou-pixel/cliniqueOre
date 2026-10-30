<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activite;
use App\Models\Medecin;
use App\Models\RendezVous;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminRendezVousController extends Controller
{
    private const RELATIONS = [
        'patient.user:id,name,telephone,photo',
        'medecin.user:id,name,photo',
        'medecin.specialite:id,nom',
    ];

    // Supervision : ?medecin_id= &patient_id= &patient= (nom/téléphone) &statut= &du= &au= &tri=asc|desc
    public function index(Request $request)
    {
        $request->validate([
            'statut' => ['nullable', Rule::in(['en_attente', 'confirme', 'annule', 'termine'])],
            'du' => 'nullable|date',
            'au' => 'nullable|date',
        ]);

        $query = RendezVous::with(self::RELATIONS);

        if ($request->filled('medecin_id')) {
            $query->where('medecin_id', $request->integer('medecin_id'));
        }
        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->integer('patient_id'));
        }
        if ($request->filled('statut')) {
            $query->where('statut', $request->query('statut'));
        }
        if ($request->filled('du')) {
            $query->whereDate('date_heure', '>=', $request->query('du'));
        }
        if ($request->filled('au')) {
            $query->whereDate('date_heure', '<=', $request->query('au'));
        }
        if ($request->filled('patient')) {
            $mot = '%' . mb_strtolower(trim($request->query('patient'))) . '%';
            $query->whereHas('patient.user', fn ($u) => $u->where(function ($w) use ($mot) {
                $w->whereRaw('LOWER(name) LIKE ?', [$mot])->orWhere('telephone', 'like', $mot);
            }));
        }

        $parPage = min(100, max(1, (int) $request->query('per_page', 15)));
        $sens = $request->query('tri') === 'asc' ? 'asc' : 'desc';

        return response()->json($query->orderBy('date_heure', $sens)->orderBy('id', $sens)->paginate($parPage));
    }

    // Médecins ayant deux rendez-vous actifs au même moment
    public function conflits()
    {
        $groupes = RendezVous::groupesEnConflit()->map(function ($g) {
            return [
                'medecin_id' => $g->medecin_id,
                'date_heure' => $g->date_heure,
                'rendez_vous' => RendezVous::with(self::RELATIONS)
                    ->where('medecin_id', $g->medecin_id)
                    ->where('date_heure', $g->date_heure)
                    ->whereIn('statut', ['en_attente', 'confirme'])
                    ->get(),
            ];
        })->values();

        return response()->json($groupes);
    }

    // Intervention de l'administrateur : changer le statut, déplacer ou réaffecter un rendez-vous
    public function update(Request $request, RendezVous $rendezVous)
    {
        $data = $request->validate([
            'statut' => ['sometimes', Rule::in(['en_attente', 'confirme', 'annule', 'termine'])],
            'date_heure' => 'sometimes|date',
            'medecin_id' => [
                'sometimes',
                function ($attribute, $value, $fail) {
                    if (!Medecin::approuves()->whereKey($value)->exists()) {
                        $fail("Ce médecin n'est pas disponible.");
                    }
                },
            ],
        ], [
            'statut.in' => 'Statut invalide.',
            'date_heure.date' => 'La date et l\'heure sont invalides.',
        ]);

        $avant = [
            'statut' => $rendezVous->statut,
            'date_heure' => Carbon::parse($rendezVous->date_heure)->format('Y-m-d H:i'),
            'medecin_id' => $rendezVous->medecin_id,
        ];

        $statut = $data['statut'] ?? $rendezVous->statut;
        $medecinId = (int) ($data['medecin_id'] ?? $rendezVous->medecin_id);
        $dateHeure = Carbon::parse($data['date_heure'] ?? $rendezVous->date_heure)->format('Y-m-d H:i:00');

        // Un médecin ne peut pas avoir deux rendez-vous actifs au même moment
        if ($statut !== 'annule') {
            $conflit = RendezVous::where('id', '!=', $rendezVous->id)
                ->where('medecin_id', $medecinId)
                ->where('date_heure', $dateHeure)
                ->where('statut', '!=', 'annule')
                ->exists();

            if ($conflit) {
                return response()->json([
                    'message' => 'Conflit : ce médecin a déjà un rendez-vous actif à cette date et à cette heure.',
                ], 422);
            }
        }

        $rendezVous->update([
            'statut' => $statut,
            'medecin_id' => $medecinId,
            'date_heure' => $dateHeure,
        ]);

        Activite::enregistrer($request->user(), 'rdv_modifie', 'rendez_vous', $rendezVous->id, [
            'avant' => $avant,
            'apres' => [
                'statut' => $statut,
                'date_heure' => Carbon::parse($dateHeure)->format('Y-m-d H:i'),
                'medecin_id' => $medecinId,
            ],
        ]);

        return response()->json([
            'message' => 'Rendez-vous mis à jour.',
            'rendez_vous' => $rendezVous->fresh()->load(self::RELATIONS),
        ]);
    }
}
