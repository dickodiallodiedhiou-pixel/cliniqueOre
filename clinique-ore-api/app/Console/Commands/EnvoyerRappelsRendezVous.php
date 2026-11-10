<?php

namespace App\Console\Commands;

use App\Models\Medecin;
use App\Models\RendezVous;
use App\Services\NotificationRendezVous;
use Illuminate\Console\Command;

class EnvoyerRappelsRendezVous extends Command
{
    protected $signature = 'rappels:rendez-vous {--agenda : Envoie l\'agenda du jour aux médecins (au lieu des rappels aux patients)}';

    protected $description = 'Envoie les rappels de rendez-vous (patients) ou l\'agenda du jour (médecins)';

    public function handle(NotificationRendezVous $notifications): int
    {
        return $this->option('agenda') ? $this->agenda($notifications) : $this->rappels($notifications);
    }

    // Patients : rendez-vous confirmé qui a lieu dans les prochaines heures et dont le rappel n'est pas encore parti
    private function rappels(NotificationRendezVous $notifications): int
    {
        $maintenant = now();
        $limite = $maintenant->copy()->addHours(config('clinique.rappel_heures_avant'));

        $rdvs = RendezVous::with(['patient.user', 'medecin.user'])
            ->where('statut', 'confirme')
            ->whereNull('rappel_envoye_le')
            ->where('date_heure', '>', $maintenant)
            ->where('date_heure', '<=', $limite)
            ->get();

        foreach ($rdvs as $rdv) {
            $notifications->rappelerPatient($rdv);
            $rdv->update(['rappel_envoye_le' => $maintenant]);
        }

        $this->info($rdvs->count() . ' rappel(s) envoyé(s).');

        return self::SUCCESS;
    }

    // Médecins : un message par jour, uniquement s'ils ont des rendez-vous aujourd'hui
    private function agenda(NotificationRendezVous $notifications): int
    {
        $envoyes = 0;

        foreach (Medecin::approuves()->with('user')->get() as $medecin) {
            $rdvs = RendezVous::where('medecin_id', $medecin->id)
                ->whereDate('date_heure', today())
                ->whereIn('statut', ['en_attente', 'confirme'])
                ->orderBy('date_heure')
                ->get();

            if ($rdvs->isEmpty()) {
                continue;
            }

            $dejaEnvoye = $medecin->user->notifications()
                ->where('data', 'like', '%"evenement":"agenda"%')
                ->whereDate('created_at', today())
                ->exists();

            if ($dejaEnvoye) {
                continue;
            }

            $notifications->agendaMedecin($medecin->user, $rdvs->count(), substr((string) $rdvs->first()->date_heure, 11, 5));
            $envoyes++;
        }

        $this->info($envoyes . ' agenda(s) envoyé(s).');

        return self::SUCCESS;
    }
}
