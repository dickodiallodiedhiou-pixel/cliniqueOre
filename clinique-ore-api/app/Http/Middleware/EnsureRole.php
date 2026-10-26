<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Autorise l'accès uniquement aux rôles listés. Usage : ->middleware('role:admin,secretaire')
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user || !in_array($user->role, $roles, true)) {
            return response()->json([
                'message' => "Accès refusé : cette action n'est pas autorisée pour votre rôle.",
            ], 403);
        }

        return $next($request);
    }
}
