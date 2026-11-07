import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { NotificationsService } from '../../services/notifications';
import { PaginationComponent } from '../pagination/pagination';

@Component({
  selector: 'app-notifications-patient',
  standalone: true,
  imports: [CommonModule, RouterLink, PaginationComponent],
  template: `
    <div class="card entete">
      <div class="ligne">
        <div class="grow">
          <h1>Notifications</h1>
          <p class="muted" style="margin: 0">Les réponses des médecins et les changements sur vos rendez-vous.</p>
        </div>
        <button class="btn light small" *ngIf="nonLues() > 0" (click)="toutLire()">Tout marquer comme lu</button>
      </div>
    </div>

    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>
    <p *ngIf="charge() && liste().length === 0" class="muted">Aucune notification pour le moment.</p>

    <div class="card notif" *ngFor="let n of liste()" [class.non-lue]="!n.read_at">
      <div class="ligne">
        <div class="grow">
          <strong>{{ n.data.titre }}</strong>
          <span class="badge en_attente" *ngIf="!n.read_at" style="margin-left: 8px">Nouveau</span>
          <div style="margin-top: 4px">{{ n.data.message }}</div>
          <div class="muted" style="margin-top: 4px">{{ n.created_at | date: 'dd/MM/yyyy à HH:mm' }}</div>
        </div>
        <div class="row">
          <a routerLink="/patient/rendez-vous" class="btn light small" *ngIf="n.data.rendez_vous_id">Voir mes rendez-vous</a>
          <button class="btn light small" *ngIf="!n.read_at" (click)="lire(n)">Marquer comme lu</button>
        </div>
      </div>
    </div>

    <app-pagination [page]="page()" [derniere]="derniere()" [total]="total()" (aller)="charger($event)"></app-pagination>
  `,
  styles: [`.non-lue { border-left: 5px solid var(--bleu); background: #f8fbff; }`]
})
export class NotificationsPatientComponent implements OnInit {
  private api = inject(ApiService);
  private service = inject(NotificationsService);

  liste = signal<any[]>([]);
  page = signal(1);
  derniere = signal(1);
  total = signal(0);
  nonLues = signal(0);
  charge = signal(false);
  error = signal('');

  ngOnInit() {
    this.charger(1);
  }

  charger(page = 1) {
    this.api.notifications(page).subscribe({
      next: (r) => {
        this.liste.set(r.data);
        this.page.set(r.current_page);
        this.derniere.set(r.last_page);
        this.total.set(r.total);
        this.nonLues.set(r.non_lues);
        this.service.nonLues.set(r.non_lues);
        this.charge.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.charge.set(true);
        this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'));
      }
    });
  }

  lire(n: any) {
    this.api.lireNotification(n.id).subscribe({
      next: (r) => {
        this.nonLues.set(r.non_lues);
        this.service.nonLues.set(r.non_lues);
        this.liste.update((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      },
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Action impossible.'))
    });
  }

  toutLire() {
    this.api.toutLireNotifications().subscribe({
      next: () => {
        this.nonLues.set(0);
        this.service.nonLues.set(0);
        this.liste.update((l) => l.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
      },
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Action impossible.'))
    });
  }
}
