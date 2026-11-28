import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface CancelDialogData {
  invoice_no: string;
  type?: 'sale' | 'purchase';
  title?: string;
  payment_mode?: string;
}

@Component({
  selector: 'app-cancel-reason-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cancel-reason-dialog.component.html',
  styleUrl: './cancel-reason-dialog.component.css',
})
export class CancelReasonDialogComponent {
  reason = '';
  paymentReturnMethod = 'Cash';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CancelDialogData,
    private dialogRef: MatDialogRef<CancelReasonDialogComponent>,
  ) {
    if (this.data?.payment_mode) {
      this.paymentReturnMethod = this.data.payment_mode;
    }
  }

  confirm(): void {
    if (!this.reason.trim()) return;
    this.dialogRef.close({
      reason: this.reason.trim(),
      payment_return_method: this.paymentReturnMethod,
    });
  }

  dismiss(): void {
    this.dialogRef.close();
  }
}
