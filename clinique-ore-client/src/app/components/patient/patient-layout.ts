import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth';
import { NotificationsService } from '../../services/notifications';
import { NavbarComponent } from '../navbar/navbar';
import { IconeComponent } from '../icone/icone';
import { AvatarComponent } from '../avatar/avatar';

// Structure de l'espace patient : barre du haut + menu latéral + contenu
@Component({
  selector: 'app-patient-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NavbarComponent, IconeComponent, AvatarComponent],
  template: `
    <app-navbar titre="Espace patient"></app-navbar>
    <div class="shell">
      <aside class="menu">
        <div class="profil-mini">
          <app-avatar [url]="auth.user?.photo_url" [nom]="auth.user?.name || ''" [taille]="46"></app-avatar>
          <div>
            <strong>{{ auth.user?.name }}</strong>
            <span class="muted">Patient</span>
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
  `,
  styles: [`
    .nb { margin-left: auto; background: var(--accent); color: #fff; border-radius: 999px; padding: 0 8px; font-size: .75rem; font-weight: 700; line-height: 1.5; }
  `]
})
export class PatientLayoutComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  notifs = inject(NotificationsService);

  liens = [
    { cle: 'accueil', chemin: '/patient', label: 'Mon tableau de bord', icone: 'tableau', exact: true },
    { cle: 'nouveau', chemin: '/patient/rendez-vous/nouveau', label: 'Prendre rendez-vous', icone: 'plus', exact: false },
    { cle: 'rdv', chemin: '/patient/rendez-vous', label: 'Mes rendez-vous', icone: 'rdv', exact: true },
    { cle: 'medecins', chemin: '/patient/medecins', label: 'Médecins', icone: 'medecin', exact: false },
    { cle: 'notifications', chemin: '/patient/notifications', label: 'Notifications', icone: 'cloche', exact: false }
  ];

  ngOnInit() {
    this.notifs.demarrer();
  }

  ngOnDestroy() {
    this.notifs.arreter();
  }
}
