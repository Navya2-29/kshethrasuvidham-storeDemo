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
import { PurchaseReturnListComponent } from '../../../features/transactions/purchase-return-list/purchase-return-list.component';

@Component({
  selector: 'app-purchase-list-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatInputModule,
  ],
  templateUrl: './purchase-list-dialog.component.html',
  styleUrl: './purchase-list-dialog.component.css',
})
export class PurchaseListDialogComponent {
  searchText: string = '';
  displayedColumns: string[] = [
    'invoice_no',
    'supplier_name',
    'products',
    'invoice_date',
    'receipt_date',
    'bill_amount',
    'status',
    'action',
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
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.data;
    return this.data.filter(
      (p: any) =>
        p.invoice_no?.toLowerCase().includes(q) ||
        p.supplier_name?.toLowerCase().includes(q) ||
        (p.product_names || '').toLowerCase().includes(q) ||
        p.items?.some((it: any) => it.product_name?.toLowerCase().includes(q)),
    );
  }

  // Product Name Display Helpers
  getPrimaryProduct(row: any): string {
    if (row.items && row.items.length > 0) {
      const it = row.items[0];
      const name = it.product_name || 'Product';
      const qtyStr = it.qty && it.qty > 1 ? ` (x${it.qty})` : '';
      return `${name}${qtyStr}`;
    }
    if (row.product_names) {
      const parts = row.product_names.split(', ');
      return parts[0];
    }
    return '—';
  }

  getExtraProductsCount(row: any): number {
    if (row.items && row.items.length > 0) {
      return Math.max(0, row.items.length - 1);
    }
    if (row.product_names) {
      const parts = row.product_names.split(', ');
      return Math.max(0, parts.length - 1);
    }
    return 0;
  }

  getProductTooltip(row: any): string {
    if (row.items && row.items.length > 0) {
      return row.items
        .map(
          (it: any) =>
            `${it.product_name || 'Product'} (Qty: ${it.qty || 1}${
              it.cost_price ? ' @ ₹' + Number(it.cost_price).toFixed(2) : ''
            })`,
        )
        .join('\n');
    }
    if (row.product_names) {
      return row.product_names;
    }
    return '';
  }

  openReturnList(): void {
    this.dialog.open(PurchaseReturnListComponent, {
      width: '1150px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      data: { isDialog: true },
    });
  }

  onEdit(row: any) {
    this.dialogRef.close({ action: 'edit', data: row });
  }

  onCancel(row: any) {
    const ref = this.dialog.open(CancelReasonDialogComponent, {
      width: '420px',
      data: { invoice_no: row.invoice_no, type: 'purchase' },
    });

    ref.afterClosed().subscribe((result: any) => {
      if (!result) return;
      const reason = typeof result === 'object' ? result.reason : result;
      if (!reason || !reason.trim()) return;

      this.masterService
        .cancelPurchase(row.id, {
          cancel_reason: reason.trim(),
          cancelled_by: this.authState.user()?.id?.toString() ?? null,
        })
        .subscribe({
          next: () => {
            row.status = 'CANCELLED';
            row.cancel_reason = reason.trim();
            row.cancelled_at = new Date().toISOString();
            row.cancelled_by_name = this.authState.user()?.username || 'Admin';

            // Cache in localStorage store_cancelled_purchases_backup
            try {
              const raw = localStorage.getItem('store_cancelled_purchases_backup');
              const list: any[] = raw ? JSON.parse(raw) : [];
              const idx = list.findIndex((x) => x.invoice_no === row.invoice_no);
              if (idx >= 0) {
                list[idx] = { ...list[idx], ...row };
              } else {
                list.unshift({ ...row });
              }
              localStorage.setItem('store_cancelled_purchases_backup', JSON.stringify(list));
            } catch (e) {
              console.warn('Could not cache cancelled purchase', e);
            }

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

