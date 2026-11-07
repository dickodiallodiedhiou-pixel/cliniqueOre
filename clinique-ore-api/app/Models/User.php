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
        'nom',
        'prenom',
        'adresse',
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

    // « name » reste le nom complet (affichage et recherche) : il est recalculé à partir du prénom et du nom
    protected static function booted(): void
    {
        static::saving(function (User $user) {
            if ($user->isDirty('nom') || $user->isDirty('prenom')) {
                $complet = trim(trim((string) $user->prenom) . ' ' . trim((string) $user->nom));
                if ($complet !== '') {
                    $user->name = $complet;
                }
            } elseif ($user->isDirty('name')) {
                [$prenom, $nom] = self::separerNomComplet((string) $user->name);
                $user->prenom = $prenom;
                $user->nom = $nom;
            }
        });
    }

    // « Awa Diop » => ['Awa', 'Diop'] ; un seul mot => [null, mot]
    public static function separerNomComplet(string $nomComplet): array
    {
        $parts = preg_split('/\s+/', trim($nomComplet), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if (count($parts) === 0) {
            return [null, null];
        }
        if (count($parts) === 1) {
            return [null, $parts[0]];
        }

        return [array_shift($parts), implode(' ', $parts)];
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
