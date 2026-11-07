import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { isoLocal, libelleRdv } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';
import { PaginationComponent } from '../pagination/pagination';

@Component({
  selector: 'app-rendez-vous-medecin',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent, PaginationComponent],
  template: `
    <div class="card entete">
      <h1>Rendez-vous</h1>
      <p class="muted" style="margin: 0">Confirmez ou refusez les demandes, suivez vos consultations et rédigez vos comptes rendus.</p>
    </div>

    <div *ngIf="message()" class="alert-box success">{{ message() }}</div>
    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

    <!-- Onglets par statut -->
    <div class="onglets">
      <button class="onglet" *ngFor="let o of onglets" [class.on]="filtres.statut === o.cle" (click)="choisirStatut(o.cle)">
        {{ o.label }} <span class="compteur">{{ compte(o.cle) }}</span>
      </button>
    </div>

    <!-- Filtres -->
    <form class="outils" (ngSubmit)="charger(1)">
      <div class="field"><label>Patient</label><input type="search" [(ngModel)]="filtres.patient" name="patient" placeholder="Nom du patient"></div>
      <div class="field"><label>Du</label><input type="date" [(ngModel)]="filtres.du" name="du" (change)="charger(1)"></div>
      <div class="field"><label>Au</label><input type="date" [(ngModel)]="filtres.au" name="au" (change)="charger(1)"></div>
      <button type="submit" class="btn light">Rechercher</button>
      <button type="button" class="btn light" (click)="reinitialiser()">Réinitialiser</button>
    </form>

    <div class="row" style="margin-bottom: 14px" *ngIf="patientFiltreNom()">
      <span class="badge">Rendez-vous de {{ patientFiltreNom() }}</span>
      <button class="btn light small" (click)="retirerFiltrePatient()">Voir tous les patients</button>
    </div>

    <p *ngIf="chargement()" class="muted">Chargement...</p>
    <p *ngIf="!chargement() && rdvs().length === 0" class="muted">Aucun rendez-vous ne correspond à ces critères.</p>

    <div class="card" *ngFor="let r of rdvs()">
      <div class="ligne">
        <div style="min-width: 110px">
          <strong>{{ iso(r.date_heure) | date: 'dd/MM/yyyy' }}</strong>
          <div class="muted">{{ iso(r.date_heure) | date: 'HH:mm' }}</div>
        </div>
        <app-avatar [url]="r.patient?.user?.photo_url" [nom]="r.patient?.user?.name || ''" [taille]="44"></app-avatar>
        <div class="grow">
          <strong>{{ r.patient?.user?.name }}</strong>
          <span class="muted" *ngIf="r.patient?.user?.telephone"> · {{ r.patient.user.telephone }}</span>
          <div class="muted" *ngIf="r.motif">Motif : {{ r.motif }}</div>
        </div>
        <span class="badge" [ngClass]="r.statut">{{ libelle(r.statut) }}</span>
      </div>

      <div class="row" style="margin-top: 12px" *ngIf="terminaisonId() !== r.id && notesEditionId() !== r.id">
        <ng-container *ngIf="r.statut === 'en_attente'">
          <button class="btn ok small" (click)="changer(r, 'confirme')">Accepter</button>
          <button class="btn danger small" (click)="changer(r, 'refuse')">Refuser</button>
        </ng-container>
        <ng-container *ngIf="r.statut === 'confirme'">
          <button class="btn small" (click)="ouvrirTerminaison(r)">Terminer la consultation</button>
          <button class="btn danger small" (click)="changer(r, 'annule')">Annuler</button>
        </ng-container>
        <button *ngIf="r.statut === 'termine'" class="btn light small" (click)="commencerNotes(r)">
          {{ r.notes_medecin ? 'Modifier le compte rendu' : 'Rédiger le compte rendu' }}
        </button>
        <button class="btn light small" (click)="basculerFiche(r)">{{ ficheId() === r.patient_id ? 'Masquer le patient' : 'Voir le patient' }}</button>
      </div>

      <!-- Clôture d'une consultation -->
      <div class="field" *ngIf="terminaisonId() === r.id" style="margin-top: 12px">
        <label>Compte rendu de la consultation (facultatif)</label>
        <textarea [(ngModel)]="notesSaisie" name="notes-fin" rows="4" maxlength="5000"
                  placeholder="Observations, diagnostic, traitement, recommandations..."></textarea>
        <span class="hint">Ce compte rendu sera visible par le patient dans son historique.</span>
        <div class="row" style="margin-top: 8px">
          <button class="btn ok small" (click)="terminer(r)" [disabled]="enCours()">Enregistrer et terminer</button>
          <button class="btn light small" (click)="terminaisonId.set(null)">Annuler</button>
        </div>
      </div>

      <!-- Compte rendu existant / en édition -->
      <ng-container *ngIf="r.statut === 'termine'">
        <div class="compte-rendu" *ngIf="r.notes_medecin && notesEditionId() !== r.id">
          <strong>Compte rendu</strong>
          <p>{{ r.notes_medecin }}</p>
        </div>
        <div class="field" *ngIf="notesEditionId() === r.id" style="margin-top: 12px">
          <label>Compte rendu (visible par le patient)</label>
          <textarea [(ngModel)]="notesEdition" name="notes-edit" rows="4" maxlength="5000"></textarea>
          <div class="row" style="margin-top: 8px">
            <button class="btn ok small" (click)="enregistrerNotes(r)" [disabled]="enCours() || !notesEdition.trim()">Enregistrer</button>
            <button class="btn light small" (click)="notesEditionId.set(null)">Annuler</button>
          </div>
        </div>
      </ng-container>

      <!-- Fiche patient -->
      <div class="fiche" *ngIf="ficheId() === r.patient_id">
        <p *ngIf="!fiche()" class="muted" style="margin: 0">Chargement...</p>
        <ng-container *ngIf="fiche() as f">
          <div class="fiche-infos">
            <div><span class="muted">Patient</span><br><strong>{{ f.nom }}</strong></div>
            <div><span class="muted">Téléphone</span><br><a [href]="'tel:' + f.telephone">{{ f.telephone || 'Non renseigné' }}</a></div>
            <div><span class="muted">Consultations terminées</span><br>{{ f.nb_consultations }}</div>
            <div><span class="muted">Rendez-vous annulés</span><br>{{ f.nb_annules }}</div>
            <div><span class="muted">Demandes refusées</span><br>{{ f.nb_refuses }}</div>
            <div><span class="muted">Dernière consultation</span><br>{{ f.derniere_consultation ? (iso(f.derniere_consultation) | date: 'dd/MM/yyyy') : 'Aucune' }}</div>
            <div><span class="muted">Prochain rendez-vous</span><br>{{ f.prochain_rdv ? (iso(f.prochain_rdv) | date: 'dd/MM/yyyy HH:mm') : 'Aucun' }}</div>
          </div>
          <button class="btn light small" style="margin-top: 10px" *ngIf="f.nb_consultations > 0" (click)="voirHistorique(f)">Voir son historique avec moi</button>
        </ng-container>
      </div>
    </div>

    <app-pagination [page]="page()" [derniere]="derniere()" [total]="total()" (aller)="charger($event)"></app-pagination>
  `,
  styles: [`
    .fiche { margin-top: 14px; padding: 14px 16px; background: var(--ciel); border-radius: 12px; border: 1px solid var(--bordure); }
    .fiche-infos { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  `]
})
export class RendezVousMedecinComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  rdvs = signal<any[]>([]);
  compteurs = signal<Record<string, number>>({});
  page = signal(1);
  derniere = signal(1);
  total = signal(0);
  chargement = signal(false);
  message = signal('');
  error = signal('');
  enCours = signal(false);

  filtres = { statut: '', patient: '', patient_id: '', du: '', au: '' };
  patientFiltreNom = signal('');

  onglets = [
    { cle: '', label: 'Tous' },
    { cle: 'en_attente', label: 'En attente' },
    { cle: 'confirme', label: 'Confirmés' },
    { cle: 'termine', label: 'Terminés' },
    { cle: 'refuse', label: 'Refusés' },
    { cle: 'annule', label: 'Annulés' }
  ];

  // Fiche patient
  ficheId = signal<number | null>(null);
  fiche = signal<any>(null);

  // Clôture / compte rendu
  terminaisonId = signal<number | null>(null);
  notesSaisie = '';
  notesEditionId = signal<number | null>(null);
  notesEdition = '';

  libelle = libelleRdv;
  iso = isoLocal;
  totalTous = computed(() => Object.values(this.compteurs()).reduce((a, b) => a + b, 0));

  ngOnInit() {
    // Filtres reçus depuis le tableau de bord (statut, du, au)
    const q = this.route.snapshot.queryParamMap;
    this.filtres.statut = q.get('statut') ?? '';
    this.filtres.du = q.get('du') ?? '';
    this.filtres.au = q.get('au') ?? '';
    this.charger(1);
  }

  compte(cle: string): number {
    return cle === '' ? this.totalTous() : this.compteurs()[cle] ?? 0;
  }

  choisirStatut(cle: string) {
    this.filtres.statut = cle;
    this.charger(1);
  }

  charger(page = 1) {
    this.chargement.set(true);
    this.api.medecinRendezVous({ ...this.filtres, page }).subscribe({
      next: (r) => {
        this.rdvs.set(r.data);
        this.compteurs.set(r.compteurs ?? {});
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

  reinitialiser() {
    this.filtres = { statut: '', patient: '', patient_id: '', du: '', au: '' };
    this.patientFiltreNom.set('');
    this.charger(1);
  }

  // ----- Actions sur un rendez-vous -----
  changer(r: any, statut: 'confirme' | 'refuse' | 'annule') {
    if (statut === 'annule' && r.statut === 'confirme' && !confirm('Annuler ce rendez-vous confirmé ?')) return;
    this.error.set('');
    this.message.set('');
    this.api.updateStatutRendezVous(r.id, statut).subscribe({
      next: () => {
        this.message.set(statut === 'confirme' ? 'Rendez-vous confirmé.' : statut === 'refuse' ? 'Demande refusée.' : 'Rendez-vous annulé.');
        this.charger(this.page());
      },
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Action impossible.'))
    });
  }

  ouvrirTerminaison(r: any) {
    this.notesSaisie = '';
    this.notesEditionId.set(null);
    this.terminaisonId.set(r.id);
  }

  terminer(r: any) {
    this.error.set('');
    this.enCours.set(true);
    this.api.updateStatutRendezVous(r.id, 'termine', this.notesSaisie.trim() || undefined).subscribe({
      next: () => {
        this.enCours.set(false);
        this.terminaisonId.set(null);
        this.message.set('Consultation terminée. Elle figure maintenant dans vos rendez-vous terminés.');
        this.charger(this.page());
      },
      error: (err: HttpErrorResponse) => this.echec(err, 'Action impossible.')
    });
  }

  commencerNotes(r: any) {
    this.notesEdition = r.notes_medecin ?? '';
    this.terminaisonId.set(null);
    this.notesEditionId.set(r.id);
  }

  enregistrerNotes(r: any) {
    this.error.set('');
    this.enCours.set(true);
    this.api.modifierNotes(r.id, this.notesEdition.trim()).subscribe({
      next: (res) => {
        this.enCours.set(false);
        this.notesEditionId.set(null);
        this.message.set(res.message);
        this.charger(this.page());
      },
      error: (err: HttpErrorResponse) => this.echec(err, 'Enregistrement impossible.')
    });
  }

  private echec(err: HttpErrorResponse, defaut: string) {
    this.enCours.set(false);
    const messages = ApiService.validationMessages(err);
    this.error.set(messages.length ? messages.join('\n') : ApiService.errorMessage(err, defaut));
  }

  // ----- Fiche patient -----
  basculerFiche(r: any) {
    if (this.ficheId() === r.patient_id) {
      this.ficheId.set(null);
      return;
    }
    this.ficheId.set(r.patient_id);
    this.fiche.set(null);
    this.api.medecinPatient(r.patient_id).subscribe({
      next: (f) => this.fiche.set(f),
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Fiche indisponible.'))
    });
  }

  voirHistorique(f: any) {
    this.filtres = { statut: 'termine', patient: '', patient_id: String(f.id), du: '', au: '' };
    this.patientFiltreNom.set(f.nom);
    this.ficheId.set(null);
    this.charger(1);
  }

  retirerFiltrePatient() {
    this.filtres.patient_id = '';
    this.patientFiltreNom.set('');
    this.charger(1);
  }
}
