import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { NavbarComponent } from '../navbar/navbar';

type Statut = 'pending' | 'approved' | 'rejected';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  template: `
    <app-navbar titre="Administration"></app-navbar>
    <div class="page">
      <h2>Validation des comptes médecins</h2>

      <div class="row" style="margin-bottom:12px">
        <button class="btn" [class.light]="onglet !== 'pending'" (click)="ouvrir('pending')">En attente</button>
        <button class="btn" [class.light]="onglet !== 'approved'" (click)="ouvrir('approved')">Approuvés</button>
        <button class="btn" [class.light]="onglet !== 'rejected'" (click)="ouvrir('rejected')">Refusés</button>
      </div>

      <div *ngIf="message" class="alert-box success">{{ message }}</div>
      <div *ngIf="error" class="alert-box error">{{ error }}</div>

      <p *ngIf="medecins.length === 0" class="muted">Aucune demande dans cette catégorie.</p>

      <div class="card" *ngFor="let m of medecins">
        <div class="row">
          <h3 style="margin:0">Dr {{ m.user?.name }}</h3>
          <span class="badge" [ngClass]="m.statut_validation">{{ m.statut_validation }}</span>
        </div>
        <div class="muted">{{ m.specialite?.nom }} — N° Ordre : <strong>{{ m.numero_ordre }}</strong></div>
        <div>{{ m.user?.email }} · {{ m.user?.telephone }}</div>
        <div>Tarif : {{ m.tarif_consultation | number }} FCFA</div>
        <p *ngIf="m.biographie" class="muted">{{ m.biographie }}</p>
        <div *ngIf="m.motif_rejet" class="alert-box error">Motif du refus : {{ m.motif_rejet }}</div>

        <div><strong>Justificatifs</strong></div>
        <div class="row" style="margin:6px 0 10px">
          <button class="btn light" *ngFor="let j of m.justificatifs" (click)="telecharger(m, j)">
            {{ libelleType(j.type) }} ({{ j.nom_original }})
          </button>
        </div>

        <div class="row" *ngIf="m.statut_validation !== 'approved'">
          <button class="btn ok" (click)="approuver(m)">Approuver</button>
        </div>

        <div *ngIf="m.statut_validation !== 'rejected'" style="margin-top:8px">
          <ng-container *ngIf="rejetId !== m.id">
            <button class="btn danger" (click)="rejetId = m.id; motif = ''">
              {{ m.statut_validation === 'approved' ? 'Suspendre / refuser' : 'Refuser' }}
            </button>
          </ng-container>
          <div *ngIf="rejetId === m.id" class="field">
            <label>Motif du refus (visible par le médecin)</label>
            <textarea [(ngModel)]="motif" name="motif" rows="2"></textarea>
            <div class="row">
              <button class="btn danger" (click)="rejeter(m)" [disabled]="motif.trim().length < 5">Confirmer le refus</button>
              <button class="btn light" (click)="rejetId = null">Annuler</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminComponent implements OnInit {
  onglet: Statut = 'pending';
  medecins: any[] = [];
  message = '';
  error = '';
  rejetId: number | null = null;
  motif = '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.charger();
  }

  ouvrir(statut: Statut) {
    this.onglet = statut;
    this.message = '';
    this.error = '';
    this.rejetId = null;
    this.charger();
  }

  libelleType(type: string): string {
    return (
      ({ diplome: 'Diplôme', autorisation_exercice: "Autorisation d'exercice", piece_identite: "Pièce d'identité" } as any)[type] ?? type
    );
  }

  charger() {
    this.api.adminGetMedecins(this.onglet).subscribe({
      next: (list) => (this.medecins = list),
      error: (err: HttpErrorResponse) => (this.error = ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }

  // Les justificatifs sont privés : on les récupère avec le token puis on les télécharge
  telecharger(m: any, j: any) {
    this.api.adminJustificatif(m.id, j.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = j.nom_original;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err: HttpErrorResponse) => (this.error = ApiService.errorMessage(err, 'Téléchargement impossible.'))
    });
  }

  approuver(m: any) {
    this.error = '';
    this.api.adminApprouver(m.id).subscribe({
      next: (res) => {
        this.message = res.message;
        this.charger();
      },
      error: (err: HttpErrorResponse) => (this.error = ApiService.errorMessage(err, 'Action impossible.'))
    });
  }

  rejeter(m: any) {
    this.error = '';
    this.api.adminRejeter(m.id, this.motif.trim()).subscribe({
      next: (res) => {
        this.message = res.message;
        this.rejetId = null;
        this.charger();
      },
      error: (err: HttpErrorResponse) => (this.error = ApiService.errorMessage(err, 'Action impossible.'))
    });
  }
}
