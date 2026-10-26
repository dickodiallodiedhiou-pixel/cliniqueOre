<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Justificatif;
use App\Models\Medecin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminMedecinController extends Controller
{
    // Liste des demandes, filtrable : ?statut=pending|approved|rejected (pending par défaut)
    public function index(Request $request)
    {
        $statut = $request->query('statut', Medecin::PENDING);
        abort_unless(in_array($statut, [Medecin::PENDING, Medecin::APPROVED, Medecin::REJECTED], true), 422, 'Statut invalide.');

        $medecins = Medecin::with(['user:id,name,email,telephone', 'specialite:id,nom', 'justificatifs'])
            ->where('statut_validation', $statut)
            ->orderBy('created_at')
            ->get();

        return response()->json($medecins);
    }

    public function show(Medecin $medecin)
    {
        return response()->json(
            $medecin->load(['user:id,name,email,telephone', 'specialite:id,nom', 'justificatifs'])
        );
    }

    // Téléchargement d'un justificatif (stocké sur le disque privé)
    public function justificatif(Medecin $medecin, Justificatif $justificatif)
    {
        abort_unless($justificatif->medecin_id === $medecin->id, 404);
        abort_unless(Storage::exists($justificatif->chemin), 404, 'Fichier introuvable.');

        return Storage::download($justificatif->chemin, $justificatif->nom_original, [
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function approuver(Request $request, Medecin $medecin)
    {
        $medecin->update([
            'statut_validation' => Medecin::APPROVED,
            'motif_rejet' => null,
            'valide_le' => now(),
            'valide_par' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Compte médecin approuvé. Il apparaît désormais dans l\'annuaire.',
            'medecin' => $medecin->fresh()->load(['user:id,name,email,telephone', 'specialite:id,nom', 'justificatifs']),
        ]);
    }

    public function rejeter(Request $request, Medecin $medecin)
    {
        $data = $request->validate([
            'motif' => 'required|string|min:5|max:1000',
        ], [
            'motif.required' => 'Le motif du refus est obligatoire.',
            'motif.min' => 'Le motif du refus doit contenir au moins 5 caractères.',
        ]);

        $medecin->update([
            'statut_validation' => Medecin::REJECTED,
            'motif_rejet' => $data['motif'],
            'valide_le' => now(),
            'valide_par' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Compte médecin refusé.',
            'medecin' => $medecin->fresh()->load(['user:id,name,email,telephone', 'specialite:id,nom', 'justificatifs']),
        ]);
    }
}
