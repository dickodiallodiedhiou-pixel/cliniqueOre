<?php

return [

    // Règle de la clinique : délai minimum (en heures) avant le rendez-vous
    // pour qu'un patient puisse le modifier ou l'annuler lui-même.
    'delai_modification_heures' => (int) env('DELAI_MODIFICATION_HEURES', 24),

];
