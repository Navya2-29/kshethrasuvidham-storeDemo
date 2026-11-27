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

  const skipNotification = req.headers.has('skip-error-notification') || req.headers.has('x-silent-error');
  const cleanReq = skipNotification
    ? req.clone({ headers: req.headers.delete('skip-error-notification').delete('x-silent-error') })
    : req;

  return next(cleanReq).pipe(
    catchError((error) => {
      // Do not pop up global snackbar if request opted out
      if (skipNotification) {
        return throwError(() => error);
      }

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
