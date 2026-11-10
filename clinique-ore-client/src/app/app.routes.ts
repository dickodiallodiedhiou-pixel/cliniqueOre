import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AccueilComponent } from './components/accueil/accueil';
import { LoginComponent } from './components/login/login';
import { RegisterComponent } from './components/register/register';
import { PatientLayoutComponent } from './components/patient/patient-layout';
import { TableauPatientComponent } from './components/patient/tableau-patient';
import { MesRendezVousComponent } from './components/patient/mes-rendez-vous';
import { NouveauRendezVousComponent } from './components/patient/nouveau-rendez-vous';
import { MedecinsPatientComponent } from './components/patient/medecins-patient';
import { ProfilMedecinPatientComponent } from './components/patient/profil-medecin';
import { NotificationsPatientComponent } from './components/patient/notifications-patient';
import { MotDePasseOublieComponent } from './components/mot-de-passe/mot-de-passe-oublie';
import { ReinitialiserMotDePasseComponent } from './components/mot-de-passe/reinitialiser-mot-de-passe';
import { MedecinLayoutComponent } from './components/medecin/medecin-layout';
import { TableauMedecinComponent } from './components/medecin/tableau-medecin';
import { RendezVousMedecinComponent } from './components/medecin/rendez-vous-medecin';
import { PlanningMedecinComponent } from './components/medecin/planning-medecin';
import { AdminLayoutComponent } from './components/admin/admin-layout';
import { TableauDeBordComponent } from './components/admin/tableau-de-bord';
import { ValidationsComponent } from './components/admin/validations';
import { MedecinsAdminComponent } from './components/admin/medecins-admin';
import { PatientsAdminComponent } from './components/admin/patients-admin';
import { SpecialitesAdminComponent } from './components/admin/specialites-admin';
import { RendezVousAdminComponent } from './components/admin/rendez-vous-admin';
import { JournalComponent } from './components/admin/journal';
import { AnnuairePageComponent } from './components/annuaire/annuaire';
import { ProfilComponent } from './components/profil/profil';
import { AuthService } from './services/auth';
import { roleGuard } from './services/guards';

export const routes: Routes = [
  { path: '', component: AccueilComponent, pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'mot-de-passe-oublie', component: MotDePasseOublieComponent },
  { path: 'reinitialiser-mot-de-passe', component: ReinitialiserMotDePasseComponent },

  // Public : médecins vérifiés uniquement
  { path: 'annuaire', component: AnnuairePageComponent },

  // Espaces par rôle
  {
    path: 'patient',
    component: PatientLayoutComponent,
    canActivate: [roleGuard('patient')],
    children: [
      { path: '', component: TableauPatientComponent, pathMatch: 'full' },
      { path: 'rendez-vous', component: MesRendezVousComponent },
      { path: 'rendez-vous/nouveau', component: NouveauRendezVousComponent },
      { path: 'medecins', component: MedecinsPatientComponent },
      { path: 'medecins/:id', component: ProfilMedecinPatientComponent },
      { path: 'notifications', component: NotificationsPatientComponent }
    ]
  },
  {
    path: 'medecin',
    component: MedecinLayoutComponent,
    canActivate: [roleGuard('medecin')],
    children: [
      { path: '', component: TableauMedecinComponent, pathMatch: 'full' },
      { path: 'rendez-vous', component: RendezVousMedecinComponent },
      { path: 'planning', component: PlanningMedecinComponent },
      { path: 'notifications', component: NotificationsPatientComponent }
    ]
  },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [roleGuard('admin')],
    children: [
      { path: '', component: TableauDeBordComponent, pathMatch: 'full' },
      { path: 'validations', component: ValidationsComponent },
      { path: 'medecins', component: MedecinsAdminComponent },
      { path: 'patients', component: PatientsAdminComponent },
      { path: 'specialites', component: SpecialitesAdminComponent },
      { path: 'rendez-vous', component: RendezVousAdminComponent },
      { path: 'journal', component: JournalComponent }
    ]
  },

  { path: 'profil', component: ProfilComponent, canActivate: [roleGuard('patient', 'medecin', 'admin')] },

  // /dashboard envoie vers l'espace correspondant au rôle
  { path: 'dashboard', redirectTo: () => inject(AuthService).homeRoute() },
  { path: '**', redirectTo: '' }
];
