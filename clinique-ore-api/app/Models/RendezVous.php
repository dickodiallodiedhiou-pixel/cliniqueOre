<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

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

    // Médecins ayant plusieurs rendez-vous actifs (en attente / confirmés) au même moment
    public static function groupesEnConflit()
    {
        return DB::table('rendez_vous')
            ->select('medecin_id', 'date_heure', DB::raw('count(*) as total'))
            ->whereIn('statut', ['en_attente', 'confirme'])
            ->where('date_heure', '>=', now()->startOfDay())
            ->groupBy('medecin_id', 'date_heure')
            ->havingRaw('count(*) > 1')
            ->get();
    }
}
