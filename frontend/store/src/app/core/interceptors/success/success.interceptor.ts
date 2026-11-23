import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { SnackbarService } from '../../services/ui/snackbar.service';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

export const successInterceptor: HttpInterceptorFn = (req, next) => {
  const snackbar = inject(SnackbarService);

  return next(req).pipe(
    tap((event) => {

      //  Only handle HttpResponse
      if (event instanceof HttpResponse) {

        const body = event.body  as any;;

        // Show only if message exists
        if (
          body?.message &&
          ['POST', 'PUT', 'DELETE'].includes(req.method)
        ) {
          snackbar.success(body.message);
        }
      }

    })
  );
};
