import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pagination" *ngIf="total > 0">
      <button type="button" class="btn light small" [disabled]="page <= 1" (click)="aller.emit(page - 1)">Précédent</button>
      <span class="muted">
        Page {{ page }} sur {{ derniere }} · {{ total }} résultat{{ total > 1 ? 's' : '' }}
      </span>
      <button type="button" class="btn light small" [disabled]="page >= derniere" (click)="aller.emit(page + 1)">Suivant</button>
    </div>
  `,
  styles: [`.pagination { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 18px 0 6px; flex-wrap: wrap; }`]
})
export class PaginationComponent {
  @Input() page = 1;
  @Input() derniere = 1;
  @Input() total = 0;
  @Output() aller = new EventEmitter<number>();
}
