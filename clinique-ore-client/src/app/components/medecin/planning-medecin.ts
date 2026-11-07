import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { ajouterJours, formatDate, isoLocal, lundiDe } from '../../services/ui';

type Onglet = 'semaine' | 'horaires' | 'conges';

@Component({
  selector: 'app-planning-medecin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="card entete">
      <h1>Planning et disponibilités</h1>
      <p class="muted" style="margin: 0">Définissez vos horaires de travail, vos congés, et consultez votre semaine.</p>
    </div>

    <div class="onglets">
      <button class="onglet" [class.on]="onglet() === 'semaine'" (click)="ouvrir('semaine')">Planning de la semaine</button>
      <button class="onglet" [class.on]="onglet() === 'horaires'" (click)="ouvrir('horaires')">Jours et horaires de travail</button>
      <button class="onglet" [class.on]="onglet() === 'conges'" (click)="ouvrir('conges')">Congés et indisponibilités</button>
    </div>

    <!-- ===================== Planning de la semaine ===================== -->
    <ng-container *ngIf="onglet() === 'semaine'">
      <div class="ligne" style="margin-bottom: 12px">
        <div class="row">
          <button class="btn light small" (click)="changerSemaine(-7)">&larr; Précédente</button>
          <button class="btn light small" (click)="cetteSemaine()">Cette semaine</button>
          <button class="btn light small" (click)="changerSemaine(7)">Suivante &rarr;</button>
        </div>
        <strong *ngIf="semaine() as s">Du {{ s.debut | date: 'd MMM' }} au {{ s.fin | date: 'd MMM y' }}</strong>
      </div>

      <div class="legende">
        <span><i class="p libre"></i> Libre</span>
        <span><i class="p en_attente"></i> En attente</span>
        <span><i class="p confirme"></i> Confirmé</span>
        <span><i class="p termine"></i> Terminé</span>
        <span><i class="p bloque"></i> Congé / indisponible</span>
        <span><i class="p passe"></i> Passé</span>
      </div>

      <div *ngIf="erreurSemaine()" class="alert-box error">{{ erreurSemaine() }}</div>
      <p *ngIf="!semaine() && !erreurSemaine()" class="muted">Chargement du planning...</p>

      <div class="grille" *ngIf="semaine() as s">
        <div class="jour" *ngFor="let j of s.jours" [class.aujourdhui]="j.date === aujourdhuiStr">
          <div class="jour-entete">{{ j.date | date: 'EEE d MMM' }}</div>

          <div class="conge" *ngFor="let i of j.indisponibilites">
            {{ i.journee_entiere ? 'Indisponible' : 'Indisponible ' + i.heure_debut + ' – ' + i.heure_fin }}<span *ngIf="i.motif"> · {{ i.motif }}</span>
          </div>

          <p class="repos" *ngIf="!j.travaille && j.hors_plage.length === 0">Repos</p>

          <div class="slot" *ngFor="let c of j.creneaux" [ngClass]="c.etat + ' ' + (c.rdv?.statut || '')"
               [title]="c.rdv ? c.rdv.patient + (c.rdv.motif ? ' — ' + c.rdv.motif : '') : ''">
            <strong>{{ c.heure }} – {{ c.fin }}</strong>
            <span *ngIf="c.rdv" class="patient">{{ c.rdv.patient }}</span>
          </div>

          <div class="hors" *ngFor="let h of j.hors_plage">
            <strong>{{ h.heure }}</strong> {{ h.patient }} <span class="muted">(hors horaires)</span>
          </div>
        </div>
      </div>
      <p class="muted" style="margin-top: 12px">
        Pour traiter un rendez-vous, rendez-vous dans la rubrique <a routerLink="/medecin/rendez-vous">Rendez-vous</a>.
      </p>
    </ng-container>

    <!-- ===================== Jours et horaires de travail ===================== -->
    <ng-container *ngIf="onglet() === 'horaires'">
      <div class="card">
        <p class="muted">
          Choisissez vos jours de travail et vos heures de début et de fin. Les patients ne pourront réserver que sur
          ces créneaux (14 prochains jours). Un jour sans plage est un jour de repos.
        </p>

        <div *ngIf="messageDispo()" class="alert-box success">{{ messageDispo() }}</div>
        <div *ngIf="erreurDispo()" class="alert-box error">{{ erreurDispo() }}</div>

        <div class="jour-ligne" *ngFor="let j of jours">
          <div class="jour-nom">{{ j.label }}</div>
          <div class="jour-plages">
            <p *ngIf="!aDesPlages(j.n)" class="muted" style="margin: 6px 0">Repos</p>
            <ng-container *ngFor="let pl of plages()">
              <div class="plage" *ngIf="pl.jour === j.n" [class.inactive]="!pl.actif">
                <input type="time" [(ngModel)]="pl.heure_debut" aria-label="Début">
                <span>à</span>
                <input type="time" [(ngModel)]="pl.heure_fin" aria-label="Fin">
                <select [(ngModel)]="pl.duree" aria-label="Durée d'un créneau">
                  <option *ngFor="let d of durees" [ngValue]="d">{{ d }} min par patient</option>
                </select>
                <label class="case"><input type="checkbox" [(ngModel)]="pl.actif"> Active</label>
                <button type="button" class="btn danger small" (click)="supprimerPlage(pl)">Retirer</button>
              </div>
            </ng-container>
            <button type="button" class="btn light small" (click)="ajouterPlage(j.n)">+ Ajouter une plage</button>
          </div>
        </div>

        <button class="btn" style="margin-top: 14px" (click)="enregistrerDispos()" [disabled]="enregistrement()">
          {{ enregistrement() ? 'Enregistrement...' : 'Enregistrer mes horaires' }}
        </button>
      </div>
    </ng-container>

    <!-- ===================== Congés et indisponibilités ===================== -->
    <ng-container *ngIf="onglet() === 'conges'">
      <form class="card" (ngSubmit)="ajouterConge()">
        <h3>Ajouter un congé ou une indisponibilité</h3>
        <p class="muted">Les créneaux concernés ne seront plus proposés aux patients.</p>

        <div *ngIf="messageConge()" class="alert-box success">{{ messageConge() }}</div>
        <div *ngIf="erreurConge()" class="alert-box error">{{ erreurConge() }}</div>

        <div class="alert-box warn" *ngIf="concernes().length > 0">
          <strong>{{ concernes().length }} rendez-vous existent déjà sur cette période.</strong>
          Ils ne sont pas annulés automatiquement : traitez-les depuis la rubrique
          <a routerLink="/medecin/rendez-vous">Rendez-vous</a>.
          <div *ngFor="let r of concernes()" style="margin-top: 4px">
            {{ iso(r.date_heure) | date: 'EEE d MMM, HH:mm' }} — {{ r.patient }}
          </div>
        </div>

        <div class="outils" style="margin: 0">
          <div class="field"><label>Du</label><input type="date" [min]="aujourdhuiStr" [(ngModel)]="conge.date_debut" name="date_debut" required></div>
          <div class="field"><label>Au (inclus)</label><input type="date" [min]="conge.date_debut || aujourdhuiStr" [(ngModel)]="conge.date_fin" name="date_fin" placeholder="Même jour"></div>
          <div class="field" style="flex: 1; min-width: 200px"><label>Motif (facultatif)</label><input type="text" [(ngModel)]="conge.motif" name="motif" maxlength="255" placeholder="Congé annuel, formation..."></div>
        </div>

        <label class="case"><input type="checkbox" [(ngModel)]="conge.journee_entiere" name="journee"> Journée(s) entière(s)</label>
        <div class="outils" *ngIf="!conge.journee_entiere" style="margin: 10px 0 0">
          <div class="field"><label>De</label><input type="time" [(ngModel)]="conge.heure_debut" name="h_debut"></div>
          <div class="field"><label>À</label><input type="time" [(ngModel)]="conge.heure_fin" name="h_fin"></div>
        </div>

        <button type="submit" class="btn" style="margin-top: 14px" [disabled]="!conge.date_debut">Ajouter</button>
      </form>

      <h2>Congés et indisponibilités à venir</h2>
      <p *ngIf="indispos().length === 0" class="muted">Aucune indisponibilité prévue.</p>
      <div class="card" *ngFor="let i of indispos()">
        <div class="ligne">
          <div class="grow">
            <strong>
              <ng-container *ngIf="i.date_debut === i.date_fin">{{ i.date_debut | date: 'EEEE d MMMM y' }}</ng-container>
              <ng-container *ngIf="i.date_debut !== i.date_fin">Du {{ i.date_debut | date: 'd MMM' }} au {{ i.date_fin | date: 'd MMM y' }}</ng-container>
            </strong>
            <div class="muted">
              {{ i.heure_debut ? 'De ' + i.heure_debut.slice(0, 5) + ' à ' + i.heure_fin.slice(0, 5) : 'Journée(s) entière(s)' }}
              <span *ngIf="i.motif"> · {{ i.motif }}</span>
            </div>
          </div>
          <button class="btn danger small" (click)="supprimerConge(i)">Supprimer</button>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    .legende { display: flex; gap: 16px; flex-wrap: wrap; font-size: .85rem; color: var(--gris); margin-bottom: 12px; }
    .legende span { display: inline-flex; align-items: center; gap: 6px; }
    .p { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }

    .grille { display: grid; grid-template-columns: repeat(7, minmax(135px, 1fr)); gap: 10px; overflow-x: auto; padding-bottom: 6px; }
    .jour { background: #fff; border: 1px solid var(--bordure); border-radius: 14px; padding: 10px; min-height: 130px; }
    .jour.aujourdhui { border-color: var(--bleu); box-shadow: 0 0 0 3px rgba(27, 95, 193, .14); }
    .jour-entete { font-weight: 600; text-align: center; margin-bottom: 8px; color: var(--bleu-nuit); }
    .repos { text-align: center; color: var(--gris); font-size: .85rem; margin: 18px 0; }
    .conge { background: #f1f3f6; border-radius: 8px; padding: 4px 8px; font-size: .78rem; color: var(--gris); margin-bottom: 6px; }
    .slot { font-size: .8rem; padding: 5px 8px; border-radius: 8px; margin-bottom: 5px; display: flex; flex-direction: column; }
    .slot .patient { font-size: .78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hors { font-size: .8rem; border: 1px dashed var(--orange); border-radius: 8px; padding: 4px 8px; margin-top: 6px; }

    .libre { background: #e3f6ee; color: #0f6e48; }
    .passe { background: #f1f3f6; color: #98a2b3; }
    .bloque { background: repeating-linear-gradient(45deg, #f1f3f6, #f1f3f6 6px, #e4e7ec 6px, #e4e7ec 12px); color: #667085; }
    .reserve.en_attente, .p.en_attente { background: #fef3c7; color: #92400e; }
    .reserve.confirme, .p.confirme { background: #dbeafe; color: #1e40af; }
    .reserve.termine, .p.termine { background: #e0e7ff; color: #3730a3; }

    .jour-ligne { display: flex; gap: 16px; padding: 12px 0; border-top: 1px solid var(--bordure); align-items: flex-start; }
    .jour-nom { width: 90px; font-weight: 600; padding-top: 6px; }
    .jour-plages { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; flex: 1; }
    .plage { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .plage input, .plage select { font: inherit; padding: 6px 10px; border: 1px solid #c9d5e3; border-radius: 8px; background: #fff; }
    .plage.inactive { opacity: .6; }
    .case { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; font-weight: 500; cursor: pointer; }
  `]
})
export class PlanningMedecinComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  onglet = signal<Onglet>('semaine');
  aujourdhuiStr = formatDate(new Date());
  iso = isoLocal;

  // Planning de la semaine
  debutSemaine = signal(lundiDe());
  semaine = signal<any>(null);
  erreurSemaine = signal('');

  // Horaires de travail
  jours = [
    { n: 1, label: 'Lundi' }, { n: 2, label: 'Mardi' }, { n: 3, label: 'Mercredi' },
    { n: 4, label: 'Jeudi' }, { n: 5, label: 'Vendredi' }, { n: 6, label: 'Samedi' }, { n: 7, label: 'Dimanche' }
  ];
  durees = [15, 20, 30, 45, 60];
  plages = signal<{ jour: number; heure_debut: string; heure_fin: string; duree: number; actif: boolean }[]>([]);
  messageDispo = signal('');
  erreurDispo = signal('');
  enregistrement = signal(false);

  // Congés
  indispos = signal<any[]>([]);
  concernes = signal<any[]>([]);
  messageConge = signal('');
  erreurConge = signal('');
  conge = { date_debut: '', date_fin: '', journee_entiere: true, heure_debut: '09:00', heure_fin: '12:00', motif: '' };

  ngOnInit() {
    const demande = this.route.snapshot.queryParamMap.get('onglet');
    if (demande === 'horaires' || demande === 'conges') {
      this.onglet.set(demande);
    }
    this.chargerDispos();
    this.chargerIndispos();
    this.chargerSemaine();
  }

  ouvrir(o: Onglet) {
    this.onglet.set(o);
    if (o === 'semaine') {
      this.chargerSemaine();
    }
  }

  // ----- Planning de la semaine -----
  chargerSemaine() {
    this.erreurSemaine.set('');
    this.api.medecinPlanning(this.debutSemaine()).subscribe({
      next: (s) => this.semaine.set(s),
      error: (err: HttpErrorResponse) => this.erreurSemaine.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }

  changerSemaine(jours: number) {
    this.debutSemaine.set(ajouterJours(this.debutSemaine(), jours));
    this.semaine.set(null);
    this.chargerSemaine();
  }

  cetteSemaine() {
    this.debutSemaine.set(lundiDe());
    this.semaine.set(null);
    this.chargerSemaine();
  }

  // ----- Horaires de travail -----
  chargerDispos() {
    this.api.getDisponibilites().subscribe({
      next: (list) =>
        // l'API renvoie des heures au format HH:mm:ss : on garde HH:mm pour les champs "time"
        this.plages.set(
          list.map((p) => ({
            jour: p.jour,
            heure_debut: String(p.heure_debut).slice(0, 5),
            heure_fin: String(p.heure_fin).slice(0, 5),
            duree: p.duree,
            actif: p.actif !== false
          }))
        ),
      error: (err: HttpErrorResponse) => this.erreurDispo.set(ApiService.errorMessage(err, 'Chargement impossible.'))
    });
  }

  aDesPlages(jour: number): boolean {
    return this.plages().some((p) => p.jour === jour);
  }

  ajouterPlage(jour: number) {
    this.plages.update((l) => [...l, { jour, heure_debut: '09:00', heure_fin: '12:00', duree: 30, actif: true }]);
  }

  supprimerPlage(plage: any) {
    this.plages.update((l) => l.filter((p) => p !== plage));
  }

  enregistrerDispos() {
    this.messageDispo.set('');
    this.erreurDispo.set('');
    this.enregistrement.set(true);
    this.api.saveDisponibilites(this.plages()).subscribe({
      next: (res) => {
        this.enregistrement.set(false);
        this.messageDispo.set(res.message);
      },
      error: (err: HttpErrorResponse) => {
        this.enregistrement.set(false);
        const messages = ApiService.validationMessages(err);
        this.erreurDispo.set(messages.length ? messages.join('\n') : ApiService.errorMessage(err, 'Enregistrement impossible.'));
      }
    });
  }

  // ----- Congés et indisponibilités -----
  chargerIndispos() {
    this.api.getIndisponibilites().subscribe({
      next: (l) => this.indispos.set(l),
      error: () => this.indispos.set([])
    });
  }

  ajouterConge() {
    this.messageConge.set('');
    this.erreurConge.set('');
    this.concernes.set([]);

    const data: Record<string, any> = {
      date_debut: this.conge.date_debut,
      date_fin: this.conge.date_fin || this.conge.date_debut,
      motif: this.conge.motif || null
    };
    if (!this.conge.journee_entiere) {
      data['heure_debut'] = this.conge.heure_debut;
      data['heure_fin'] = this.conge.heure_fin;
    }

    this.api.creerIndisponibilite(data).subscribe({
      next: (res) => {
        this.messageConge.set(res.message);
        this.concernes.set(res.rendez_vous_concernes ?? []);
        this.conge = { date_debut: '', date_fin: '', journee_entiere: true, heure_debut: '09:00', heure_fin: '12:00', motif: '' };
        this.chargerIndispos();
      },
      error: (err: HttpErrorResponse) => {
        const messages = ApiService.validationMessages(err);
        this.erreurConge.set(messages.length ? messages.join('\n') : ApiService.errorMessage(err, 'Enregistrement impossible.'));
      }
    });
  }

  supprimerConge(i: any) {
    if (!confirm('Supprimer cette indisponibilité ? Les créneaux seront de nouveau proposés aux patients.')) return;
    this.messageConge.set('');
    this.concernes.set([]);
    this.api.supprimerIndisponibilite(i.id).subscribe({
      next: (res) => {
        this.messageConge.set(res.message);
        this.chargerIndispos();
      },
      error: (err: HttpErrorResponse) => this.erreurConge.set(ApiService.errorMessage(err, 'Suppression impossible.'))
    });
  }
}
