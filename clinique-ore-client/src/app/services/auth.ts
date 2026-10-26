import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'user';

  get token(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  get user(): any {
    try {
      return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  get role(): string | null {
    return this.user?.role ?? null;
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  save(response: { access_token: string; user: any }) {
    localStorage.setItem(this.TOKEN_KEY, response.access_token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
  }

  clear() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem('user_role');
  }

  // Page d'accueil selon le rôle
  homeRoute(): string {
    switch (this.role) {
      case 'admin':
        return '/admin';
      case 'medecin':
        return '/medecin';
      case 'patient':
        return '/patient';
      default:
        return '/login';
    }
  }
}
