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

    // Libellé des spécialités (ex. « Cardiologie, Pédiatrie »), ajouté aux réponses JSON
    protected $appends = ['specialites_libelle'];

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

    // Un médecin a 1..* spécialités (la première est la spécialité principale, mémorisée dans specialite_id)
    public function specialites()
    {
        return $this->belongsToMany(Specialite::class, 'medecin_specialite');
    }

    // Remplace les spécialités du médecin ; la première de la liste devient la principale
    public function definirSpecialites(array $ids): void
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));

        $this->specialites()->sync($ids);
        $this->update(['specialite_id' => $ids[0]]);
        $this->unsetRelation('specialites');
    }

    // Spécialités avec la principale en premier
    public function specialitesOrdonnees()
    {
        return $this->specialites->sortBy(fn ($s) => $s->id === $this->specialite_id ? 0 : 1)->values();
    }

    public function getSpecialitesLibelleAttribute(): ?string
    {
        if ($this->relationLoaded('specialites')) {
            $noms = $this->specialitesOrdonnees()->pluck('nom')->all();

            return $noms ? implode(', ', $noms) : null;
        }

        return $this->relationLoaded('specialite') ? $this->specialite?->nom : null;
    }

    // Lien vers la spécialité principale du médecin
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

    // Seules les plages actives génèrent des créneaux
    public function disponibilitesActives()
    {
        return $this->hasMany(Disponibilite::class)->where('actif', true);
    }

    // Congés et indisponibilités ponctuelles
    public function indisponibilites()
    {
        return $this->hasMany(Indisponibilite::class);
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
