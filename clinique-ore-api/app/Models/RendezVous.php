<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RendezVous extends Model
{
    use HasFactory;

    protected $table = 'rendez_vous';

    protected $fillable = [
        'patient_id',
        'medecin_id',
        'date_heure',
        'statut',
        'motif',
        'notes_medecin',
    ];

    // Un rendez-vous concerne un patient
    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    // Un rendez-vous est assigné à un médecin
    public function medecin()
    {
        return $this->belongsTo(Medecin::class);
    }
}