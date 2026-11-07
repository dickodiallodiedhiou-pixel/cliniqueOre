<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\NormaliseLaRequete;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class ProfilController extends Controller
{
    use NormaliseLaRequete;

    // Mise à jour du profil de l'utilisateur connecté (patient, médecin ou admin)
    public function update(Request $request)
    {
        $user = $request->user();
        $estMedecin = $user->role === 'medecin' && $user->medecin;
        $estPatient = $user->role === 'patient' && $user->patient;

        $this->normaliserIdentite($request);

        if (is_string($request->input('telephone'))) {
            $request->merge(['telephone' => preg_replace('/\D/', '', $request->input('telephone'))]);
        }

        $rules = [
            'prenom' => 'required|string|max:100',
            'nom' => 'required|string|max:100',
            'adresse' => 'nullable|string|max:255',
            'telephone' => ['required', 'regex:/^(75|76|77|78)[0-9]{7}$/'],
            'photo' => 'nullable|file|mimes:jpg,jpeg,png,webp|max:2048',
        ];
        if ($estMedecin) {
            $rules['tarif_consultation'] = 'required|numeric|min:0';
            $rules['biographie'] = 'nullable|string|max:2000';
        }
        if ($estPatient) {
            $rules['date_naissance'] = 'nullable|date|before:today';
            $rules['sexe'] = 'nullable|in:M,F';
        }

        $data = $request->validate($rules, [
            'prenom.required' => 'Le prénom est obligatoire.',
            'nom.required' => 'Le nom est obligatoire.',
            'sexe.in' => 'Le sexe doit être M (masculin) ou F (féminin).',
            'telephone.required' => 'Le numéro de téléphone est obligatoire.',
            'telephone.regex' => 'Numéro invalide : 9 chiffres, commençant par 77, 78, 76 ou 75.',
            'photo.mimes' => 'La photo doit être au format JPG, PNG ou WEBP.',
            'photo.max' => 'La photo dépasse 2 Mo.',
            'photo.uploaded' => 'Le téléversement de la photo a échoué (fichier trop lourd ?).',
            'tarif_consultation.required' => 'Le tarif de consultation est obligatoire.',
            'tarif_consultation.numeric' => 'Le tarif de consultation doit être un nombre.',
            'tarif_consultation.min' => 'Le tarif de consultation doit être positif.',
            'date_naissance.date' => 'La date de naissance est invalide.',
            'date_naissance.before' => 'La date de naissance doit être dans le passé.',
        ]);

        $anciennePhoto = $user->getRawOriginal('photo');
        $nouvellePhoto = null;

        try {
            if ($request->hasFile('photo')) {
                $nouvellePhoto = $request->file('photo')->store('photos');
            }

            DB::transaction(function () use ($request, $user, $data, $estMedecin, $estPatient, $nouvellePhoto, $anciennePhoto) {
                $user->update([
                    'prenom' => $data['prenom'],
                    'nom' => $data['nom'],
                    'adresse' => $data['adresse'] ?? null,
                    'telephone' => $data['telephone'],
                    'photo' => $nouvellePhoto ?? $anciennePhoto,
                ]);

                if ($estMedecin) {
                    $user->medecin->update([
                        'tarif_consultation' => $data['tarif_consultation'],
                        'biographie' => $data['biographie'] ?? null,
                    ]);
                }

                // La date de naissance et le sexe ne sont modifiés que si le champ est envoyé
                if ($estPatient) {
                    $champsPatient = [];
                    if ($request->exists('date_naissance')) {
                        $champsPatient['date_naissance'] = $data['date_naissance'] ?? null;
                    }
                    if ($request->exists('sexe')) {
                        $champsPatient['sexe'] = $data['sexe'] ?? null;
                    }
                    if ($champsPatient) {
                        $user->patient->update($champsPatient);
                    }
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
            $user->load(['medecin.specialite', 'medecin.specialites']);
        } elseif ($user->role === 'patient') {
            $user->load('patient:id,user_id,date_naissance,sexe');
        }

        return response()->json(['message' => 'Profil mis à jour.', 'user' => $user]);
    }

    // Changement de mot de passe : l'ancien mot de passe est exigé
    public function motDePasse(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed|different:current_password',
        ], [
            'current_password.required' => 'Saisissez votre mot de passe actuel.',
            'password.required' => 'Le nouveau mot de passe est obligatoire.',
            'password.min' => 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'La confirmation du mot de passe ne correspond pas.',
            'password.different' => "Le nouveau mot de passe doit être différent de l'ancien.",
        ]);

        if (!Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'Le mot de passe actuel est incorrect.']);
        }

        $user->update(['password' => Hash::make($data['password'])]);

        // Les autres appareils sont déconnectés ; la session en cours est conservée
        $courant = $user->currentAccessToken();
        $autres = $user->tokens();
        if ($courant instanceof PersonalAccessToken) {
            $autres->where('id', '!=', $courant->id);
        }
        $autres->delete();

        return response()->json(['message' => 'Mot de passe modifié.']);
    }
}
