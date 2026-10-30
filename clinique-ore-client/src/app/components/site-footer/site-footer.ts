import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api';
import { LogoComponent } from '../logo/logo';

// Pied de page léger
@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, LogoComponent],
  template: `
    <footer class="pied">
      <div class="int">
        <div class="col marque">
          <app-logo [clair]="true"></app-logo>
          <p>Prise de rendez-vous médicaux en ligne avec les médecins de la Clinique Oré.</p>
        </div>
        <div class="col">
          <h4>Patients</h4>
          <a routerLink="/annuaire">Annuaire des médecins</a>
          <a routerLink="/register">Créer un compte</a>
          <a routerLink="/login">Connexion</a>
        </div>
        <div class="col">
          <h4>Médecins</h4>
          <a routerLink="/register" [queryParams]="{ type: 'medecin' }">Rejoindre la clinique</a>
          <a routerLink="/login">Espace médecin</a>
        </div>
        <div class="col" *ngIf="specialites().length > 0">
          <h4>Spécialités</h4>
          <a *ngFor="let s of specialites()" routerLink="/annuaire" [queryParams]="{ spec: s }">{{ s }}</a>
        </div>
      </div>
      <div class="bas">© {{ annee }} Clinique Oré. Tous droits réservés.</div>
    </footer>
  `,
  styles: [`
    .pied { background: var(--bleu-nuit); color: #cbd8ea; margin-top: 64px; }
    .int { max-width: 1160px; margin: 0 auto; padding: 40px 20px 28px; display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 28px; }
    .col { display: flex; flex-direction: column; gap: 8px; }
    .col h4 { color: #fff; font-size: .95rem; margin-bottom: 4px; }
    .col a { color: #cbd8ea; font-weight: 400; font-size: .92rem; }
    .col a:hover { color: #fff; }
    .marque p { font-size: .9rem; max-width: 300px; margin-top: 10px; }
    .bas { border-top: 1px solid rgba(255, 255, 255, .12); text-align: center; padding: 16px 20px; font-size: .85rem; color: #93a8c6; }
    @media (max-width: 820px) { .int { grid-template-columns: 1fr 1fr; } .marque { grid-column: 1 / -1; } }
  `]
})
export class SiteFooterComponent implements OnInit {
  private api = inject(ApiService);
  specialites = signal<string[]>([]);
  annee = new Date().getFullYear();

  ngOnInit() {
    // 5 spécialités maximum pour garder un pied de page léger
    this.api.getSpecialites().subscribe({
      next: (l) => this.specialites.set(l.slice(0, 5).map((s) => s.nom)),
      error: () => this.specialites.set([])
    });
  }
}
