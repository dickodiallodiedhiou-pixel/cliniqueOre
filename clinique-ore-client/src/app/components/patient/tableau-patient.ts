import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { isoLocal, libelleRdv, prenom } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';
import { IconeComponent } from '../icone/icone';

@Component({
  selector: 'app-tableau-patient',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarComponent, IconeComponent],
  template: `
    <div class="card entete">
      <div class="ligne">
        <div class="grow">
          <h1>Bonjour {{ prenomUser }}</h1>
          <p class="muted" style="margin: 0">{{ aujourdhui | date: 'fullDate' }}</p>
        </div>
        <a routerLink="/patient/rendez-vous/nouveau" class="btn"><app-icone nom="plus" [taille]="16"></app-icone>&nbsp;Prendre rendez-vous</a>
      </div>
    </div>

    <div *ngIf="erreur()" class="alert-box error">{{ erreur() }}</div>
    <p *ngIf="!erreur() && !stats()" class="muted">Chargement...</p>

    <ng-container *ngIf="stats() as d">
      <!-- Chiffres clés -->
      <div class="stats-grid">
        <a class="stat c-indigo" routerLink="/patient/rendez-vous">
          <span class="ico"><app-icone nom="rdv" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.a_venir }}</span><span class="lib">Rendez-vous à venir</span></span>
        </a>
        <a class="stat c-orange" routerLink="/patient/rendez-vous">
          <span class="ico"><app-icone nom="attente" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.en_attente }}</span><span class="lib">En attente de réponse</span></span>
        </a>
        <a class="stat c-vert" routerLink="/patient/rendez-vous">
          <span class="ico"><app-icone nom="check" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.confirmes }}</span><span class="lib">Confirmés</span></span>
        </a>
        <a class="stat c-bleu" routerLink="/patient/rendez-vous">
          <span class="ico"><app-icone nom="patient" [taille]="26"></app-icone></span>
          <span class="txt"><span class="nb">{{ d.rendez_vous.termines }}</span><span class="lib">Consultations terminées</span></span>
        </a>
      </div>

      <div class="deux-colonnes">
        <!-- Prochain rendez-vous -->
        <div class="card">
          <h3>Mon prochain rendez-vous</h3>
          <ng-container *ngIf="d.prochain as r; else aucun">
            <div class="ligne">
              <app-avatar [url]="r.medecin?.user?.photo_url" [nom]="r.medecin?.user?.name || ''" [taille]="56"></app-avatar>
              <div class="grow">
                <strong>{{ iso(r.date_heure) | date: 'EEEE d MMMM y' }}</strong>
                <div>à <strong>{{ iso(r.date_heure) | date: 'HH:mm' }}</strong></div>
                <div class="muted">Dr {{ r.medecin?.user?.name }} · {{ r.medecin?.specialites_libelle }}</div>
              </div>
              <span class="badge" [ngClass]="r.statut">{{ libelle(r.statut) }}</span>
            </div>
            <p *ngIf="r.statut === 'en_attente'" class="muted" style="margin: 12px 0 0">
              Le médecin n'a pas encore répondu. Vous serez notifié dès qu'il aura confirmé.
            </p>
            <a routerLink="/patient/rendez-vous" class="btn light small" style="margin-top: 12px">Gérer mes rendez-vous</a>
          </ng-container>
          <ng-template #aucun>
            <p class="muted">Vous n'avez aucun rendez-vous à venir.</p>
            <a routerLink="/patient/rendez-vous/nouveau" class="btn small">Prendre rendez-vous</a>
          </ng-template>
        </div>

        <!-- Dernières notifications -->
        <div class="card">
          <div class="ligne">
            <h3 class="grow">Dernières notifications</h3>
            <span class="badge en_attente" *ngIf="d.notifications.non_lues > 0">{{ d.notifications.non_lues }} non lue{{ d.notifications.non_lues > 1 ? 's' : '' }}</span>
          </div>
          <p *ngIf="d.notifications.recentes.length === 0" class="muted">Aucune notification pour le moment.</p>
          <div class="item-liste" *ngFor="let n of d.notifications.recentes">
            <div style="flex: 1">
              <strong>{{ n.data.titre }}</strong>
              <span class="badge en_attente" *ngIf="!n.read_at" style="margin-left: 6px">Nouveau</span>
              <div class="muted">{{ n.data.message }}</div>
            </div>
          </div>
          <a routerLink="/patient/notifications" style="display: inline-block; margin-top: 8px">Voir toutes les notifications &rarr;</a>
        </div>
      </div>

      <h2>Accès rapide</h2>
      <div class="row">
        <a routerLink="/patient/medecins" class="btn light">Trouver un médecin</a>
        <a routerLink="/patient/rendez-vous" class="btn light">Mes rendez-vous</a>
        <a routerLink="/profil" class="btn light">Mon profil</a>
      </div>
    </ng-container>
  `
})
export class TableauPatientComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  stats = signal<any>(null);
  erreur = signal('');
  aujourdhui = new Date();
  prenomUser = prenom(this.auth.user?.name);
  libelle = libelleRdv;
  iso = isoLocal;

  ngOnInit() {
    this.api.patientStats().subscribe({
      next: (s) => this.stats.set(s),
      error: (err: HttpErrorResponse) => this.erreur.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }
}
