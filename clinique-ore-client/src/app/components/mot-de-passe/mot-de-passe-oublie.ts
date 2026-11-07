import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { LogoComponent } from '../logo/logo';

@Component({
  selector: 'app-mot-de-passe-oublie',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LogoComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <a routerLink="/login" class="retour">&larr; Retour à la connexion</a>
        <div class="logo-zone"><app-logo></app-logo></div>
        <h1>Mot de passe oublié</h1>
        <p class="sous">Saisissez votre adresse email : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>

        <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

        <div *ngIf="message()" class="alert-box success">
          {{ message() }}
          <div *ngIf="lienDemo()" style="margin-top: 8px">
            <strong>Mode démonstration :</strong> aucun serveur d'email n'est configuré,
            utilisez ce lien directement.<br>
            <a [href]="lienDemo()" class="btn small" style="margin-top: 8px">Ouvrir le lien de réinitialisation</a>
          </div>
        </div>

        <form (ngSubmit)="envoyer()" *ngIf="!message()">
          <div class="field">
            <label for="email">Adresse email</label>
            <input type="email" id="email" [(ngModel)]="email" name="email" required placeholder="vous@exemple.com" autocomplete="email">
          </div>
          <button type="submit" class="btn btn-block" [disabled]="envoi()">
            {{ envoi() ? 'Envoi en cours...' : 'Envoyer le lien' }}
          </button>
        </form>
      </div>
    </div>
  `
})
export class MotDePasseOublieComponent {
  private api = inject(ApiService);

  email = '';
  envoi = signal(false);
  message = signal('');
  error = signal('');
  lienDemo = signal<string | null>(null);

  envoyer() {
    this.error.set('');
    this.envoi.set(true);
    this.api.motDePasseOublie(this.email.trim()).subscribe({
      next: (res) => {
        this.envoi.set(false);
        this.message.set(res.message);
        this.lienDemo.set(res.lien_demo ?? null);
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        const messages = ApiService.validationMessages(err);
        this.error.set(messages.length ? messages.join('\n') : ApiService.errorMessage(err, 'Envoi impossible.'));
      }
    });
  }
}
