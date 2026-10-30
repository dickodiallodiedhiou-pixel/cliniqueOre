import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// Photo de profil ronde ; si pas de photo, des initiales sur fond coloré
@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <img *ngIf="url && !casse" [src]="url" [alt]="nom" class="av"
         [style.width.px]="taille" [style.height.px]="taille" (error)="casse = true">
    <span *ngIf="!url || casse" class="av ini" [style.width.px]="taille" [style.height.px]="taille"
          [style.background]="couleur()" [style.font-size.px]="taille * 0.4">{{ initiales() }}</span>
  `,
  styles: [`
    .av { border-radius: 50%; object-fit: cover; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(16, 24, 40, .18); flex-shrink: 0; }
    .ini { display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; }
  `]
})
export class AvatarComponent {
  @Input() url: string | null | undefined = null;
  @Input() nom = '';
  @Input() taille = 48;
  casse = false;

  initiales(): string {
    const mots = (this.nom || '?').replace(/^Dr\.?\s+/i, '').trim().split(/\s+/);
    return ((mots[0]?.[0] ?? '?') + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase();
  }

  couleur(): string {
    const palette = ['#1b5fc1', '#0f766e', '#7c3aed', '#0e7490', '#b45309', '#be185d'];
    let h = 0;
    for (const c of this.nom || '?') { h = (h * 31 + c.charCodeAt(0)) % palette.length; }
    return palette[h];
  }
}
