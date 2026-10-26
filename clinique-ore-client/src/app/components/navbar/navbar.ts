import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="bar">
      <strong>Clinique Oré — {{ titre }}</strong>
      <span class="who">
        {{ auth.user?.name }}
        <button class="btn light" (click)="logout()">Se déconnecter</button>
      </span>
    </header>
  `,
  styles: [`
    .bar { display: flex; justify-content: space-between; align-items: center; background: #2c3e50; color: #fff; padding: 12px 20px; }
    .who { display: flex; gap: 12px; align-items: center; }
  `]
})
export class NavbarComponent {
  @Input() titre = '';

  constructor(public auth: AuthService, private api: ApiService, private router: Router) {}

  logout() {
    const done = () => {
      this.auth.clear();
      this.router.navigate(['/login']);
    };
    this.api.logout().subscribe({ next: done, error: done });
  }
}
