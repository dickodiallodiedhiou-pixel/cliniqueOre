import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api';
import { libelleStatutMedecin } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';

type Statut = 'pending' | 'approved' | 'rejected';

@Component({
  selector: 'app-validations',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent],
  template: `
    <div>
      <div class="card entete">
        <h1>Validation des comptes médecins</h1>
        <p class="muted" style="margin: 0">Vérifiez les justificatifs, puis approuvez ou refusez chaque demande.</p>
      </div>

      <div class="onglets">
        <button class="onglet" [class.on]="onglet() === 'pending'" (click)="ouvrir('pending')">
          En attente <span class="compteur">{{ listes().pending.length }}</span>
        </button>
        <button class="onglet" [class.on]="onglet() === 'approved'" (click)="ouvrir('approved')">
          Approuvés <span class="compteur">{{ listes().approved.length }}</span>
        </button>
        <button class="onglet" [class.on]="onglet() === 'rejected'" (click)="ouvrir('rejected')">
          Refusés <span class="compteur">{{ listes().rejected.length }}</span>
        </button>
      </div>

      <div *ngIf="message()" class="alert-box success">{{ message() }}</div>
      <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

      <p *ngIf="chargee() && medecins().length === 0" class="muted">Aucune demande dans cette catégorie.</p>

      <div class="card" *ngFor="let m of medecins()">
        <div class="row">
          <app-avatar [url]="m.user?.photo_url" [nom]="m.user?.name || ''" [taille]="72"></app-avatar>
          <div style="flex: 1">
            <h3>Dr {{ m.user?.name }}</h3>
            <div class="muted">{{ m.specialite?.nom }} · N° Ordre : <strong>{{ m.numero_ordre }}</strong></div>
            <div>{{ m.user?.email }} · {{ m.user?.telephone }}</div>
            <div>Tarif : {{ m.tarif_consultation | number }} FCFA</div>
          </div>
          <span class="badge" [ngClass]="m.statut_validation">{{ libelleStatut(m.statut_validation) }}</span>
        </div>

        <p *ngIf="m.biographie" class="muted" style="margin-top: 10px">{{ m.biographie }}</p>
        <div *ngIf="m.motif_rejet" class="alert-box error" style="margin-top: 10px">Motif du refus : {{ m.motif_rejet }}</div>

        <div style="margin-top: 12px"><strong>Justificatifs</strong></div>
        <div class="row" style="margin: 6px 0 14px">
          <button class="btn light small" *ngFor="let j of m.justificatifs" (click)="voir(m, j)">
            {{ libelleType(j.type) }}
          </button>
        </div>

        <div class="row">
          <button *ngIf="m.statut_validation !== 'approved'" class="btn ok" (click)="approuver(m)">Approuver</button>
          <button *ngIf="m.statut_validation !== 'rejected' && rejetId() !== m.id" class="btn danger"
                  (click)="rejetId.set(m.id); motif = ''">
            {{ m.statut_validation === 'approved' ? 'Suspendre' : 'Refuser' }}
          </button>
        </div>

        <div *ngIf="rejetId() === m.id" class="field" style="margin-top: 12px">
          <label>Motif du refus (visible par le médecin)</label>
          <textarea [(ngModel)]="motif" name="motif" rows="2" placeholder="Exemple : diplôme illisible"></textarea>
          <div class="row">
            <button class="btn danger small" (click)="rejeter(m)" [disabled]="motif.trim().length < 5">Confirmer le refus</button>
            <button class="btn light small" (click)="rejetId.set(null)">Annuler</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Aperçu d'un justificatif image -->
    <div class="voile" *ngIf="apercu() as a" (click)="fermerApercu()">
      <div class="apercu" (click)="$event.stopPropagation()">
        <div class="row" style="justify-content: space-between">
          <strong>{{ a.nom }}</strong>
          <button class="btn light small" (click)="fermerApercu()">Fermer</button>
        </div>
        <img [src]="a.url" [alt]="a.nom">
      </div>
    </div>
  `,
  styles: [`
    .onglets { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 16px; border-bottom: 2px solid var(--bordure); }
    .onglet { font: inherit; font-weight: 500; border: none; background: transparent; padding: 10px 18px; cursor: pointer; color: var(--gris); border-bottom: 3px solid transparent; margin-bottom: -2px; }
    .onglet:hover { color: var(--bleu); }
    .onglet.on { color: var(--bleu); border-bottom-color: var(--bleu); font-weight: 600; }
    .compteur { background: var(--bleu-clair); color: var(--bleu-fonce); border-radius: 999px; padding: 0 9px; margin-left: 6px; font-size: .8rem; }
    .voile { position: fixed; inset: 0; background: rgba(10, 42, 86, .55); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
    .apercu { background: #fff; border-radius: 16px; padding: 16px; max-width: 760px; width: 100%; max-height: 90vh; overflow: auto; }
    .apercu img { width: 100%; margin-top: 10px; border-radius: 10px; }
  `]
})
export class ValidationsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  onglet = signal<Statut>('pending');
  listes = signal<Record<Statut, any[]>>({ pending: [], approved: [], rejected: [] });
  chargee = signal(false);
  message = signal('');
  error = signal('');
  rejetId = signal<number | null>(null);
  apercu = signal<{ url: string; nom: string } | null>(null);
  motif = '';

  medecins = computed(() => this.listes()[this.onglet()]);
  libelleStatut = libelleStatutMedecin;

  ngOnInit() {
    this.charger();
  }

  ngOnDestroy() {
    this.fermerApercu();
  }

  ouvrir(statut: Statut) {
    this.onglet.set(statut);
    this.message.set('');
    this.error.set('');
    this.rejetId.set(null);
  }

  libelleType(type: string): string {
    const map: Record<string, string> = {
      diplome: 'Diplôme',
      autorisation_exercice: "Autorisation d'exercice",
      piece_identite: "Pièce d'identité"
    };
    return map[type] ?? type;
  }

  // Charge les 3 listes d'un coup (pour afficher les compteurs)
  charger() {
    forkJoin({
      pending: this.api.adminMedecins({ statut: 'pending', per_page: 100 }),
      approved: this.api.adminMedecins({ statut: 'approved', per_page: 100 }),
      rejected: this.api.adminMedecins({ statut: 'rejected', per_page: 100 })
    }).subscribe({
      next: (res) => {
        this.listes.set({ pending: res.pending.data, approved: res.approved.data, rejected: res.rejected.data });
        this.chargee.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.chargee.set(true);
        this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'));
      }
    });
  }

  // Les justificatifs sont privés : on les récupère avec le token.
  // Images : aperçu à l'écran ; PDF : téléchargement.
  voir(m: any, j: any) {
    this.api.adminJustificatif(m.id, j.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (blob.type.startsWith('image/')) {
          this.fermerApercu();
          this.apercu.set({ url, nom: `${this.libelleType(j.type)} — ${j.nom_original}` });
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = j.nom_original;
          a.click();
          URL.revokeObjectURL(url);
        }
      },
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Ouverture impossible.'))
    });
  }

  fermerApercu() {
    const a = this.apercu();
    if (a) {
      URL.revokeObjectURL(a.url);
    }
    this.apercu.set(null);
  }

  approuver(m: any) {
    this.error.set('');
    this.api.adminApprouver(m.id).subscribe({
      next: (res) => {
        this.message.set(res.message);
        this.charger();
      },
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Action impossible.'))
    });
  }

  rejeter(m: any) {
    this.error.set('');
    this.api.adminRejeter(m.id, this.motif.trim()).subscribe({
      next: (res) => {
        this.message.set(res.message);
        this.rejetId.set(null);
        this.charger();
      },
      error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Action impossible.'))
    });
  }
}
