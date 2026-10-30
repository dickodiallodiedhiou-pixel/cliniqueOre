import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// Photo qui remplit son conteneur. Si le fichier n'existe pas encore (public/images/...),
// un visuel de remplacement discret est affiché à la place.
@Component({
  selector: 'app-photo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cadre" [style.border-radius]="forme">
      <img *ngIf="!absente" [src]="src" [alt]="alt" (error)="absente = true">
      <div *ngIf="absente" class="vide" role="img" [attr.aria-label]="alt">
        <svg viewBox="0 0 120 120" width="42%" aria-hidden="true">
          <circle cx="60" cy="40" r="20" fill="#ffffff" opacity=".85"/>
          <path d="M20 112c0-24 18-40 40-40s40 16 40 40z" fill="#ffffff" opacity=".85"/>
          <path d="M54 80h12v8h8v12H66v8H54v-8h-8V88h8z" fill="#1b5fc1" opacity=".55" transform="translate(0 -6) scale(1)"/>
        </svg>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .cadre { width: 100%; height: 100%; overflow: hidden; background: #cfe0f5; }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .vide { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
            background: linear-gradient(135deg, #d9e8fa, #a9c7ef); }
  `]
})
export class PhotoComponent {
  @Input() src = '';
  @Input() alt = '';
  @Input() forme = '24px';
  absente = false;
}
