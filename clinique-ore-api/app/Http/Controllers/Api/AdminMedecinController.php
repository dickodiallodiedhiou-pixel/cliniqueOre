<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\NormaliseLaRequete;
use App\Models\Activite;
use App\Models\Justificatif;
use App\Models\Medecin;
use App\Models\Specialite;
use App\Models\User;
use App\Services\CompteService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class AdminMedecinController extends Controller
{
    use NormaliseLaRequete;

    private const RELATIONS = ['user:id,name,nom,prenom,email,telephone,adresse,photo,actif', 'specialite:id,nom', 'specialites:id,nom', 'justificatifs'];

    // Liste paginée et filtrable : ?statut= &specialite_id= &actif= &q= &page= &per_page=
    public function index(Request $request)
    {
        $statut = $request->query('statut');
        abort_unless(
            !$statut || in_array($statut, [Medecin::PENDING, Medecin::APPROVED, Medecin::REJECTED], true),
            422,
            'Statut invalide.'
        );

        $query = Medecin::with(self::RELATIONS)->withCount('rendezVous');

        if ($statut) {
            $query->where('statut_validation', $statut);
        }
        if ($request->filled('specialite_id')) {
            $id = $request->integer('specialite_id');
            $query->whereHas('specialites', fn ($sp) => $sp->where('specialites.id', $id));
        }
        if ($request->filled('actif')) {
            $actif = filter_var($request->query('actif'), FILTER_VALIDATE_BOOLEAN);
            $query->whereHas('user', fn ($u) => $u->where('actif', $actif));
        }
        if ($request->filled('q')) {
            $mot = '%' . mb_strtolower(trim($request->query('q'))) . '%';
            $query->where(function ($w) use ($mot) {
                $w->whereRaw('LOWER(numero_ordre) LIKE ?', [$mot])
                    ->orWhereHas('user', fn ($u) => $u->whereRaw('LOWER(name) LIKE ?', [$mot])
                        ->orWhereRaw('LOWER(email) LIKE ?', [$mot]));
            });
        }

        $parPage = min(100, max(1, (int) $request->query('per_page', 15)));

        return response()->json($query->orderByDesc('created_at')->orderByDesc('id')->paginate($parPage));
    }

    public function show(Medecin $medecin)
    {
        return response()->json($medecin->load(self::RELATIONS)->loadCount('rendezVous'));
    }

    // Ajout direct d'un médecin par l'administrateur : le compte est créé déjà approuvé
    public function store(Request $request)
    {
        $this->nettoyerTelephone($request);
        $this->normaliserIdentite($request);
        $this->normaliserSpecialites($request);
        $data = $request->validate($this->regles(null), $this->messages());

        $photo = null;

        try {
            $photo = $request->hasFile('photo') ? $request->file('photo')->store('photos') : null;

            $medecin = DB::transaction(function () use ($data, $photo, $request) {
                $user = User::create([
                    'prenom' => $data['prenom'],
                    'nom' => $data['nom'],
                    'adresse' => $data['adresse'] ?? null,
                    'email' => $data['email'],
                    'password' => Hash::make($data['password']),
                    'role' => 'medecin',
                    'telephone' => $data['telephone'],
                    'photo' => $photo,
                    'actif' => true,
                ]);

                $medecin = Medecin::create([
                    'user_id' => $user->id,
                    'specialite_id' => $data['specialite_ids'][0], // spécialité principale
                    'numero_ordre' => $data['numero_ordre'],
                    'tarif_consultation' => $data['tarif_consultation'],
                    'biographie' => $data['biographie'] ?? null,
                    'statut_validation' => Medecin::APPROVED,
                    'valide_le' => now(),
                    'valide_par' => $request->user()->id,
                ]);
                $medecin->definirSpecialites($data['specialite_ids']);

                return $medecin;
            });
        } catch (\Throwable $e) {
            if ($photo) {
                Storage::delete($photo);
            }
            throw $e;
        }

        Activite::enregistrer($request->user(), 'medecin_cree', 'medecin', $medecin->id, ['nom' => trim($data['prenom'] . ' ' . $data['nom'])]);

        return response()->json([
            'message' => 'Médecin ajouté. Son compte est actif et visible dans l\'annuaire.',
            'medecin' => $medecin->load(self::RELATIONS)->loadCount('rendezVous'),
        ], 201);
    }

    // Modification des informations d'un médecin (POST car la requête peut contenir une photo)
    public function update(Request $request, Medecin $medecin)
    {
        $this->nettoyerTelephone($request);
        $this->normaliserIdentite($request);
        $this->normaliserSpecialites($request);
        $data = $request->validate($this->regles($medecin), $this->messages());

        $user = $medecin->user;
        $anciennePhoto = $user->getRawOriginal('photo');
        $nouvellePhoto = null;

        try {
            $nouvellePhoto = $request->hasFile('photo') ? $request->file('photo')->store('photos') : null;

            DB::transaction(function () use ($data, $user, $medecin, $nouvellePhoto, $anciennePhoto) {
                $champsUser = [
                    'prenom' => $data['prenom'],
                    'nom' => $data['nom'],
                    'adresse' => $data['adresse'] ?? null,
                    'email' => $data['email'],
                    'telephone' => $data['telephone'],
                    'photo' => $nouvellePhoto ?? $anciennePhoto,
                ];
                if (!empty($data['password'])) {
                    $champsUser['password'] = Hash::make($data['password']);
                }
                $user->update($champsUser);

                $medecin->update([
                    'numero_ordre' => $data['numero_ordre'],
                    'tarif_consultation' => $data['tarif_consultation'],
                    'biographie' => $data['biographie'] ?? null,
                ]);
                $medecin->definirSpecialites($data['specialite_ids']);
            });
        } catch (\Throwable $e) {
            if ($nouvellePhoto) {
                Storage::delete($nouvellePhoto);
            }
            throw $e;
        }

        if ($nouvellePhoto && $anciennePhoto) {
            Storage::delete($anciennePhoto);
        }
        if (!empty($data['password'])) {
            $user->tokens()->delete(); // le nouveau mot de passe coupe les sessions ouvertes
        }

        Activite::enregistrer($request->user(), 'medecin_modifie', 'medecin', $medecin->id, [
            'nom' => trim($data['prenom'] . ' ' . $data['nom']),
            'mot_de_passe_reinitialise' => !empty($data['password']),
        ]);

        return response()->json([
            'message' => 'Informations du médecin mises à jour.',
            'medecin' => $medecin->fresh()->load(self::RELATIONS)->loadCount('rendezVous'),
        ]);
    }

    // Activer / désactiver le compte
    public function basculerActif(Request $request, Medecin $medecin, CompteService $comptes)
    {
        $data = $request->validate(['actif' => 'required|boolean']);
        $actif = (bool) $data['actif'];

        $comptes->changerActivite($medecin->user, $actif);

        Activite::enregistrer($request->user(), $actif ? 'compte_active' : 'compte_desactive', 'medecin', $medecin->id, [
            'nom' => $medecin->user->name,
        ]);

        return response()->json([
            'message' => $actif ? 'Compte activé.' : 'Compte désactivé : le médecin ne peut plus se connecter.',
            'medecin' => $medecin->fresh()->load(self::RELATIONS)->loadCount('rendezVous'),
        ]);
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

        Activite::enregistrer($request->user(), 'medecin_approuve', 'medecin', $medecin->id, ['nom' => $medecin->user->name]);

        return response()->json([
            'message' => 'Compte médecin approuvé. Il apparaît désormais dans l\'annuaire.',
            'medecin' => $medecin->fresh()->load(self::RELATIONS),
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

        Activite::enregistrer($request->user(), 'medecin_refuse', 'medecin', $medecin->id, [
            'nom' => $medecin->user->name,
            'motif' => $data['motif'],
        ]);

        return response()->json([
            'message' => 'Compte médecin refusé.',
            'medecin' => $medecin->fresh()->load(self::RELATIONS),
        ]);
    }

    private function nettoyerTelephone(Request $request): void
    {
        if (is_string($request->input('telephone'))) {
            $request->merge(['telephone' => preg_replace('/\D/', '', $request->input('telephone'))]);
        }
    }

    private function regles(?Medecin $medecin): array
    {
        $dejaAssociees = $medecin ? $medecin->specialites()->pluck('specialites.id')->all() : [];

        return [
            'prenom' => 'required|string|max:100',
            'nom' => 'required|string|max:100',
            'adresse' => 'nullable|string|max:255',
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($medecin?->user_id)],
            'telephone' => ['required', 'regex:/^(75|76|77|78)[0-9]{7}$/'],
            // création : obligatoire ; modification : facultatif (réinitialisation par l'admin)
            'password' => $medecin ? 'nullable|string|min:8' : 'required|string|min:8',
            // une ou plusieurs spécialités : actives (ou déjà associées au médecin en cas de modification)
            'specialite_ids' => 'required|array|min:1',
            'specialite_ids.*' => [
                'integer',
                function ($attribute, $value, $fail) use ($dejaAssociees) {
                    $valide = Specialite::whereKey($value)->where(function ($q) use ($dejaAssociees) {
                        $q->where('actif', true);
                        if ($dejaAssociees) {
                            $q->orWhereIn('id', $dejaAssociees);
                        }
                    })->exists();

                    if (!$valide) {
                        $fail('Une des spécialités choisies est invalide ou désactivée.');
                    }
                },
            ],
            'numero_ordre' => ['required', 'string', 'max:100', Rule::unique('medecins', 'numero_ordre')->ignore($medecin?->id)],
            'tarif_consultation' => 'required|numeric|min:0',
            'biographie' => 'nullable|string|max:2000',
            'photo' => 'nullable|file|mimes:jpg,jpeg,png,webp|max:2048',
        ];
    }

    private function messages(): array
    {
        return [
            'prenom.required' => 'Le prénom est obligatoire.',
            'nom.required' => 'Le nom est obligatoire.',
            'email.required' => "L'adresse email est obligatoire.",
            'email.email' => "L'adresse email n'est pas valide.",
            'email.unique' => 'Cette adresse email est déjà utilisée.',
            'telephone.required' => 'Le numéro de téléphone est obligatoire.',
            'telephone.regex' => 'Numéro invalide : 9 chiffres, commençant par 77, 78, 76 ou 75.',
            'password.required' => 'Le mot de passe est obligatoire.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'specialite_ids.required' => 'Veuillez choisir au moins une spécialité.',
            'specialite_ids.min' => 'Veuillez choisir au moins une spécialité.',
            'numero_ordre.required' => "Le numéro d'inscription à l'Ordre est obligatoire.",
            'numero_ordre.unique' => "Ce numéro d'inscription est déjà enregistré.",
            'tarif_consultation.required' => 'Le tarif de consultation est obligatoire.',
            'tarif_consultation.numeric' => 'Le tarif de consultation doit être un nombre.',
            'tarif_consultation.min' => 'Le tarif de consultation doit être positif.',
            'photo.mimes' => 'La photo doit être au format JPG, PNG ou WEBP.',
            'photo.max' => 'La photo dépasse 2 Mo.',
            'photo.uploaded' => 'Le téléversement de la photo a échoué (fichier trop lourd ?).',
        ];
    }
}
