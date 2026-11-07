import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api';

// Nombre de notifications non lues, partagé entre le menu et les pages
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private api = inject(ApiService);
  private minuteur: any = null;

  nonLues = signal(0);

  rafraichir() {
    this.api.notificationsNonLues().subscribe({
      next: (r) => this.nonLues.set(r.non_lues),
      error: () => {}
    });
  }

  // Interroge l'API toutes les minutes tant que l'espace patient est ouvert
  demarrer() {
    this.rafraichir();
    if (!this.minuteur) {
      this.minuteur = setInterval(() => this.rafraichir(), 60000);
    }
  }

  arreter() {
    if (this.minuteur) {
      clearInterval(this.minuteur);
      this.minuteur = null;
    }
  }
}
