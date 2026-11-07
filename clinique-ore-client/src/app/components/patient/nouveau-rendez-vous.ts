import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { nomsSpecialites } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';

// Assistant de réservation : spécialité -> médecin -> date et créneau -> confirmation
@Component({
  selector: 'app-nouveau-rendez-vous',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AvatarComponent],
  template: `
    <div class="card entete">
      <h1>{{ edition() ? 'Modifier mon rendez-vous' : 'Prendre un rendez-vous' }}</h1>
      <p class="muted" style="margin: 0">
        {{ edition() ? 'Choisissez un nouveau créneau. Le médecin devra le confirmer à nouveau.' : 'Quelques étapes suffisent, sans vous déplacer.' }}
      </p>
    </div>

    <!-- Progression -->
    <div class="etapes" *ngIf="!edition() && etape() < 4">
      <div class="etape-nav" *ngFor="let e of etapes" [class.fait]="etape() > e.n" [class.courante]="etape() === e.n">
        <span class="rond">{{ etape() > e.n ? '✓' : e.n }}</span>
        <span class="nom">{{ e.label }}</span>
      </div>
    </div>

    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>
    <p *ngIf="!chargeMedecins() && !error()" class="muted">Chargement des médecins...</p>

    <!-- Étape 1 : spécialité -->
    <ng-container *ngIf="etape() === 1 && chargeMedecins()">
      <h2>1. Choisissez une spécialité</h2>
      <p *ngIf="specialites().length === 0" class="muted">Aucun médecin n'est disponible pour le moment. Revenez bientôt.</p>
      <div class="grid">
        <button type="button" class="carte-choix" *ngFor="let s of specialites()" (click)="choisirSpecialite(s.nom)">
          <strong>{{ s.nom }}</strong>
          <span class="muted">{{ s.nb }} médecin{{ s.nb > 1 ? 's' : '' }}</span>
        </button>
      </div>
    </ng-container>

    <!-- Étape 2 : médecin -->
    <ng-container *ngIf="etape() === 2">
      <div class="ligne" style="margin-bottom: 8px">
        <h2 class="grow" style="margin: 0">2. Choisissez un médecin · {{ spec() }}</h2>
        <button class="btn light small" (click)="etape.set(1)">&larr; Changer de spécialité</button>
      </div>
      <div class="card" *ngFor="let m of listeMedecins()">
        <div class="ligne">
          <app-avatar [url]="m.photo_url" [nom]="m.nom" [taille]="60"></app-avatar>
          <div class="grow">
            <h3>Dr {{ m.nom }}</h3>
            <div class="muted" *ngIf="m.biographie">{{ m.biographie }}</div>
            <div style="margin-top: 4px"><strong>{{ m.tarif_consultation | number }} FCFA</strong> <span class="muted">/ consultation</span></div>
            <div class="muted" *ngIf="m.prochain_creneau">
              Prochain créneau : <strong>{{ m.prochain_creneau.date | date: 'EEE d MMM' }} à {{ m.prochain_creneau.heure }}</strong>
            </div>
            <div class="muted" *ngIf="!m.prochain_creneau">Aucune disponibilité pour le moment.</div>
          </div>
          <div class="row">
            <a class="btn light small" [routerLink]="['/patient/medecins', m.id]">Voir le profil</a>
            <button class="btn small" (click)="choisirMedecin(m)" [disabled]="!m.prochain_creneau">Choisir ce médecin</button>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- Étape 3 : date, créneau, motif -->
    <ng-container *ngIf="etape() === 3 && medecin() as m">
      <div class="card panneau">
        <div class="ligne">
          <app-avatar [url]="m.photo_url" [nom]="m.nom" [taille]="52"></app-avatar>
          <div class="grow">
            <strong>Dr {{ m.nom }}</strong>
            <div class="muted">{{ m.specialites_libelle }}</div>
          </div>
          <button class="btn light small" *ngIf="!edition()" (click)="etape.set(2)">&larr; Changer de médecin</button>
        </div>
      </div>

      <h2>3. Choisissez la date et le créneau</h2>
      <p *ngIf="!creneauxCharges()" class="muted">Chargement des disponibilités...</p>
      <p *ngIf="creneauxCharges() && jours().length === 0" class="muted">
        Ce médecin n'a pas de créneau disponible pour le moment. Revenez plus tard ou choisissez un autre médecin.
      </p>

      <ng-container *ngIf="jours().length > 0">
        <div class="etiquette">Jour</div>
        <div class="chips">
          <button type="button" class="chip" *ngFor="let j of jours()" [class.on]="jourChoisi() === j" (click)="choisirJour(j)">
            {{ j | date: 'EEE d MMM' }}
          </button>
        </div>

        <ng-container *ngIf="jourChoisi()">
          <div class="etiquette">Horaire</div>
          <div class="chips">
            <button type="button" class="chip" *ngFor="let h of heures()" [class.on]="heureChoisie() === h" (click)="heureChoisie.set(h)">{{ h }}</button>
          </div>
        </ng-container>
      </ng-container>

      <div class="card" style="margin-top: 18px">
        <div class="field">
          <label>Motif du rendez-vous</label>
          <textarea [(ngModel)]="motif" name="motif" rows="3" maxlength="1000" placeholder="Décrivez brièvement la raison de votre consultation"></textarea>
        </div>

        <div class="recap" *ngIf="jourChoisi() && heureChoisie()">
          <strong>Récapitulatif :</strong> Dr {{ m.nom }}, le {{ jourChoisi() | date: 'EEEE d MMMM y' }} à {{ heureChoisie() }}.
        </div>

        <div class="row" style="margin-top: 14px">
          <button class="btn ok" (click)="envoyer()" [disabled]="envoi() || !heureChoisie()">
            {{ envoi() ? 'Envoi en cours...' : (edition() ? 'Enregistrer la modification' : 'Envoyer la demande') }}
          </button>
          <button class="btn light" (click)="retour()">Annuler</button>
        </div>
      </div>
    </ng-container>

    <!-- Étape 4 : confirmation -->
    <ng-container *ngIf="etape() === 4 && recap() as r">
      <div class="card succes">
        <div class="coche">✓</div>
        <h2>{{ r.modification ? 'Rendez-vous modifié' : 'Demande envoyée' }}</h2>
        <p>
          Dr <strong>{{ r.medecin }}</strong> · {{ r.specialite }}<br>
          <strong>{{ r.jour | date: 'EEEE d MMMM y' }}</strong> à <strong>{{ r.heure }}</strong>
        </p>
        <p class="muted">
          Votre rendez-vous est <strong>en attente</strong> de confirmation. Vous recevrez une notification dès que le
          médecin aura répondu.
        </p>
        <div class="row" style="justify-content: center">
          <a routerLink="/patient/rendez-vous" class="btn">Voir mes rendez-vous</a>
          <button class="btn light" (click)="recommencer()">Prendre un autre rendez-vous</button>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    .etapes { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
    .etape-nav { flex: 1; min-width: 130px; display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #fff; border: 1px solid var(--bordure); border-radius: 12px; color: var(--gris); }
    .rond { width: 28px; height: 28px; border-radius: 50%; background: #e4e7ec; color: #667085; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: .85rem; flex-shrink: 0; }
    .etape-nav.courante { border-color: var(--bleu); color: var(--bleu-nuit); font-weight: 600; box-shadow: 0 0 0 3px rgba(27, 95, 193, .12); }
    .etape-nav.courante .rond { background: var(--bleu); color: #fff; }
    .etape-nav.fait .rond { background: var(--vert); color: #fff; }
    .etape-nav.fait { color: var(--vert); }

    .carte-choix { font: inherit; text-align: left; background: #fff; border: 1px solid var(--bordure); border-radius: 14px; padding: 18px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; box-shadow: var(--ombre); transition: transform .15s, border-color .15s; color: var(--bleu-nuit); }
    .carte-choix:hover { transform: translateY(-3px); border-color: var(--bleu); }
    .carte-choix strong { font-size: 1.05rem; }

    .etiquette { font-weight: 600; margin: 14px 0 8px; color: var(--bleu-nuit); }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { font: inherit; font-size: .9rem; border: 1px solid var(--bordure); background: #fff; color: var(--bleu-fonce); border-radius: 10px; padding: 7px 14px; cursor: pointer; transition: all .12s; }
    .chip:hover { border-color: var(--bleu); }
    .chip.on { background: var(--bleu); color: #fff; border-color: var(--bleu); }
    .recap { background: var(--bleu-clair); border-radius: 10px; padding: 12px 14px; }

    .succes { text-align: center; padding: 34px 24px; }
    .coche { width: 64px; height: 64px; margin: 0 auto 12px; border-radius: 50%; background: var(--vert-clair); color: var(--vert); font-size: 2rem; display: flex; align-items: center; justify-content: center; font-weight: 700; }
  `]
})
export class NouveauRendezVousComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  etapes = [
    { n: 1, label: 'Spécialité' },
    { n: 2, label: 'Médecin' },
    { n: 3, label: 'Date et créneau' },
    { n: 4, label: 'Confirmation' }
  ];

  etape = signal<1 | 2 | 3 | 4>(1);
  medecins = signal<any[]>([]);
  chargeMedecins = signal(false);
  error = signal('');

  spec = signal<string | null>(null);
  medecin = signal<any>(null);
  edition = signal<any>(null); // rendez-vous en cours de modification

  creneaux = signal<Record<string, string[]>>({});
  creneauxCharges = signal(false);
  jourChoisi = signal<string | null>(null);
  heureChoisie = signal<string | null>(null);
  motif = '';

  envoi = signal(false);
  recap = signal<any>(null);

  // Spécialités qui ont au moins un médecin vérifié
  specialites = computed(() => {
    const compte = new Map<string, number>();
    for (const m of this.medecins()) {
      for (const nom of nomsSpecialites(m)) compte.set(nom, (compte.get(nom) ?? 0) + 1);
    }
    return [...compte.entries()].map(([nom, nb]) => ({ nom, nb })).sort((a, b) => a.nom.localeCompare(b.nom));
  });
  listeMedecins = computed(() => this.medecins().filter((m) => nomsSpecialites(m).includes(this.spec() as string)));
  jours = computed(() => Object.keys(this.creneaux()).sort());
  heures = computed(() => (this.jourChoisi() ? this.creneaux()[this.jourChoisi() as string] ?? [] : []));

  ngOnInit() {
    this.api.getMedecinsAvecCreneaux().subscribe({
      next: (list) => {
        this.medecins.set(list);
        this.chargeMedecins.set(true);
        this.appliquerParametres();
      },
      error: (err: HttpErrorResponse) => {
        this.chargeMedecins.set(true);
        this.error.set(ApiService.errorMessage(err, 'Impossible de charger les médecins.'));
      }
    });
  }

  // /nouveau?medecin_id=3 : on saute directement au choix du créneau ; ?modifier=12 : modification
  private appliquerParametres() {
    const q = this.route.snapshot.queryParamMap;
    const modifierId = q.get('modifier');
    const medecinId = q.get('medecin_id');

    if (modifierId) {
      this.api.getRendezVous().subscribe({
        next: (liste) => {
          const rdv = liste.find((r: any) => String(r.id) === modifierId);
          if (!rdv || !['en_attente', 'confirme'].includes(rdv.statut)) {
            this.error.set("Ce rendez-vous n'existe pas ou ne peut plus être modifié.");
            return;
          }
          this.edition.set(rdv);
          this.motif = rdv.motif ?? '';
          this.selectionnerMedecin({
            id: rdv.medecin_id,
            nom: rdv.medecin?.user?.name ?? '',
            photo_url: rdv.medecin?.user?.photo_url,
            specialites: rdv.medecin?.specialites ?? [],
            specialites_libelle: rdv.medecin?.specialites_libelle ?? ''
          });
        },
        error: (err: HttpErrorResponse) => this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'))
      });
    } else if (medecinId) {
      const m = this.medecins().find((x) => String(x.id) === medecinId);
      if (m) {
        this.selectionnerMedecin(m);
      } else {
        this.error.set("Ce médecin n'est pas disponible.");
      }
    }
  }

  choisirSpecialite(nom: string) {
    this.spec.set(nom);
    this.etape.set(2);
  }

  choisirMedecin(m: any) {
    this.selectionnerMedecin(m);
  }

  private selectionnerMedecin(m: any) {
    this.medecin.set(m);
    this.spec.set(nomsSpecialites(m)[0] ?? null);
    this.etape.set(3);
    this.creneaux.set({});
    this.creneauxCharges.set(false);
    this.jourChoisi.set(null);
    this.heureChoisie.set(null);
    this.error.set('');

    this.api.getCreneaux(m.id).subscribe({
      next: (c) => {
        this.creneaux.set(c);
        this.creneauxCharges.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.creneauxCharges.set(true);
        this.error.set(ApiService.errorMessage(err, 'Impossible de charger les disponibilités.'));
      }
    });
  }

  choisirJour(j: string) {
    this.jourChoisi.set(j);
    this.heureChoisie.set(null);
  }

  retour() {
    if (this.edition()) {
      this.router.navigate(['/patient/rendez-vous']);
    } else {
      this.etape.set(2);
    }
  }

  envoyer() {
    const jour = this.jourChoisi();
    const heure = this.heureChoisie();
    const m = this.medecin();
    if (!jour || !heure || !m) return;

    const date_heure = `${jour} ${heure}`;
    const motif = this.motif.trim() || undefined;
    const rdv = this.edition();

    this.envoi.set(true);
    this.error.set('');

    const requete = rdv
      ? this.api.modifierRendezVous(rdv.id, { date_heure, motif })
      : this.api.createRendezVous({ medecin_id: m.id, date_heure, motif });

    requete.subscribe({
      next: () => {
        this.envoi.set(false);
        this.recap.set({ medecin: m.nom, specialite: m.specialites_libelle, jour, heure, modification: !!rdv });
        this.etape.set(4);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        const messages = ApiService.validationMessages(err);
        this.error.set(messages.length ? messages.join('\n') : ApiService.errorMessage(err, 'Envoi impossible.'));
        // le créneau a peut-être été pris entre-temps : on rafraîchit les disponibilités
        this.api.getCreneaux(m.id).subscribe({ next: (c) => this.creneaux.set(c) });
        this.heureChoisie.set(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  recommencer() {
    this.router.navigate(['/patient/rendez-vous/nouveau']).then(() => {
      this.etape.set(1);
      this.medecin.set(null);
      this.spec.set(null);
      this.edition.set(null);
      this.motif = '';
      this.recap.set(null);
      this.error.set('');
    });
  }
}
