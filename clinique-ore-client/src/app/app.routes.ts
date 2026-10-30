import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AccueilComponent } from './components/accueil/accueil';
import { LoginComponent } from './components/login/login';
import { RegisterComponent } from './components/register/register';
import { PatientComponent } from './components/patient/patient';
import { MedecinComponent } from './components/medecin/medecin';
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

  // Public : médecins vérifiés uniquement
  { path: 'annuaire', component: AnnuairePageComponent },

  // Espaces par rôle
  { path: 'patient', component: PatientComponent, canActivate: [roleGuard('patient')] },
  { path: 'medecin', component: MedecinComponent, canActivate: [roleGuard('medecin')] },
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
