<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activite;
use App\Models\Specialite;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSpecialiteController extends Controller
{
    // Toutes les spécialités (actives ou non) avec le nombre de médecins
    public function index()
    {
        return response()->json(Specialite::withCount('medecins')->orderBy('nom')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nom' => 'required|string|max:100|unique:specialites,nom',
            'description' => 'nullable|string|max:500',
        ], $this->messages());

        $specialite = Specialite::create($data + ['actif' => true]);

        Activite::enregistrer($request->user(), 'specialite_creee', 'specialite', $specialite->id, ['nom' => $specialite->nom]);

        return response()->json([
            'message' => 'Spécialité ajoutée.',
            'specialite' => $specialite->loadCount('medecins'),
        ], 201);
    }

    public function update(Request $request, Specialite $specialite)
    {
        $data = $request->validate([
            'nom' => ['required', 'string', 'max:100', Rule::unique('specialites', 'nom')->ignore($specialite->id)],
            'description' => 'nullable|string|max:500',
        ], $this->messages());

        $specialite->update($data);

        Activite::enregistrer($request->user(), 'specialite_modifiee', 'specialite', $specialite->id, ['nom' => $specialite->nom]);

        return response()->json([
            'message' => 'Spécialité mise à jour.',
            'specialite' => $specialite->loadCount('medecins'),
        ]);
    }

    // Désactiver = ne plus la proposer (aucune suppression : les médecins existants gardent leur spécialité)
    public function basculerActif(Request $request, Specialite $specialite)
    {
        $data = $request->validate(['actif' => 'required|boolean']);
        $specialite->update(['actif' => (bool) $data['actif']]);

        Activite::enregistrer(
            $request->user(),
            $specialite->actif ? 'specialite_activee' : 'specialite_desactivee',
            'specialite',
            $specialite->id,
            ['nom' => $specialite->nom]
        );

        return response()->json([
            'message' => $specialite->actif ? 'Spécialité activée.' : 'Spécialité désactivée : elle n\'est plus proposée.',
            'specialite' => $specialite->loadCount('medecins'),
        ]);
    }

    private function messages(): array
    {
        return [
            'nom.required' => 'Le nom de la spécialité est obligatoire.',
            'nom.unique' => 'Cette spécialité existe déjà.',
            'nom.max' => 'Le nom est trop long (100 caractères maximum).',
        ];
    }
}
