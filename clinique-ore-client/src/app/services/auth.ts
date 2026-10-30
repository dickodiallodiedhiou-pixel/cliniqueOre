import { Injectable } from '@angular/core';

// La session est gardée dans sessionStorage : elle disparaît à la fermeture de l'onglet,
// donc au prochain lancement on retombe sur la page de connexion.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'user';

  constructor() {
    // Nettoie les anciennes sessions stockées durablement (localStorage)
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem('user_role');
  }

  get token(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  get user(): any {
    try {
      return JSON.parse(sessionStorage.getItem(this.USER_KEY) || 'null');
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
    sessionStorage.setItem(this.TOKEN_KEY, response.access_token);
    sessionStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
  }

  // Met à jour l'utilisateur en session (après modification du profil)
  updateUser(user: any) {
    sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  clear() {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
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
