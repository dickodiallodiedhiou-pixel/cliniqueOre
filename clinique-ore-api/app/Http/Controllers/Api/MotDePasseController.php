<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class MotDePasseController extends Controller
{
    // Demande de lien de réinitialisation. La réponse est identique que le compte existe ou non.
    public function oublie(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
        ], [
            'email.required' => "L'adresse email est obligatoire.",
            'email.email' => "L'adresse email n'est pas valide.",
        ]);

        $user = User::where('email', $data['email'])->first();
        $lien = null;

        if ($user && $user->actif) {
            $token = Password::createToken($user);
            $lien = rtrim(env('FRONTEND_URL', 'http://localhost:4200'), '/')
                . '/reinitialiser-mot-de-passe?token=' . $token . '&email=' . urlencode($user->email);

            // Le lien envoyé par email pointe vers l'application Angular
            ResetPassword::createUrlUsing(fn ($notifiable, string $jeton) => $lien);

            try {
                $user->sendPasswordResetNotification($token);
            } catch (\Throwable $e) {
                report($e); // serveur d'envoi indisponible : on ne révèle rien à l'appelant
            }
        }

        $reponse = ['message' => "Si un compte correspond à cette adresse, un lien de réinitialisation vient d'être envoyé."];

        // Mode démonstration : sans serveur d'envoi réel (MAIL_MAILER=log) et en mode debug,
        // le lien est aussi renvoyé pour pouvoir tester sans boîte mail.
        if ($lien && config('app.debug') && config('mail.default') === 'log') {
            $reponse['lien_demo'] = $lien;
        }

        return response()->json($reponse);
    }

    public function reinitialiser(Request $request)
    {
        $data = $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ], [
            'password.required' => 'Le mot de passe est obligatoire.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'La confirmation du mot de passe ne correspond pas.',
        ]);

        $statut = Password::reset(
            ['email' => $data['email'], 'password' => $data['password'], 'token' => $data['token']],
            function (User $user, string $motDePasse) {
                $user->forceFill([
                    'password' => Hash::make($motDePasse),
                    'remember_token' => Str::random(60),
                ])->save();

                $user->tokens()->delete(); // toutes les sessions ouvertes sont coupées
                event(new PasswordReset($user));
            }
        );

        if ($statut !== Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Ce lien est invalide ou a expiré. Faites une nouvelle demande.'], 422);
        }

        return response()->json(['message' => 'Mot de passe modifié. Vous pouvez maintenant vous connecter.']);
    }
}
