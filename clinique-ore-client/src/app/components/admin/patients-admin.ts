import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { libelleRdv } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';
import { PaginationComponent } from '../pagination/pagination';

@Component({
  selector: 'app-patients-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent, PaginationComponent],
  template: `
    <div class="card entete">
      <h1>Patients</h1>
      <p class="muted" style="margin: 0">Consultez les patients inscrits et gérez l'accès à leur compte.</p>
    </div>

    <div *ngIf="message()" class="alert-box success">{{ message() }}</div>
    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

    <form class="outils" (ngSubmit)="charger(1)">
      <div class="field"><label>Recherche</label><input type="search" [(ngModel)]="filtres.q" name="q" placeholder="Nom, email ou téléphone"></div>
      <div class="field">
        <label>Compte</label>
        <select [(ngModel)]="filtres.actif" name="actif" (change)="charger(1)">
          <option value="">Tous</option><option value="true">Actifs</option><option value="false">Désactivés</option>
        </select>
      </div>
      <button type="submit" class="btn light">Rechercher</button>
    </form>

    <p *ngIf="chargement()" class="muted">Chargement...</p>
    <p *ngIf="!chargement() && patients().length === 0" class="muted">Aucun patient ne correspond à ces critères.</p>

    <div class="card" *ngFor="let p of patients()" [class.inactif]="!p.user?.actif">
      <div class="ligne">
        <app-avatar [url]="p.user?.photo_url" [nom]="p.user?.name || ''" [taille]="52"></app-avatar>
        <div class="grow">
          <h3>{{ p.user?.name }}</h3>
          <div class="muted">{{ p.user?.email }} · {{ p.user?.telephone }}</div>
          <div class="pastilles">
            <span class="badge" [ngClass]="p.user?.actif ? 'approved' : 'rejected'">{{ p.user?.actif ? 'Compte actif' : 'Compte désactivé' }}</span>
            <span class="badge">{{ p.rendez_vous_count }} rendez-vous</span>
          </div>
        </div>
        <div class="row">
          <button class="btn light small" (click)="basculerDetails(p)">{{ ouvert() === p.id ? 'Masquer' : 'Détails' }}</button>
          <button class="btn light small" (click)="voirRdv(p)">Rendez-vous</button>
          <button class="btn small" [ngClass]="p.user?.actif ? 'danger' : 'ok'" (click)="basculer(p)">
            {{ p.user?.actif ? 'Désactiver' : 'Activer' }}
          </button>
        </div>
      </div>

      <div class="details" *ngIf="ouvert() === p.id">
        <p *ngIf="!details()" class="muted">Chargement...</p>
        <ng-container *ngIf="details() as d">
          <div class="infos">
            <div><span class="muted">Inscrit le</span><br>{{ d.user?.created_at | date: 'dd/MM/yyyy' }}</div>
            <div><span class="muted">Date de naissance</span><br>{{ d.date_naissance ? (d.date_naissance | date: 'dd/MM/yyyy') : 'Non renseignée' }}</div>
            <div><span class="muted">Sexe</span><br>{{ d.sexe === 'M' ? 'Masculin' : d.sexe === 'F' ? 'Féminin' : 'Non précisé' }}</div>
            <div><span class="muted">Adresse</span><br>{{ d.user?.adresse || 'Non renseignée' }}</div>
            <div><span class="muted">Rendez-vous au total</span><br>{{ d.rendez_vous_count }}</div>
          </div>
          <div class="pastilles" *ngIf="statuts(d).length > 0">
            <span class="badge" *ngFor="let s of statuts(d)" [ngClass]="s">{{ libelle(s) }} : {{ d.rendez_vous_par_statut[s] }}</span>
          </div>
        </ng-container>
      </div>
    </div>

    <app-pagination [page]="page()" [derniere]="derniere()" [total]="total()" (aller)="charger($event)"></app-pagination>
  `,
  styles: [`
    .inactif { opacity: .75; background: #fafbfd; }
    .details { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--bordure); }
    .infos { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 10px; }
  `]
})
export class PatientsAdminComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  patients = signal<any[]>([]);
  page = signal(1);
  derniere = signal(1);
  total = signal(0);
  chargement = signal(false);
  message = signal('');
  error = signal('');
  ouvert = signal<number | null>(null);
  details = signal<any>(null);

  filtres = { q: '', actif: '' };
  libelle = libelleRdv;

  ngOnInit() {
    this.charger(1);
  }

  charger(page = 1) {
    this.chargement.set(true);
    this.api.adminPatients({ ...this.filtres, page }).subscribe({
      next: (r) => {
        this.patients.set(r.data);
        this.page.set(r.current_page);
        this.derniere.set(r.last_page);
        this.total.set(r.total);
        this.chargement.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.chargement.set(false);
        this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'));
      }
    });
  }

  basculerDetails(p: any) {
    if (this.ouvert() === p.id) {
      this.ouvert.set(null);
      return;
    }
    this.ouvert.set(p.id);
    this.details.set(null);
    this.api.adminPatient(p.id).subscribe({
      next: (d) => this.details.set(d),
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }

  statuts(d: any): string[] {
    return Object.keys(d.rendez_vous_par_statut ?? {});
  }

  basculer(p: any) {
    const actif = !p.user?.actif;
    if (!actif && !confirm(`Désactiver le compte de ${p.user.name} ? Il ne pourra plus se connecter.`)) {
      return;
    }
    this.error.set('');
    this.api.adminActifPatient(p.id, actif).subscribe({
      next: (res) => {
        this.message.set(res.message);
        this.charger(this.page());
      },
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Action impossible.'))
    });
  }

  voirRdv(p: any) {
    this.router.navigate(['/admin/rendez-vous'], { queryParams: { patient_id: p.id } });
  }
}
