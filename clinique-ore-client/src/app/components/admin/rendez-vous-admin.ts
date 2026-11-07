import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { isoLocal, libelleRdv, pourChampDateHeure } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';
import { PaginationComponent } from '../pagination/pagination';

@Component({
  selector: 'app-rendez-vous-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent, PaginationComponent],
  template: `
    <div class="card entete">
      <h1>Rendez-vous</h1>
      <p class="muted" style="margin: 0">Supervisez tous les rendez-vous et intervenez en cas d'erreur ou de conflit.</p>
    </div>

    <div *ngIf="message()" class="alert-box success">{{ message() }}</div>
    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

    <!-- Conflits : un médecin avec deux rendez-vous actifs au même moment -->
    <div class="alert-box error" *ngIf="conflits().length > 0">
      <strong>{{ conflits().length }} conflit{{ conflits().length > 1 ? 's' : '' }} à résoudre</strong>
      <div class="conflit" *ngFor="let g of conflits()">
        <div>Dr {{ g.rendez_vous[0]?.medecin?.user?.name }} — {{ g.date_heure | date: "EEEE d MMMM y 'à' HH:mm" }}</div>
        <div class="row" *ngFor="let r of g.rendez_vous" style="margin-top: 6px">
          <span>{{ r.patient?.user?.name }} <span class="badge" [ngClass]="r.statut">{{ libelle(r.statut) }}</span></span>
          <button class="btn light small" (click)="intervenir(r)">Intervenir</button>
        </div>
      </div>
    </div>

    <!-- Panneau d'intervention -->
    <div class="card panneau" *ngIf="selection() as r">
      <h3>Intervenir sur le rendez-vous n° {{ r.id }}</h3>
      <p class="muted">{{ r.patient?.user?.name }} avec Dr {{ r.medecin?.user?.name }} — modifiez uniquement ce qui doit changer.</p>
      <div class="outils" style="margin: 0">
        <div class="field">
          <label>Statut</label>
          <select [(ngModel)]="edition.statut" name="e-statut">
            <option value="en_attente">En attente</option><option value="confirme">Confirmé</option>
            <option value="refuse">Refusé</option><option value="annule">Annulé</option><option value="termine">Terminé</option>
          </select>
        </div>
        <div class="field"><label>Date et heure</label><input type="datetime-local" [(ngModel)]="edition.date_heure" name="e-date"></div>
        <div class="field">
          <label>Médecin</label>
          <select [(ngModel)]="edition.medecin_id" name="e-medecin">
            <option *ngIf="!medecinDansListe(r.medecin_id)" [ngValue]="r.medecin_id">Dr {{ r.medecin?.user?.name }} (actuel)</option>
            <option *ngFor="let m of medecins()" [ngValue]="m.id">Dr {{ m.user?.name }} — {{ m.specialites_libelle }}</option>
          </select>
        </div>
      </div>
      <div class="row" style="margin-top: 12px">
        <button class="btn ok" (click)="appliquer(r)" [disabled]="enregistrement()">Enregistrer</button>
        <button class="btn light" (click)="selection.set(null)">Annuler</button>
      </div>
    </div>

    <!-- Filtres -->
    <form class="outils" (ngSubmit)="charger(1)">
      <div class="field">
        <label>Médecin</label>
        <select [(ngModel)]="filtres.medecin_id" name="medecin" (change)="charger(1)">
          <option value="">Tous</option>
          <option *ngFor="let m of medecins()" [value]="m.id">Dr {{ m.user?.name }}</option>
        </select>
      </div>
      <div class="field"><label>Patient</label><input type="search" [(ngModel)]="filtres.patient" name="patient" placeholder="Nom ou téléphone"></div>
      <div class="field">
        <label>Statut</label>
        <select [(ngModel)]="filtres.statut" name="statut" (change)="charger(1)">
          <option value="">Tous</option><option value="en_attente">En attente</option><option value="confirme">Confirmé</option>
          <option value="refuse">Refusé</option><option value="annule">Annulé</option><option value="termine">Terminé</option>
        </select>
      </div>
      <div class="field"><label>Du</label><input type="date" [(ngModel)]="filtres.du" name="du" (change)="charger(1)"></div>
      <div class="field"><label>Au</label><input type="date" [(ngModel)]="filtres.au" name="au" (change)="charger(1)"></div>
      <button type="submit" class="btn light">Rechercher</button>
      <button type="button" class="btn light" (click)="reinitialiser()">Réinitialiser</button>
    </form>

    <div class="row" style="margin-bottom: 14px" *ngIf="filtres.patient_id">
      <span class="badge">Filtré sur un patient</span>
      <button class="btn light small" (click)="filtres.patient_id = ''; charger(1)">Retirer ce filtre</button>
    </div>

    <p *ngIf="chargement()" class="muted">Chargement...</p>
    <p *ngIf="!chargement() && rdvs().length === 0" class="muted">Aucun rendez-vous ne correspond à ces critères.</p>

    <div class="card" *ngFor="let r of rdvs()">
      <div class="ligne">
        <div style="min-width: 150px">
          <strong>{{ iso(r.date_heure) | date: 'dd/MM/yyyy' }}</strong>
          <div class="muted">{{ iso(r.date_heure) | date: 'HH:mm' }}</div>
        </div>
        <div class="grow ligne">
          <app-avatar [url]="r.patient?.user?.photo_url" [nom]="r.patient?.user?.name || ''" [taille]="40"></app-avatar>
          <div>
            <div><span class="muted">Patient</span> {{ r.patient?.user?.name }}</div>
            <div class="muted">{{ r.patient?.user?.telephone }}</div>
          </div>
        </div>
        <div class="grow ligne">
          <app-avatar [url]="r.medecin?.user?.photo_url" [nom]="r.medecin?.user?.name || ''" [taille]="40"></app-avatar>
          <div>
            <div><span class="muted">Médecin</span> Dr {{ r.medecin?.user?.name }}</div>
            <div class="muted">{{ r.medecin?.specialites_libelle }}</div>
          </div>
        </div>
        <span class="badge" [ngClass]="r.statut">{{ libelle(r.statut) }}</span>
        <div class="row">
          <button *ngIf="r.statut === 'en_attente'" class="btn ok small" (click)="rapide(r, 'confirme')">Confirmer</button>
          <button *ngIf="r.statut === 'en_attente'" class="btn danger small" (click)="rapide(r, 'refuse')">Refuser</button>
          <button *ngIf="r.statut === 'confirme'" class="btn danger small" (click)="rapide(r, 'annule')">Annuler</button>
          <button class="btn light small" (click)="intervenir(r)">Intervenir</button>
        </div>
      </div>
      <div *ngIf="r.motif" class="muted" style="margin-top: 8px">Motif : {{ r.motif }}</div>
    </div>

    <app-pagination [page]="page()" [derniere]="derniere()" [total]="total()" (aller)="charger($event)"></app-pagination>
  `,
  styles: [`.conflit { margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(180, 35, 24, .35); }`]
})
export class RendezVousAdminComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  rdvs = signal<any[]>([]);
  medecins = signal<any[]>([]);
  conflits = signal<any[]>([]);
  page = signal(1);
  derniere = signal(1);
  total = signal(0);
  chargement = signal(false);
  message = signal('');
  error = signal('');
  selection = signal<any>(null);
  enregistrement = signal(false);

  filtres = { medecin_id: '', patient_id: '', patient: '', statut: '', du: '', au: '' };
  edition = { statut: 'en_attente', date_heure: '', medecin_id: 0 };

  libelle = libelleRdv;
  iso = isoLocal;

  ngOnInit() {
    // Filtres reçus depuis les autres pages (tableau de bord, médecins, patients)
    const q = this.route.snapshot.queryParamMap;
    this.filtres.medecin_id = q.get('medecin_id') ?? '';
    this.filtres.patient_id = q.get('patient_id') ?? '';
    this.filtres.statut = q.get('statut') ?? '';
    this.filtres.du = q.get('du') ?? '';
    this.filtres.au = q.get('au') ?? '';

    this.api.adminMedecins({ statut: 'approved', actif: 'true', per_page: 100 }).subscribe({
      next: (r) => this.medecins.set(r.data),
      error: () => this.medecins.set([])
    });
    this.charger(1);
    this.chargerConflits();
  }

  charger(page = 1) {
    this.chargement.set(true);
    this.api.adminRendezVous({ ...this.filtres, page }).subscribe({
      next: (r) => {
        this.rdvs.set(r.data);
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

  chargerConflits() {
    this.api.adminConflits().subscribe({ next: (l) => this.conflits.set(l), error: () => this.conflits.set([]) });
  }

  reinitialiser() {
    this.filtres = { medecin_id: '', patient_id: '', patient: '', statut: '', du: '', au: '' };
    this.router.navigate([], { queryParams: {} });
    this.charger(1);
  }

  medecinDansListe(id: number): boolean {
    return this.medecins().some((m) => m.id === id);
  }

  intervenir(r: any) {
    this.message.set('');
    this.error.set('');
    this.selection.set(r);
    this.edition = { statut: r.statut, date_heure: pourChampDateHeure(r.date_heure), medecin_id: r.medecin_id };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Envoie uniquement les champs modifiés
  appliquer(r: any) {
    const data: { statut?: string; date_heure?: string; medecin_id?: number } = {};
    if (this.edition.statut !== r.statut) data.statut = this.edition.statut;
    if (this.edition.date_heure && this.edition.date_heure !== pourChampDateHeure(r.date_heure)) data.date_heure = this.edition.date_heure;
    if (this.edition.medecin_id !== r.medecin_id) data.medecin_id = this.edition.medecin_id;

    if (Object.keys(data).length === 0) {
      this.selection.set(null);
      return;
    }
    this.envoyer(r, data, true);
  }

  rapide(r: any, statut: 'confirme' | 'refuse' | 'annule') {
    if (statut !== 'confirme' && !confirm(statut === 'refuse' ? 'Refuser cette demande ?' : 'Annuler ce rendez-vous ?')) return;
    this.envoyer(r, { statut }, false);
  }

  private envoyer(r: any, data: { statut?: string; date_heure?: string; medecin_id?: number }, depuisPanneau: boolean) {
    this.message.set('');
    this.error.set('');
    this.enregistrement.set(true);
    this.api.adminModifierRdv(r.id, data).subscribe({
      next: (res) => {
        this.enregistrement.set(false);
        this.message.set(res.message);
        if (depuisPanneau) this.selection.set(null);
        this.charger(this.page());
        this.chargerConflits();
      },
      error: (err: HttpErrorResponse) => {
        this.enregistrement.set(false);
        const messages = ApiService.validationMessages(err);
        this.error.set(messages.length ? messages.join('\n') : ApiService.errorMessage(err, 'Action impossible.'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
}
