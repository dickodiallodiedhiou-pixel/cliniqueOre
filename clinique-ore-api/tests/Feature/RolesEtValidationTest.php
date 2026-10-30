<?php

namespace Tests\Feature;

use App\Models\Activite;
use App\Models\Disponibilite;
use App\Models\Medecin;
use App\Models\Patient;
use App\Models\Specialite;
use App\Models\RendezVous;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RolesEtValidationTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        // le rôle est toujours fourni explicitement (valeur en mémoire fiable)
        return User::factory()->create(['role' => $role]);
    }

    private function medecin(string $statut): Medecin
    {
        $specialite = Specialite::firstOrCreate(['nom' => 'Cardiologie']);

        return Medecin::create([
            'user_id' => $this->user('medecin')->id,
            'specialite_id' => $specialite->id,
            'tarif_consultation' => 5000,
            'numero_ordre' => 'ORD-' . uniqid(),
            'statut_validation' => $statut,
        ]);
    }

    public function test_annuaire_ne_liste_que_les_medecins_approuves(): void
    {
        $this->medecin(Medecin::PENDING);
        $approuve = $this->medecin(Medecin::APPROVED);
        $this->medecin(Medecin::REJECTED);

        $this->getJson('/api/medecins')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $approuve->id);
    }

    public function test_inscription_medecin_cree_un_compte_pending_sans_token(): void
    {
        Storage::fake();
        $specialite = Specialite::create(['nom' => 'Pédiatrie']);

        $reponse = $this->post('/api/register/medecin', [
            'name' => 'Dr Test',
            'email' => 'dr@test.sn',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'telephone' => '77 123 45 67', // espaces tolérés
            'specialite_id' => $specialite->id,
            'numero_ordre' => 'ORD-1',
            'tarif_consultation' => 10000,
            'photo' => UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg'),
            'diplome' => UploadedFile::fake()->create('diplome.pdf', 100, 'application/pdf'),
            'autorisation_exercice' => UploadedFile::fake()->create('autorisation.pdf', 100, 'application/pdf'),
            'piece_identite' => UploadedFile::fake()->create('cni.png', 100, 'image/png'),
        ], ['Accept' => 'application/json']);

        $reponse->assertCreated()
            ->assertJsonPath('statut_validation', 'pending')
            ->assertJsonMissingPath('access_token');

        $this->assertDatabaseHas('medecins', ['numero_ordre' => 'ORD-1', 'statut_validation' => 'pending']);
        $this->assertDatabaseCount('justificatifs', 3);
    }

    public function test_inscription_patient_exige_photo_et_telephone_senegalais(): void
    {
        Storage::fake();
        $base = [
            'name' => 'Awa Diop',
            'email' => 'awa@test.sn',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ];

        // Numéros refusés : trop court, trop long, mauvais préfixe, lettres
        foreach (['77123', '7712345678', '701234567', '12345678a'] as $mauvais) {
            $this->post('/api/register', $base + [
                'telephone' => $mauvais,
                'photo' => UploadedFile::fake()->create('p.jpg', 50, 'image/jpeg'),
            ], ['Accept' => 'application/json'])
                ->assertStatus(422)
                ->assertJsonValidationErrors('telephone');
        }

        // Photo manquante
        $this->post('/api/register', $base + ['telephone' => '781234567'], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('photo');

        // Tous les préfixes autorisés passent
        foreach (['75', '76', '77', '78'] as $i => $prefixe) {
            $this->post('/api/register', array_merge($base, [
                'email' => "awa{$i}@test.sn",
                'telephone' => $prefixe . '1234567',
                'photo' => UploadedFile::fake()->create('p.jpg', 50, 'image/jpeg'),
            ]), ['Accept' => 'application/json'])
                ->assertCreated()
                ->assertJsonPath('user.role', 'patient');
        }

        $this->assertNotNull(User::where('email', 'awa0@test.sn')->first()->photo_url);
    }

    public function test_admin_liste_les_medecins_en_attente(): void
    {
        $this->medecin(Medecin::PENDING);
        $this->medecin(Medecin::APPROVED);
        Sanctum::actingAs($this->user('admin'));

        $this->getJson('/api/admin/medecins?statut=pending')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/medecins?statut=approved')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/medecins')->assertOk()->assertJsonCount(2, 'data'); // tous statuts
    }

    public function test_medecin_en_attente_ne_peut_pas_gerer_les_rendez_vous(): void
    {
        $medecin = $this->medecin(Medecin::PENDING);
        $patient = Patient::create(['user_id' => $this->user('patient')->id]);
        $rdv = \App\Models\RendezVous::create([
            'patient_id' => $patient->id,
            'medecin_id' => $medecin->id,
            'date_heure' => now()->addDay(),
            'statut' => 'en_attente',
        ]);
        Sanctum::actingAs($medecin->user);

        $this->getJson('/api/rendez-vous')->assertForbidden();
        $this->patchJson("/api/rendez-vous/{$rdv->id}/statut", ['statut' => 'confirme'])->assertForbidden();
        $this->assertDatabaseHas('rendez_vous', ['id' => $rdv->id, 'statut' => 'en_attente']);
    }

    public function test_patient_ne_peut_pas_reserver_avec_un_medecin_non_valide(): void
    {
        $pending = $this->medecin(Medecin::PENDING);
        $patientUser = $this->user('patient');
        Patient::create(['user_id' => $patientUser->id]);
        Sanctum::actingAs($patientUser);

        $this->postJson('/api/rendez-vous', [
            'medecin_id' => $pending->id,
            'date_heure' => now()->addDay()->toDateTimeString(),
        ])->assertStatus(422);
    }

    public function test_patient_ne_peut_pas_acceder_aux_routes_admin(): void
    {
        Sanctum::actingAs($this->user('patient'));

        $this->getJson('/api/admin/medecins')->assertForbidden();
    }

    public function test_admin_approuve_un_medecin_qui_apparait_dans_l_annuaire(): void
    {
        $medecin = $this->medecin(Medecin::PENDING);
        $admin = $this->user('admin');
        Sanctum::actingAs($admin);

        $this->postJson("/api/admin/medecins/{$medecin->id}/approuver")->assertOk();

        $this->assertDatabaseHas('medecins', [
            'id' => $medecin->id,
            'statut_validation' => 'approved',
            'valide_par' => $admin->id,
        ]);
        $this->getJson('/api/medecins')->assertJsonCount(1);
    }

    public function test_admin_doit_motiver_un_refus(): void
    {
        $medecin = $this->medecin(Medecin::PENDING);
        Sanctum::actingAs($this->user('admin'));

        $this->postJson("/api/admin/medecins/{$medecin->id}/rejeter", [])->assertStatus(422);
        $this->postJson("/api/admin/medecins/{$medecin->id}/rejeter", ['motif' => 'Diplôme illisible'])->assertOk();

        $this->assertDatabaseHas('medecins', ['id' => $medecin->id, 'statut_validation' => 'rejected']);
    }

    public function test_medecin_approuve_peut_confirmer_son_rendez_vous(): void
    {
        $medecin = $this->medecin(Medecin::APPROVED);
        $patientUser = $this->user('patient');
        $patient = Patient::create(['user_id' => $patientUser->id]);
        $rdv = \App\Models\RendezVous::create([
            'patient_id' => $patient->id,
            'medecin_id' => $medecin->id,
            'date_heure' => now()->addDay(),
            'statut' => 'en_attente',
        ]);

        Sanctum::actingAs($medecin->user);

        $this->patchJson("/api/rendez-vous/{$rdv->id}/statut", ['statut' => 'confirme'])->assertOk();
        $this->assertDatabaseHas('rendez_vous', ['id' => $rdv->id, 'statut' => 'confirme']);
    }

    // ---------- Créneaux, disponibilités, modification, profil ----------

    // Lundi 26/10/2026 à 08:00 ; le médecin travaille le lundi de 9h à 11h, créneaux de 30 min
    private function medecinAvecLundi(): Medecin
    {
        $this->travelTo(\Carbon\Carbon::parse('2026-10-26 08:00:00'));
        $medecin = $this->medecin(Medecin::APPROVED);
        Disponibilite::create([
            'medecin_id' => $medecin->id,
            'jour' => 1,
            'heure_debut' => '09:00',
            'heure_fin' => '11:00',
            'duree' => 30,
        ]);

        return $medecin;
    }

    private function patientConnecte(): Patient
    {
        $user = $this->user('patient');
        $patient = Patient::create(['user_id' => $user->id]);
        Sanctum::actingAs($user);

        return $patient;
    }

    public function test_creneaux_generes_a_partir_des_disponibilites(): void
    {
        $medecin = $this->medecinAvecLundi();

        $reponse = $this->getJson("/api/medecins/{$medecin->id}/creneaux")->assertOk();

        $reponse->assertJsonPath('2026-10-26', ['09:00', '09:30', '10:00', '10:30']);
        $reponse->assertJsonPath('2026-11-02', ['09:00', '09:30', '10:00', '10:30']);
        $this->assertArrayNotHasKey('2026-10-27', $reponse->json()); // mardi : pas de plage
    }

    public function test_creneaux_indisponibles_pour_un_medecin_non_valide(): void
    {
        $pending = $this->medecin(Medecin::PENDING);

        $this->getJson("/api/medecins/{$pending->id}/creneaux")->assertNotFound();
    }

    public function test_patient_reserve_un_creneau_libre_puis_il_disparait(): void
    {
        $medecin = $this->medecinAvecLundi();
        $this->patientConnecte();

        $this->postJson('/api/rendez-vous', [
            'medecin_id' => $medecin->id,
            'date_heure' => '2026-10-26 09:00',
        ])->assertCreated();

        $this->getJson("/api/medecins/{$medecin->id}/creneaux")
            ->assertJsonPath('2026-10-26', ['09:30', '10:00', '10:30']);

        // même créneau : refusé
        $this->postJson('/api/rendez-vous', [
            'medecin_id' => $medecin->id,
            'date_heure' => '2026-10-26 09:00',
        ])->assertStatus(422);
    }

    public function test_reservation_refusee_hors_creneaux_proposes(): void
    {
        $medecin = $this->medecinAvecLundi();
        $this->patientConnecte();

        // heure qui n'est pas un créneau
        $this->postJson('/api/rendez-vous', ['medecin_id' => $medecin->id, 'date_heure' => '2026-10-26 09:15'])
            ->assertStatus(422);
        // jour sans disponibilité (mardi)
        $this->postJson('/api/rendez-vous', ['medecin_id' => $medecin->id, 'date_heure' => '2026-10-27 09:00'])
            ->assertStatus(422);
    }

    public function test_un_rendez_vous_annule_libere_le_creneau(): void
    {
        $medecin = $this->medecinAvecLundi();
        $patient = $this->patientConnecte();
        $rdv = RendezVous::create([
            'patient_id' => $patient->id,
            'medecin_id' => $medecin->id,
            'date_heure' => '2026-10-26 09:00:00',
            'statut' => 'en_attente',
        ]);

        $this->postJson("/api/rendez-vous/{$rdv->id}/annuler")->assertOk();

        $this->getJson("/api/medecins/{$medecin->id}/creneaux")
            ->assertJsonPath('2026-10-26', ['09:00', '09:30', '10:00', '10:30']);
    }

    public function test_patient_modifie_son_rendez_vous_qui_repasse_en_attente(): void
    {
        $medecin = $this->medecinAvecLundi();
        $patient = $this->patientConnecte();
        $rdv = RendezVous::create([
            'patient_id' => $patient->id,
            'medecin_id' => $medecin->id,
            'date_heure' => '2026-10-26 09:00:00',
            'statut' => 'confirme',
        ]);

        $this->patchJson("/api/rendez-vous/{$rdv->id}", ['date_heure' => '2026-10-26 10:00'])->assertOk();

        $this->assertDatabaseHas('rendez_vous', ['id' => $rdv->id, 'statut' => 'en_attente']);
        $this->assertSame('2026-10-26 10:00', \Carbon\Carbon::parse(RendezVous::find($rdv->id)->date_heure)->format('Y-m-d H:i'));
    }

    public function test_un_patient_ne_peut_pas_modifier_le_rendez_vous_d_un_autre(): void
    {
        $medecin = $this->medecinAvecLundi();
        $proprietaire = Patient::create(['user_id' => $this->user('patient')->id]);
        $rdv = RendezVous::create([
            'patient_id' => $proprietaire->id,
            'medecin_id' => $medecin->id,
            'date_heure' => '2026-10-26 09:00:00',
            'statut' => 'en_attente',
        ]);

        $this->patientConnecte(); // un autre patient

        $this->patchJson("/api/rendez-vous/{$rdv->id}", ['date_heure' => '2026-10-26 10:00'])->assertForbidden();
    }

    public function test_medecin_approuve_gere_ses_disponibilites(): void
    {
        $medecin = $this->medecin(Medecin::APPROVED);
        Sanctum::actingAs($medecin->user);

        $this->putJson('/api/medecin/disponibilites', ['plages' => [
            ['jour' => 1, 'heure_debut' => '09:00', 'heure_fin' => '12:00', 'duree' => 30],
            ['jour' => 1, 'heure_debut' => '14:00', 'heure_fin' => '17:00', 'duree' => 30],
        ]])->assertOk();

        $this->getJson('/api/medecin/disponibilites')->assertOk()->assertJsonCount(2);

        // chevauchement, fin avant début : refusés
        $this->putJson('/api/medecin/disponibilites', ['plages' => [
            ['jour' => 2, 'heure_debut' => '09:00', 'heure_fin' => '12:00', 'duree' => 30],
            ['jour' => 2, 'heure_debut' => '11:00', 'heure_fin' => '13:00', 'duree' => 30],
        ]])->assertStatus(422);
        $this->putJson('/api/medecin/disponibilites', ['plages' => [
            ['jour' => 3, 'heure_debut' => '12:00', 'heure_fin' => '09:00', 'duree' => 30],
        ]])->assertStatus(422);

        // les disponibilités précédentes n'ont pas été écrasées par les requêtes refusées
        $this->getJson('/api/medecin/disponibilites')->assertJsonCount(2);
    }

    public function test_medecin_en_attente_ne_peut_pas_definir_ses_disponibilites(): void
    {
        $pending = $this->medecin(Medecin::PENDING);
        Sanctum::actingAs($pending->user);

        $this->putJson('/api/medecin/disponibilites', ['plages' => []])->assertForbidden();
    }

    public function test_modification_du_profil_controle_le_telephone(): void
    {
        $patient = $this->user('patient');
        Sanctum::actingAs($patient);

        $this->postJson('/api/me', ['name' => 'Nouveau Nom', 'telephone' => '701234567'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('telephone');

        $this->postJson('/api/me', ['name' => 'Nouveau Nom', 'telephone' => '77 123 45 67'])
            ->assertOk()
            ->assertJsonPath('user.name', 'Nouveau Nom');

        $this->assertDatabaseHas('users', ['id' => $patient->id, 'name' => 'Nouveau Nom', 'telephone' => '771234567']);
    }

    // ---------- Administration : tableau de bord, médecins, patients, spécialités, rendez-vous ----------

    private function admin(): User
    {
        $admin = $this->user('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function rdv(Medecin $medecin, Patient $patient, $dateHeure, string $statut = 'en_attente'): RendezVous
    {
        return RendezVous::create([
            'patient_id' => $patient->id,
            'medecin_id' => $medecin->id,
            'date_heure' => $dateHeure,
            'statut' => $statut,
        ]);
    }

    private function patientProfil(): Patient
    {
        return Patient::create(['user_id' => $this->user('patient')->id]);
    }

    public function test_tableau_de_bord_compte_patients_medecins_et_rendez_vous(): void
    {
        $approuve = $this->medecin(Medecin::APPROVED);
        $this->medecin(Medecin::PENDING);
        $p1 = $this->patientProfil();
        $this->patientProfil();

        $this->rdv($approuve, $p1, now()->setTime(10, 0), 'en_attente');           // aujourd'hui
        $this->rdv($approuve, $p1, now()->addDays(2)->setTime(10, 0), 'confirme');
        $this->rdv($approuve, $p1, now()->addDays(3)->setTime(10, 0), 'annule');

        $this->admin();

        $this->getJson('/api/admin/tableau-de-bord')
            ->assertOk()
            ->assertJsonPath('patients.total', 2)
            ->assertJsonPath('medecins.total', 2)
            ->assertJsonPath('medecins.approuves', 1)
            ->assertJsonPath('medecins.en_attente', 1)
            ->assertJsonPath('rendez_vous.aujourdhui', 1)
            ->assertJsonPath('rendez_vous.en_attente', 1)
            ->assertJsonPath('rendez_vous.confirmes', 1)
            ->assertJsonPath('rendez_vous.annules', 1)
            ->assertJsonCount(7, 'par_jour');
    }

    public function test_les_routes_admin_sont_interdites_aux_autres_roles(): void
    {
        Sanctum::actingAs($this->user('medecin'));

        foreach (['tableau-de-bord', 'patients', 'specialites', 'rendez-vous', 'journal'] as $route) {
            $this->getJson("/api/admin/{$route}")->assertForbidden();
        }
    }

    public function test_admin_ajoute_un_medecin_approuve_qui_peut_se_connecter(): void
    {
        $specialite = Specialite::create(['nom' => 'Cardiologie']);
        $admin = $this->admin();

        $this->postJson('/api/admin/medecins', [
            'name' => 'Dr Ndiaye',
            'email' => 'ndiaye@clinique.sn',
            'password' => 'motdepasse1',
            'telephone' => '781234567',
            'specialite_id' => $specialite->id,
            'numero_ordre' => 'ORD-900',
            'tarif_consultation' => 15000,
        ])->assertCreated()->assertJsonPath('medecin.statut_validation', 'approved');

        $this->getJson('/api/medecins')->assertJsonCount(1); // visible dans l'annuaire
        $this->assertSame(1, Activite::where('action', 'medecin_cree')->where('user_id', $admin->id)->count());

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => 'ndiaye@clinique.sn', 'password' => 'motdepasse1'])
            ->assertOk()->assertJsonPath('user.role', 'medecin');
    }

    public function test_admin_modifie_un_medecin_et_change_sa_specialite(): void
    {
        $medecin = $this->medecin(Medecin::APPROVED);
        $autre = Specialite::create(['nom' => 'Dermatologie']);
        $this->admin();

        $this->postJson("/api/admin/medecins/{$medecin->id}/modifier", [
            'name' => 'Nom Modifié',
            'email' => $medecin->user->email,
            'telephone' => '77 765 43 21',
            'specialite_id' => $autre->id,
            'numero_ordre' => $medecin->numero_ordre,
            'tarif_consultation' => 20000,
        ])->assertOk()->assertJsonPath('medecin.specialite.nom', 'Dermatologie');

        $this->assertDatabaseHas('users', ['id' => $medecin->user_id, 'name' => 'Nom Modifié', 'telephone' => '777654321']);
        $this->assertDatabaseHas('medecins', ['id' => $medecin->id, 'tarif_consultation' => 20000]);
    }

    public function test_desactiver_un_medecin_le_retire_de_l_annuaire_et_bloque_sa_connexion(): void
    {
        $medecin = $this->medecin(Medecin::APPROVED);
        $medecin->user->update(['password' => 'secret1234']);
        $this->admin();

        $this->postJson("/api/admin/medecins/{$medecin->id}/actif", ['actif' => false])->assertOk();

        $this->getJson('/api/medecins')->assertJsonCount(0);
        $this->getJson("/api/medecins/{$medecin->id}/creneaux")->assertNotFound();

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => $medecin->user->email, 'password' => 'secret1234'])->assertForbidden();

        // réactivation
        Sanctum::actingAs($this->user('admin'));
        $this->postJson("/api/admin/medecins/{$medecin->id}/actif", ['actif' => true])->assertOk();
        $this->getJson('/api/medecins')->assertJsonCount(1);
    }

    public function test_admin_desactive_un_patient_dont_les_sessions_sont_coupees(): void
    {
        $patient = $this->patientProfil();
        $patient->user->update(['password' => 'secret1234']);
        $token = $patient->user->createToken('test');
        $this->assertSame(1, $patient->user->tokens()->count());

        $this->admin();
        $this->postJson("/api/admin/patients/{$patient->id}/actif", ['actif' => false])->assertOk();

        $this->assertSame(0, $patient->user->fresh()->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => $patient->user->email, 'password' => 'secret1234'])->assertForbidden();
    }

    public function test_admin_recherche_un_patient_et_n_a_pas_acces_aux_donnees_medicales(): void
    {
        $recherche = $this->user('patient');
        $recherche->update(['name' => 'Fatou Sow']);
        Patient::create(['user_id' => $recherche->id, 'groupe_sanguin' => 'O+', 'antecedents' => 'secret']);
        $this->patientProfil();
        $this->admin();

        $reponse = $this->getJson('/api/admin/patients?q=fatou')->assertOk()->assertJsonCount(1, 'data');

        $this->assertArrayNotHasKey('groupe_sanguin', $reponse->json('data.0'));
        $this->assertArrayNotHasKey('antecedents', $reponse->json('data.0'));
    }

    public function test_gestion_des_specialites(): void
    {
        $this->admin();

        $id = $this->postJson('/api/admin/specialites', ['nom' => 'Neurologie', 'description' => 'Système nerveux'])
            ->assertCreated()->json('specialite.id');

        // doublon refusé
        $this->postJson('/api/admin/specialites', ['nom' => 'Neurologie'])->assertStatus(422);

        $this->putJson("/api/admin/specialites/{$id}", ['nom' => 'Neurologie adulte'])->assertOk();
        $this->getJson('/api/specialites')->assertJsonFragment(['nom' => 'Neurologie adulte']);

        // désactivée : disparaît de la liste publique, mais reste visible pour l'admin
        $this->postJson("/api/admin/specialites/{$id}/actif", ['actif' => false])->assertOk();
        $this->getJson('/api/specialites')->assertJsonMissing(['nom' => 'Neurologie adulte']);
        $this->getJson('/api/admin/specialites')->assertJsonFragment(['nom' => 'Neurologie adulte', 'actif' => false]);

        // et on ne peut plus l'associer à un nouveau médecin
        $this->postJson('/api/admin/medecins', [
            'name' => 'Dr Test', 'email' => 'test@clinique.sn', 'password' => 'motdepasse1',
            'telephone' => '771234567', 'specialite_id' => $id, 'numero_ordre' => 'ORD-1', 'tarif_consultation' => 5000,
        ])->assertStatus(422)->assertJsonValidationErrors('specialite_id');
    }

    public function test_admin_filtre_les_rendez_vous(): void
    {
        $m1 = $this->medecin(Medecin::APPROVED);
        $m2 = $this->medecin(Medecin::APPROVED);
        $p = $this->patientProfil();
        $this->rdv($m1, $p, now()->addDays(1)->setTime(9, 0), 'en_attente');
        $this->rdv($m1, $p, now()->addDays(2)->setTime(9, 0), 'confirme');
        $this->rdv($m2, $p, now()->addDays(3)->setTime(9, 0), 'en_attente');
        $this->admin();

        $this->getJson('/api/admin/rendez-vous')->assertJsonCount(3, 'data');
        $this->getJson("/api/admin/rendez-vous?medecin_id={$m1->id}")->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/rendez-vous?statut=en_attente')->assertJsonCount(2, 'data');
        $this->getJson("/api/admin/rendez-vous?patient_id={$p->id}&statut=confirme")->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/rendez-vous?du=' . now()->addDays(3)->toDateString())->assertJsonCount(1, 'data');
    }

    public function test_admin_detecte_et_resout_un_conflit_de_rendez_vous(): void
    {
        $medecin = $this->medecin(Medecin::APPROVED);
        $p1 = $this->patientProfil();
        $p2 = $this->patientProfil();
        $quand = now()->addDays(2)->setTime(10, 0);
        $a = $this->rdv($medecin, $p1, $quand, 'confirme');
        $b = $this->rdv($medecin, $p2, $quand, 'en_attente'); // même médecin, même heure : conflit
        $this->admin();

        $this->getJson('/api/admin/rendez-vous/conflits')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/admin/tableau-de-bord')->assertJsonPath('conflits', 1);

        // confirmer le second serait un nouveau conflit
        $this->patchJson("/api/admin/rendez-vous/{$b->id}", ['statut' => 'confirme'])->assertStatus(422);

        // déplacer le second sur un autre horaire résout le conflit
        $this->patchJson("/api/admin/rendez-vous/{$b->id}", ['date_heure' => $quand->copy()->addHour()->format('Y-m-d H:i')])->assertOk();
        $this->getJson('/api/admin/rendez-vous/conflits')->assertJsonCount(0);

        // annuler est toujours possible
        $this->patchJson("/api/admin/rendez-vous/{$a->id}", ['statut' => 'annule'])->assertOk();
        $this->assertDatabaseHas('rendez_vous', ['id' => $a->id, 'statut' => 'annule']);
    }

    public function test_les_actions_de_l_admin_sont_journalisees(): void
    {
        $medecin = $this->medecin(Medecin::PENDING);
        $this->admin();

        $this->postJson("/api/admin/medecins/{$medecin->id}/approuver")->assertOk();

        $this->getJson('/api/admin/journal')
            ->assertOk()
            ->assertJsonPath('data.0.action', 'medecin_approuve');
    }
}
