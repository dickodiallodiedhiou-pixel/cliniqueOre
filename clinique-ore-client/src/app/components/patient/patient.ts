import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { NavbarComponent } from '../navbar/navbar';
import { AnnuaireComponent } from '../annuaire/annuaire';

@Component({
  selector: 'app-patient',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, AnnuaireComponent],
  template: `
    <app-navbar titre="Espace patient"></app-navbar>
    <div class="page">
      <div *ngIf="message" class="alert-box success">{{ message }}</div>
      <div *ngIf="error" class="alert-box error">{{ error }}</div>

      <div class="card" *ngIf="choisi">
        <h3>Rendez-vous avec Dr {{ choisi.nom }}</h3>
        <div class="field">
          <label>Date et heure</label>
          <input type="datetime-local" [(ngModel)]="form.date_heure" name="date_heure" required>
        </div>
        <div class="field">
          <label>Motif (facultatif)</label>
          <textarea [(ngModel)]="form.motif" name="motif" rows="2"></textarea>
        </div>
        <div class="row">
          <button class="btn ok" (click)="reserver()" [disabled]="loading || !form.date_heure">Réserver</button>
          <button class="btn light" (click)="choisi = null">Annuler</button>
        </div>
      </div>

      <h2>Mes rendez-vous</h2>
      <p *ngIf="rdvs.length === 0" class="muted">Aucun rendez-vous pour le moment.</p>
      <div class="card" *ngFor="let r of rdvs">
        <div class="row">
          <strong>{{ r.date_heure | date: 'dd/MM/yyyy HH:mm' }}</strong>
          <span class="badge" [ngClass]="r.statut">{{ libelle(r.statut) }}</span>
        </div>
        <div>Dr {{ r.medecin?.user?.name }} — <span class="muted">{{ r.medecin?.specialite?.nom }}</span></div>
        <div *ngIf="r.motif" class="muted">Motif : {{ r.motif }}</div>
        <button *ngIf="r.statut === 'en_attente' || r.statut === 'confirme'" class="btn danger"
                style="margin-top:8px" (click)="annuler(r)">Annuler</button>
      </div>

      <h2>Prendre rendez-vous</h2>
      <app-annuaire [selectable]="true" (choisir)="choisir($event)"></app-annuaire>
    </div>
  `
})
export class PatientComponent implements OnInit {
  rdvs: any[] = [];
  choisi: any = null;
  form = { date_heure: '', motif: '' };
  message = '';
  error = '';
  loading = false;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.charger();
  }

  libelle(statut: string): string {
    return ({ en_attente: 'En attente', confirme: 'Confirmé', annule: 'Annulé', termine: 'Terminé' } as any)[statut] ?? statut;
  }

  charger() {
    this.api.getRendezVous().subscribe({
      next: (list) => (this.rdvs = list),
      error: (err: HttpErrorResponse) => (this.error = ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }

  choisir(medecin: any) {
    this.choisi = medecin;
    this.message = '';
    this.error = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  reserver() {
    this.loading = true;
    this.error = '';
    this.api
      .createRendezVous({
        medecin_id: this.choisi.id,
        date_heure: this.form.date_heure,
        motif: this.form.motif || undefined
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.message = 'Rendez-vous réservé. Il sera confirmé par le médecin.';
          this.choisi = null;
          this.form = { date_heure: '', motif: '' };
          this.charger();
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.error = ApiService.errorMessage(err, 'Réservation impossible.');
        }
      });
  }

  annuler(r: any) {
    this.api.annulerRendezVous(r.id).subscribe({
      next: () => this.charger(),
      error: (err: HttpErrorResponse) => (this.error = ApiService.errorMessage(err, 'Annulation impossible.'))
    });
  }
}
