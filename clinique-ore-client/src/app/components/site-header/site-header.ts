import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { LogoComponent } from '../logo/logo';

// En-tête des pages publiques (accueil, annuaire)
@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [CommonModule, RouterLink, LogoComponent],
  template: `
    <header class="site-header">
      <div class="int">
        <a routerLink="/" class="marque"><app-logo [clair]="true"></app-logo></a>
        <nav>
          <a routerLink="/annuaire" class="lien">Nos médecins</a>
          <a routerLink="/register" [queryParams]="{ type: 'medecin' }" class="lien">Vous êtes médecin ?</a>
          <ng-container *ngIf="!auth.isLoggedIn(); else connecte">
            <a routerLink="/register" class="btn-contour">Inscription</a>
            <a routerLink="/login" class="btn-plein">Connexion</a>
          </ng-container>
          <ng-template #connecte>
            <a [routerLink]="auth.homeRoute()" class="btn-plein">Mon espace</a>
          </ng-template>
        </nav>
      </div>
    </header>
  `,
  styles: [`
    .site-header { position: sticky; top: 0; z-index: 30; background: var(--bleu-fonce); box-shadow: 0 2px 10px rgba(10, 42, 86, .25); }
    .int { max-width: 1160px; margin: 0 auto; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .marque:hover { text-decoration: none; }
    nav { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
    .lien { color: #fff; font-weight: 500; font-size: .95rem; }
    .btn-contour, .btn-plein { padding: 8px 20px; border-radius: 999px; font-weight: 600; font-size: .92rem; border: 1.5px solid #fff; }
    .btn-contour { color: #fff; background: transparent; }
    .btn-contour:hover { background: rgba(255, 255, 255, .12); text-decoration: none; }
    .btn-plein { color: var(--bleu-fonce); background: #fff; }
    .btn-plein:hover { background: var(--bleu-clair); text-decoration: none; }
    @media (max-width: 640px) { .lien { display: none; } }
  `]
})
export class SiteHeaderComponent {
  auth = inject(AuthService);
}
