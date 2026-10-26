<?php

namespace App\Http\Middleware;

use App\Models\Medecin;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Réserve l'accès aux médecins dont le compte a été approuvé par l'administrateur.
 * Le statut est relu en base à chaque requête : une suspension prend effet immédiatement.
 */
class EnsureMedecinApprouve
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $medecin = $user && $user->role === 'medecin' ? $user->medecin : null;

        if (!$medecin) {
            return response()->json([
                'message' => 'Accès réservé aux médecins.',
            ], 403);
        }

        if (!$medecin->estApprouve()) {
            $message = $medecin->statut_validation === Medecin::REJECTED
                ? "Votre compte a été refusé par l'administrateur."
                : "Votre compte est en attente de validation par l'administrateur.";

            return response()->json([
                'message' => $message,
                'statut_validation' => $medecin->statut_validation,
            ], 403);
        }

        // Évite de recharger le profil dans les contrôleurs
        $request->attributes->set('medecin', $medecin);

        return $next($request);
    }
}
