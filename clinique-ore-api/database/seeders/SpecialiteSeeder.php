<?php

namespace Database\Seeders;

use App\Models\Specialite;
use Illuminate\Database\Seeder;

class SpecialiteSeeder extends Seeder
{
    public function run(): void
    {
        $specialites = [
            'Médecine générale',
            'Pédiatrie',
            'Gynécologie-obstétrique',
            'Cardiologie',
            'Dermatologie',
            'Ophtalmologie',
            'ORL',
            'Chirurgie générale',
            'Dentisterie',
            'Psychiatrie',
        ];

        foreach ($specialites as $nom) {
            Specialite::firstOrCreate(['nom' => $nom]);
        }
    }
}
