import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { isoLocal, libelleRdv } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';
import { IconeComponent } from '../icone/icone';

@Component({
  selector: 'app-tableau-medecin',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarComponent, IconeComponent],
  template: `
    <div class="card entete">
      <h1>Bonjour Dr {{ nom }}</h1>
      <p class="muted" style="margin: 0">{{ aujourdhui | date: 'fullDate' }}</p>
    </div>

    <div *ngIf="message()" class="alert-box success">{{ message() }}</div>
    <div *ngIf="erreur()" class="alert-box error">{{ erreur() }}</div>
    <p *ngIf="!erreur() && !stats()" class="muted">Chargement...</p>

    <ng-container *ngIf="stats() as d">
      <!-- Points d'attention -->
      <a *ngIf="!d.prochain_creneau" routerLink="/medecin/planning" [queryParams]="{ onglet: 'horaires' }" class="alert-box warn bandeau">
        <span><strong>Aucun créneau n'est proposé aux patients.</strong> Définissez vos jours et horaires de travail.</span>
        <span>Définir mes horaires &rarr;</span>
      </a>
      <a *ngIf="d.prochaine_indisponibilite as c" routerLink="/medecin/planning" [queryParams]="{ onglet: 'conges' }" class="alert-box warn bandeau">
        <span>
          Indisponibilité du <strong>{{ c.date_debut | date: 'd MMM' }}</strong> au <strong>{{ c.date_fin | date: 'd MMM y' }}</strong>
          <span *ngIf="c.motif"> · {{ c.motif }}</span>
        </span>
        <span>Gérer &rarr;</span>
      </a>

      <!-- Chiffres clés -->
      <div class="stats-grid">
        <a class="stat c-indigo" routerLink="/medecin/rendez-vous" [queryParams]="{ du: jour, au: jour }">
          <span class="ico"><app-icone nom="rdv" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.aujourdhui }}</span><span class="lib">Rendez-vous aujourd'hui</span></span>
        </a>
        <a class="stat c-orange" routerLink="/medecin/rendez-vous" [queryParams]="{ statut: 'en_attente' }">
          <span class="ico"><app-icone nom="attente" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.en_attente }}</span><span class="lib">En attente de réponse</span></span>
        </a>
        <a class="stat c-vert" routerLink="/medecin/rendez-vous" [queryParams]="{ statut: 'confirme' }">
          <span class="ico"><app-icone nom="check" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.confirmes }}</span><span class="lib">Confirmés à venir</span></span>
        </a>
        <a class="stat c-bleu" routerLink="/medecin/rendez-vous" [queryParams]="{ statut: 'termine' }">
          <span class="ico"><app-icone nom="patient" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.termines }}</span><span class="lib">Terminés · {{ d.rendez_vous.termines_mois }} ce mois-ci</span></span>
        </a>
      </div>

      <div class="deux-colonnes">
        <!-- Aujourd'hui -->
        <div class="card">
          <h3>Aujourd'hui</h3>
          <p *ngIf="d.aujourdhui_liste.length === 0" class="muted">Aucun rendez-vous aujourd'hui.</p>
          <div class="item-liste" *ngFor="let r of d.aujourdhui_liste">
            <span class="heure">{{ iso(r.date_heure) | date: 'HH:mm' }}</span>
            <app-avatar [url]="r.patient?.user?.photo_url" [nom]="r.patient?.user?.name || ''" [taille]="34"></app-avatar>
            <span style="flex: 1">{{ r.patient?.user?.name }}</span>
            <span class="badge" [ngClass]="r.statut">{{ libelle(r.statut) }}</span>
          </div>
        </div>

        <!-- Demandes à traiter -->
        <div class="card">
          <h3>Demandes à traiter</h3>
          <p *ngIf="d.en_attente_liste.length === 0" class="muted">Aucune demande en attente.</p>
          <div class="item-liste" *ngFor="let r of d.en_attente_liste">
            <div style="flex: 1; min-width: 150px">
              <strong>{{ r.patient?.user?.name }}</strong>
              <div class="muted">{{ iso(r.date_heure) | date: 'EEE d MMM, HH:mm' }}</div>
            </div>
            <button class="btn ok small" (click)="repondre(r, 'confirme')">Accepter</button>
            <button class="btn danger small" (click)="repondre(r, 'refuse')">Refuser</button>
          </div>
          <a *ngIf="d.rendez_vous.en_attente > d.en_attente_liste.length" routerLink="/medecin/rendez-vous"
             [queryParams]="{ statut: 'en_attente' }">Voir toutes les demandes &rarr;</a>
        </div>
      </div>

      <div class="deux-colonnes">
        <!-- Prochains rendez-vous -->
        <div class="card">
          <h3>Prochains rendez-vous</h3>
          <p *ngIf="d.prochains.length === 0" class="muted">Aucun rendez-vous à venir.</p>
          <div class="item-liste" *ngFor="let r of d.prochains">
            <div style="min-width: 110px">
              <strong>{{ iso(r.date_heure) | date: 'EEE d MMM' }}</strong>
              <div class="muted">{{ iso(r.date_heure) | date: 'HH:mm' }}</div>
            </div>
            <span style="flex: 1">{{ r.patient?.user?.name }}</span>
            <span class="badge" [ngClass]="r.statut">{{ libelle(r.statut) }}</span>
          </div>
        </div>

        <!-- Charge des 7 jours -->
        <div class="card">
          <h3>Votre charge des 7 prochains jours</h3>
          <div class="colonnes">
            <div class="colonne" *ngFor="let j of d.par_jour">
              <span class="valeur">{{ j.total }}</span>
              <div class="barre-v" [style.height.%]="hauteur(j.total)"></div>
              <span class="etiquette">{{ j.date | date: 'EEE d' }}</span>
            </div>
          </div>
          <p class="muted" *ngIf="d.prochain_creneau" style="margin: 14px 0 0">
            Prochain créneau libre : <strong>{{ d.prochain_creneau.date | date: 'EEEE d MMMM' }} à {{ d.prochain_creneau.heure }}</strong>
          </p>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    .colonnes { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; height: 170px; padding-top: 10px; }
    .colonne { flex: 1; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; }
    .valeur { font-size: .8rem; font-weight: 600; color: var(--bleu-fonce); }
    .barre-v { width: 100%; max-width: 38px; min-height: 4px; background: linear-gradient(180deg, var(--bleu), #6fa0e6); border-radius: 8px 8px 3px 3px; transition: height .4s ease; }
    .etiquette { font-size: .75rem; color: var(--gris); white-space: nowrap; }
  `]
})
export class TableauMedecinComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  stats = signal<any>(null);
  erreur = signal('');
  message = signal('');
  aujourdhui = new Date();
  jour = new Date().toISOString().slice(0, 10);
  nom = this.auth.user?.name ?? '';
  libelle = libelleRdv;
  iso = isoLocal;

  private maxJour = computed(() => Math.max(1, ...(this.stats()?.par_jour ?? []).map((j: any) => j.total)));

  hauteur(total: number): number {
    return Math.max(3, (total / this.maxJour()) * 100);
  }

  ngOnInit() {
    this.charger();
  }

  charger() {
    this.api.medecinStats().subscribe({
      next: (s) => this.stats.set(s),
      error: (err: HttpErrorResponse) => this.erreur.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }

  // Réponse rapide à une demande depuis le tableau de bord
  repondre(r: any, statut: 'confirme' | 'refuse') {
    this.erreur.set('');
    this.api.updateStatutRendezVous(r.id, statut).subscribe({
      next: () => {
        this.message.set(statut === 'confirme' ? 'Rendez-vous confirmé.' : 'Demande refusée.');
        this.charger();
      },
      error: (err: HttpErrorResponse) => this.erreur.set(ApiService.errorMessage(err, 'Action impossible.'))
    });
  }
}
