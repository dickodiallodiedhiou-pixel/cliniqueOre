<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
    use HasFactory;

    protected $table = 'patients';

    protected $fillable = [
        'user_id',
        'date_naissance',
        'sexe',
        'groupe_sanguin',
        'antecedents',
    ];

    // Lien vers les informations de base de l'utilisateur
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Un patient a plusieurs rendez-vous
    public function rendezVous()
    {
        return $this->hasMany(RendezVous::class);
    }
}
