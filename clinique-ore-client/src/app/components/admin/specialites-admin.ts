import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { IconeComponent } from '../icone/icone';

@Component({
  selector: 'app-specialites-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, IconeComponent],
  template: `
    <div class="card entete">
      <h1>Spécialités</h1>
      <p class="muted" style="margin: 0">
        Référentiel des spécialités de la clinique. Une spécialité désactivée n'est plus proposée aux nouveaux
        médecins ; les médecins déjà associés la conservent.
      </p>
    </div>

    <div *ngIf="message()" class="alert-box success">{{ message() }}</div>
    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

    <!-- Ajout -->
    <form class="card" (ngSubmit)="ajouter()">
      <h3>Ajouter une spécialité</h3>
      <div class="outils" style="margin: 0">
        <div class="field" style="flex: 1; min-width: 200px"><label>Nom</label><input type="text" [(ngModel)]="nouvelle.nom" name="nom" required maxlength="100" placeholder="Ex : Neurologie"></div>
        <div class="field" style="flex: 2; min-width: 240px"><label>Description (facultatif)</label><input type="text" [(ngModel)]="nouvelle.description" name="description" maxlength="500"></div>
        <button type="submit" class="btn" [disabled]="!nouvelle.nom.trim()"><app-icone nom="plus" [taille]="16"></app-icone>&nbsp;Ajouter</button>
      </div>
    </form>

    <p *ngIf="!chargee()" class="muted">Chargement...</p>

    <div class="card" *ngFor="let s of specialites()" [class.inactif]="!s.actif">
      <ng-container *ngIf="enEdition() !== s.id; else formEdition">
        <div class="ligne">
          <div class="grow">
            <h3>{{ s.nom }}</h3>
            <div class="muted">{{ s.description || 'Aucune description' }}</div>
            <div class="pastilles">
              <span class="badge" [ngClass]="s.actif ? 'approved' : 'rejected'">{{ s.actif ? 'Proposée' : 'Désactivée' }}</span>
              <span class="badge">{{ s.medecins_count }} médecin{{ s.medecins_count > 1 ? 's' : '' }}</span>
            </div>
          </div>
          <div class="row">
            <button class="btn light small" (click)="commencerEdition(s)">Modifier</button>
            <button class="btn small" [ngClass]="s.actif ? 'danger' : 'ok'" (click)="basculer(s)">{{ s.actif ? 'Désactiver' : 'Activer' }}</button>
          </div>
        </div>
      </ng-container>

      <ng-template #formEdition>
        <div class="outils" style="margin: 0">
          <div class="field" style="flex: 1; min-width: 200px"><label>Nom</label><input type="text" [(ngModel)]="edition.nom" [ngModelOptions]="{ standalone: true }" maxlength="100"></div>
          <div class="field" style="flex: 2; min-width: 240px"><label>Description</label><input type="text" [(ngModel)]="edition.description" [ngModelOptions]="{ standalone: true }" maxlength="500"></div>
          <button class="btn ok small" (click)="enregistrerEdition(s)" [disabled]="!edition.nom.trim()">Enregistrer</button>
          <button class="btn light small" (click)="enEdition.set(null)">Annuler</button>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`.inactif { opacity: .75; background: #fafbfd; }`]
})
export class SpecialitesAdminComponent implements OnInit {
  private api = inject(ApiService);

  specialites = signal<any[]>([]);
  chargee = signal(false);
  message = signal('');
  error = signal('');
  enEdition = signal<number | null>(null);

  nouvelle = { nom: '', description: '' };
  edition = { nom: '', description: '' };

  ngOnInit() {
    this.charger();
  }

  charger() {
    this.api.adminSpecialites().subscribe({
      next: (l) => {
        this.specialites.set(l);
        this.chargee.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.chargee.set(true);
        this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'));
      }
    });
  }

  private erreur(err: HttpErrorResponse, defaut: string) {
    const messages = ApiService.validationMessages(err);
    this.error.set(messages.length ? messages.join('\n') : ApiService.errorMessage(err, defaut));
  }

  ajouter() {
    this.message.set('');
    this.error.set('');
    this.api.adminCreerSpecialite({ nom: this.nouvelle.nom.trim(), description: this.nouvelle.description.trim() || undefined }).subscribe({
      next: (res) => {
        this.message.set(res.message);
        this.nouvelle = { nom: '', description: '' };
        this.charger();
      },
      error: (err: HttpErrorResponse) => this.erreur(err, 'Ajout impossible.')
    });
  }

  commencerEdition(s: any) {
    this.edition = { nom: s.nom, description: s.description ?? '' };
    this.enEdition.set(s.id);
  }

  enregistrerEdition(s: any) {
    this.message.set('');
    this.error.set('');
    this.api.adminModifierSpecialite(s.id, { nom: this.edition.nom.trim(), description: this.edition.description.trim() || undefined }).subscribe({
      next: (res) => {
        this.message.set(res.message);
        this.enEdition.set(null);
        this.charger();
      },
      error: (err: HttpErrorResponse) => this.erreur(err, 'Modification impossible.')
    });
  }

  basculer(s: any) {
    const actif = !s.actif;
    if (!actif && s.medecins_count > 0 &&
        !confirm(`${s.medecins_count} médecin(s) exercent cette spécialité. Elle ne sera plus proposée aux nouveaux médecins. Continuer ?`)) {
      return;
    }
    this.message.set('');
    this.error.set('');
    this.api.adminActifSpecialite(s.id, actif).subscribe({
      next: (res) => {
        this.message.set(res.message);
        this.charger();
      },
      error: (err: HttpErrorResponse) => this.erreur(err, 'Action impossible.')
    });
  }
}
