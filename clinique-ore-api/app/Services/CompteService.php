<?php

namespace App\Services;

use App\Models\User;

class CompteService
{
    // Active ou désactive un compte ; la désactivation coupe immédiatement toutes les sessions
    public function changerActivite(User $user, bool $actif): void
    {
        $user->update(['actif' => $actif]);

        if (!$actif) {
            $user->tokens()->delete();
        }
    }
}
