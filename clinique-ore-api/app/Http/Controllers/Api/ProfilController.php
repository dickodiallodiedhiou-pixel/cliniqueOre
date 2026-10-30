<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProfilController extends Controller
{
    // Mise à jour du profil de l'utilisateur connecté (patient, médecin ou admin)
    public function update(Request $request)
    {
        $user = $request->user();
        $estMedecin = $user->role === 'medecin' && $user->medecin;

        if (is_string($request->input('telephone'))) {
            $request->merge(['telephone' => preg_replace('/\D/', '', $request->input('telephone'))]);
        }

        $rules = [
            'name' => 'required|string|max:255',
            'telephone' => ['required', 'regex:/^(75|76|77|78)[0-9]{7}$/'],
            'photo' => 'nullable|file|mimes:jpg,jpeg,png,webp|max:2048',
        ];
        if ($estMedecin) {
            $rules['tarif_consultation'] = 'required|numeric|min:0';
            $rules['biographie'] = 'nullable|string|max:2000';
        }

        $data = $request->validate($rules, [
            'name.required' => 'Le nom est obligatoire.',
            'telephone.required' => 'Le numéro de téléphone est obligatoire.',
            'telephone.regex' => 'Numéro invalide : 9 chiffres, commençant par 77, 78, 76 ou 75.',
            'photo.mimes' => 'La photo doit être au format JPG, PNG ou WEBP.',
            'photo.max' => 'La photo dépasse 2 Mo.',
            'photo.uploaded' => 'Le téléversement de la photo a échoué (fichier trop lourd ?).',
            'tarif_consultation.required' => 'Le tarif de consultation est obligatoire.',
            'tarif_consultation.numeric' => 'Le tarif de consultation doit être un nombre.',
            'tarif_consultation.min' => 'Le tarif de consultation doit être positif.',
        ]);

        $anciennePhoto = $user->getRawOriginal('photo');
        $nouvellePhoto = null;

        try {
            if ($request->hasFile('photo')) {
                $nouvellePhoto = $request->file('photo')->store('photos');
            }

            DB::transaction(function () use ($user, $data, $estMedecin, $nouvellePhoto, $anciennePhoto) {
                $user->update([
                    'name' => $data['name'],
                    'telephone' => $data['telephone'],
                    'photo' => $nouvellePhoto ?? $anciennePhoto,
                ]);

                if ($estMedecin) {
                    $user->medecin->update([
                        'tarif_consultation' => $data['tarif_consultation'],
                        'biographie' => $data['biographie'] ?? null,
                    ]);
                }
            });
        } catch (\Throwable $e) {
            if ($nouvellePhoto) {
                Storage::delete($nouvellePhoto);
            }
            throw $e;
        }

        // L'ancienne photo n'est supprimée qu'une fois la mise à jour réussie
        if ($nouvellePhoto && $anciennePhoto) {
            Storage::delete($anciennePhoto);
        }

        $user = $user->fresh();
        if ($user->role === 'medecin') {
            $user->load('medecin.specialite');
        }

        return response()->json(['message' => 'Profil mis à jour.', 'user' => $user]);
    }
}
