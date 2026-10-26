import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="max-width: 600px; margin: 60px auto; font-family: sans-serif; text-align: center;">
      <h2>Bienvenue {{ user?.name }} 👋</h2>
      <p>Rôle : <strong>{{ user?.role }}</strong></p>
      <p>Connexion réussie à la Clinique Oré.</p>
      <button (click)="logout()" style="padding: 10px 20px; cursor: pointer;">Se déconnecter</button>
    </div>
  `
})
export class DashboardComponent {
  user: any = JSON.parse(localStorage.getItem('user') || 'null');

  constructor(private apiService: ApiService, private router: Router) {}

  logout() {
    const token = localStorage.getItem('access_token') || '';
    const clear = () => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user');
      this.router.navigate(['/login']);
    };
    this.apiService.logout().subscribe({ next: clear, error: clear });
  }
}
