import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { PHOTO_MAX, PHOTO_TYPES, TEL_ERREUR, TEL_REGEX, chiffres } from '../../services/validators';
import { AvatarComponent } from '../avatar/avatar';
import { NavbarComponent } from '../navbar/navbar';

// Gestion du profil (patient, médecin ou administrateur)
@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, AvatarComponent],
  template: `
    <app-navbar titre="Mon profil"></app-navbar>
    <div class="page petit">
      <div class="card entete">
        <h1>Mon profil</h1>
        <p class="muted" style="margin: 0">Mettez à jour vos informations personnelles.</p>
      </div>

      <div *ngIf="message()" class="alert-box success">{{ message() }}</div>
      <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

      <form class="card" *ngIf="charge()" (ngSubmit)="enregistrer()">
        <div class="photo-ligne">
          <label for="photo" class="photo-cliquable" title="Changer la photo">
            <img *ngIf="apercu()" [src]="apercu()" alt="Nouvelle photo" class="apercu">
            <app-avatar *ngIf="!apercu()" [url]="photoActuelle()" [nom]="form.name" [taille]="92"></app-avatar>
          </label>
          <div>
            <label for="photo" class="btn light small">Changer la photo</label>
            <div class="hint" style="margin-top: 6px">JPG, PNG ou WEBP — 2 Mo maximum.</div>
          </div>
          <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" (change)="onPhoto($event)" hidden>
        </div>

        <div class="field">
          <label>Nom complet</label>
          <input type="text" [(ngModel)]="form.name" name="name" required>
        </div>

        <div class="field">
          <label>Adresse email</label>
          <input type="email" [value]="email" disabled>
          <span class="hint">L'adresse email ne peut pas être modifiée.</span>
        </div>

        <div class="field">
          <label>Téléphone</label>
          <input type="tel" inputmode="numeric" maxlength="9" name="telephone" required
                 [value]="form.telephone" (input)="onTel($event)" placeholder="771234567">
          <span class="hint" [class.ok]="telValide()" [class.ko]="form.telephone.length > 0 && !telValide()">
            {{ telValide() ? 'Numéro valide' : '9 chiffres, commence par 77, 78, 76 ou 75' }}
          </span>
        </div>

        <ng-container *ngIf="estMedecin">
          <div class="field">
            <label>Tarif de consultation (FCFA)</label>
            <input type="number" min="0" [(ngModel)]="form.tarif_consultation" name="tarif" required>
          </div>
          <div class="field">
            <label>Présentation</label>
            <textarea [(ngModel)]="form.biographie" name="bio" rows="4" maxlength="2000"></textarea>
          </div>
        </ng-container>

        <button type="submit" class="btn" [disabled]="loading()">
          {{ loading() ? 'Enregistrement...' : 'Enregistrer les modifications' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .petit { max-width: 640px; }
    .photo-ligne { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; }
    .photo-cliquable { cursor: pointer; }
    .apercu { width: 92px; height: 92px; border-radius: 50%; object-fit: cover; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(16, 24, 40, .18); }
    .hint.ok { color: var(--vert); font-weight: 500; }
    .hint.ko { color: var(--rouge); font-weight: 500; }
    label.btn { cursor: pointer; }
  `]
})
export class ProfilComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  charge = signal(false);
  loading = signal(false);
  message = signal('');
  error = signal('');
  apercu = signal<string | null>(null);
  photoActuelle = signal<string | null>(null);

  estMedecin = false;
  email = '';
  photo: File | null = null;
  form = { name: '', telephone: '', tarif_consultation: null as number | null, biographie: '' };

  ngOnInit() {
    this.api.me().subscribe({
      next: (u) => {
        this.estMedecin = u.role === 'medecin' && !!u.medecin;
        this.email = u.email;
        this.photoActuelle.set(u.photo_url ?? null);
        this.form = {
          name: u.name,
          telephone: u.telephone ?? '',
          tarif_consultation: u.medecin?.tarif_consultation ?? null,
          biographie: u.medecin?.biographie ?? ''
        };
        this.charge.set(true);
      },
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }

  ngOnDestroy() {
    this.libererApercu();
  }

  onTel(event: Event) {
    const input = event.target as HTMLInputElement;
    this.form.telephone = chiffres(input.value);
    input.value = this.form.telephone;
  }

  telValide(): boolean {
    return TEL_REGEX.test(this.form.telephone);
  }

  onPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    if (!PHOTO_TYPES.includes(file.type) || file.size > PHOTO_MAX) {
      input.value = '';
      this.error.set(!PHOTO_TYPES.includes(file.type) ? 'La photo doit être au format JPG, PNG ou WEBP.' : 'La photo dépasse 2 Mo.');
      return;
    }
    this.error.set('');
    this.photo = file;
    this.libererApercu();
    this.apercu.set(URL.createObjectURL(file));
  }

  enregistrer() {
    this.message.set('');
    this.error.set('');

    if (!this.telValide()) {
      this.error.set(TEL_ERREUR);
      return;
    }

    const data = new FormData();
    data.append('name', this.form.name);
    data.append('telephone', this.form.telephone);
    if (this.photo) data.append('photo', this.photo);
    if (this.estMedecin) {
      data.append('tarif_consultation', String(this.form.tarif_consultation ?? ''));
      data.append('biographie', this.form.biographie ?? '');
    }

    this.loading.set(true);
    this.api.updateProfil(data).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.auth.updateUser(res.user);
        this.photoActuelle.set(res.user.photo_url ?? null);
        this.photo = null;
        this.libererApercu();
        this.apercu.set(null);
        this.message.set(res.message);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const messages = ApiService.validationMessages(err);
        this.error.set(messages.length ? messages.join('\n') : ApiService.errorMessage(err, 'Enregistrement impossible.'));
      }
    });
  }

  private libererApercu() {
    const url = this.apercu();
    if (url) URL.revokeObjectURL(url);
  }
}
