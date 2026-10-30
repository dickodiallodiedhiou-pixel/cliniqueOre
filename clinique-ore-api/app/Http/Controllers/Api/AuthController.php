<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medecin;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class AuthController extends Controller
{
    // Règles communes à tous les comptes (patient ou médecin)
    private function reglesIdentite(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            // Format Sénégal : 9 chiffres, commence par 75, 76, 77 ou 78
            'telephone' => ['required', 'regex:/^(75|76|77|78)[0-9]{7}$/'],
            'photo' => 'required|file|mimes:jpg,jpeg,png,webp|max:2048',
        ];
    }

    private function messagesIdentite(): array
    {
        return [
            'name.required' => 'Le nom est obligatoire.',
            'email.required' => "L'adresse email est obligatoire.",
            'email.email' => "L'adresse email n'est pas valide.",
            'email.unique' => 'Cette adresse email est déjà utilisée.',
            'password.required' => 'Le mot de passe est obligatoire.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'La confirmation du mot de passe ne correspond pas.',
            'telephone.required' => 'Le numéro de téléphone est obligatoire.',
            'telephone.regex' => 'Numéro invalide : 9 chiffres, commençant par 77, 78, 76 ou 75.',
            'photo.required' => 'La photo de profil est obligatoire.',
            'photo.mimes' => 'La photo doit être au format JPG, PNG ou WEBP.',
            'photo.max' => 'La photo dépasse 2 Mo.',
            'photo.uploaded' => 'Le téléversement de la photo a échoué (fichier trop lourd ?).',
        ];
    }

    // Les espaces / points du numéro sont ignorés : "77 123 45 67" devient "771234567"
    private function nettoyerTelephone(Request $request): void
    {
        if (is_string($request->input('telephone'))) {
            $request->merge(['telephone' => preg_replace('/\D/', '', $request->input('telephone'))]);
        }
    }

    public function registerPatient(Request $request)
    {
        $this->nettoyerTelephone($request);

        $data = $request->validate(
            array_merge($this->reglesIdentite(), ['date_naissance' => 'nullable|date']),
            array_merge($this->messagesIdentite(), ['date_naissance.date' => 'La date de naissance est invalide.'])
        );

        $photoPath = null;

        try {
            $photoPath = $request->file('photo')->store('photos');

            // Utilisateur + profil patient créés ensemble (tout ou rien)
            $user = DB::transaction(function () use ($data, $photoPath) {
                $user = User::create([
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'password' => Hash::make($data['password']),
                    'role' => 'patient', // jamais fourni par le client
                    'telephone' => $data['telephone'],
                    'photo' => $photoPath,
                ]);

                Patient::create([
                    'user_id' => $user->id,
                    'date_naissance' => $data['date_naissance'] ?? null,
                ]);

                return $user;
            });
        } catch (\Throwable $e) {
            if ($photoPath) {
                Storage::delete($photoPath);
            }
            throw $e;
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Inscription réussie',
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ], 201);
    }

    // Types de justificatifs exigés à l'inscription d'un médecin
    private const JUSTIFICATIFS = ['diplome', 'autorisation_exercice', 'piece_identite'];

    public function registerMedecin(Request $request)
    {
        $this->nettoyerTelephone($request);

        $rules = array_merge($this->reglesIdentite(), [
            'specialite_id' => 'required|integer|exists:specialites,id',
            'numero_ordre' => 'required|string|max:100|unique:medecins,numero_ordre',
            'tarif_consultation' => 'required|numeric|min:0',
            'biographie' => 'nullable|string|max:2000',
        ]);
        $messages = array_merge($this->messagesIdentite(), [
            'specialite_id.required' => 'Veuillez choisir une spécialité.',
            'specialite_id.exists' => 'Cette spécialité est invalide.',
            'numero_ordre.required' => "Le numéro d'inscription à l'Ordre est obligatoire.",
            'numero_ordre.unique' => "Ce numéro d'inscription est déjà enregistré.",
            'tarif_consultation.required' => 'Le tarif de consultation est obligatoire.',
            'tarif_consultation.numeric' => 'Le tarif de consultation doit être un nombre.',
            'tarif_consultation.min' => 'Le tarif de consultation doit être positif.',
        ]);

        $libelles = [
            'diplome' => 'le diplôme',
            'autorisation_exercice' => "l'autorisation d'exercice",
            'piece_identite' => "la pièce d'identité",
        ];
        foreach (self::JUSTIFICATIFS as $type) {
            // 2 Mo max (limite par défaut de PHP : upload_max_filesize)
            $rules[$type] = 'required|file|mimes:pdf,jpg,jpeg,png|max:2048';
            $messages["$type.required"] = "Le document suivant est obligatoire : {$libelles[$type]}.";
            $messages["$type.mimes"] = "Format non accepté pour {$libelles[$type]} (PDF, JPG ou PNG).";
            $messages["$type.max"] = "Le fichier pour {$libelles[$type]} dépasse 2 Mo.";
            $messages["$type.uploaded"] = "Le téléversement de {$libelles[$type]} a échoué (fichier trop lourd ?).";
        }

        $data = $request->validate($rules, $messages);

        $storedPaths = [];

        try {
            $photoPath = $request->file('photo')->store('photos');
            $storedPaths[] = $photoPath;

            $user = DB::transaction(function () use ($request, $data, $photoPath, &$storedPaths) {
                $user = User::create([
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'password' => Hash::make($data['password']),
                    'role' => 'medecin', // jamais fourni par le client
                    'telephone' => $data['telephone'],
                    'photo' => $photoPath,
                ]);

                // Le compte démarre toujours en attente de validation par l'administrateur
                $medecin = Medecin::create([
                    'user_id' => $user->id,
                    'specialite_id' => $data['specialite_id'],
                    'numero_ordre' => $data['numero_ordre'],
                    'tarif_consultation' => $data['tarif_consultation'],
                    'biographie' => $data['biographie'] ?? null,
                    'statut_validation' => Medecin::PENDING,
                ]);

                foreach (self::JUSTIFICATIFS as $type) {
                    $fichier = $request->file($type);
                    // Disque privé : les justificatifs ne sont pas accessibles par URL publique
                    $chemin = $fichier->store("justificatifs/{$medecin->id}");
                    $storedPaths[] = $chemin;

                    $medecin->justificatifs()->create([
                        'type' => $type,
                        'chemin' => $chemin,
                        'nom_original' => $fichier->getClientOriginalName(),
                        'mime' => $fichier->getClientMimeType(),
                    ]);
                }

                return $user;
            });
        } catch (\Throwable $e) {
            // Annulation : on supprime les fichiers déjà enregistrés
            foreach ($storedPaths as $chemin) {
                Storage::delete($chemin);
            }
            throw $e;
        }

        // Pas de token : le médecin ne peut pas utiliser la plateforme avant validation
        return response()->json([
            'message' => "Demande d'inscription envoyée. Votre compte est en attente de validation par l'administrateur.",
            'statut_validation' => Medecin::PENDING,
            'user' => $user,
        ], 201);
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ], [
            'email.required' => "L'adresse email est obligatoire.",
            'email.email' => "L'adresse email n'est pas valide.",
            'password.required' => 'Le mot de passe est obligatoire.',
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            return response()->json(['message' => 'Email ou mot de passe incorrect.'], 401);
        }

        if (!$user->actif) {
            return response()->json([
                'message' => "Ce compte a été désactivé. Contactez l'administrateur de la clinique.",
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Connexion réussie',
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->withProfile($user),
        ]);
    }

    // Profil de l'utilisateur connecté (avec le statut de validation pour un médecin)
    public function me(Request $request)
    {
        return response()->json($this->withProfile($request->user()));
    }

    private function withProfile(User $user): User
    {
        if ($user->role === 'medecin') {
            $user->load('medecin.specialite');
        }

        return $user;
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnexion réussie']);
    }
}
