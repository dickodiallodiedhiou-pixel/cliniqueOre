<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Medecin extends Model
{
    use HasFactory;

    public const PENDING = 'pending';
    public const APPROVED = 'approved';
    public const REJECTED = 'rejected';

    protected $table = 'medecins';

    protected $fillable = [
        'user_id',
        'specialite_id',
        'tarif_consultation',
        'jours_travail',
        'heure_debut',
        'heure_fin',
        'numero_ordre',
        'biographie',
        'statut_validation',
        'motif_rejet',
        'valide_le',
        'valide_par',
    ];

    protected function casts(): array
    {
        return [
            'valide_le' => 'datetime',
        ];
    }

    // Lien vers les informations de base de l'utilisateur
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Lien vers la spécialité du médecin
    public function specialite()
    {
        return $this->belongsTo(Specialite::class);
    }

    // Un médecin a plusieurs rendez-vous
    public function rendezVous()
    {
        return $this->hasMany(RendezVous::class);
    }

    // Plages de disponibilité hebdomadaires (génèrent les créneaux réservables)
    public function disponibilites()
    {
        return $this->hasMany(Disponibilite::class);
    }

    // Pièces justificatives fournies à l'inscription
    public function justificatifs()
    {
        return $this->hasMany(Justificatif::class);
    }

    public function estApprouve(): bool
    {
        return $this->statut_validation === self::APPROVED && ($this->user->actif ?? true);
    }

    // Médecins vérifiés : seuls eux apparaîtront dans l'annuaire
    public function scopeApprouves($query)
    {
        return $query->where('statut_validation', self::APPROVED)
            ->whereHas('user', fn ($u) => $u->where('actif', true));
    }
}
