import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { libelleAction } from '../../services/ui';
import { PaginationComponent } from '../pagination/pagination';

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  template: `
    <div class="card entete">
      <h1>Journal d'activité</h1>
      <p class="muted" style="margin: 0">Historique des actions effectuées par les administrateurs.</p>
    </div>

    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>
    <p *ngIf="chargee() && entrees().length === 0" class="muted">Aucune action enregistrée pour le moment.</p>

    <div class="card" *ngFor="let a of entrees()">
      <div class="ligne">
        <div style="min-width: 150px">
          <strong>{{ a.created_at | date: 'dd/MM/yyyy' }}</strong>
          <div class="muted">{{ a.created_at | date: 'HH:mm' }}</div>
        </div>
        <div class="grow">
          <strong>{{ libelle(a.action) }}</strong>
          <span class="muted" *ngIf="a.details?.nom"> · {{ a.details.nom }}</span>
          <div class="muted" *ngIf="a.details?.motif">Motif : {{ a.details.motif }}</div>
          <div class="muted" *ngIf="a.details?.avant">
            {{ a.details.avant.statut }} &rarr; {{ a.details.apres.statut }} ·
            {{ a.details.avant.date_heure }} &rarr; {{ a.details.apres.date_heure }}
          </div>
        </div>
        <span class="badge">{{ a.auteur?.name || 'Système' }}</span>
      </div>
    </div>

    <app-pagination [page]="page()" [derniere]="derniere()" [total]="total()" (aller)="charger($event)"></app-pagination>
  `
})
export class JournalComponent implements OnInit {
  private api = inject(ApiService);

  entrees = signal<any[]>([]);
  page = signal(1);
  derniere = signal(1);
  total = signal(0);
  chargee = signal(false);
  error = signal('');
  libelle = libelleAction;

  ngOnInit() {
    this.charger(1);
  }

  charger(page = 1) {
    this.api.adminJournal(page).subscribe({
      next: (r) => {
        this.entrees.set(r.data);
        this.page.set(r.current_page);
        this.derniere.set(r.last_page);
        this.total.set(r.total);
        this.chargee.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.chargee.set(true);
        this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'));
      }
    });
  }
}
