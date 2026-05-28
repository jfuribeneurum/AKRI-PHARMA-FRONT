import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('akri_token');

  if (token) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
