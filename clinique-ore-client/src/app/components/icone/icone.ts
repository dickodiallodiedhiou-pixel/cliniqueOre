import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

const ICONES: Record<string, string[]> = {
  tableau: ['M4 4h7v7H4z', 'M13 4h7v4h-7z', 'M13 10h7v10h-7z', 'M4 13h7v7H4z'],
  validation: ['M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z', 'M9 12l2 2 4-4'],
  medecin: ['M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z'],
  patient: ['M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c0-4 3.6-7 8-7s8 3 8 7'],
  specialite: ['M4 7h16', 'M4 12h16', 'M4 17h10'],
  rdv: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  journal: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  alerte: ['M12 3l10 18H2z', 'M12 10v4', 'M12 17.5v.01'],
  plus: ['M12 5v14', 'M5 12h14'],
  attente: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 8v4l2 2'],
  check: ['M5 12l4 4 10-10'],
  croix: ['M6 6l12 12', 'M18 6L6 18']
};

// Petites icônes en SVG (sans bibliothèque externe)
@Component({
  selector: 'app-icone',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="taille" [attr.height]="taille" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path *ngFor="let d of chemins()" [attr.d]="d"></path>
    </svg>
  `,
  styles: [`:host { display: inline-flex; }`]
})
export class IconeComponent {
  @Input() nom = 'tableau';
  @Input() taille = 20;

  chemins(): string[] {
    return ICONES[this.nom] ?? [];
  }
}
