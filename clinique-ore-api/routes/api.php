<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AdminMedecinController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MedecinController;
use App\Http\Controllers\Api\RendezVousController;
use App\Http\Controllers\Api\SpecialiteController;

// ---------- Routes publiques ----------
Route::post('/register', [AuthController::class, 'registerPatient']);
Route::post('/register/medecin', [AuthController::class, 'registerMedecin']);
Route::post('/login', [AuthController::class, 'login']);
Route::get('/specialites', [SpecialiteController::class, 'index']);

// Annuaire : uniquement les médecins vérifiés (statut approved)
Route::get('/medecins', [MedecinController::class, 'index']);
Route::get('/medecins/{id}', [MedecinController::class, 'show'])->whereNumber('id');

// ---------- Routes authentifiées (Sanctum) ----------
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Liste des rendez-vous : le contenu dépend du rôle (contrôlé dans le contrôleur)
    Route::get('/rendez-vous', [RendezVousController::class, 'index']);

    // Patients uniquement
    Route::middleware('role:patient')->group(function () {
        Route::post('/rendez-vous', [RendezVousController::class, 'store']);
        Route::post('/rendez-vous/{rendezVous}/annuler', [RendezVousController::class, 'annuler']);
    });

    // Médecins APPROUVÉS uniquement : accepter / refuser / terminer un rendez-vous
    Route::middleware('medecin.approuve')->group(function () {
        Route::patch('/rendez-vous/{rendezVous}/statut', [RendezVousController::class, 'updateStatut']);
    });

    // Administrateur uniquement : validation des comptes médecins
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/medecins', [AdminMedecinController::class, 'index']);
        Route::get('/medecins/{medecin}', [AdminMedecinController::class, 'show']);
        Route::get('/medecins/{medecin}/justificatifs/{justificatif}', [AdminMedecinController::class, 'justificatif']);
        Route::post('/medecins/{medecin}/approuver', [AdminMedecinController::class, 'approuver']);
        Route::post('/medecins/{medecin}/rejeter', [AdminMedecinController::class, 'rejeter']);
    });
});
