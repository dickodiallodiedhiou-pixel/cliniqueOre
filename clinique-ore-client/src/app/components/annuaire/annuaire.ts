import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { nomsSpecialites } from '../../services/ui';
import { AvatarComponent } from '../avatar/avatar';
import { SiteFooterComponent } from '../site-footer/site-footer';
import { SiteHeaderComponent } from '../site-header/site-header';

// Annuaire des médecins vérifiés (l'API ne renvoie que les médecins approuvés)
@Component({
  selector: 'app-annuaire',
  standalone: true,
  imports: [CommonModule, AvatarComponent],
  template: `
    <div *ngIf="error()" class="alert-box error">{{ error() }}</div>

    <div class="filtres" *ngIf="medecins().length > 0">
      <input class="recherche" type="search" placeholder="Rechercher un médecin ou une spécialité"
             [value]="recherche()" (input)="recherche.set($any($event.target).value)">
      <div class="chips">
        <button type="button" class="chip" [class.on]="filtreSpec() === null" (click)="filtreSpec.set(null)">Toutes</button>
        <button type="button" class="chip" *ngFor="let s of specialitesDispo()"
                [class.on]="filtreSpec() === s" (click)="filtreSpec.set(s)">{{ s }}</button>
      </div>
    </div>

    <p *ngIf="!error() && loaded() && medecins().length === 0" class="muted">
      Aucun médecin vérifié pour le moment. Revenez bientôt.
    </p>
    <p *ngIf="loaded() && medecins().length > 0 && filtres().length === 0" class="muted">
      Aucun résultat pour cette recherche.
    </p>

    <div class="grid">
      <div class="card medecin-card" *ngFor="let m of filtres()">
        <div class="entete-med">
          <app-avatar [url]="m.photo_url" [nom]="m.nom" [taille]="64"></app-avatar>
          <div>
            <h3>Dr {{ m.nom }}</h3>
            <span class="badge" *ngFor="let s of m.specialites">{{ s.nom }}</span>
          </div>
        </div>
        <p *ngIf="m.biographie" class="muted">{{ m.biographie }}</p>
        <p class="tarif"><strong>{{ m.tarif_consultation | number }} FCFA</strong> <span class="muted">/ consultation</span></p>
        <button *ngIf="selectable" class="btn" (click)="choisir.emit(m)">Prendre rendez-vous</button>
      </div>
    </div>
  `,
  styles: [`
    .filtres { margin-bottom: 18px; }
    .recherche { width: 100%; font: inherit; padding: 12px 18px; border-radius: 999px; border: 1px solid #c9d5e3; background: #fff; }
    .recherche:focus { outline: none; border-color: var(--bleu); box-shadow: 0 0 0 3px rgba(27, 95, 193, .15); }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .chip { font: inherit; font-size: .88rem; border: 1px solid var(--bordure); background: #fff; color: var(--bleu-fonce); border-radius: 999px; padding: 5px 16px; cursor: pointer; transition: all .12s; }
    .chip:hover { border-color: var(--bleu); }
    .chip.on { background: var(--bleu); color: #fff; border-color: var(--bleu); }
    .medecin-card { margin: 0; }
    .entete-med { display: flex; gap: 14px; align-items: center; margin-bottom: 10px; }
    .entete-med h3 { margin-bottom: 4px; }
    .tarif { margin: 8px 0 14px; }
  `]
})
export class AnnuaireComponent implements OnInit {
  @Input() selectable = false;
  // Valeurs initiales (venant de la page d'accueil)
  @Input() set q(v: string | null) { this.recherche.set(v ?? ''); }
  @Input() set spec(v: string | null) { this.filtreSpec.set(v || null); }
  @Output() choisir = new EventEmitter<any>();

  private api = inject(ApiService);

  medecins = signal<any[]>([]);
  loaded = signal(false);
  error = signal('');
  recherche = signal('');
  filtreSpec = signal<string | null>(null);

  specialitesDispo = computed(() => {
    const noms = this.medecins().flatMap((m) => nomsSpecialites(m));
    return [...new Set(noms)].sort();
  });

  filtres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const spec = this.filtreSpec();
    return this.medecins().filter(
      (m) =>
        (!spec || nomsSpecialites(m).includes(spec)) &&
        (!q || `${m.nom} ${m.specialites_libelle}`.toLowerCase().includes(q))
    );
  });

  ngOnInit() {
    this.api.getMedecins().subscribe({
      next: (list) => {
        this.medecins.set(list);
        this.loaded.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(ApiService.errorMessage(err, "Impossible de charger l'annuaire."));
      }
    });
  }
}

// Page publique /annuaire
@Component({
  selector: 'app-annuaire-page',
  standalone: true,
  imports: [AnnuaireComponent, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <app-site-header></app-site-header>
    <div class="page">
      <div class="card entete">
        <h1>Annuaire des médecins</h1>
        <p class="muted" style="margin: 0">
          Seuls les médecins dont les justificatifs ont été validés par l'administrateur apparaissent ici.
        </p>
      </div>
      <app-annuaire [q]="q" [spec]="spec"></app-annuaire>
    </div>
    <app-site-footer></app-site-footer>
  `
})
export class AnnuairePageComponent {
  private route = inject(ActivatedRoute);
  q = this.route.snapshot.queryParamMap.get('q');
  spec = this.route.snapshot.queryParamMap.get('spec');
}
