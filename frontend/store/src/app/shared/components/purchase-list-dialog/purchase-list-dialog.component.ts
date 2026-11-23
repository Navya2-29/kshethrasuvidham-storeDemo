import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MasterService } from '../../../core/services/masters/master.service';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { SnackbarService } from '../../../core/services/ui/snackbar.service';
import { CancelReasonDialogComponent } from '../cancel-reason-dialog/cancel-reason-dialog.component';

@Component({
  selector: 'app-purchase-list-dialog',
  standalone: true,
  imports: [CommonModule,
    FormsModule,
    MatTableModule,
    MatInputModule],
  templateUrl: './purchase-list-dialog.component.html',
  styleUrl: './purchase-list-dialog.component.css'
})
export class PurchaseListDialogComponent {
searchText: string = '';
  displayedColumns: string[] = [
    'invoice_no',
    'supplier_name',
    'invoice_date',
    'receipt_date',
    'bill_amount',
    'status',
    'action'
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any[],
    private dialogRef: MatDialogRef<PurchaseListDialogComponent>,
    private dialog: MatDialog,
    private masterService: MasterService,
    private authState: AuthStateService,
    private notification: SnackbarService,
  ) {}

  get filteredData() {
    return this.data.filter((p: any) =>
      p.invoice_no.toLowerCase().includes(this.searchText.toLowerCase()) ||
      p.supplier_name.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }
  onEdit(row: any) {
  this.dialogRef.close({ action: 'edit', data: row });
}

onCancel(row: any) {
  const ref = this.dialog.open(CancelReasonDialogComponent, {
    width: '420px',
    data: { invoice_no: row.invoice_no },
  });

  ref.afterClosed().subscribe((reason: string | undefined) => {
    if (!reason) return;

    this.masterService
      .cancelPurchase(row.id, {
        cancel_reason: reason,
        cancelled_by: this.authState.user()?.id?.toString() ?? null,
      })
      .subscribe({
        next: () => {
          row.status = 'CANCELLED';
          row.cancel_reason = reason;
          this.notification.success('Purchase cancelled successfully');
        },
        error: () => {
          // global error interceptor already shows a toast
        },
      });
  });
}

close() {
  this.dialogRef.close();
}
}
