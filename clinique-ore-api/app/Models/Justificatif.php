<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Justificatif extends Model
{
    protected $table = 'justificatifs';

    protected $fillable = [
        'medecin_id',
        'type',
        'chemin',
        'nom_original',
        'mime',
    ];

    // Le chemin interne n'est jamais renvoyé dans les réponses JSON
    protected $hidden = ['chemin'];

    public function medecin()
    {
        return $this->belongsTo(Medecin::class);
    }
}
