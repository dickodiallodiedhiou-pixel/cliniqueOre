<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;
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
        'rappel_envoye_le',
    ];

    // Les comptes rendus médicaux ne sont visibles que par le médecin concerné et le patient :
    // masqués par défaut, rendus visibles explicitement dans leurs réponses (makeVisible)
    protected $hidden = ['notes_medecin'];

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

    // Le délai minimum avant le rendez-vous (règle de la clinique) est-il respecté ?
    public function delaiRespecte(): bool
    {
        return Carbon::parse($this->date_heure)->gte(now()->addHours((int) config('clinique.delai_modification_heures')));
    }

    // Le patient peut-il encore modifier ou annuler ce rendez-vous ?
    public function estModifiable(): bool
    {
        return in_array($this->statut, ['en_attente', 'confirme'], true) && $this->delaiRespecte();
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
