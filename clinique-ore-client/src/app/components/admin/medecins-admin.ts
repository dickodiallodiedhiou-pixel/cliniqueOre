import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { PHOTO_MAX, PHOTO_TYPES, TEL_ERREUR, TEL_REGEX, chiffres } from '../../services/validators';
import { libelleStatutMedecin } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';
import { IconeComponent } from '../icone/icone';
import { PaginationComponent } from '../pagination/pagination';

@Component({
  selector: 'app-medecins-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent, IconeComponent, PaginationComponent],
  template: `
    <div class="card entete">
      <div class="ligne">
        <div class="grow">
          <h1>Médecins</h1>
          <p class="muted" style="margin: 0">Ajoutez, modifiez et activez les comptes des médecins de la clinique.</p>
        </div>
        <button class="btn" (click)="ouvrirCreation()"><app-icone nom="plus" [taille]="16"></app-icone>&nbsp;Ajouter un médecin</button>
      </div>
    </div>

    <div *ngIf="message()" class="alert-box success">{{ message() }}</div>
    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

    <!-- Formulaire d'ajout / de modification -->
    <form class="card panneau" *ngIf="formOuvert()" (ngSubmit)="enregistrer()">
      <h3>{{ edition() ? 'Modifier le médecin' : 'Ajouter un médecin' }}</h3>
      <div *ngIf="erreurForm()" class="alert-box error">{{ erreurForm() }}</div>

      <div class="photo-ligne">
        <label for="photo-med" class="photo-cliquable">
          <img *ngIf="apercu()" [src]="apercu()" alt="Aperçu" class="apercu">
          <app-avatar *ngIf="!apercu()" [url]="edition()?.user?.photo_url" [nom]="form.name || 'Dr'" [taille]="72"></app-avatar>
        </label>
        <div>
          <label for="photo-med" class="btn light small">{{ edition() ? 'Changer la photo' : 'Ajouter une photo' }}</label>
          <div class="hint" style="margin-top: 4px">Facultative — JPG, PNG ou WEBP, 2 Mo maximum.</div>
        </div>
        <input id="photo-med" type="file" accept="image/jpeg,image/png,image/webp" (change)="onPhoto($event)" hidden>
      </div>

      <div class="deux">
        <div class="field"><label>Nom complet</label><input type="text" [(ngModel)]="form.name" name="name" required></div>
        <div class="field"><label>Adresse email</label><input type="email" [(ngModel)]="form.email" name="email" required></div>
      </div>
      <div class="deux">
        <div class="field">
          <label>Téléphone</label>
          <input type="tel" inputmode="numeric" maxlength="9" name="telephone" required
                 [value]="form.telephone" (input)="onTel($event)" placeholder="771234567">
          <span class="hint" [class.ok]="telValide()" [class.ko]="form.telephone.length > 0 && !telValide()">
            {{ telValide() ? 'Numéro valide' : '9 chiffres, commence par 77, 78, 76 ou 75' }}
          </span>
        </div>
        <div class="field">
          <label>Spécialité</label>
          <select [(ngModel)]="form.specialite_id" name="specialite_id" required>
            <option [ngValue]="null" disabled>Choisir une spécialité</option>
            <option *ngFor="let s of specialitesDisponibles()" [ngValue]="s.id">{{ s.nom }}{{ s.actif ? '' : ' (désactivée)' }}</option>
          </select>
        </div>
      </div>
      <div class="deux">
        <div class="field"><label>N° d'inscription à l'Ordre</label><input type="text" [(ngModel)]="form.numero_ordre" name="numero_ordre" required></div>
        <div class="field"><label>Tarif de consultation (FCFA)</label><input type="number" min="0" [(ngModel)]="form.tarif_consultation" name="tarif" required></div>
      </div>
      <div class="field"><label>Présentation (facultatif)</label><textarea [(ngModel)]="form.biographie" name="bio" rows="3" maxlength="2000"></textarea></div>
      <div class="field">
        <label>{{ edition() ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe provisoire' }}</label>
        <input type="password" [(ngModel)]="form.password" name="password" [required]="!edition()" minlength="8" autocomplete="new-password" placeholder="8 caractères minimum">
      </div>

      <div class="row">
        <button type="submit" class="btn" [disabled]="enregistrement()">
          {{ enregistrement() ? 'Enregistrement...' : (edition() ? 'Enregistrer les modifications' : 'Ajouter le médecin') }}
        </button>
        <button type="button" class="btn light" (click)="fermerForm()">Annuler</button>
      </div>
    </form>

    <!-- Filtres -->
    <form class="outils" (ngSubmit)="charger(1)">
      <div class="field"><label>Recherche</label><input type="search" [(ngModel)]="filtres.q" name="q" placeholder="Nom, email, n° d'ordre"></div>
      <div class="field">
        <label>Statut</label>
        <select [(ngModel)]="filtres.statut" name="statut" (change)="charger(1)">
          <option value="">Tous</option><option value="approved">Approuvés</option><option value="pending">En attente</option><option value="rejected">Refusés</option>
        </select>
      </div>
      <div class="field">
        <label>Spécialité</label>
        <select [(ngModel)]="filtres.specialite_id" name="specialite" (change)="charger(1)">
          <option value="">Toutes</option>
          <option *ngFor="let s of specialites()" [value]="s.id">{{ s.nom }}</option>
        </select>
      </div>
      <div class="field">
        <label>Compte</label>
        <select [(ngModel)]="filtres.actif" name="actif" (change)="charger(1)">
          <option value="">Tous</option><option value="true">Actifs</option><option value="false">Désactivés</option>
        </select>
      </div>
      <button type="submit" class="btn light">Rechercher</button>
    </form>

    <p *ngIf="chargement()" class="muted">Chargement...</p>
    <p *ngIf="!chargement() && medecins().length === 0" class="muted">Aucun médecin ne correspond à ces critères.</p>

    <div class="card" *ngFor="let m of medecins()" [class.inactif]="!m.user?.actif">
      <div class="ligne">
        <app-avatar [url]="m.user?.photo_url" [nom]="m.user?.name || ''" [taille]="56"></app-avatar>
        <div class="grow">
          <h3>Dr {{ m.user?.name }}</h3>
          <div class="muted">{{ m.specialite?.nom }} · N° {{ m.numero_ordre }} · {{ m.tarif_consultation | number }} FCFA</div>
          <div class="muted">{{ m.user?.email }} · {{ m.user?.telephone }}</div>
          <div class="pastilles">
            <span class="badge" [ngClass]="m.statut_validation">{{ libelleStatut(m.statut_validation) }}</span>
            <span class="badge rejected" *ngIf="!m.user?.actif">Compte désactivé</span>
            <span class="badge">{{ m.rendez_vous_count }} rendez-vous</span>
          </div>
        </div>
        <div class="row">
          <button class="btn light small" (click)="modifier(m)">Modifier</button>
          <button class="btn light small" (click)="voirRdv(m)">Rendez-vous</button>
          <button class="btn small" [ngClass]="m.user?.actif ? 'danger' : 'ok'" (click)="basculer(m)">
            {{ m.user?.actif ? 'Désactiver' : 'Activer' }}
          </button>
        </div>
      </div>
    </div>

    <app-pagination [page]="page()" [derniere]="derniere()" [total]="total()" (aller)="charger($event)"></app-pagination>
  `,
  styles: [`
    .inactif { opacity: .75; background: #fafbfd; }
    .deux { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 640px) { .deux { grid-template-columns: 1fr; } }
    .photo-ligne { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
    .photo-cliquable { cursor: pointer; }
    .apercu { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(16, 24, 40, .18); }
    .hint.ok { color: var(--vert); font-weight: 500; } .hint.ko { color: var(--rouge); font-weight: 500; }
    label.btn { cursor: pointer; }
  `]
})
export class MedecinsAdminComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  medecins = signal<any[]>([]);
  specialites = signal<any[]>([]);
  page = signal(1);
  derniere = signal(1);
  total = signal(0);
  chargement = signal(false);
  message = signal('');
  error = signal('');

  filtres = { q: '', statut: '', specialite_id: '', actif: '' };

  formOuvert = signal(false);
  edition = signal<any>(null);
  enregistrement = signal(false);
  erreurForm = signal('');
  apercu = signal<string | null>(null);
  photo: File | null = null;
  form = this.formVide();
  libelleStatut = libelleStatutMedecin;

  private formVide() {
    return {
      name: '', email: '', telephone: '', password: '',
      specialite_id: null as number | null, numero_ordre: '',
      tarif_consultation: null as number | null, biographie: ''
    };
  }

  ngOnInit() {
    this.api.adminSpecialites().subscribe({ next: (l) => this.specialites.set(l), error: () => this.specialites.set([]) });
    this.charger(1);
    if (this.route.snapshot.queryParamMap.get('nouveau')) {
      this.ouvrirCreation();
    }
  }

  ngOnDestroy() {
    this.libererApercu();
  }

  // Spécialités proposées dans le formulaire : actives, plus celle déjà associée au médecin modifié
  specialitesDisponibles() {
    return this.specialites().filter((s) => s.actif || s.id === this.form.specialite_id);
  }

  charger(page = 1) {
    this.chargement.set(true);
    this.api.adminMedecins({ ...this.filtres, page }).subscribe({
      next: (r) => {
        this.medecins.set(r.data);
        this.page.set(r.current_page);
        this.derniere.set(r.last_page);
        this.total.set(r.total);
        this.chargement.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.chargement.set(false);
        this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'));
      }
    });
  }

  ouvrirCreation() {
    this.edition.set(null);
    this.form = this.formVide();
    this.reinitialiserPhoto();
    this.erreurForm.set('');
    this.formOuvert.set(true);
  }

  modifier(m: any) {
    this.edition.set(m);
    this.form = {
      name: m.user.name, email: m.user.email, telephone: m.user.telephone ?? '', password: '',
      specialite_id: m.specialite_id, numero_ordre: m.numero_ordre ?? '',
      tarif_consultation: m.tarif_consultation, biographie: m.biographie ?? ''
    };
    this.reinitialiserPhoto();
    this.erreurForm.set('');
    this.message.set('');
    this.formOuvert.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  fermerForm() {
    this.formOuvert.set(false);
    this.reinitialiserPhoto();
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
      this.erreurForm.set(!PHOTO_TYPES.includes(file.type) ? 'La photo doit être au format JPG, PNG ou WEBP.' : 'La photo dépasse 2 Mo.');
      return;
    }
    this.erreurForm.set('');
    this.photo = file;
    this.libererApercu();
    this.apercu.set(URL.createObjectURL(file));
  }

  enregistrer() {
    this.erreurForm.set('');
    if (!this.telValide()) {
      this.erreurForm.set(TEL_ERREUR);
      return;
    }
    if (!this.form.specialite_id) {
      this.erreurForm.set('Choisissez une spécialité.');
      return;
    }

    const data = new FormData();
    data.append('name', this.form.name);
    data.append('email', this.form.email);
    data.append('telephone', this.form.telephone);
    data.append('specialite_id', String(this.form.specialite_id));
    data.append('numero_ordre', this.form.numero_ordre);
    data.append('tarif_consultation', String(this.form.tarif_consultation ?? ''));
    data.append('biographie', this.form.biographie ?? '');
    if (this.form.password) data.append('password', this.form.password);
    if (this.photo) data.append('photo', this.photo);

    const edition = this.edition();
    this.enregistrement.set(true);

    const requete = edition ? this.api.adminModifierMedecin(edition.id, data) : this.api.adminCreerMedecin(data);
    requete.subscribe({
      next: (res) => {
        this.enregistrement.set(false);
        this.message.set(res.message);
        this.fermerForm();
        this.charger(edition ? this.page() : 1);
      },
      error: (err: HttpErrorResponse) => {
        this.enregistrement.set(false);
        const messages = ApiService.validationMessages(err);
        this.erreurForm.set(messages.length ? messages.join('\n') : ApiService.errorMessage(err, 'Enregistrement impossible.'));
      }
    });
  }

  basculer(m: any) {
    const actif = !m.user?.actif;
    if (!actif && !confirm(`Désactiver le compte de Dr ${m.user.name} ? Il ne pourra plus se connecter et disparaîtra de l'annuaire.`)) {
      return;
    }
    this.error.set('');
    this.api.adminActifMedecin(m.id, actif).subscribe({
      next: (res) => {
        this.message.set(res.message);
        this.charger(this.page());
      },
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Action impossible.'))
    });
  }

  voirRdv(m: any) {
    this.router.navigate(['/admin/rendez-vous'], { queryParams: { medecin_id: m.id } });
  }

  private reinitialiserPhoto() {
    this.libererApercu();
    this.apercu.set(null);
    this.photo = null;
  }

  private libererApercu() {
    const url = this.apercu();
    if (url) URL.revokeObjectURL(url);
  }
}
