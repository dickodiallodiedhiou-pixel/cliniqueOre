import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { nomJour } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';

// Profil d'un médecin vu par le patient : présentation, horaires de travail et prochains créneaux
@Component({
  selector: 'app-profil-medecin-patient',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarComponent],
  template: `
    <a routerLink="/patient/medecins" class="retour">&larr; Tous les médecins</a>

    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>
    <p *ngIf="!medecin() && !error()" class="muted">Chargement...</p>

    <ng-container *ngIf="medecin() as m">
      <div class="card entete">
        <div class="ligne">
          <app-avatar [url]="m.photo_url" [nom]="m.nom" [taille]="84"></app-avatar>
          <div class="grow">
            <h1>Dr {{ m.nom }}</h1>
            <span class="badge" *ngFor="let s of m.specialites">{{ s.nom }}</span>
            <div style="margin-top: 8px"><strong>{{ m.tarif_consultation | number }} FCFA</strong> <span class="muted">/ consultation</span></div>
          </div>
          <a class="btn" routerLink="/patient/rendez-vous/nouveau" [queryParams]="{ medecin_id: m.id }">Prendre rendez-vous</a>
        </div>
        <p *ngIf="m.biographie" style="margin: 14px 0 0">{{ m.biographie }}</p>
      </div>

      <div class="deux-colonnes">
        <div class="card">
          <h3>Horaires de consultation</h3>
          <p *ngIf="m.disponibilites.length === 0" class="muted">Les horaires ne sont pas encore renseignés.</p>
          <div class="item-liste" *ngFor="let j of joursTravailles()">
            <strong style="min-width: 90px">{{ j.nom }}</strong>
            <span>{{ j.plages }}</span>
          </div>
        </div>

        <div class="card">
          <h3>Prochains créneaux disponibles</h3>
          <p *ngIf="chargeCreneaux() && jours().length === 0" class="muted">Aucun créneau disponible pour le moment.</p>
          <div *ngFor="let j of premiersJours()" style="margin-bottom: 10px">
            <div style="font-weight: 600">{{ j | date: 'EEEE d MMMM' }}</div>
            <div class="chips">
              <span class="chip" *ngFor="let h of creneaux()[j]">{{ h }}</span>
            </div>
          </div>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    .retour { display: inline-block; margin-bottom: 10px; font-size: .9rem; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .chip { font-size: .82rem; background: var(--vert-clair); color: #0f6e48; border-radius: 8px; padding: 3px 10px; }
  `]
})
export class ProfilMedecinPatientComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  medecin = signal<any>(null);
  creneaux = signal<Record<string, string[]>>({});
  chargeCreneaux = signal(false);
  error = signal('');

  jours = computed(() => Object.keys(this.creneaux()).sort());
  premiersJours = computed(() => this.jours().slice(0, 5));

  // Regroupe les plages par jour : « Lundi : 09:00 - 12:00, 14:00 - 17:00 »
  joursTravailles = computed(() => {
    const groupes = new Map<number, string[]>();
    for (const d of this.medecin()?.disponibilites ?? []) {
      groupes.set(d.jour, [...(groupes.get(d.jour) ?? []), `${d.heure_debut} - ${d.heure_fin}`]);
    }
    return [...groupes.entries()].sort((a, b) => a[0] - b[0]).map(([n, plages]) => ({ nom: nomJour(n), plages: plages.join(', ') }));
  });

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.api.getMedecin(id).subscribe({
      next: (m) => this.medecin.set(m),
      error: (err: HttpErrorResponse) =>
        this.error.set(err.status === 404 ? "Ce médecin n'est pas disponible." : ApiService.errorMessage(err, 'Chargement impossible.'))
    });
    this.api.getCreneaux(id).subscribe({
      next: (c) => {
        this.creneaux.set(c);
        this.chargeCreneaux.set(true);
      },
      error: () => this.chargeCreneaux.set(true)
    });
  }
}
