import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';

// NB : ces guards n'améliorent que l'expérience ; la vraie sécurité est appliquée par l'API Laravel.
export const roleGuard = (...roles: string[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }
  return roles.includes(auth.role ?? '') ? true : router.createUrlTree([auth.homeRoute()]);
};

// Empêche un utilisateur déjà connecté de revoir login / inscription
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? router.createUrlTree([auth.homeRoute()]) : true;
};
