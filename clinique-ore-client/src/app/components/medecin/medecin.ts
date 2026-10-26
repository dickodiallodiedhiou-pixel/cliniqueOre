import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { NavbarComponent } from '../navbar/navbar';

@Component({
  selector: 'app-medecin',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  template: `
    <app-navbar titre="Espace médecin"></app-navbar>
    <div class="page">
      <div *ngIf="error" class="alert-box error">{{ error }}</div>

      <ng-container *ngIf="profil">
        <!-- Compte non validé : aucune fonctionnalité professionnelle -->
        <div *ngIf="statut === 'pending'" class="alert-box warn">
          <strong>Compte en attente de validation.</strong><br>
          L'administrateur examine vos justificatifs. Tant que votre compte n'est pas approuvé, vous
          n'apparaissez pas dans l'annuaire et vous ne pouvez pas accepter de rendez-vous.
        </div>
        <div *ngIf="statut === 'rejected'" class="alert-box error">
          <strong>Votre demande a été refusée.</strong><br>
          Motif : {{ profil.medecin?.motif_rejet }}
        </div>

        <ng-container *ngIf="statut === 'approved'">
          <div class="alert-box success">Compte validé — votre profil est visible dans l'annuaire.</div>

          <h2>Mes rendez-vous</h2>
          <p *ngIf="rdvs.length === 0" class="muted">Aucun rendez-vous pour le moment.</p>
          <div class="card" *ngFor="let r of rdvs">
            <div class="row">
              <strong>{{ r.date_heure | date: 'dd/MM/yyyy HH:mm' }}</strong>
              <span class="badge" [ngClass]="r.statut">{{ libelle(r.statut) }}</span>
            </div>
            <div>Patient : {{ r.patient?.user?.name }}
              <span class="muted" *ngIf="r.patient?.user?.telephone">({{ r.patient.user.telephone }})</span></div>
            <div *ngIf="r.motif" class="muted">Motif : {{ r.motif }}</div>
            <div class="row" style="margin-top:8px">
              <ng-container *ngIf="r.statut === 'en_attente'">
                <button class="btn ok" (click)="changer(r, 'confirme')">Accepter</button>
                <button class="btn danger" (click)="changer(r, 'annule')">Refuser</button>
              </ng-container>
              <ng-container *ngIf="r.statut === 'confirme'">
                <button class="btn" (click)="changer(r, 'termine')">Marquer terminé</button>
                <button class="btn danger" (click)="changer(r, 'annule')">Annuler</button>
              </ng-container>
            </div>
          </div>
        </ng-container>
      </ng-container>
    </div>
  `
})
export class MedecinComponent implements OnInit {
  profil: any = null;
  statut = '';
  rdvs: any[] = [];
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    // Le statut est relu en base : si l'admin vient de valider le compte, il est pris en compte
    this.api.me().subscribe({
      next: (user) => {
        this.profil = user;
        this.statut = user.medecin?.statut_validation ?? 'pending';
        if (this.statut === 'approved') {
          this.charger();
        }
      },
      error: (err: HttpErrorResponse) => (this.error = ApiService.errorMessage(err, 'Chargement impossible.'))
    });
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

  changer(r: any, statut: 'confirme' | 'annule' | 'termine') {
    this.error = '';
    this.api.updateStatutRendezVous(r.id, statut).subscribe({
      next: () => this.charger(),
      error: (err: HttpErrorResponse) => (this.error = ApiService.errorMessage(err, 'Action impossible.'))
    });
  }
}
