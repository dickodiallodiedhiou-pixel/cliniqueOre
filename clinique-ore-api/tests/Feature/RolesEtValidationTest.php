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

        $medecin = Medecin::create([
            'user_id' => $this->user('medecin')->id,
            'specialite_id' => $specialite->id,
            'tarif_consultation' => 5000,
            'numero_ordre' => 'ORD-' . uniqid(),
            'statut_validation' => $statut,
        ]);
        $medecin->specialites()->attach($specialite->id);

        return $medecin;
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
            'date_heure' => '2026-11-02 09:00:00',
            'statut' => 'en_attente',
        ]);

        $this->postJson("/api/rendez-vous/{$rdv->id}/annuler")->assertOk();

        $this->getJson("/api/medecins/{$medecin->id}/creneaux")
            ->assertJsonPath('2026-11-02', ['09:00', '09:30', '10:00', '10:30']);
    }

    public function test_patient_modifie_son_rendez_vous_qui_repasse_en_attente(): void
    {
        $medecin = $this->medecinAvecLundi();
        $patient = $this->patientConnecte();
        $rdv = RendezVous::create([
            'patient_id' => $patient->id,
            'medecin_id' => $medecin->id,
            'date_heure' => '2026-11-02 09:00:00',
            'statut' => 'confirme',
        ]);

        $this->patchJson("/api/rendez-vous/{$rdv->id}", ['date_heure' => '2026-11-02 10:00'])->assertOk();

        $this->assertDatabaseHas('rendez_vous', ['id' => $rdv->id, 'statut' => 'en_attente']);
        $this->assertSame('2026-11-02 10:00', \Carbon\Carbon::parse(RendezVous::find($rdv->id)->date_heure)->format('Y-m-d H:i'));
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
                ])->assertStatus(422)->assertJsonValidationErrors('specialite_ids.0');
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

    // ---------- Historique des consultations et comptes rendus ----------

    public function test_medecin_termine_une_consultation_avec_compte_rendu_visible_par_le_patient(): void
    {
        $medecin = $this->medecin(Medecin::APPROVED);
        $patient = $this->patientProfil();
        $rdv = $this->rdv($medecin, $patient, now()->subHour(), 'confirme');

        Sanctum::actingAs($medecin->user);
        $this->patchJson("/api/rendez-vous/{$rdv->id}/statut", [
            'statut' => 'termine',
            'notes_medecin' => 'Tension normale. Repos conseillé pendant 3 jours.',
        ])->assertOk()->assertJsonPath('rendez_vous.notes_medecin', 'Tension normale. Repos conseillé pendant 3 jours.');

        Sanctum::actingAs($patient->user);
        $this->getJson('/api/historique')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.notes_medecin', 'Tension normale. Repos conseillé pendant 3 jours.')
            ->assertJsonPath('data.0.medecin.user.id', $medecin->user_id);
    }

    public function test_historique_patient_ne_contient_que_ses_consultations_terminees(): void
    {
        $medecin = $this->medecin(Medecin::APPROVED);
        $moi = $this->patientProfil();
        $autre = $this->patientProfil();
        $this->rdv($medecin, $moi, now()->subDays(3), 'termine');
        $this->rdv($medecin, $moi, now()->addDay(), 'en_attente');
        $this->rdv($medecin, $autre, now()->subDays(2), 'termine');

        Sanctum::actingAs($moi->user);

        $this->getJson('/api/historique')->assertOk()->assertJsonPath('total', 1);
    }

    public function test_l_admin_ne_voit_pas_les_comptes_rendus_medicaux(): void
    {
        $medecin = $this->medecin(Medecin::APPROVED);
        $patient = $this->patientProfil();
        $rdv = $this->rdv($medecin, $patient, now()->subDay(), 'termine');
        $rdv->update(['notes_medecin' => 'Information médicale confidentielle']);

        $this->admin();
        $reponse = $this->getJson('/api/admin/rendez-vous')->assertOk();

        $this->assertArrayNotHasKey('notes_medecin', $reponse->json('data.0'));
        $this->assertStringNotContainsString('confidentielle', $reponse->getContent());
    }

    public function test_medecin_corrige_le_compte_rendu_d_une_consultation_terminee(): void
    {
        $medecin = $this->medecin(Medecin::APPROVED);
        $patient = $this->patientProfil();
        $termine = $this->rdv($medecin, $patient, now()->subDay(), 'termine');
        $confirme = $this->rdv($medecin, $patient, now()->addDay(), 'confirme');

        Sanctum::actingAs($medecin->user);

        $this->patchJson("/api/rendez-vous/{$termine->id}/notes", ['notes_medecin' => 'Contrôle dans un mois.'])->assertOk();
        $this->assertDatabaseHas('rendez_vous', ['id' => $termine->id, 'notes_medecin' => 'Contrôle dans un mois.']);

        // vide : refusé ; consultation non terminée : refusé
        $this->patchJson("/api/rendez-vous/{$termine->id}/notes", ['notes_medecin' => ''])->assertStatus(422);
        $this->patchJson("/api/rendez-vous/{$confirme->id}/notes", ['notes_medecin' => 'Trop tôt'])->assertStatus(422);

        // un autre médecin ne peut pas modifier ce compte rendu
        $autre = $this->medecin(Medecin::APPROVED);
        Sanctum::actingAs($autre->user);
        $this->patchJson("/api/rendez-vous/{$termine->id}/notes", ['notes_medecin' => 'Intrus'])->assertForbidden();
    }

    public function test_historique_medecin_filtre_par_patient_et_reste_limite_a_ses_consultations(): void
    {
        $medecin = $this->medecin(Medecin::APPROVED);
        $autreMedecin = $this->medecin(Medecin::APPROVED);
        $p1 = $this->patientProfil();
        $p2 = $this->patientProfil();
        $this->rdv($medecin, $p1, now()->subDays(5), 'termine');
        $this->rdv($medecin, $p1, now()->subDays(2), 'termine');
        $this->rdv($medecin, $p2, now()->subDays(1), 'termine');
        $this->rdv($autreMedecin, $p1, now()->subDays(1), 'termine'); // consultation d'un autre médecin

        Sanctum::actingAs($medecin->user);

        $this->getJson('/api/medecin/historique')->assertOk()->assertJsonPath('total', 3);
        $this->getJson("/api/medecin/historique?patient_id={$p1->id}")->assertOk()->assertJsonPath('total', 2);
    }

    public function test_medecin_en_attente_n_a_pas_acces_a_l_historique(): void
    {
        $pending = $this->medecin(Medecin::PENDING);
        Sanctum::actingAs($pending->user);

        $this->getJson('/api/medecin/historique')->assertForbidden();
    }

    // ---------- Espace médecin : tableau de bord, rendez-vous, fiche patient, planning, congés ----------

    public function test_tableau_de_bord_du_medecin(): void
    {
        $medecin = $this->medecinAvecLundi(); // nous sommes le lundi 26/10/2026 à 08:00
        $patient = $this->patientProfil();

        $this->rdv($medecin, $patient, now()->setTime(10, 0), 'confirme');          // aujourd'hui
        $this->rdv($medecin, $patient, now()->addDay()->setTime(9, 0), 'en_attente'); // demain
        $this->rdv($medecin, $patient, now()->subDay()->setTime(9, 0), 'termine');   // hier
        $this->rdv($medecin, $patient, now()->addDays(2)->setTime(9, 0), 'annule');

        // rendez-vous d'un autre médecin : ne doit pas être compté
        $autre = $this->medecin(Medecin::APPROVED);
        $this->rdv($autre, $patient, now()->setTime(11, 0), 'en_attente');

        Sanctum::actingAs($medecin->user);

        $this->getJson('/api/medecin/tableau-de-bord')
            ->assertOk()
            ->assertJsonPath('rendez_vous.aujourdhui', 1)
            ->assertJsonPath('rendez_vous.en_attente', 1)
            ->assertJsonPath('rendez_vous.confirmes', 1)
            ->assertJsonPath('rendez_vous.termines', 1)
            ->assertJsonPath('rendez_vous.annules', 1)
            ->assertJsonCount(1, 'aujourdhui_liste')
            ->assertJsonCount(2, 'prochains')
            ->assertJsonCount(7, 'par_jour')
            ->assertJsonPath('prochain_creneau.date', '2026-10-26');
    }

    public function test_liste_des_rendez_vous_du_medecin_filtrable_avec_compteurs(): void
    {
        $medecin = $this->medecinAvecLundi();
        $autre = $this->medecin(Medecin::APPROVED);
        $p1 = $this->patientProfil();
        $p2 = $this->patientProfil();

        $this->rdv($medecin, $p1, now()->addDay(), 'en_attente');
        $this->rdv($medecin, $p1, now()->addDays(2), 'confirme');
        $termine = $this->rdv($medecin, $p2, now()->subDays(2), 'termine');
        $termine->update(['notes_medecin' => 'Compte rendu visible du médecin']);
        $this->rdv($medecin, $p2, now()->addDays(3), 'annule');
        $this->rdv($autre, $p1, now()->addDay(), 'en_attente'); // autre médecin

        Sanctum::actingAs($medecin->user);

        $this->getJson('/api/medecin/rendez-vous')
            ->assertOk()
            ->assertJsonPath('total', 4)
            ->assertJsonPath('compteurs.en_attente', 1)
            ->assertJsonPath('compteurs.termine', 1)
            ->assertJsonPath('compteurs.annule', 1);

        $this->getJson('/api/medecin/rendez-vous?statut=annule')->assertJsonPath('total', 1);
        $this->getJson("/api/medecin/rendez-vous?patient_id={$p2->id}")->assertJsonPath('total', 2);

        $this->getJson('/api/medecin/rendez-vous?statut=termine')
            ->assertJsonPath('data.0.notes_medecin', 'Compte rendu visible du médecin');
    }

    public function test_medecin_en_attente_n_a_pas_acces_a_son_espace(): void
    {
        $pending = $this->medecin(Medecin::PENDING);
        Sanctum::actingAs($pending->user);

        foreach (['tableau-de-bord', 'rendez-vous', 'planning', 'indisponibilites'] as $route) {
            $this->getJson("/api/medecin/{$route}")->assertForbidden();
        }
    }

    public function test_fiche_patient_reservee_aux_patients_ayant_rendez_vous_avec_le_medecin(): void
    {
        $medecin = $this->medecinAvecLundi();
        $connu = $this->patientProfil();
        $inconnu = $this->patientProfil();
        $this->rdv($medecin, $connu, now()->subDays(10), 'termine');
        $this->rdv($medecin, $connu, now()->addDays(3), 'confirme');

        Sanctum::actingAs($medecin->user);

        $this->getJson("/api/medecin/patients/{$connu->id}")
            ->assertOk()
            ->assertJsonPath('nb_consultations', 1)
            ->assertJsonPath('nom', $connu->user->name);

        $this->getJson("/api/medecin/patients/{$inconnu->id}")->assertForbidden();
    }

    public function test_un_conge_retire_les_creneaux_et_previent_des_rendez_vous_deja_pris(): void
    {
        $medecin = $this->medecinAvecLundi();
        $patient = $this->patientProfil();
        $this->rdv($medecin, $patient, '2026-11-02 09:30:00', 'confirme');
        Sanctum::actingAs($medecin->user);

        $this->postJson('/api/medecin/indisponibilites', [
            'date_debut' => '2026-11-02',
            'date_fin' => '2026-11-02',
            'motif' => 'Congé',
        ])->assertCreated()->assertJsonCount(1, 'rendez_vous_concernes');

        $creneaux = $this->getJson("/api/medecins/{$medecin->id}/creneaux")->assertOk()->json();
        $this->assertArrayNotHasKey('2026-11-02', $creneaux);   // journée bloquée
        $this->assertArrayHasKey('2026-10-26', $creneaux);      // aujourd'hui toujours disponible

        // suppression : les créneaux reviennent
        $id = $this->getJson('/api/medecin/indisponibilites')->assertJsonCount(1)->json('0.id');
        $this->deleteJson("/api/medecin/indisponibilites/{$id}")->assertOk();
        $this->assertArrayHasKey('2026-11-02', $this->getJson("/api/medecins/{$medecin->id}/creneaux")->json());
    }

    public function test_une_indisponibilite_partielle_ne_bloque_que_ses_heures(): void
    {
        $medecin = $this->medecinAvecLundi();
        Sanctum::actingAs($medecin->user);

        $this->postJson('/api/medecin/indisponibilites', [
            'date_debut' => '2026-11-02',
            'date_fin' => '2026-11-02',
            'heure_debut' => '09:30',
            'heure_fin' => '10:30',
        ])->assertCreated();

        $this->getJson("/api/medecins/{$medecin->id}/creneaux")
            ->assertJsonPath('2026-11-02', ['09:00', '10:30']);
    }

    public function test_validation_des_indisponibilites(): void
    {
        $medecin = $this->medecinAvecLundi();
        Sanctum::actingAs($medecin->user);

        // date passée
        $this->postJson('/api/medecin/indisponibilites', ['date_debut' => '2026-10-01', 'date_fin' => '2026-10-02'])
            ->assertStatus(422)->assertJsonValidationErrors('date_debut');
        // fin avant début
        $this->postJson('/api/medecin/indisponibilites', ['date_debut' => '2026-11-05', 'date_fin' => '2026-11-03'])
            ->assertStatus(422)->assertJsonValidationErrors('date_fin');
        // une seule heure fournie
        $this->postJson('/api/medecin/indisponibilites', ['date_debut' => '2026-11-05', 'date_fin' => '2026-11-05', 'heure_debut' => '09:00'])
            ->assertStatus(422);
        // heure de fin avant l'heure de début
        $this->postJson('/api/medecin/indisponibilites', ['date_debut' => '2026-11-05', 'date_fin' => '2026-11-05', 'heure_debut' => '11:00', 'heure_fin' => '09:00'])
            ->assertStatus(422)->assertJsonValidationErrors('heure_fin');
    }

    public function test_un_medecin_ne_peut_pas_supprimer_l_indisponibilite_d_un_autre(): void
    {
        $medecin = $this->medecinAvecLundi();
        Sanctum::actingAs($medecin->user);
        $id = $this->postJson('/api/medecin/indisponibilites', ['date_debut' => '2026-11-02', 'date_fin' => '2026-11-02'])
            ->assertCreated()->json('indisponibilite.id');

        $autre = $this->medecin(Medecin::APPROVED);
        Sanctum::actingAs($autre->user);

        $this->deleteJson("/api/medecin/indisponibilites/{$id}")->assertNotFound();
    }

    public function test_planning_hebdomadaire_avec_etats_des_creneaux(): void
    {
        $medecin = $this->medecinAvecLundi(); // lundi 26/10 à 08:00, plage 9h-11h par 30 min
        $patient = $this->patientProfil();
        $this->rdv($medecin, $patient, '2026-10-26 09:00:00', 'confirme');
        Sanctum::actingAs($medecin->user);

        $this->postJson('/api/medecin/indisponibilites', [
            'date_debut' => '2026-10-26', 'date_fin' => '2026-10-26', 'heure_debut' => '10:00', 'heure_fin' => '11:00',
        ])->assertCreated();

        $reponse = $this->getJson('/api/medecin/planning?debut=2026-10-28')->assertOk(); // mercredi -> semaine du lundi 26

        $reponse->assertJsonPath('debut', '2026-10-26')
            ->assertJsonCount(7, 'jours')
            ->assertJsonPath('jours.0.travaille', true)
            ->assertJsonPath('jours.0.creneaux.0.etat', 'reserve')
            ->assertJsonPath('jours.0.creneaux.0.rdv.patient', $patient->user->name)
            ->assertJsonPath('jours.0.creneaux.1.etat', 'libre')      // 09:30
            ->assertJsonPath('jours.0.creneaux.2.etat', 'bloque')     // 10:00
            ->assertJsonPath('jours.1.travaille', false);             // mardi : repos
    }

    // ---------- Espace patient : règles, notifications, mot de passe, profils ----------

    public function test_le_patient_ne_peut_pas_modifier_ou_annuler_moins_de_24h_avant(): void
    {
        $medecin = $this->medecinAvecLundi(); // lundi 26/10/2026 à 08:00
        $patient = $this->patientConnecte();
        $proche = $this->rdv($medecin, $patient, '2026-10-26 10:00:00', 'confirme'); // dans 2 heures
        $loin = $this->rdv($medecin, $patient, '2026-11-02 09:00:00', 'confirme');   // dans 7 jours

        $this->postJson("/api/rendez-vous/{$proche->id}/annuler")->assertStatus(422);
        $this->patchJson("/api/rendez-vous/{$proche->id}", ['date_heure' => '2026-11-02 10:00'])->assertStatus(422);
        $this->assertDatabaseHas('rendez_vous', ['id' => $proche->id, 'statut' => 'confirme']);

        $this->postJson("/api/rendez-vous/{$loin->id}/annuler")->assertOk();
    }

    public function test_le_patient_est_notifie_quand_le_medecin_confirme_puis_lit_la_notification(): void
    {
        $medecin = $this->medecinAvecLundi();
        $patient = $this->patientProfil();
        $rdv = $this->rdv($medecin, $patient, '2026-11-02 09:00:00', 'en_attente');

        Sanctum::actingAs($medecin->user);
        $this->patchJson("/api/rendez-vous/{$rdv->id}/statut", ['statut' => 'confirme'])->assertOk();

        Sanctum::actingAs($patient->user);
        $reponse = $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('non_lues', 1)
            ->assertJsonPath('data.0.data.evenement', 'confirme')
            ->assertJsonPath('data.0.data.titre', 'Rendez-vous confirmé');
        $this->assertStringContainsString('Dr', $reponse->json('data.0.data.message'));

        $this->getJson('/api/notifications/non-lues')->assertJsonPath('non_lues', 1);

        $id = $reponse->json('data.0.id');
        $this->postJson("/api/notifications/{$id}/lire")->assertOk()->assertJsonPath('non_lues', 0);
    }

    public function test_notifications_de_refus_et_de_fin_de_consultation(): void
    {
        $medecin = $this->medecinAvecLundi();
        $patient = $this->patientProfil();
        $demande = $this->rdv($medecin, $patient, '2026-11-02 09:00:00', 'en_attente');
        $consultation = $this->rdv($medecin, $patient, '2026-10-26 07:00:00', 'confirme');

        Sanctum::actingAs($medecin->user);
        $this->patchJson("/api/rendez-vous/{$demande->id}/statut", ['statut' => 'refuse'])->assertOk();
        $this->assertDatabaseHas('rendez_vous', ['id' => $demande->id, 'statut' => 'refuse']);
        $this->patchJson("/api/rendez-vous/{$consultation->id}/statut", ['statut' => 'termine', 'notes_medecin' => 'RAS'])->assertOk();

        Sanctum::actingAs($patient->user);
        $reponse = $this->getJson('/api/notifications')->assertOk()->assertJsonCount(2, 'data');

        $evenements = collect($reponse->json('data'))->pluck('data.evenement')->sort()->values()->all();
        $this->assertSame(['refuse', 'termine'], $evenements);

        $this->postJson('/api/notifications/tout-lire')->assertOk()->assertJsonPath('non_lues', 0);
    }

    public function test_le_patient_est_notifie_quand_l_admin_deplace_son_rendez_vous(): void
    {
        $medecin = $this->medecinAvecLundi();
        $patient = $this->patientProfil();
        $rdv = $this->rdv($medecin, $patient, '2026-11-02 09:00:00', 'confirme');

        $this->admin();
        $this->patchJson("/api/admin/rendez-vous/{$rdv->id}", ['date_heure' => '2026-11-02 10:00'])->assertOk();

        Sanctum::actingAs($patient->user);
        $this->getJson('/api/notifications')->assertJsonPath('data.0.data.evenement', 'modifie');
    }

    public function test_un_utilisateur_ne_peut_pas_lire_la_notification_d_un_autre(): void
    {
        $medecin = $this->medecinAvecLundi();
        $a = $this->patientProfil();
        $b = $this->patientProfil();
        $rdv = $this->rdv($medecin, $a, '2026-11-02 09:00:00', 'en_attente');

        Sanctum::actingAs($medecin->user);
        $this->patchJson("/api/rendez-vous/{$rdv->id}/statut", ['statut' => 'confirme'])->assertOk();

        Sanctum::actingAs($a->user);
        $id = $this->getJson('/api/notifications')->json('data.0.id');

        Sanctum::actingAs($b->user);
        $this->postJson("/api/notifications/{$id}/lire")->assertNotFound();
    }

    public function test_reinitialisation_du_mot_de_passe_par_lien(): void
    {
        \Illuminate\Support\Facades\Notification::fake();
        $user = $this->user('patient');
        $user->update(['password' => 'ancien1234']);

        $this->postJson('/api/mot-de-passe/oublie', ['email' => $user->email])->assertOk();
        \Illuminate\Support\Facades\Notification::assertSentTo($user, \Illuminate\Auth\Notifications\ResetPassword::class);

        // compte inconnu : même réponse, mais rien n'est envoyé
        $this->postJson('/api/mot-de-passe/oublie', ['email' => 'inconnu@test.sn'])->assertOk();
        \Illuminate\Support\Facades\Notification::assertCount(1);

        $token = \Illuminate\Support\Facades\Password::createToken($user);

        // confirmation différente : refusée
        $this->postJson('/api/mot-de-passe/reinitialiser', [
            'token' => $token, 'email' => $user->email,
            'password' => 'nouveau1234', 'password_confirmation' => 'autre1234',
        ])->assertStatus(422);

        $this->postJson('/api/mot-de-passe/reinitialiser', [
            'token' => $token, 'email' => $user->email,
            'password' => 'nouveau1234', 'password_confirmation' => 'nouveau1234',
        ])->assertOk();

        // le lien ne sert qu'une fois
        $this->postJson('/api/mot-de-passe/reinitialiser', [
            'token' => $token, 'email' => $user->email,
            'password' => 'autre12345', 'password_confirmation' => 'autre12345',
        ])->assertStatus(422);

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'nouveau1234'])->assertOk();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'ancien1234'])->assertStatus(401);
    }

    public function test_changement_de_mot_de_passe_exige_l_ancien_mot_de_passe(): void
    {
        $user = $this->user('patient');
        $user->update(['password' => 'ancien1234']);
        Sanctum::actingAs($user);

        $this->postJson('/api/me/mot-de-passe', [
            'current_password' => 'faux', 'password' => 'nouveau1234', 'password_confirmation' => 'nouveau1234',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');

        // nouveau mot de passe identique à l'ancien : refusé
        $this->postJson('/api/me/mot-de-passe', [
            'current_password' => 'ancien1234', 'password' => 'ancien1234', 'password_confirmation' => 'ancien1234',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->postJson('/api/me/mot-de-passe', [
            'current_password' => 'ancien1234', 'password' => 'nouveau1234', 'password_confirmation' => 'nouveau1234',
        ])->assertOk();

        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('nouveau1234', $user->fresh()->password));
    }

    public function test_le_patient_renseigne_sa_date_de_naissance(): void
    {
        $patient = $this->patientConnecte();

        $this->postJson('/api/me', ['name' => 'Awa Diop', 'telephone' => '771234567', 'date_naissance' => '2999-01-01'])
            ->assertStatus(422)->assertJsonValidationErrors('date_naissance');

        $this->postJson('/api/me', ['name' => 'Awa Diop', 'telephone' => '771234567', 'date_naissance' => '1998-05-14'])
            ->assertOk();

        $this->assertSame('1998-05-14', \Carbon\Carbon::parse(Patient::find($patient->id)->date_naissance)->format('Y-m-d'));
    }

    public function test_profil_public_du_medecin_avec_horaires_et_prochain_creneau(): void
    {
        $medecin = $this->medecinAvecLundi(); // plage du lundi 9h-11h

        $this->getJson("/api/medecins/{$medecin->id}")
            ->assertOk()
            ->assertJsonCount(1, 'disponibilites')
            ->assertJsonPath('disponibilites.0.jour', 1)
            ->assertJsonPath('disponibilites.0.heure_debut', '09:00')
            ->assertJsonPath('prochain_creneau.date', '2026-10-26');

        // la liste publique ne calcule les créneaux que sur demande
        $this->getJson('/api/medecins')->assertOk()->assertJsonMissingPath('0.prochain_creneau');
        $this->getJson('/api/medecins?avec_creneaux=1')->assertOk()->assertJsonPath('0.prochain_creneau.heure', '09:00');
    }

    public function test_tableau_de_bord_et_liste_des_rendez_vous_du_patient(): void
    {
        $medecin = $this->medecinAvecLundi(); // lundi 26/10/2026 à 08:00
        $patient = $this->patientConnecte();
        $this->rdv($medecin, $patient, '2026-10-27 09:00:00', 'en_attente'); // demain
        $this->rdv($medecin, $patient, '2026-11-02 09:00:00', 'confirme');   // dans 7 jours
        $this->rdv($medecin, $patient, '2026-10-20 09:00:00', 'termine');    // passé
        $this->rdv($medecin, $patient, '2026-10-22 09:00:00', 'confirme');   // passé, jamais clôturé
        $this->rdv($medecin, $patient, '2026-11-03 09:00:00', 'annule');
        $this->rdv($medecin, $this->patientProfil(), '2026-10-28 09:00:00', 'en_attente'); // autre patient

        $this->getJson('/api/patient/tableau-de-bord')
            ->assertOk()
            ->assertJsonPath('rendez_vous.a_venir', 2)
            ->assertJsonPath('rendez_vous.en_attente', 1)
            ->assertJsonPath('rendez_vous.confirmes', 1)
            ->assertJsonPath('rendez_vous.termines', 1)
            ->assertJsonPath('rendez_vous.annules', 1)
            ->assertJsonPath('prochain.statut', 'en_attente')
            ->assertJsonPath('prochain.modifiable', true)
            ->assertJsonPath('prochain.delai_modification_heures', 24);

        $this->getJson('/api/patient/rendez-vous?onglet=avenir')
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('data.0.statut', 'en_attente') // le plus proche d'abord
            ->assertJsonPath('compteurs.avenir', 2)
            ->assertJsonPath('compteurs.passes', 2)
            ->assertJsonPath('compteurs.annules', 1);

        $this->getJson('/api/patient/rendez-vous?onglet=passes')->assertJsonPath('total', 2);
        $this->getJson('/api/patient/rendez-vous?onglet=annules')->assertJsonPath('total', 1);
        $this->getJson('/api/patient/rendez-vous?onglet=autre')->assertStatus(422);
    }

    // ---------- Alignement sur le diagramme de classes ----------

    public function test_un_medecin_peut_avoir_plusieurs_specialites_et_apparait_pour_chacune(): void
    {
        $cardio = Specialite::firstOrCreate(['nom' => 'Cardiologie']);
        $pedia = Specialite::firstOrCreate(['nom' => 'Pédiatrie']);
        $this->admin();

        $id = $this->postJson('/api/admin/medecins', [
            'prenom' => 'Awa', 'nom' => 'Sy', 'email' => 'awa.sy@clinique.sn', 'password' => 'motdepasse1',
            'telephone' => '771112233', 'adresse' => 'Dakar, Plateau',
            'specialite_ids' => [$pedia->id, $cardio->id], 'numero_ordre' => 'ORD-77', 'tarif_consultation' => 8000,
        ])->assertCreated()
            ->assertJsonPath('medecin.user.name', 'Awa Sy')
            ->assertJsonPath('medecin.user.adresse', 'Dakar, Plateau')
            ->assertJsonCount(2, 'medecin.specialites')
            ->assertJsonPath('medecin.specialite.nom', 'Pédiatrie') // la première est la principale
            ->json('medecin.id');

        $this->assertDatabaseCount('medecin_specialite', 2);

        // visible dans l'annuaire pour chacune de ses spécialités
        $this->getJson("/api/medecins?specialite_id={$cardio->id}")->assertJsonCount(1);
        $this->getJson("/api/medecins?specialite_id={$pedia->id}")
            ->assertJsonCount(1)
            ->assertJsonPath('0.specialites_libelle', 'Pédiatrie, Cardiologie');
        $this->getJson("/api/admin/medecins?specialite_id={$cardio->id}")->assertJsonCount(1, 'data');

        // un rendez-vous compte dans chacune des spécialités du médecin
        $this->rdv(Medecin::find($id), $this->patientProfil(), now()->addDay(), 'en_attente');
        $this->getJson('/api/admin/tableau-de-bord')->assertJsonCount(2, 'par_specialite');

        // modification : une seule spécialité conservée, elle devient la principale
        $this->postJson("/api/admin/medecins/{$id}/modifier", [
            'prenom' => 'Awa', 'nom' => 'Sy', 'email' => 'awa.sy@clinique.sn', 'telephone' => '771112233',
            'specialite_ids' => [$cardio->id], 'numero_ordre' => 'ORD-77', 'tarif_consultation' => 8000,
        ])->assertOk()->assertJsonCount(1, 'medecin.specialites')->assertJsonPath('medecin.specialite.nom', 'Cardiologie');
        $this->assertDatabaseCount('medecin_specialite', 1);
    }

    public function test_un_medecin_doit_avoir_au_moins_une_specialite_valide(): void
    {
        $this->admin();
        $base = [
            'prenom' => 'Awa', 'nom' => 'Sy', 'email' => 'awa.sy@clinique.sn', 'password' => 'motdepasse1',
            'telephone' => '771112233', 'numero_ordre' => 'ORD-78', 'tarif_consultation' => 8000,
        ];

        $this->postJson('/api/admin/medecins', $base)->assertStatus(422)->assertJsonValidationErrors('specialite_ids');
        $this->postJson('/api/admin/medecins', $base + ['specialite_ids' => []])->assertStatus(422);
        $this->postJson('/api/admin/medecins', $base + ['specialite_ids' => [9999]])->assertStatus(422);
    }

    public function test_le_medecin_refuse_une_demande_avec_le_statut_refuse(): void
    {
        $medecin = $this->medecinAvecLundi();
        $patient = $this->patientProfil();
        $demande = $this->rdv($medecin, $patient, '2026-11-02 09:00:00', 'en_attente');
        $confirme = $this->rdv($medecin, $patient, '2026-11-02 10:00:00', 'confirme');

        Sanctum::actingAs($medecin->user);

        // un rendez-vous confirmé ne se refuse pas : il s'annule ; une demande ne s'annule pas : elle se refuse
        $this->patchJson("/api/rendez-vous/{$confirme->id}/statut", ['statut' => 'refuse'])->assertStatus(422);
        $this->patchJson("/api/rendez-vous/{$demande->id}/statut", ['statut' => 'annule'])->assertStatus(422);

        $this->patchJson("/api/rendez-vous/{$demande->id}/statut", ['statut' => 'refuse'])->assertOk();
        $this->patchJson("/api/rendez-vous/{$confirme->id}/statut", ['statut' => 'annule'])->assertOk();
        $this->assertDatabaseHas('rendez_vous', ['id' => $demande->id, 'statut' => 'refuse']);
        $this->assertDatabaseHas('rendez_vous', ['id' => $confirme->id, 'statut' => 'annule']);

        $this->getJson('/api/medecin/tableau-de-bord')
            ->assertJsonPath('rendez_vous.refuses', 1)
            ->assertJsonPath('rendez_vous.annules', 1);

        // les créneaux refusés ou annulés sont de nouveau libres
        $this->getJson("/api/medecins/{$medecin->id}/creneaux")
            ->assertJsonPath('2026-11-02', ['09:00', '09:30', '10:00', '10:30']);

        // le patient retrouve la demande refusée avec les annulés, et en est notifié
        Sanctum::actingAs($patient->user);
        $this->getJson('/api/patient/rendez-vous?onglet=annules')->assertJsonPath('total', 2);
        $this->getJson('/api/notifications')->assertJsonFragment(['evenement' => 'refuse']);
    }

    public function test_une_plage_inactive_ne_genere_pas_de_creneaux(): void
    {
        $medecin = $this->medecinAvecLundi(); // plage active : lundi 9h-11h
        Sanctum::actingAs($medecin->user);

        $this->putJson('/api/medecin/disponibilites', ['plages' => [
            ['jour' => 1, 'heure_debut' => '09:00', 'heure_fin' => '11:00', 'duree' => 30, 'actif' => false],
            ['jour' => 2, 'heure_debut' => '14:00', 'heure_fin' => '16:00', 'duree' => 30],
        ]])->assertOk();

        $this->getJson('/api/medecin/disponibilites')
            ->assertJsonCount(2)
            ->assertJsonPath('0.actif', false)
            ->assertJsonPath('1.actif', true);

        $creneaux = $this->getJson("/api/medecins/{$medecin->id}/creneaux")->json();
        $this->assertArrayNotHasKey('2026-10-26', $creneaux); // lundi désactivé
        $this->assertArrayHasKey('2026-10-27', $creneaux);    // mardi actif

        // le profil public n'affiche que les plages actives
        $this->getJson("/api/medecins/{$medecin->id}")
            ->assertJsonCount(1, 'disponibilites')
            ->assertJsonPath('disponibilites.0.jour', 2);

        // une plage inactive peut chevaucher une plage active
        $this->putJson('/api/medecin/disponibilites', ['plages' => [
            ['jour' => 3, 'heure_debut' => '09:00', 'heure_fin' => '12:00', 'duree' => 30],
            ['jour' => 3, 'heure_debut' => '10:00', 'heure_fin' => '11:00', 'duree' => 30, 'actif' => false],
        ]])->assertOk();
    }

    public function test_inscription_patient_avec_nom_prenom_adresse_et_sexe(): void
    {
        Storage::fake();
        $base = [
            'prenom' => 'Awa', 'nom' => 'Diop', 'adresse' => 'Pikine, Dakar', 'sexe' => 'F',
            'email' => 'awa.diop@test.sn', 'telephone' => '771234567',
            'password' => 'password123', 'password_confirmation' => 'password123',
        ];
        $photo = fn () => UploadedFile::fake()->create('p.jpg', 50, 'image/jpeg');

        $this->post('/api/register', $base + ['photo' => $photo()], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('user.name', 'Awa Diop')
            ->assertJsonPath('user.prenom', 'Awa')
            ->assertJsonPath('user.nom', 'Diop')
            ->assertJsonPath('user.adresse', 'Pikine, Dakar');

        $patient = User::where('email', 'awa.diop@test.sn')->first()->patient;
        $this->assertSame('F', $patient->sexe);

        // l'administrateur voit l'adresse et le sexe du patient
        $this->admin();
        $this->getJson("/api/admin/patients/{$patient->id}")
            ->assertOk()
            ->assertJsonPath('sexe', 'F')
            ->assertJsonPath('user.adresse', 'Pikine, Dakar');

        // sexe invalide
        $this->post('/api/register', array_merge($base, ['email' => 'autre@test.sn', 'sexe' => 'X', 'photo' => $photo()]), ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('sexe');

        // prénom manquant
        $sansPrenom = $base;
        unset($sansPrenom['prenom']);
        $this->post('/api/register', array_merge($sansPrenom, ['email' => 'autre2@test.sn', 'photo' => $photo()]), ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('prenom');
    }

    public function test_le_profil_met_a_jour_nom_prenom_adresse_et_sexe(): void
    {
        $patient = $this->patientConnecte();

        $this->postJson('/api/me', [
            'prenom' => 'Fatou', 'nom' => 'Ndiaye', 'adresse' => 'Rufisque', 'telephone' => '781234567', 'sexe' => 'F',
        ])->assertOk()->assertJsonPath('user.name', 'Fatou Ndiaye');

        $this->assertDatabaseHas('users', [
            'id' => $patient->user_id, 'prenom' => 'Fatou', 'nom' => 'Ndiaye', 'name' => 'Fatou Ndiaye', 'adresse' => 'Rufisque',
        ]);
        $this->assertDatabaseHas('patients', ['id' => $patient->id, 'sexe' => 'F']);
    }

    public function test_le_nom_complet_est_synchronise_avec_nom_et_prenom(): void
    {
        $u = User::factory()->create(['role' => 'patient', 'name' => 'Moussa Fall']);
        $this->assertSame(['Moussa', 'Fall'], [$u->prenom, $u->nom]);

        $u->update(['prenom' => 'Mamadou', 'nom' => 'Sarr']);
        $this->assertSame('Mamadou Sarr', $u->fresh()->name);

        $u->update(['name' => 'Aminata Ba Diallo']);
        $this->assertSame(['Aminata', 'Ba Diallo'], [$u->fresh()->prenom, $u->fresh()->nom]);
    }
}
