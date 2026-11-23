import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-cancel-reason-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cancel-reason-dialog.component.html',
  styleUrl: './cancel-reason-dialog.component.css',
})
export class CancelReasonDialogComponent {
  reason = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { invoice_no: string },
    private dialogRef: MatDialogRef<CancelReasonDialogComponent>,
  ) {}

  confirm(): void {
    if (!this.reason.trim()) return;
    this.dialogRef.close(this.reason.trim());
  }

  dismiss(): void {
    this.dialogRef.close();
  }
}
