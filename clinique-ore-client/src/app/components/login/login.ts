import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { LogoComponent } from '../logo/logo';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LogoComponent],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  private apiService = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  credentials = { email: '', password: '' };

  // Signaux : l'écran se met à jour dès que la réponse de l'API arrive
  errorMessage = signal('');
  loading = signal(false);
  // Session déjà ouverte dans cet onglet (on propose de continuer, sans rediriger de force)
  sessionActive = signal<any>(this.auth.isLoggedIn() ? this.auth.user : null);

  onLogin() {
    this.errorMessage.set('');
    this.loading.set(true);

    this.apiService.login(this.credentials).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.auth.save(response);
        // Redirection selon le rôle (patient, médecin, admin)
        this.router.navigate([this.auth.homeRoute()]);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(ApiService.errorMessage(err, 'Email ou mot de passe incorrect.'));
      }
    });
  }

  continuer() {
    this.router.navigate([this.auth.homeRoute()]);
  }

  changerDeCompte() {
    const done = () => {
      this.auth.clear();
      this.sessionActive.set(null);
    };
    this.apiService.logout().subscribe({ next: done, error: done });
  }
}
