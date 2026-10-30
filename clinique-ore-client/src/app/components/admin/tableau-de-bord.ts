import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { IconeComponent } from '../icone/icone';

@Component({
  selector: 'app-tableau-de-bord',
  standalone: true,
  imports: [CommonModule, RouterLink, IconeComponent],
  template: `
    <div class="card entete">
      <h1>Tableau de bord</h1>
      <p class="muted" style="margin: 0">{{ aujourdhui | date: 'fullDate' }}</p>
    </div>

    <div *ngIf="erreur()" class="alert-box error">{{ erreur() }}</div>
    <p *ngIf="!erreur() && !stats()" class="muted">Chargement des statistiques...</p>

    <ng-container *ngIf="stats() as d">
      <!-- Points d'attention -->
      <a *ngIf="d.medecins.en_attente > 0" routerLink="/admin/validations" class="alert-box warn bandeau">
        <span><strong>{{ d.medecins.en_attente }}</strong> demande{{ d.medecins.en_attente > 1 ? 's' : '' }} de médecin à valider</span>
        <span>Examiner &rarr;</span>
      </a>
      <a *ngIf="d.conflits > 0" routerLink="/admin/rendez-vous" class="alert-box error bandeau">
        <span><strong>{{ d.conflits }}</strong> conflit{{ d.conflits > 1 ? 's' : '' }} de rendez-vous détecté{{ d.conflits > 1 ? 's' : '' }}</span>
        <span>Résoudre &rarr;</span>
      </a>

      <!-- Vue d'ensemble -->
      <div class="stats-grid">
        <a class="stat c-bleu" routerLink="/admin/patients">
          <span class="ico"><app-icone nom="patient" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.patients.total }}</span><span class="lib">Patients · {{ d.patients.actifs }} actif{{ d.patients.actifs > 1 ? 's' : '' }}</span></span>
        </a>
        <a class="stat c-teal" routerLink="/admin/medecins">
          <span class="ico"><app-icone nom="medecin" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.medecins.total }}</span><span class="lib">Médecins · {{ d.medecins.approuves }} approuvé{{ d.medecins.approuves > 1 ? 's' : '' }}</span></span>
        </a>
        <a class="stat c-indigo" routerLink="/admin/rendez-vous" [queryParams]="{ du: jour, au: jour }">
          <span class="ico"><app-icone nom="rdv" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.aujourdhui }}</span><span class="lib">Rendez-vous aujourd'hui</span></span>
        </a>
        <a class="stat c-orange" routerLink="/admin/specialites">
          <span class="ico"><app-icone nom="specialite" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.specialites_actives }}</span><span class="lib">Spécialités proposées</span></span>
        </a>
      </div>

      <!-- Rendez-vous par statut -->
      <h2>Rendez-vous par statut</h2>
      <div class="stats-grid">
        <a class="stat c-orange" routerLink="/admin/rendez-vous" [queryParams]="{ statut: 'en_attente' }">
          <span class="ico"><app-icone nom="attente" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.en_attente }}</span><span class="lib">En attente</span></span>
        </a>
        <a class="stat c-vert" routerLink="/admin/rendez-vous" [queryParams]="{ statut: 'confirme' }">
          <span class="ico"><app-icone nom="check" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.confirmes }}</span><span class="lib">Confirmés</span></span>
        </a>
        <a class="stat c-rouge" routerLink="/admin/rendez-vous" [queryParams]="{ statut: 'annule' }">
          <span class="ico"><app-icone nom="croix" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.annules }}</span><span class="lib">Annulés</span></span>
        </a>
        <a class="stat c-indigo" routerLink="/admin/rendez-vous" [queryParams]="{ statut: 'termine' }">
          <span class="ico"><app-icone nom="rdv" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.termines }}</span><span class="lib">Terminés</span></span>
        </a>
      </div>

      <!-- Graphiques -->
      <div class="deux-colonnes">
        <div class="card">
          <h3>Charge des 7 prochains jours</h3>
          <div class="colonnes">
            <div class="colonne" *ngFor="let j of d.par_jour">
              <span class="valeur">{{ j.total }}</span>
              <div class="barre-v" [style.height.%]="hauteur(j.total)"></div>
              <span class="etiquette">{{ j.date | date: 'EEE d' }}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Rendez-vous par spécialité</h3>
          <p *ngIf="d.par_specialite.length === 0" class="muted">Pas encore de rendez-vous.</p>
          <div class="barre-h" *ngFor="let s of d.par_specialite">
            <div class="ligne-h"><span>{{ s.nom }}</span><strong>{{ s.total }}</strong></div>
            <div class="piste"><div class="remplissage" [style.width.%]="largeur(s.total)"></div></div>
          </div>
        </div>
      </div>

      <!-- Raccourcis -->
      <h2>Actions rapides</h2>
      <div class="row">
        <a routerLink="/admin/medecins" [queryParams]="{ nouveau: 1 }" class="btn"><app-icone nom="plus" [taille]="16"></app-icone>&nbsp;Ajouter un médecin</a>
        <a routerLink="/admin/validations" class="btn light">Valider des médecins</a>
        <a routerLink="/admin/rendez-vous" [queryParams]="{ statut: 'en_attente' }" class="btn light">Demandes en attente</a>
      </div>
    </ng-container>
  `,
  styles: [`
    .deux-colonnes { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 8px; }
    @media (max-width: 900px) { .deux-colonnes { grid-template-columns: 1fr; } }
    .colonnes { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; height: 190px; padding-top: 10px; }
    .colonne { flex: 1; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; }
    .valeur { font-size: .8rem; font-weight: 600; color: var(--bleu-fonce); }
    .barre-v { width: 100%; max-width: 38px; min-height: 4px; background: linear-gradient(180deg, var(--bleu), #6fa0e6); border-radius: 8px 8px 3px 3px; transition: height .4s ease; }
    .etiquette { font-size: .75rem; color: var(--gris); white-space: nowrap; }
    .barre-h { margin-top: 12px; }
    .ligne-h { display: flex; justify-content: space-between; font-size: .92rem; margin-bottom: 4px; }
    .piste { height: 9px; background: var(--bleu-clair); border-radius: 999px; overflow: hidden; }
    .remplissage { height: 100%; background: linear-gradient(90deg, var(--bleu), #6fa0e6); border-radius: 999px; transition: width .4s ease; }
  `]
})
export class TableauDeBordComponent implements OnInit {
  private api = inject(ApiService);

  stats = signal<any>(null);
  erreur = signal('');
  aujourdhui = new Date();
  jour = new Date().toISOString().slice(0, 10);

  private maxJour = computed(() => Math.max(1, ...(this.stats()?.par_jour ?? []).map((j: any) => j.total)));
  private maxSpec = computed(() => Math.max(1, ...(this.stats()?.par_specialite ?? []).map((s: any) => s.total)));

  hauteur(total: number): number {
    return Math.max(3, (total / this.maxJour()) * 100);
  }

  largeur(total: number): number {
    return Math.max(4, (total / this.maxSpec()) * 100);
  }

  ngOnInit() {
    this.api.adminStats().subscribe({
      next: (s) => this.stats.set(s),
      error: (err: HttpErrorResponse) => this.erreur.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }
}
