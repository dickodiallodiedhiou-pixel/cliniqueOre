import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { NotificationsService } from '../../services/notifications';
import { NavbarComponent } from '../navbar/navbar';
import { IconeComponent } from '../icone/icone';
import { AvatarComponent } from '../avatar/avatar';

// Structure de l'espace médecin : barre du haut + menu latéral + contenu.
// Tant que le compte n'est pas approuvé, seul un message d'attente (ou de refus) est affiché.
@Component({
  selector: 'app-medecin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NavbarComponent, IconeComponent, AvatarComponent],
  template: `
    <app-navbar titre="Espace médecin"></app-navbar>

    <div class="page" *ngIf="erreur()"><div class="alert-box error">{{ erreur() }}</div></div>

    <ng-container *ngIf="profil() as p">
      <div class="page" *ngIf="statut() !== 'approved'">
        <div *ngIf="statut() === 'pending'" class="alert-box warn">
          <strong>Votre compte est en attente de validation.</strong><br>
          L'administrateur examine vos justificatifs. Tant que votre compte n'est pas approuvé, vous
          n'apparaissez pas dans l'annuaire et vous ne pouvez pas accepter de rendez-vous.
        </div>
        <div *ngIf="statut() === 'rejected'" class="alert-box error">
          <strong>Votre demande a été refusée.</strong><br>
          Motif : {{ p.medecin?.motif_rejet }}
        </div>
      </div>

      <div class="shell" *ngIf="statut() === 'approved'">
        <aside class="menu">
          <div class="profil-mini">
            <app-avatar [url]="p.photo_url" [nom]="p.name" [taille]="46"></app-avatar>
            <div>
              <strong>Dr {{ p.name }}</strong>
              <span class="muted">{{ p.medecin?.specialites_libelle }}</span>
            </div>
          </div>
          <a *ngFor="let l of liens" class="lien-menu" [routerLink]="l.chemin" routerLinkActive="actif"
             [routerLinkActiveOptions]="{ exact: l.exact }">
            <app-icone [nom]="l.icone"></app-icone>
            <span>{{ l.label }}</span>
            <span class="nb" *ngIf="l.cle === 'notifications' && notifs.nonLues() > 0">{{ notifs.nonLues() }}</span>
          </a>
        </aside>
        <main class="contenu"><router-outlet></router-outlet></main>
      </div>
    </ng-container>
  `,
  styles: [`
    .nb { margin-left: auto; background: var(--accent); color: #fff; border-radius: 999px; padding: 0 8px; font-size: .75rem; font-weight: 700; line-height: 1.5; }
  `]
})
export class MedecinLayoutComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  notifs = inject(NotificationsService);

  profil = signal<any>(null);
  statut = signal('');
  erreur = signal('');

  liens = [
    { cle: 'accueil', chemin: '/medecin', label: 'Tableau de bord', icone: 'tableau', exact: true },
    { cle: 'rdv', chemin: '/medecin/rendez-vous', label: 'Rendez-vous', icone: 'rdv', exact: false },
    { cle: 'planning', chemin: '/medecin/planning', label: 'Planning et disponibilités', icone: 'planning', exact: false },
    { cle: 'notifications', chemin: '/medecin/notifications', label: 'Notifications', icone: 'cloche', exact: false }
  ];

  ngOnDestroy() {
    this.notifs.arreter();
  }

  ngOnInit() {
    this.notifs.demarrer();
    // Le statut est relu en base : si l'admin vient de valider le compte, il est pris en compte
    this.api.me().subscribe({
      next: (user) => {
        this.profil.set(user);
        this.statut.set(user.medecin?.statut_validation ?? 'pending');
      },
      error: (err: HttpErrorResponse) => this.erreur.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }
}
