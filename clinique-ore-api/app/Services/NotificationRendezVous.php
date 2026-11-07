<?php

namespace App\Services;

use App\Models\RendezVous;
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
        try {
            $rdv->loadMissing(['patient.user', 'medecin.user']);

            $utilisateur = $rdv->patient?->user;
            if (!$utilisateur) {
                return;
            }

            $quand = Carbon::parse($rdv->date_heure)->locale('fr')->isoFormat('dddd D MMMM [à] HH:mm');
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

            $utilisateur->notify(new RendezVousNotification($evenement, $titre, $message, $rdv->id));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
