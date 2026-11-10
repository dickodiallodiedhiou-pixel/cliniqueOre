<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

// Notification enregistrée en base (affichée dans l'application) et, si activé, envoyée par email
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
        return config('clinique.rappels_email') && !empty($notifiable->email)
            ? ['database', 'mail']
            : ['database'];
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

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject($this->titre . ' — Clinique Oré')
            ->greeting('Bonjour,')
            ->line($this->message)
            ->action('Ouvrir Clinique Oré', rtrim(env('FRONTEND_URL', 'http://localhost:4200'), '/'))
            ->salutation('La clinique Oré');
    }
}
