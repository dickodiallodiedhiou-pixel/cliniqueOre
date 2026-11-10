<?php

namespace App\Services;

use App\Models\RendezVous;
use App\Models\User;
use App\Notifications\RendezVousNotification;
use Carbon\Carbon;

class NotificationRendezVous
{
    /**
     * Prévient le patient d'un changement sur son rendez-vous.
     * Événements : confirme, refuse, annule, termine, modifie.
     * Une erreur de notification ne doit jamais empêcher l'action principale.
     */
    public function notifierPatient(RendezVous $rdv, string $evenement, array $options = []): void
    {
        $this->proteger(function () use ($rdv, $evenement, $options) {
            $rdv->loadMissing(['patient.user', 'medecin.user']);

            $quand = $this->quand($rdv);
            $medecin = 'Dr ' . ($rdv->medecin?->user?->name ?? '');

            [$titre, $message] = match ($evenement) {
                'confirme' => ['Rendez-vous confirmé', "{$medecin} a confirmé votre rendez-vous du {$quand}."],
                'refuse' => ['Demande refusée', "{$medecin} ne peut pas accepter votre demande du {$quand}. Vous pouvez choisir un autre créneau."],
                'annule' => ['Rendez-vous annulé', "Votre rendez-vous du {$quand} avec {$medecin} a été annulé."],
                'termine' => ['Consultation terminée', "Votre consultation du {$quand} avec {$medecin} est terminée."
                    . (!empty($options['compte_rendu']) ? ' Le compte rendu est disponible dans votre historique.' : '')],
                'modifie' => ['Rendez-vous modifié', "Votre rendez-vous avec {$medecin} a été modifié par la clinique. Nouvelle date : {$quand}."],
                default => ['Rendez-vous mis à jour', "Votre rendez-vous du {$quand} a été mis à jour."],
            };

            $this->envoyer($rdv->patient?->user, $evenement, $titre, $message, $rdv->id);
        });
    }

    /**
     * Prévient le médecin d'une action du patient.
     * Événements : nouvelle_demande, demande_modifiee, annulation_patient.
     */
    public function notifierMedecin(RendezVous $rdv, string $evenement): void
    {
        $this->proteger(function () use ($rdv, $evenement) {
            $rdv->loadMissing(['patient.user', 'medecin.user']);

            $quand = $this->quand($rdv);
            $patient = $rdv->patient?->user?->name ?? 'Un patient';

            [$titre, $message] = match ($evenement) {
                'nouvelle_demande' => ['Nouvelle demande de rendez-vous', "{$patient} souhaite un rendez-vous le {$quand}. Confirmez ou refusez la demande."],
                'demande_modifiee' => ['Demande modifiée', "{$patient} a modifié sa demande : nouveau créneau le {$quand}. Elle est de nouveau en attente de votre réponse."],
                'annulation_patient' => ['Rendez-vous annulé par le patient', "{$patient} a annulé son rendez-vous du {$quand}."],
                default => ['Rendez-vous', "Mise à jour du rendez-vous du {$quand}."],
            };

            $this->envoyer($rdv->medecin?->user, $evenement, $titre, $message, $rdv->id);
        });
    }

    // Rappel envoyé au patient avant son rendez-vous confirmé
    public function rappelerPatient(RendezVous $rdv): void
    {
        $this->proteger(function () use ($rdv) {
            $rdv->loadMissing(['patient.user', 'medecin.user']);

            $quand = $this->quand($rdv);
            $medecin = 'Dr ' . ($rdv->medecin?->user?->name ?? '');

            $this->envoyer(
                $rdv->patient?->user,
                'rappel',
                'Rappel de rendez-vous',
                "Rappel : vous avez rendez-vous avec {$medecin} le {$quand}. Pensez à vous présenter à l'heure.",
                $rdv->id
            );
        });
    }

    // Agenda du jour envoyé au médecin
    public function agendaMedecin(User $medecin, int $nombre, string $premiereHeure): void
    {
        $this->proteger(function () use ($medecin, $nombre, $premiereHeure) {
            $this->envoyer(
                $medecin,
                'agenda',
                'Votre agenda du jour',
                "Vous avez {$nombre} rendez-vous aujourd'hui, le premier à {$premiereHeure}."
            );
        });
    }

    private function envoyer(?User $destinataire, string $evenement, string $titre, string $message, ?int $rendezVousId = null): void
    {
        if ($destinataire) {
            $destinataire->notify(new RendezVousNotification($evenement, $titre, $message, $rendezVousId));
        }
    }

    private function quand(RendezVous $rdv): string
    {
        return Carbon::parse($rdv->date_heure)->locale('fr')->isoFormat('dddd D MMMM [à] HH:mm');
    }

    // Une erreur de notification (email indisponible...) ne doit jamais empêcher l'action principale
    private function proteger(callable $action): void
    {
        try {
            $action();
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
