<?php

namespace Tests\Feature;

use App\Models\Medecin;
use App\Models\Patient;
use App\Models\Specialite;
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
            'telephone' => '770000000',
            'specialite_id' => $specialite->id,
            'numero_ordre' => 'ORD-1',
            'tarif_consultation' => 10000,
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
}
