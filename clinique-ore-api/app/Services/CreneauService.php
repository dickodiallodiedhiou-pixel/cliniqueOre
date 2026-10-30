<?php

namespace App\Services;

use App\Models\Medecin;
use App\Models\RendezVous;
use Carbon\Carbon;

/**
 * Calcule les créneaux réservables d'un médecin à partir de ses disponibilités
 * hebdomadaires, en retirant les créneaux passés et ceux déjà pris.
 */
class CreneauService
{
    public const HORIZON_JOURS = 14;

    /**
     * @return array<string, string[]> ex : ['2026-10-26' => ['09:00', '09:30'], ...] (jours sans créneau omis)
     */
    public function creneauxParJour(Medecin $medecin, int $jours = self::HORIZON_JOURS): array
    {
        $dispos = $medecin->disponibilites()
            ->orderBy('jour')
            ->orderBy('heure_debut')
            ->get()
            ->groupBy('jour');

        if ($dispos->isEmpty()) {
            return [];
        }

        $maintenant = now();
        $debut = $maintenant->copy()->startOfDay();
        $fin = $debut->copy()->addDays($jours)->endOfDay();

        // Créneaux déjà occupés (les rendez-vous annulés libèrent le créneau)
        $pris = RendezVous::where('medecin_id', $medecin->id)
            ->where('statut', '!=', 'annule')
            ->whereBetween('date_heure', [$debut, $fin])
            ->pluck('date_heure')
            ->map(fn ($d) => Carbon::parse($d)->format('Y-m-d H:i'))
            ->all();
        $pris = array_flip($pris);

        $resultat = [];

        for ($i = 0; $i <= $jours; $i++) {
            $jour = $debut->copy()->addDays($i);
            $plages = $dispos->get($jour->dayOfWeekIso);

            if (!$plages) {
                continue;
            }

            $libres = [];

            foreach ($plages as $plage) {
                $courant = Carbon::parse($jour->format('Y-m-d') . ' ' . $plage->heure_debut);
                $finPlage = Carbon::parse($jour->format('Y-m-d') . ' ' . $plage->heure_fin);
                $duree = max(5, (int) $plage->duree);

                while ($courant->copy()->addMinutes($duree)->lte($finPlage)) {
                    if ($courant->gt($maintenant) && !isset($pris[$courant->format('Y-m-d H:i')])) {
                        $libres[] = $courant->format('H:i');
                    }
                    $courant->addMinutes($duree);
                }
            }

            if ($libres) {
                $libres = array_values(array_unique($libres));
                sort($libres);
                $resultat[$jour->format('Y-m-d')] = $libres;
            }
        }

        return $resultat;
    }

    // Le créneau demandé est-il bien proposé par le médecin et encore libre ?
    public function estLibre(Medecin $medecin, Carbon $dateHeure): bool
    {
        $libres = $this->creneauxParJour($medecin)[$dateHeure->format('Y-m-d')] ?? [];

        return in_array($dateHeure->format('H:i'), $libres, true);
    }
}
