import { Component, Input } from '@angular/core';

// Logo : croix médicale dans un carré arrondi + nom de la clinique
@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <span class="logo" [class.clair]="clair">
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <rect width="32" height="32" rx="9" [attr.fill]="clair ? '#ffffff' : '#1b5fc1'"/>
        <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" [attr.fill]="clair ? '#1b5fc1' : '#ffffff'"/>
      </svg>
      <span class="nom">Clinique Oré</span>
    </span>
  `,
  styles: [`
    .logo { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.2rem; color: var(--bleu-nuit); }
    .logo.clair { color: #fff; }
  `]
})
export class LogoComponent {
  @Input() clair = false;
}
