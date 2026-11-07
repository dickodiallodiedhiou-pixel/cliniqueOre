<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Indisponibilite extends Model
{
    protected $table = 'indisponibilites';

    protected $fillable = [
        'medecin_id',
        'date_debut',
        'date_fin',
        'heure_debut',
        'heure_fin',
        'motif',
    ];

    public function medecin()
    {
        return $this->belongsTo(Medecin::class);
    }
}
