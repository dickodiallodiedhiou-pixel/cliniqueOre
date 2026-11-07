<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Disponibilite extends Model
{
    protected $table = 'disponibilites';

    protected $fillable = [
        'medecin_id',
        'jour',
        'heure_debut',
        'heure_fin',
        'duree',
        'actif',
    ];

    protected function casts(): array
    {
        return ['actif' => 'boolean'];
    }

    public function medecin()
    {
        return $this->belongsTo(Medecin::class);
    }
}
