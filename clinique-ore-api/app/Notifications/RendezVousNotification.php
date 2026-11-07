<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

// Notification enregistrée en base : affichée dans l'espace du patient
class RendezVousNotification extends Notification
{
    public function __construct(
        public string $evenement,
        public string $titre,
        public string $message,
        public ?int $rendezVousId = null,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'evenement' => $this->evenement,
            'titre' => $this->titre,
            'message' => $this->message,
            'rendez_vous_id' => $this->rendezVousId,
        ];
    }
}
