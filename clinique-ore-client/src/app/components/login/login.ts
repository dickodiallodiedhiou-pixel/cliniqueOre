import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  credentials = {
    email: '',
    password: ''
  };
  errorMessage = '';
  loading = false;

  constructor(
    private apiService: ApiService,
    private auth: AuthService,
    private router: Router
  ) {}

  onLogin() {
    this.errorMessage = '';
    this.loading = true;

    this.apiService.login(this.credentials).subscribe({
      next: (response) => {
        this.loading = false;
        this.auth.save(response);
        // Redirection selon le rôle (patient, médecin, admin)
        this.router.navigate([this.auth.homeRoute()]);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = ApiService.errorMessage(err, 'Email ou mot de passe incorrect.');
      }
    });
  }
}
