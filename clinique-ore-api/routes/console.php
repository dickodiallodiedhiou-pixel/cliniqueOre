<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Rappels automatiques (en développement : php artisan schedule:work ; en production : cron « schedule:run » chaque minute)
Schedule::command('rappels:rendez-vous')->hourly();
Schedule::command('rappels:rendez-vous --agenda')->dailyAt('07:00');
