<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AdminActiviteController;
use App\Http\Controllers\Api\AdminMedecinController;
use App\Http\Controllers\Api\AdminPatientController;
use App\Http\Controllers\Api\AdminRendezVousController;
use App\Http\Controllers\Api\AdminSpecialiteController;
use App\Http\Controllers\Api\TableauDeBordController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DisponibiliteController;
use App\Http\Controllers\Api\EspaceMedecinController;
use App\Http\Controllers\Api\IndisponibiliteController;
use App\Http\Controllers\Api\EspacePatientController;
use App\Http\Controllers\Api\MedecinController;
use App\Http\Controllers\Api\MotDePasseController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PhotoController;
use App\Http\Controllers\Api\ProfilController;
use App\Http\Controllers\Api\RendezVousController;
use App\Http\Controllers\Api\SpecialiteController;

// ---------- Routes publiques ----------
Route::post('/register', [AuthController::class, 'registerPatient']);
Route::post('/register/medecin', [AuthController::class, 'registerMedecin']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/mot-de-passe/oublie', [MotDePasseController::class, 'oublie'])->middleware('throttle:5,1');
Route::post('/mot-de-passe/reinitialiser', [MotDePasseController::class, 'reinitialiser'])->middleware('throttle:10,1');
Route::get('/specialites', [SpecialiteController::class, 'index']);
Route::get('/photos/{fichier}', [PhotoController::class, 'show'])
    ->where('fichier', '[A-Za-z0-9]{20,64}\.(?:jpg|jpeg|png|webp)');

// Annuaire : uniquement les médecins vérifiés (statut approved)
Route::get('/medecins', [MedecinController::class, 'index']);
Route::get('/medecins/{id}', [MedecinController::class, 'show'])->whereNumber('id');
Route::get('/medecins/{id}/creneaux', [MedecinController::class, 'creneaux'])->whereNumber('id');

// ---------- Routes authentifiées (Sanctum) ----------
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me/mot-de-passe', [ProfilController::class, 'motDePasse']);
    Route::post('/me', [ProfilController::class, 'update']);

    // Notifications de l'utilisateur connecté
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/non-lues', [NotificationController::class, 'nonLues']);
    Route::post('/notifications/tout-lire', [NotificationController::class, 'toutLire']);
    Route::post('/notifications/{id}/lire', [NotificationController::class, 'lire'])->whereUuid('id'); // POST car la requête contient une photo (multipart)

    // Liste des rendez-vous : le contenu dépend du rôle (contrôlé dans le contrôleur)
    Route::get('/rendez-vous', [RendezVousController::class, 'index']);

    // Patients uniquement
    Route::middleware('role:patient')->group(function () {
        Route::post('/rendez-vous', [RendezVousController::class, 'store']);
        Route::patch('/rendez-vous/{rendezVous}', [RendezVousController::class, 'modifier']);
        Route::post('/rendez-vous/{rendezVous}/annuler', [RendezVousController::class, 'annuler']);
        Route::get('/historique', [RendezVousController::class, 'historiquePatient']);
        Route::get('/patient/tableau-de-bord', [EspacePatientController::class, 'tableauDeBord']);
        Route::get('/patient/rendez-vous', [EspacePatientController::class, 'rendezVous']);
    });

    // Médecins APPROUVÉS uniquement : accepter / refuser / terminer un rendez-vous
    Route::middleware('medecin.approuve')->group(function () {
        Route::patch('/rendez-vous/{rendezVous}/statut', [RendezVousController::class, 'updateStatut']);
        Route::patch('/rendez-vous/{rendezVous}/notes', [RendezVousController::class, 'modifierNotes']);
        Route::get('/medecin/historique', [RendezVousController::class, 'historiqueMedecin']);
        Route::get('/medecin/disponibilites', [DisponibiliteController::class, 'index']);
        Route::put('/medecin/disponibilites', [DisponibiliteController::class, 'update']);

        // Espace médecin : tableau de bord, rendez-vous, fiche patient, planning, congés
        Route::get('/medecin/tableau-de-bord', [EspaceMedecinController::class, 'tableauDeBord']);
        Route::get('/medecin/rendez-vous', [EspaceMedecinController::class, 'rendezVous']);
        Route::get('/medecin/patients/{patient}', [EspaceMedecinController::class, 'patient']);
        Route::get('/medecin/planning', [EspaceMedecinController::class, 'planning']);
        Route::get('/medecin/indisponibilites', [IndisponibiliteController::class, 'index']);
        Route::post('/medecin/indisponibilites', [IndisponibiliteController::class, 'store']);
        Route::delete('/medecin/indisponibilites/{id}', [IndisponibiliteController::class, 'destroy'])->whereNumber('id');
    });

    // Administrateur uniquement
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/tableau-de-bord', [TableauDeBordController::class, 'index']);

        // Médecins : liste, ajout, modification, activation, validation des justificatifs
        Route::get('/medecins', [AdminMedecinController::class, 'index']);
        Route::post('/medecins', [AdminMedecinController::class, 'store']);
        Route::get('/medecins/{medecin}', [AdminMedecinController::class, 'show']);
        Route::post('/medecins/{medecin}/modifier', [AdminMedecinController::class, 'update']);
        Route::post('/medecins/{medecin}/actif', [AdminMedecinController::class, 'basculerActif']);
        Route::get('/medecins/{medecin}/justificatifs/{justificatif}', [AdminMedecinController::class, 'justificatif']);
        Route::post('/medecins/{medecin}/approuver', [AdminMedecinController::class, 'approuver']);
        Route::post('/medecins/{medecin}/rejeter', [AdminMedecinController::class, 'rejeter']);

        // Patients : consultation et activation
        Route::get('/patients', [AdminPatientController::class, 'index']);
        Route::get('/patients/{patient}', [AdminPatientController::class, 'show']);
        Route::post('/patients/{patient}/actif', [AdminPatientController::class, 'basculerActif']);

        // Spécialités : référentiel de la clinique
        Route::get('/specialites', [AdminSpecialiteController::class, 'index']);
        Route::post('/specialites', [AdminSpecialiteController::class, 'store']);
        Route::put('/specialites/{specialite}', [AdminSpecialiteController::class, 'update']);
        Route::post('/specialites/{specialite}/actif', [AdminSpecialiteController::class, 'basculerActif']);

        // Supervision des rendez-vous
        Route::get('/rendez-vous', [AdminRendezVousController::class, 'index']);
        Route::get('/rendez-vous/conflits', [AdminRendezVousController::class, 'conflits']);
        Route::patch('/rendez-vous/{rendezVous}', [AdminRendezVousController::class, 'update']);

        // Journal d'activité
        Route::get('/journal', [AdminActiviteController::class, 'index']);
    });
});
