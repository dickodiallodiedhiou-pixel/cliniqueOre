<?php

namespace App\Services;

use App\Models\Medecin;
use App\Models\RendezVous;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Calcule les créneaux d'un médecin à partir de ses disponibilités hebdomadaires,
 * en retirant les créneaux passés, déjà pris ou couverts par un congé / une indisponibilité.
 */
class CreneauService
{
    public const HORIZON_JOURS = 14;

    /**
     * Créneaux réservables.
     *
     * @return array<string, string[]> ex : ['2026-10-26' => ['09:00', '09:30'], ...] (jours sans créneau omis)
     */
    public function creneauxParJour(Medecin $medecin, int $jours = self::HORIZON_JOURS): array
    {
        $dispos = $this->disponibilites($medecin);

        if ($dispos->isEmpty()) {
            return [];
        }

        $maintenant = now();
        $debut = $maintenant->copy()->startOfDay();
        $fin = $debut->copy()->addDays($jours)->endOfDay();

        $pris = array_flip($this->heuresPrises($medecin, $debut, $fin));
        $indispos = $this->indisponibilites($medecin, $debut, $fin);

        $resultat = [];

        for ($i = 0; $i <= $jours; $i++) {
            $jour = $debut->copy()->addDays($i);
            $plages = $dispos->get($jour->dayOfWeekIso);

            if (!$plages) {
                continue;
            }

            $libres = [];

            foreach ($this->creneauxDuJour($jour, $plages) as $c) {
                if (
                    $c['debut']->gt($maintenant)
                    && !isset($pris[$c['debut']->format('Y-m-d H:i')])
                    && !$this->estBloque($c['debut'], $c['fin'], $indispos)
                ) {
                    $libres[] = $c['debut']->format('H:i');
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

    /**
     * Planning détaillé d'une semaine (7 jours à partir du lundi donné).
     * Chaque créneau a un état : libre, reserve, bloque (congé) ou passe.
     */
    public function planningSemaine(Medecin $medecin, Carbon $lundi): array
    {
        $debut = $lundi->copy()->startOfDay();
        $fin = $debut->copy()->addDays(6)->endOfDay();
        $maintenant = now();

        $dispos = $this->disponibilites($medecin);
        $indispos = $this->indisponibilites($medecin, $debut, $fin);

        $rdvs = RendezVous::with('patient.user:id,name')
            ->where('medecin_id', $medecin->id)
            ->whereIn('statut', ['en_attente', 'confirme', 'termine'])
            ->whereBetween('date_heure', [$debut, $fin])
            ->orderBy('date_heure')
            ->get();

        $parHeure = $rdvs->keyBy(fn ($r) => Carbon::parse($r->date_heure)->format('Y-m-d H:i'));

        $jours = [];

        for ($i = 0; $i < 7; $i++) {
            $jour = $debut->copy()->addDays($i);
            $plages = $dispos->get($jour->dayOfWeekIso);
            $creneaux = [];
            $utilises = [];

            if ($plages) {
                foreach ($this->creneauxDuJour($jour, $plages) as $c) {
                    $cle = $c['debut']->format('Y-m-d H:i');
                    $rdv = $parHeure->get($cle);

                    if ($rdv) {
                        $etat = 'reserve';
                        $utilises[$cle] = true;
                    } elseif ($this->estBloque($c['debut'], $c['fin'], $indispos)) {
                        $etat = 'bloque';
                    } elseif ($c['debut']->lte($maintenant)) {
                        $etat = 'passe';
                    } else {
                        $etat = 'libre';
                    }

                    $creneaux[] = [
                        'heure' => $c['debut']->format('H:i'),
                        'fin' => $c['fin']->format('H:i'),
                        'etat' => $etat,
                        'rdv' => $rdv ? $this->infoRdv($rdv) : null,
                    ];
                }
            }

            // Rendez-vous placés en dehors des créneaux actuels (ex. horaires modifiés depuis)
            $horsPlage = $rdvs
                ->filter(fn ($r) => Carbon::parse($r->date_heure)->isSameDay($jour)
                    && !isset($utilises[Carbon::parse($r->date_heure)->format('Y-m-d H:i')]))
                ->map(fn ($r) => $this->infoRdv($r) + ['heure' => Carbon::parse($r->date_heure)->format('H:i')])
                ->values()
                ->all();

            $jours[] = [
                'date' => $jour->format('Y-m-d'),
                'travaille' => (bool) $plages,
                'creneaux' => $creneaux,
                'hors_plage' => $horsPlage,
                'indisponibilites' => $this->indisponibilitesDuJour($jour, $indispos),
            ];
        }

        return [
            'debut' => $debut->format('Y-m-d'),
            'fin' => $fin->format('Y-m-d'),
            'jours' => $jours,
        ];
    }

    // ---------- outils ----------

    private function disponibilites(Medecin $medecin): Collection
    {
        return $medecin->disponibilitesActives()->orderBy('jour')->orderBy('heure_debut')->get()->groupBy('jour');
    }

    private function heuresPrises(Medecin $medecin, Carbon $debut, Carbon $fin): array
    {
        return RendezVous::where('medecin_id', $medecin->id)
            ->whereNotIn('statut', ['annule', 'refuse'])
            ->whereBetween('date_heure', [$debut, $fin])
            ->pluck('date_heure')
            ->map(fn ($d) => Carbon::parse($d)->format('Y-m-d H:i'))
            ->all();
    }

    private function indisponibilites(Medecin $medecin, Carbon $debut, Carbon $fin): Collection
    {
        return $medecin->indisponibilites()
            ->where('date_fin', '>=', $debut->format('Y-m-d'))
            ->where('date_debut', '<=', $fin->format('Y-m-d'))
            ->get();
    }

    // Découpe les plages d'un jour en créneaux
    private function creneauxDuJour(Carbon $jour, $plages): array
    {
        $resultat = [];

        foreach ($plages as $plage) {
            $courant = Carbon::parse($jour->format('Y-m-d') . ' ' . $plage->heure_debut);
            $finPlage = Carbon::parse($jour->format('Y-m-d') . ' ' . $plage->heure_fin);
            $duree = max(5, (int) $plage->duree);

            while ($courant->copy()->addMinutes($duree)->lte($finPlage)) {
                $resultat[] = ['debut' => $courant->copy(), 'fin' => $courant->copy()->addMinutes($duree)];
                $courant->addMinutes($duree);
            }
        }

        return $resultat;
    }

    // Le créneau (de son début à sa fin) chevauche-t-il un congé ou une indisponibilité ?
    private function estBloque(Carbon $debut, Carbon $fin, Collection $indispos): bool
    {
        $jour = $debut->format('Y-m-d');

        foreach ($indispos as $i) {
            if (!$this->couvreLeJour($i, $jour)) {
                continue;
            }
            if (!$i->heure_debut || !$i->heure_fin) {
                return true; // journée entière
            }
            $bloqueDebut = Carbon::parse($jour . ' ' . $i->heure_debut);
            $bloqueFin = Carbon::parse($jour . ' ' . $i->heure_fin);
            if ($debut->lt($bloqueFin) && $fin->gt($bloqueDebut)) {
                return true;
            }
        }

        return false;
    }

    private function couvreLeJour($indispo, string $jour): bool
    {
        return $jour >= Carbon::parse($indispo->date_debut)->format('Y-m-d')
            && $jour <= Carbon::parse($indispo->date_fin)->format('Y-m-d');
    }

    private function indisponibilitesDuJour(Carbon $jour, Collection $indispos): array
    {
        return $indispos
            ->filter(fn ($i) => $this->couvreLeJour($i, $jour->format('Y-m-d')))
            ->map(fn ($i) => [
                'id' => $i->id,
                'motif' => $i->motif,
                'journee_entiere' => !$i->heure_debut || !$i->heure_fin,
                'heure_debut' => $i->heure_debut ? substr($i->heure_debut, 0, 5) : null,
                'heure_fin' => $i->heure_fin ? substr($i->heure_fin, 0, 5) : null,
            ])
            ->values()
            ->all();
    }

    private function infoRdv(RendezVous $r): array
    {
        return [
            'id' => $r->id,
            'statut' => $r->statut,
            'patient' => $r->patient?->user?->name,
            'patient_id' => $r->patient_id,
            'motif' => $r->motif,
        ];
    }
}
