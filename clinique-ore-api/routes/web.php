<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Évite l'erreur "Route [login] not defined" quand un visiteur non authentifié
// appelle une URL protégée sans l'en-tête Accept: application/json
Route::get('/login', function () {
    return response()->json(['message' => 'Non authentifié.'], 401);
})->name('login');
