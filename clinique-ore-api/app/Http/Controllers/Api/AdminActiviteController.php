<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activite;

class AdminActiviteController extends Controller
{
    // Journal des actions de l'administrateur, les plus récentes d'abord
    public function index()
    {
        return response()->json(
            Activite::with('auteur:id,name')->orderByDesc('id')->paginate(20)
        );
    }
}
