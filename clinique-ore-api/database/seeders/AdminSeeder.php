<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    /**
     * Crée le compte administrateur (jamais possible via l'inscription publique).
     * Identifiants configurables dans .env : ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME
     */
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@clinique-ore.sn')],
            [
                'name' => env('ADMIN_NAME', 'Administrateur'),
                'password' => Hash::make(env('ADMIN_PASSWORD', 'ChangeMe@2026')),
                'role' => 'admin',
            ]
        );
    }
}
