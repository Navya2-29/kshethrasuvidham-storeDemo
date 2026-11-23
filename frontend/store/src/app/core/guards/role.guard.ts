import { CanActivateFn } from '@angular/router';
import { AuthStateService } from '../services/auth/auth-state.service';
import { inject } from '@angular/core';

export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthStateService);

  const allowedRoles = route.data?.['roles'] as string[];

  return allowedRoles.includes(auth.role() || '');
};
