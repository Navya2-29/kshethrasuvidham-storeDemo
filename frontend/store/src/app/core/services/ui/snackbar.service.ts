import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class SnackbarService {

  private snackBar = inject(MatSnackBar);

  success(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['snackbar-success'],
       horizontalPosition: 'right',
     verticalPosition: 'top',
    });
  }

  error(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: ['snackbar-error'],
       horizontalPosition: 'right',
    verticalPosition: 'top',
    });
  }

  info(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
    });
  }

  warning(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3500,
      panelClass: ['snackbar-warning'],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }
}
