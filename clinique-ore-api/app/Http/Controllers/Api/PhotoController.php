<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;

class PhotoController extends Controller
{
    // Les photos sont stockées sur le disque privé et servies ici (pas besoin de "storage:link").
    // Le nom du fichier est aléatoire et impossible à deviner.
    public function show(string $fichier)
    {
        $chemin = 'photos/' . $fichier;

        abort_unless(Storage::exists($chemin), 404);

        return Storage::response($chemin, null, [
            'Cache-Control' => 'public, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
