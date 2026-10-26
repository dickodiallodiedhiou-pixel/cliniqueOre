import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';

// Annuaire des professionnels vérifiés (l'API ne renvoie que les médecins approuvés)
@Component({
  selector: 'app-annuaire',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="error" class="alert-box error">{{ error }}</div>
    <p *ngIf="!error && loaded && medecins.length === 0" class="muted">
      Aucun professionnel vérifié pour le moment.
    </p>
    <div class="grid">
      <div class="card" *ngFor="let m of medecins">
        <h3>Dr {{ m.nom }}</h3>
        <div class="muted">{{ m.specialite }}</div>
        <p *ngIf="m.biographie" class="muted">{{ m.biographie }}</p>
        <p><strong>{{ m.tarif_consultation | number }}</strong> FCFA / consultation</p>
        <button *ngIf="selectable" class="btn" (click)="choisir.emit(m)">Prendre rendez-vous</button>
      </div>
    </div>
  `
})
export class AnnuaireComponent implements OnInit {
  @Input() selectable = false;
  @Output() choisir = new EventEmitter<any>();

  medecins: any[] = [];
  loaded = false;
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getMedecins().subscribe({
      next: (list) => {
        this.medecins = list;
        this.loaded = true;
      },
      error: (err: HttpErrorResponse) => {
        this.error = ApiService.errorMessage(err, "Impossible de charger l'annuaire.");
      }
    });
  }
}

// Page publique /annuaire
@Component({
  selector: 'app-annuaire-page',
  standalone: true,
  imports: [AnnuaireComponent, RouterLink],
  template: `
    <div class="page">
      <h2>Annuaire des professionnels vérifiés</h2>
      <p class="muted">
        Seuls les médecins dont les justificatifs ont été validés par l'administrateur apparaissent ici.
        <a routerLink="/login">Se connecter</a> pour prendre rendez-vous.
      </p>
      <app-annuaire></app-annuaire>
    </div>
  `
})
export class AnnuairePageComponent {}
