import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api';
import { AvatarComponent } from '../avatar/avatar';
import { PhotoComponent } from '../photo/photo';
import { SiteFooterComponent } from '../site-footer/site-footer';
import { SiteHeaderComponent } from '../site-header/site-header';

// Page d'accueil publique : première page vue avant la connexion
@Component({
  selector: 'app-accueil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SiteHeaderComponent, SiteFooterComponent, PhotoComponent, AvatarComponent],
  templateUrl: './accueil.html',
  styleUrls: ['./accueil.css']
})
export class AccueilComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  medecins = signal<any[]>([]);
  specialites = signal<{ id: number; nom: string }[]>([]);

  nbSpecialites = computed(() => new Set(this.medecins().map((m) => m.specialite)).size);
  vedettes = computed(() => this.medecins().slice(0, 3));

  q = '';
  spec = '';

  ngOnInit() {
    this.api.getMedecins().subscribe({ next: (l) => this.medecins.set(l), error: () => this.medecins.set([]) });
    this.api.getSpecialites().subscribe({ next: (l) => this.specialites.set(l), error: () => this.specialites.set([]) });
  }

  rechercher() {
    const queryParams: Record<string, string> = {};
    if (this.q.trim()) queryParams['q'] = this.q.trim();
    if (this.spec) queryParams['spec'] = this.spec;
    this.router.navigate(['/annuaire'], { queryParams });
  }

  versComment() {
    document.getElementById('comment')?.scrollIntoView({ behavior: 'smooth' });
  }
}
