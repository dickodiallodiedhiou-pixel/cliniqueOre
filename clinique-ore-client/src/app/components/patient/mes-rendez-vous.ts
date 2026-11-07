import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { isoLocal, libelleRdv } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';
import { PaginationComponent } from '../pagination/pagination';

type Onglet = 'avenir' | 'passes' | 'annules';

@Component({
  selector: 'app-mes-rendez-vous',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarComponent, PaginationComponent],
  template: `
    <div class="card entete">
      <div class="ligne">
        <div class="grow">
          <h1>Mes rendez-vous</h1>
          <p class="muted" style="margin: 0">Suivez l'état de vos demandes, modifiez ou annulez un rendez-vous.</p>
        </div>
        <a routerLink="/patient/rendez-vous/nouveau" class="btn">Prendre rendez-vous</a>
      </div>
    </div>

    <div *ngIf="message()" class="alert-box success">{{ message() }}</div>
    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

    <div class="onglets">
      <button class="onglet" [class.on]="onglet() === 'avenir'" (click)="ouvrir('avenir')">À venir <span class="compteur">{{ compteurs().avenir }}</span></button>
      <button class="onglet" [class.on]="onglet() === 'passes'" (click)="ouvrir('passes')">Passés <span class="compteur">{{ compteurs().passes }}</span></button>
      <button class="onglet" [class.on]="onglet() === 'annules'" (click)="ouvrir('annules')">Annulés et refusés <span class="compteur">{{ compteurs().annules }}</span></button>
    </div>

    <div class="alert-box warn" *ngIf="onglet() === 'avenir'">
      <strong>Règle de la clinique :</strong> un rendez-vous peut être modifié ou annulé jusqu'à
      <strong>{{ delai() }} heures</strong> avant sa date.
    </div>

    <p *ngIf="chargement()" class="muted">Chargement...</p>
    <p *ngIf="!chargement() && rdvs().length === 0" class="muted">
      {{ onglet() === 'avenir' ? "Vous n'avez aucun rendez-vous à venir." : onglet() === 'passes' ? 'Aucun rendez-vous passé.' : 'Aucun rendez-vous annulé ou refusé.' }}
    </p>

    <div class="card" *ngFor="let r of rdvs()">
      <div class="ligne">
        <div style="min-width: 150px">
          <strong>{{ iso(r.date_heure) | date: 'EEEE d MMMM y' }}</strong>
          <div class="muted">à {{ iso(r.date_heure) | date: 'HH:mm' }}</div>
        </div>
        <app-avatar [url]="r.medecin?.user?.photo_url" [nom]="r.medecin?.user?.name || ''" [taille]="44"></app-avatar>
        <div class="grow">
          <div>Dr {{ r.medecin?.user?.name }}</div>
          <div class="muted">{{ r.medecin?.specialites_libelle }}</div>
        </div>
        <span class="badge" [ngClass]="r.statut">{{ libelle(r.statut) }}</span>
      </div>

      <div *ngIf="r.motif" class="muted" style="margin-top: 8px">Motif : {{ r.motif }}</div>
      <p class="muted" style="margin: 8px 0 0">{{ explication(r.statut) }}</p>

      <!-- Compte rendu du médecin -->
      <div class="compte-rendu" *ngIf="r.statut === 'termine' && r.notes_medecin">
        <strong>Compte rendu du médecin</strong>
        <p>{{ r.notes_medecin }}</p>
      </div>

      <!-- Actions -->
      <div class="row" style="margin-top: 12px" *ngIf="r.statut === 'en_attente' || r.statut === 'confirme'">
        <ng-container *ngIf="r.modifiable">
          <button class="btn light small" (click)="modifier(r)">Modifier</button>
          <button class="btn danger small" (click)="annuler(r)">Annuler</button>
        </ng-container>
        <span *ngIf="!r.modifiable && onglet() === 'avenir'" class="muted">
          Modification et annulation impossibles moins de {{ r.delai_modification_heures }} h avant le rendez-vous.
        </span>
      </div>
      <div class="row" style="margin-top: 12px" *ngIf="onglet() !== 'avenir'">
        <button class="btn light small" (click)="reprendre(r)">Reprendre rendez-vous avec ce médecin</button>
      </div>
    </div>

    <app-pagination [page]="page()" [derniere]="derniere()" [total]="total()" (aller)="charger($event)"></app-pagination>
  `
})
export class MesRendezVousComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  onglet = signal<Onglet>('avenir');
  rdvs = signal<any[]>([]);
  compteurs = signal<{ avenir: number; passes: number; annules: number }>({ avenir: 0, passes: 0, annules: 0 });
  page = signal(1);
  derniere = signal(1);
  total = signal(0);
  chargement = signal(false);
  message = signal('');
  error = signal('');
  delai = signal(24);

  libelle = libelleRdv;
  iso = isoLocal;

  ngOnInit() {
    this.charger(1);
  }

  ouvrir(o: Onglet) {
    this.onglet.set(o);
    this.message.set('');
    this.charger(1);
  }

  charger(page = 1) {
    this.chargement.set(true);
    this.api.patientRendezVous({ onglet: this.onglet(), page }).subscribe({
      next: (r) => {
        this.rdvs.set(r.data);
        this.compteurs.set(r.compteurs);
        this.page.set(r.current_page);
        this.derniere.set(r.last_page);
        this.total.set(r.total);
        if (r.data.length > 0 && r.data[0].delai_modification_heures) {
          this.delai.set(r.data[0].delai_modification_heures);
        }
        this.chargement.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.chargement.set(false);
        this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'));
      }
    });
  }

  explication(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'En attente de la réponse du médecin. Vous serez notifié dès sa décision.',
      confirme: 'Confirmé par le médecin.',
      termine: 'Consultation terminée.',
      refuse: 'Votre demande a été refusée par le médecin. Vous pouvez choisir un autre créneau.',
      annule: 'Ce rendez-vous a été annulé.'
    };
    return map[statut] ?? '';
  }

  modifier(r: any) {
    this.router.navigate(['/patient/rendez-vous/nouveau'], { queryParams: { modifier: r.id } });
  }

  reprendre(r: any) {
    this.router.navigate(['/patient/rendez-vous/nouveau'], { queryParams: { medecin_id: r.medecin_id } });
  }

  annuler(r: any) {
    if (!confirm('Annuler ce rendez-vous ?')) return;
    this.error.set('');
    this.message.set('');
    this.api.annulerRendezVous(r.id).subscribe({
      next: () => {
        this.message.set('Rendez-vous annulé.');
        this.charger(this.page());
      },
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Annulation impossible.'))
    });
  }
}
