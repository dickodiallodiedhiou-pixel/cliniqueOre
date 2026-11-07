import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { nomsSpecialites } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';

@Component({
  selector: 'app-medecins-patient',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarComponent],
  template: `
    <div class="card entete">
      <h1>Nos médecins</h1>
      <p class="muted" style="margin: 0">Recherchez un médecin par nom ou par spécialité et consultez ses disponibilités.</p>
    </div>

    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

    <div *ngIf="medecins().length > 0" style="margin-bottom: 18px">
      <input class="recherche" type="search" placeholder="Rechercher un médecin ou une spécialité"
             [value]="recherche()" (input)="recherche.set($any($event.target).value)">
      <div class="chips">
        <button type="button" class="chip" [class.on]="filtreSpec() === null" (click)="filtreSpec.set(null)">Toutes</button>
        <button type="button" class="chip" *ngFor="let s of specialitesDispo()" [class.on]="filtreSpec() === s" (click)="filtreSpec.set(s)">{{ s }}</button>
      </div>
    </div>

    <p *ngIf="!charge() && !error()" class="muted">Chargement...</p>
    <p *ngIf="charge() && medecins().length === 0" class="muted">Aucun médecin vérifié pour le moment.</p>
    <p *ngIf="charge() && medecins().length > 0 && filtres().length === 0" class="muted">Aucun résultat pour cette recherche.</p>

    <div class="grid">
      <div class="card" *ngFor="let m of filtres()" style="margin: 0">
        <div class="ligne" style="margin-bottom: 8px">
          <app-avatar [url]="m.photo_url" [nom]="m.nom" [taille]="60"></app-avatar>
          <div class="grow" style="min-width: 0">
            <h3>Dr {{ m.nom }}</h3>
            <span class="badge" *ngFor="let s of m.specialites">{{ s.nom }}</span>
          </div>
        </div>
        <p class="muted bio" *ngIf="m.biographie">{{ m.biographie }}</p>
        <p style="margin: 6px 0"><strong>{{ m.tarif_consultation | number }} FCFA</strong> <span class="muted">/ consultation</span></p>
        <p class="muted" *ngIf="m.prochain_creneau" style="margin: 0 0 10px">
          Prochain créneau : <strong>{{ m.prochain_creneau.date | date: 'EEE d MMM' }} à {{ m.prochain_creneau.heure }}</strong>
        </p>
        <p class="muted" *ngIf="!m.prochain_creneau" style="margin: 0 0 10px">Aucune disponibilité pour le moment.</p>
        <div class="row">
          <a class="btn light small" [routerLink]="['/patient/medecins', m.id]">Voir le profil</a>
          <a class="btn small" routerLink="/patient/rendez-vous/nouveau" [queryParams]="{ medecin_id: m.id }">Prendre rendez-vous</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .recherche { width: 100%; font: inherit; padding: 12px 18px; border-radius: 999px; border: 1px solid #c9d5e3; background: #fff; }
    .recherche:focus { outline: none; border-color: var(--bleu); box-shadow: 0 0 0 3px rgba(27, 95, 193, .15); }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .chip { font: inherit; font-size: .88rem; border: 1px solid var(--bordure); background: #fff; color: var(--bleu-fonce); border-radius: 999px; padding: 5px 16px; cursor: pointer; transition: all .12s; }
    .chip:hover { border-color: var(--bleu); }
    .chip.on { background: var(--bleu); color: #fff; border-color: var(--bleu); }
    .bio { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin: 0; }
  `]
})
export class MedecinsPatientComponent implements OnInit {
  private api = inject(ApiService);

  medecins = signal<any[]>([]);
  charge = signal(false);
  error = signal('');
  recherche = signal('');
  filtreSpec = signal<string | null>(null);

  specialitesDispo = computed(() => [...new Set(this.medecins().flatMap((m) => nomsSpecialites(m)))].sort());
  filtres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const spec = this.filtreSpec();
    return this.medecins().filter(
      (m) => (!spec || nomsSpecialites(m).includes(spec)) && (!q || `${m.nom} ${m.specialites_libelle}`.toLowerCase().includes(q))
    );
  });

  ngOnInit() {
    this.api.getMedecinsAvecCreneaux().subscribe({
      next: (l) => {
        this.medecins.set(l);
        this.charge.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.charge.set(true);
        this.error.set(ApiService.errorMessage(err, 'Chargement impossible.'));
      }
    });
  }
}
