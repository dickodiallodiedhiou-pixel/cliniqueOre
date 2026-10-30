import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { libelleRdv } from '../../services/ui';
import { NavbarComponent } from '../navbar/navbar';
import { AvatarComponent } from '../avatar/avatar';

@Component({
  selector: 'app-medecin',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, AvatarComponent],
  template: `
    <app-navbar titre="Espace médecin"></app-navbar>
    <div class="page">
      <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

      <ng-container *ngIf="profil() as p">
        <!-- Compte non validé : aucune fonctionnalité professionnelle -->
        <div *ngIf="statut() === 'pending'" class="alert-box warn">
          <strong>Votre compte est en attente de validation.</strong><br>
          L'administrateur examine vos justificatifs. Tant que votre compte n'est pas approuvé, vous
          n'apparaissez pas dans l'annuaire et vous ne pouvez pas accepter de rendez-vous.
        </div>
        <div *ngIf="statut() === 'rejected'" class="alert-box error">
          <strong>Votre demande a été refusée.</strong><br>
          Motif : {{ p.medecin?.motif_rejet }}
        </div>

        <ng-container *ngIf="statut() === 'approved'">
          <div class="card entete">
            <div class="row">
              <app-avatar [url]="p.photo_url" [nom]="p.name" [taille]="60"></app-avatar>
              <div>
                <h1>Dr {{ p.name }}</h1>
                <p class="muted" style="margin: 0">Compte validé : votre profil est visible dans l'annuaire.</p>
              </div>
            </div>
            <div class="row" style="margin-top: 12px">
              <span class="badge en_attente">{{ nbEnAttente() }} à traiter</span>
              <span class="badge confirme">{{ nbConfirmes() }} confirmé{{ nbConfirmes() > 1 ? 's' : '' }}</span>
            </div>
          </div>

          <h2>Mes rendez-vous</h2>
          <p *ngIf="rdvs().length === 0" class="muted">Aucun rendez-vous pour le moment.</p>
          <div class="card" *ngFor="let r of rdvs()">
            <div class="row">
              <app-avatar [url]="r.patient?.user?.photo_url" [nom]="r.patient?.user?.name || ''" [taille]="44"></app-avatar>
              <div style="flex: 1">
                <strong>{{ r.date_heure | date: 'EEEE d MMMM y, HH:mm' }}</strong>
                <div>{{ r.patient?.user?.name }}
                  <span class="muted" *ngIf="r.patient?.user?.telephone">· {{ r.patient.user.telephone }}</span></div>
              </div>
              <span class="badge" [ngClass]="r.statut">{{ libelle(r.statut) }}</span>
            </div>
            <div *ngIf="r.motif" class="muted" style="margin-top: 6px">Motif : {{ r.motif }}</div>
            <div class="row" style="margin-top: 10px">
              <ng-container *ngIf="r.statut === 'en_attente'">
                <button class="btn ok small" (click)="changer(r, 'confirme')">Accepter</button>
                <button class="btn danger small" (click)="changer(r, 'annule')">Refuser</button>
              </ng-container>
              <ng-container *ngIf="r.statut === 'confirme'">
                <button class="btn small" (click)="changer(r, 'termine')">Marquer comme terminé</button>
                <button class="btn danger small" (click)="changer(r, 'annule')">Annuler</button>
              </ng-container>
            </div>
          </div>

          <h2 style="margin-top: 28px">Mes disponibilités</h2>
          <div class="card">
            <p class="muted">
              Indiquez vos plages horaires hebdomadaires. Les patients ne pourront réserver que sur ces créneaux
              (14 prochains jours).
            </p>

            <div *ngIf="messageDispo()" class="alert-box success">{{ messageDispo() }}</div>
            <div *ngIf="erreurDispo()" class="alert-box error">{{ erreurDispo() }}</div>

            <div class="jour-ligne" *ngFor="let j of jours">
              <div class="jour-nom">{{ j.label }}</div>
              <div class="jour-plages">
                <ng-container *ngFor="let p of plages()">
                  <div class="plage" *ngIf="p.jour === j.n">
                    <input type="time" [(ngModel)]="p.heure_debut" aria-label="Début">
                    <span>à</span>
                    <input type="time" [(ngModel)]="p.heure_fin" aria-label="Fin">
                    <select [(ngModel)]="p.duree" aria-label="Durée d'un créneau">
                      <option *ngFor="let d of durees" [ngValue]="d">{{ d }} min</option>
                    </select>
                    <button type="button" class="btn danger small" (click)="supprimerPlage(p)">Retirer</button>
                  </div>
                </ng-container>
                <button type="button" class="btn light small" (click)="ajouterPlage(j.n)">+ Ajouter une plage</button>
              </div>
            </div>

            <button class="btn" style="margin-top: 14px" (click)="enregistrerDispos()" [disabled]="enregistrement()">
              {{ enregistrement() ? 'Enregistrement...' : 'Enregistrer mes disponibilités' }}
            </button>
          </div>
        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [`
    .jour-ligne { display: flex; gap: 16px; padding: 12px 0; border-top: 1px solid var(--bordure); align-items: flex-start; }
    .jour-nom { width: 90px; font-weight: 600; padding-top: 6px; }
    .jour-plages { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; flex: 1; }
    .plage { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .plage input, .plage select { font: inherit; padding: 6px 10px; border: 1px solid #c9d5e3; border-radius: 8px; background: #fff; }
  `]
})
export class MedecinComponent implements OnInit {
  private api = inject(ApiService);

  profil = signal<any>(null);
  statut = signal('');
  rdvs = signal<any[]>([]);
  error = signal('');

  nbEnAttente = computed(() => this.rdvs().filter((r) => r.statut === 'en_attente').length);
  nbConfirmes = computed(() => this.rdvs().filter((r) => r.statut === 'confirme').length);
  libelle = libelleRdv;

  // Disponibilités hebdomadaires
  jours = [
    { n: 1, label: 'Lundi' }, { n: 2, label: 'Mardi' }, { n: 3, label: 'Mercredi' },
    { n: 4, label: 'Jeudi' }, { n: 5, label: 'Vendredi' }, { n: 6, label: 'Samedi' }, { n: 7, label: 'Dimanche' }
  ];
  durees = [15, 20, 30, 45, 60];
  plages = signal<{ jour: number; heure_debut: string; heure_fin: string; duree: number }[]>([]);
  messageDispo = signal('');
  erreurDispo = signal('');
  enregistrement = signal(false);

  ngOnInit() {
    // Le statut est relu en base : si l'admin vient de valider le compte, il est pris en compte
    this.api.me().subscribe({
      next: (user) => {
        this.profil.set(user);
        this.statut.set(user.medecin?.statut_validation ?? 'pending');
        if (this.statut() === 'approved') {
          this.charger();
          this.chargerDispos();
        }
      },
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }

  charger() {
    this.api.getRendezVous().subscribe({
      next: (list) => this.rdvs.set(list),
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }

  chargerDispos() {
    this.api.getDisponibilites().subscribe({
      next: (list) =>
        // l'API renvoie des heures au format HH:mm:ss : on garde HH:mm pour les champs "time"
        this.plages.set(
          list.map((p) => ({
            jour: p.jour,
            heure_debut: String(p.heure_debut).slice(0, 5),
            heure_fin: String(p.heure_fin).slice(0, 5),
            duree: p.duree
          }))
        ),
      error: (err: HttpErrorResponse) => this.erreurDispo.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }

  ajouterPlage(jour: number) {
    this.plages.update((l) => [...l, { jour, heure_debut: '09:00', heure_fin: '12:00', duree: 30 }]);
  }

  supprimerPlage(plage: any) {
    this.plages.update((l) => l.filter((p) => p !== plage));
  }

  enregistrerDispos() {
    this.messageDispo.set('');
    this.erreurDispo.set('');
    this.enregistrement.set(true);
    this.api.saveDisponibilites(this.plages()).subscribe({
      next: (res) => {
        this.enregistrement.set(false);
        this.messageDispo.set(res.message);
      },
      error: (err: HttpErrorResponse) => {
        this.enregistrement.set(false);
        const messages = ApiService.validationMessages(err);
        this.erreurDispo.set(messages.length ? messages.join('\n') : ApiService.errorMessage(err, 'Enregistrement impossible.'));
      }
    });
  }

  changer(r: any, statut: 'confirme' | 'annule' | 'termine') {
    this.error.set('');
    this.api.updateStatutRendezVous(r.id, statut).subscribe({
      next: () => this.charger(),
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Action impossible.'))
    });
  }
}
