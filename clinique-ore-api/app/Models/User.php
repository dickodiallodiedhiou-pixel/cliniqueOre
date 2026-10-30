<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'telephone',
        'photo',
        'actif',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'photo', // chemin interne : on n'expose que photo_url
    ];

    // Ajouté automatiquement à chaque réponse JSON
    protected $appends = ['photo_url'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'actif' => 'boolean',
        ];
    }

    // URL publique de la photo de profil (servie par PhotoController), null si aucune
    public function getPhotoUrlAttribute(): ?string
    {
        $photo = $this->attributes['photo'] ?? null;

        return $photo ? url('/api/photos/' . basename($photo)) : null;
    }

    // Un utilisateur peut avoir un profil médecin (si role == 'medecin')
    public function medecin()
    {
        return $this->hasOne(Medecin::class);
    }

    // Un utilisateur peut avoir un profil patient (si role == 'patient')
    public function patient()
    {
        return $this->hasOne(Patient::class);
    }
}
