import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { libelleRdv, prenom } from '../../services/ui';
import { NavbarComponent } from '../navbar/navbar';
import { AnnuaireComponent } from '../annuaire/annuaire';
import { AvatarComponent } from '../avatar/avatar';

@Component({
  selector: 'app-patient',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, AnnuaireComponent, AvatarComponent],
  template: `
    <app-navbar titre="Espace patient"></app-navbar>
    <div class="page">
      <div class="card entete">
        <h1>Bonjour {{ prenomUser }}</h1>
        <p class="muted" style="margin: 0">Retrouvez vos rendez-vous et prenez-en de nouveaux.</p>
      </div>

      <div *ngIf="message()" class="alert-box success">{{ message() }}</div>
      <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

      <!-- Choix du créneau (nouvelle réservation ou modification) -->
      <div class="card" *ngIf="choisi() as c">
        <h3>{{ edition() ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous' }} avec Dr {{ c.nom }}</h3>

        <p *ngIf="!creneauxCharges()" class="muted">Chargement des disponibilités...</p>
        <p *ngIf="creneauxCharges() && jours().length === 0" class="muted">
          Ce médecin n'a pas encore publié de disponibilités. Revenez plus tard.
        </p>

        <ng-container *ngIf="jours().length > 0">
          <div class="etiquette">1. Choisissez un jour</div>
          <div class="chips">
            <button type="button" class="chip" *ngFor="let j of jours()"
                    [class.on]="jourChoisi() === j" (click)="choisirJour(j)">
              {{ j | date: 'EEE d MMM' }}
            </button>
          </div>

          <ng-container *ngIf="jourChoisi()">
            <div class="etiquette">2. Choisissez un horaire</div>
            <div class="chips">
              <button type="button" class="chip" *ngFor="let h of heures()"
                      [class.on]="heureChoisie() === h" (click)="heureChoisie.set(h)">
                {{ h }}
              </button>
            </div>
          </ng-container>
        </ng-container>

        <div class="field" style="margin-top: 14px">
          <label>Motif (facultatif)</label>
          <textarea [(ngModel)]="form.motif" name="motif" rows="2" placeholder="Précisez brièvement le motif de la consultation"></textarea>
        </div>
        <div class="row">
          <button class="btn ok" (click)="valider()" [disabled]="loading() || !heureChoisie()">
            {{ edition() ? 'Enregistrer la modification' : 'Confirmer la réservation' }}
          </button>
          <button class="btn light" (click)="fermer()">Annuler</button>
        </div>
        <p *ngIf="edition()" class="muted" style="margin: 10px 0 0">
          Après modification, le rendez-vous repasse « en attente » : le médecin devra le confirmer à nouveau.
        </p>
      </div>

      <h2>Mes rendez-vous</h2>
      <p *ngIf="rdvs().length === 0" class="muted">Vous n'avez aucun rendez-vous pour le moment.</p>
      <div class="card" *ngFor="let r of rdvs()">
        <div class="row">
          <app-avatar [url]="r.medecin?.user?.photo_url" [nom]="r.medecin?.user?.name || ''" [taille]="44"></app-avatar>
          <div style="flex: 1">
            <strong>{{ r.date_heure | date: 'EEEE d MMMM y, HH:mm' }}</strong>
            <div>Dr {{ r.medecin?.user?.name }} <span class="muted">· {{ r.medecin?.specialite?.nom }}</span></div>
          </div>
          <span class="badge" [ngClass]="r.statut">{{ libelle(r.statut) }}</span>
        </div>
        <div *ngIf="r.motif" class="muted" style="margin-top: 6px">Motif : {{ r.motif }}</div>
        <div class="row" style="margin-top: 10px" *ngIf="r.statut === 'en_attente' || r.statut === 'confirme'">
          <button class="btn light small" (click)="modifier(r)">Modifier</button>
          <button class="btn danger small" (click)="annuler(r)">Annuler</button>
        </div>
      </div>

      <h2 style="margin-top: 28px">Prendre rendez-vous</h2>
      <app-annuaire [selectable]="true" (choisir)="nouveau($event)"></app-annuaire>
    </div>
  `,
  styles: [`
    .etiquette { font-weight: 600; margin: 12px 0 8px; color: var(--bleu-nuit); }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { font: inherit; font-size: .9rem; border: 1px solid var(--bordure); background: #fff; color: var(--bleu-fonce); border-radius: 10px; padding: 7px 14px; cursor: pointer; transition: all .12s; }
    .chip:hover { border-color: var(--bleu); }
    .chip.on { background: var(--bleu); color: #fff; border-color: var(--bleu); }
  `]
})
export class PatientComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  rdvs = signal<any[]>([]);
  choisi = signal<{ id: number; nom: string } | null>(null);
  edition = signal<any>(null); // rendez-vous en cours de modification
  message = signal('');
  error = signal('');
  loading = signal(false);

  // Créneaux libres du médecin choisi
  creneaux = signal<Record<string, string[]>>({});
  creneauxCharges = signal(false);
  jourChoisi = signal<string | null>(null);
  heureChoisie = signal<string | null>(null);
  jours = computed(() => Object.keys(this.creneaux()).sort());
  heures = computed(() => (this.jourChoisi() ? this.creneaux()[this.jourChoisi() as string] ?? [] : []));

  form = { motif: '' };
  prenomUser = prenom(this.auth.user?.name);
  libelle = libelleRdv;

  ngOnInit() {
    this.charger();
  }

  charger() {
    this.api.getRendezVous().subscribe({
      next: (list) => this.rdvs.set(list),
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }

  // Nouvelle réservation depuis l'annuaire
  nouveau(medecin: any) {
    this.edition.set(null);
    this.form.motif = '';
    this.ouvrir({ id: medecin.id, nom: medecin.nom });
  }

  // Modification d'un rendez-vous existant
  modifier(r: any) {
    this.edition.set(r);
    this.form.motif = r.motif ?? '';
    this.ouvrir({ id: r.medecin_id, nom: r.medecin?.user?.name ?? '' });
  }

  private ouvrir(medecin: { id: number; nom: string }) {
    this.message.set('');
    this.error.set('');
    this.choisi.set(medecin);
    this.creneaux.set({});
    this.creneauxCharges.set(false);
    this.jourChoisi.set(null);
    this.heureChoisie.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.api.getCreneaux(medecin.id).subscribe({
      next: (c) => {
        this.creneaux.set(c);
        this.creneauxCharges.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.creneauxCharges.set(true);
        this.error.set(ApiService.errorMessage(err, 'Impossible de charger les disponibilités.'));
      }
    });
  }

  choisirJour(jour: string) {
    this.jourChoisi.set(jour);
    this.heureChoisie.set(null);
  }

  fermer() {
    this.choisi.set(null);
    this.edition.set(null);
  }

  valider() {
    const jour = this.jourChoisi();
    const heure = this.heureChoisie();
    const c = this.choisi();
    if (!jour || !heure || !c) return;

    const date_heure = `${jour} ${heure}`;
    const motif = this.form.motif || undefined;
    const rdv = this.edition();

    this.loading.set(true);
    this.error.set('');

    const requete = rdv
      ? this.api.modifierRendezVous(rdv.id, { date_heure, motif })
      : this.api.createRendezVous({ medecin_id: c.id, date_heure, motif });

    requete.subscribe({
      next: () => {
        this.loading.set(false);
        this.message.set(rdv ? 'Rendez-vous modifié. Le médecin doit le confirmer à nouveau.' : 'Rendez-vous réservé. Le médecin va le confirmer.');
        this.fermer();
        this.charger();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(ApiService.errorMessage(err, 'Enregistrement impossible.'));
        // le créneau a peut-être été pris entre-temps : on rafraîchit la liste
        this.api.getCreneaux(c.id).subscribe({ next: (cr) => this.creneaux.set(cr) });
        this.heureChoisie.set(null);
      }
    });
  }

  annuler(r: any) {
    this.api.annulerRendezVous(r.id).subscribe({
      next: () => this.charger(),
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Annulation impossible.'))
    });
  }
}
