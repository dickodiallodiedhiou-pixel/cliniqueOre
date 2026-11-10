<?php

return [

    // Règle de la clinique : délai minimum (en heures) avant le rendez-vous
    // pour qu'un patient puisse le modifier ou l'annuler lui-même.
    'delai_modification_heures' => (int) env('DELAI_MODIFICATION_HEURES', 24),

    // Rappel automatique envoyé au patient quand son rendez-vous confirmé a lieu dans moins de N heures.
    'rappel_heures_avant' => (int) env('RAPPEL_HEURES_AVANT', 24),

    // En plus de la notification dans l'application, envoyer aussi un email (nécessite la configuration MAIL_*).
    'rappels_email' => (bool) env('RAPPELS_EMAIL', false),

];
