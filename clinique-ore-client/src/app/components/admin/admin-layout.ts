import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar';
import { IconeComponent } from '../icone/icone';

// Structure de l'espace administrateur : barre du haut + menu latéral + contenu
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NavbarComponent, IconeComponent],
  template: `
    <app-navbar titre="Administration"></app-navbar>
    <div class="shell">
      <aside class="menu">
        <a *ngFor="let l of liens" class="lien-menu" [routerLink]="l.chemin" routerLinkActive="actif"
           [routerLinkActiveOptions]="{ exact: l.exact }">
          <app-icone [nom]="l.icone"></app-icone>
          <span>{{ l.label }}</span>
        </a>
      </aside>
      <main class="contenu"><router-outlet></router-outlet></main>
    </div>
  `,
  styles: [`
    .shell { max-width: 1240px; margin: 24px auto; padding: 0 20px 48px; display: grid; grid-template-columns: 230px 1fr; gap: 24px; align-items: start; }
    .menu { position: sticky; top: 16px; background: #fff; border: 1px solid var(--bordure); border-radius: 16px; padding: 10px; box-shadow: var(--ombre); display: flex; flex-direction: column; gap: 2px; }
    .lien-menu { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; color: var(--texte); font-weight: 500; }
    .lien-menu:hover { background: var(--ciel); text-decoration: none; }
    .lien-menu.actif { background: var(--bleu-clair); color: var(--bleu-fonce); box-shadow: inset 3px 0 0 var(--bleu); }
    .contenu { min-width: 0; }
    @media (max-width: 880px) {
      .shell { grid-template-columns: 1fr; gap: 14px; }
      .menu { position: static; flex-direction: row; overflow-x: auto; }
      .lien-menu span { white-space: nowrap; }
    }
  `]
})
export class AdminLayoutComponent {
  liens = [
    { chemin: '/admin', label: 'Tableau de bord', icone: 'tableau', exact: true },
    { chemin: '/admin/validations', label: 'Validations', icone: 'validation', exact: false },
    { chemin: '/admin/medecins', label: 'Médecins', icone: 'medecin', exact: false },
    { chemin: '/admin/patients', label: 'Patients', icone: 'patient', exact: false },
    { chemin: '/admin/specialites', label: 'Spécialités', icone: 'specialite', exact: false },
    { chemin: '/admin/rendez-vous', label: 'Rendez-vous', icone: 'rdv', exact: false },
    { chemin: '/admin/journal', label: "Journal d'activité", icone: 'journal', exact: false }
  ];
}
