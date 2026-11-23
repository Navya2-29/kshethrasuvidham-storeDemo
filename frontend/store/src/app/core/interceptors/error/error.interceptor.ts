import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SnackbarService } from '../../services/ui/snackbar.service';
import { Router } from '@angular/router';
import { ErrorService } from '../../services/error/error.service';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
 const snackbar = inject(SnackbarService);
  const errorService = inject(ErrorService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error) => {
      const message = errorService.getErrorMessage(error);

      //  Show snackbar globally
      snackbar.error(message);

      //  Handle auth errors
      if (error.status === 401) {
        router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
