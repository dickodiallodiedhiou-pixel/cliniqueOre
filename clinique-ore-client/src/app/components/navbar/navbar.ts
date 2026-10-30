import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { AvatarComponent } from '../avatar/avatar';
import { LogoComponent } from '../logo/logo';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarComponent, LogoComponent],
  template: `
    <header class="bar">
      <div class="int">
        <span class="gauche">
          <a routerLink="/"><app-logo [clair]="true"></app-logo></a>
          <span class="espace">{{ titre }}</span>
          <a [routerLink]="auth.homeRoute()" class="lien">Mon espace</a>
          <a routerLink="/profil" class="lien">Mon profil</a>
        </span>
        <span class="who">
          <app-avatar [url]="auth.user?.photo_url" [nom]="auth.user?.name || ''" [taille]="36"></app-avatar>
          <span class="nom">{{ auth.user?.name }}</span>
          <button class="deco" (click)="logout()">Se déconnecter</button>
        </span>
      </div>
    </header>
  `,
  styles: [`
    .bar { background: var(--bleu-fonce); box-shadow: 0 2px 10px rgba(10, 42, 86, .25); }
    .int { max-width: 1160px; margin: 0 auto; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .gauche { display: flex; align-items: center; gap: 16px; }
    .gauche a:hover { text-decoration: none; }
    .espace { color: #b9cfec; font-size: .92rem; border-left: 1px solid rgba(255, 255, 255, .25); padding-left: 16px; }
    .lien { color: #fff; font-size: .92rem; font-weight: 500; }
    .who { display: flex; gap: 12px; align-items: center; }
    .nom { color: #fff; font-weight: 500; font-size: .95rem; }
    .deco { font: inherit; font-size: .85rem; font-weight: 600; color: #fff; background: transparent; border: 1.5px solid rgba(255, 255, 255, .7); border-radius: 999px; padding: 6px 16px; cursor: pointer; }
    .deco:hover { background: rgba(255, 255, 255, .14); }
    @media (max-width: 640px) { .nom, .espace { display: none; } }
  `]
})
export class NavbarComponent {
  @Input() titre = '';

  auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  logout() {
    const done = () => {
      this.auth.clear();
      this.router.navigate(['/']);
    };
    this.api.logout().subscribe({ next: done, error: done });
  }
}
