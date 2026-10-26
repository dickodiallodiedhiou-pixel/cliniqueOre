import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { LoginComponent } from './components/login/login';
import { RegisterComponent } from './components/register/register';
import { PatientComponent } from './components/patient/patient';
import { MedecinComponent } from './components/medecin/medecin';
import { AdminComponent } from './components/admin/admin';
import { AnnuairePageComponent } from './components/annuaire/annuaire';
import { AuthService } from './services/auth';
import { guestGuard, roleGuard } from './services/guards';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },

  // Public : médecins vérifiés uniquement
  { path: 'annuaire', component: AnnuairePageComponent },

  // Espaces par rôle
  { path: 'patient', component: PatientComponent, canActivate: [roleGuard('patient')] },
  { path: 'medecin', component: MedecinComponent, canActivate: [roleGuard('medecin')] },
  { path: 'admin', component: AdminComponent, canActivate: [roleGuard('admin')] },

  // /dashboard envoie vers l'espace correspondant au rôle
  { path: 'dashboard', redirectTo: () => inject(AuthService).homeRoute() },
  { path: '**', redirectTo: 'login' }
];
