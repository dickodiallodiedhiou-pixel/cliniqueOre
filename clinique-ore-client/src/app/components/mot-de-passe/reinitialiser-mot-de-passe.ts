import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { LogoComponent } from '../logo/logo';

@Component({
  selector: 'app-reinitialiser-mot-de-passe',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LogoComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="logo-zone"><app-logo></app-logo></div>
        <h1>Nouveau mot de passe</h1>
        <p class="sous" *ngIf="!succes()">Choisissez un nouveau mot de passe pour <strong>{{ email }}</strong>.</p>

        <div *ngIf="error()" class="alert-box error">{{ error() }}</div>
        <div *ngIf="succes()" class="alert-box success">
          {{ succes() }}
          <div style="margin-top: 8px"><a routerLink="/login" class="btn small">Se connecter</a></div>
        </div>

        <div *ngIf="!token || !email" class="alert-box error">
          Lien incomplet. <a routerLink="/mot-de-passe-oublie">Faire une nouvelle demande</a>
        </div>

        <form (ngSubmit)="valider()" *ngIf="token && email && !succes()">
          <div class="field">
            <label>Nouveau mot de passe</label>
            <input type="password" [(ngModel)]="password" name="password" required minlength="8" placeholder="8 caractères minimum" autocomplete="new-password">
          </div>
          <div class="field">
            <label>Confirmation</label>
            <input type="password" [(ngModel)]="confirmation" name="confirmation" required placeholder="Répétez le mot de passe" autocomplete="new-password">
          </div>
          <button type="submit" class="btn btn-block" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement...' : 'Enregistrer le mot de passe' }}
          </button>
        </form>
      </div>
    </div>
  `
})
export class ReinitialiserMotDePasseComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  token = '';
  email = '';
  password = '';
  confirmation = '';
  envoi = signal(false);
  error = signal('');
  succes = signal('');

  ngOnInit() {
    const q = this.route.snapshot.queryParamMap;
    this.token = q.get('token') ?? '';
    this.email = q.get('email') ?? '';
  }

  valider() {
    this.error.set('');
    if (this.password.length < 8) {
      this.error.set('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (this.password !== this.confirmation) {
      this.error.set('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    this.envoi.set(true);
    this.api
      .reinitialiserMotDePasse({
        token: this.token,
        email: this.email,
        password: this.password,
        password_confirmation: this.confirmation
      })
      .subscribe({
        next: (res) => {
          this.envoi.set(false);
          this.succes.set(res.message);
          setTimeout(() => this.router.navigate(['/login']), 4000);
        },
        error: (err: HttpErrorResponse) => {
          this.envoi.set(false);
          const messages = ApiService.validationMessages(err);
          this.error.set(messages.length ? messages.join('\n') : ApiService.errorMessage(err, 'Réinitialisation impossible.'));
        }
      });
  }
}
