import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MasterService } from '../../../core/services/masters/master.service';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { SnackbarService } from '../../../core/services/ui/snackbar.service';
import { CancelReasonDialogComponent } from '../../../shared/components/cancel-reason-dialog/cancel-reason-dialog.component';
import { ReceiptPrintComponent } from '../sales/receipt-print/receipt-print.component';
import { Subject, takeUntil } from 'rxjs';
import { RouterModule } from '@angular/router';
import { CancelledSalesListComponent } from '../cancelled-sales-list/cancelled-sales-list.component';

export interface SaleSummary {
  id: number;
  order_no?: string;
  invoice_no: string;
  receipt_date: string;
  customer_name?: string;
  customer_mobile?: string;
  department_id?: number;
  dept_name?: string;
  total_amount?: number;
  discount_amount?: number;
  gst_amount?: number;
  other_charges?: number;
  bill_amount: number;
  payment_mode?: string;
  status: 'ACTIVE' | 'CANCELLED';
  cancel_reason?: string;
  cancelled_by?: string | number | null;
  cancelled_by_name?: string;
  cancelled_at?: string;
  payment_return_method?: string;
  total_items?: number;
  created_at?: string;
  items?: any[];
  cashier_name?: string;
  user_name?: string;
  product_names?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-sales-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatInputModule,
    MatDialogModule,
    RouterModule,
    ReceiptPrintComponent,
  ],
  templateUrl: './sales-list.component.html',
  styleUrl: './sales-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesListComponent implements OnInit, OnDestroy {
  sales: SaleSummary[] = [];
  filteredSales: SaleSummary[] = [];
  loading = false;
  searchText = '';
  selectedStatus: 'ALL' | 'ACTIVE' | 'CANCELLED' = 'ALL';
  selectedPaymentMode = 'ALL';

  // Details Preview Modal
  selectedSale: any = null;
  saleItems: any[] = [];
  loadingItems = false;

  // Receipt Printing
  receiptData: any = null;
  showReceipt = false;

  displayedColumns: string[] = [
    'index',
    'invoice_no',
    'customer',
    'products',
    'receipt_date',
    'total_items',
    'payment_mode',
    'bill_amount',
    'status',
    'action',
  ];

  dataSource = new MatTableDataSource<SaleSummary>([]);

  private destroy$ = new Subject<void>();
  isDialog = false;

  @ViewChild(ReceiptPrintComponent) receiptPrint?: ReceiptPrintComponent;

  constructor(
    private masterService: MasterService,
    private authState: AuthStateService,
    private notification: SnackbarService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    @Optional() private dialogRef?: MatDialogRef<SalesListComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public dialogData?: any[],
  ) {
    this.isDialog = !!dialogRef;
  }

  ngOnInit(): void {
    if (this.dialogData && Array.isArray(this.dialogData) && this.dialogData.length > 0) {
      this.sales = this.dialogData;
      this.applyFilter();
    } else {
      this.loadSales();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSales(): void {
    this.loading = true;
    this.masterService
      .getAllSales()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          this.sales = this.mergeWithLocalBackup(res || []);
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('API getAllSales error, loading local sales backup:', err);
          this.sales = this.mergeWithLocalBackup([]);
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private mergeWithLocalBackup(serverSales: any[]): SaleSummary[] {
    try {
      const raw = localStorage.getItem('store_completed_sales_backup');
      const backup: any[] = raw ? JSON.parse(raw) : [];
      const map = new Map<string, any>();

      // Server sales first
      (serverSales || []).forEach((s) => {
        if (s.invoice_no) {
          const invKey = s.invoice_no.toUpperCase();
          const localMatch = backup.find(
            (b) => b.invoice_no?.toUpperCase() === invKey,
          );
          if (localMatch) {
            // Attach line items from local backup if server row does not have items
            if (localMatch.items && localMatch.items.length > 0) {
              s.items = s.items && s.items.length > 0 ? s.items : localMatch.items;
            }
            // Keep cancellation details if cancelled locally
            if (localMatch.status === 'CANCELLED') {
              s.status = 'CANCELLED';
              s.cancel_reason = s.cancel_reason || localMatch.cancel_reason;
              s.payment_return_method =
                s.payment_return_method || localMatch.payment_return_method;
              s.cancelled_by_name =
                s.cancelled_by_name || localMatch.cancelled_by_name;
              s.cancelled_at = s.cancelled_at || localMatch.cancelled_at;
            }
          }
          map.set(invKey, s);
        }
      });

      // Add local backup if not in server response
      backup.forEach((b) => {
        if (b.invoice_no && !map.has(b.invoice_no.toUpperCase())) {
          map.set(b.invoice_no.toUpperCase(), b);
        }
      });

      return Array.from(map.values()).sort((a, b) => {
        const dateA = new Date(a.receipt_date || a.created_at || 0).getTime();
        const dateB = new Date(b.receipt_date || b.created_at || 0).getTime();
        return dateB - dateA;
      });
    } catch {
      return serverSales || [];
    }
  }

  applyFilter(): void {
    const term = (this.searchText || '').trim().toLowerCase();

    this.filteredSales = this.sales.filter((s) => {
      const prods = (s.product_names || '').toLowerCase();
      const itemsMatch = s.items?.some((it: any) =>
        it.product_name?.toLowerCase().includes(term) ||
        it.product_code?.toLowerCase().includes(term),
      );

      const matchSearch =
        !term ||
        s.invoice_no?.toLowerCase().includes(term) ||
        s.customer_name?.toLowerCase().includes(term) ||
        s.customer_mobile?.toLowerCase().includes(term) ||
        s.payment_mode?.toLowerCase().includes(term) ||
        s.dept_name?.toLowerCase().includes(term) ||
        prods.includes(term) ||
        itemsMatch;

      const matchStatus =
        this.selectedStatus === 'ALL' || s.status === this.selectedStatus;

      const matchPayment =
        this.selectedPaymentMode === 'ALL' ||
        s.payment_mode?.toUpperCase() === this.selectedPaymentMode.toUpperCase();

      return matchSearch && matchStatus && matchPayment;
    });

    this.dataSource.data = this.filteredSales;
    this.cdr.markForCheck();
  }

  // Product Name Display Helpers
  getPrimaryProduct(row: SaleSummary): string {
    if (row.items && row.items.length > 0) {
      const it = row.items[0];
      const name = it.product_name || 'Item';
      const qtyStr = it.qty && it.qty > 1 ? ` (x${it.qty})` : '';
      return `${name}${qtyStr}`;
    }
    if (row.product_names) {
      const parts = row.product_names.split(', ');
      return parts[0];
    }
    // Fallback: check local backup
    try {
      const raw = localStorage.getItem('store_completed_sales_backup');
      const backup: any[] = raw ? JSON.parse(raw) : [];
      const found = backup.find(
        (b) => b.invoice_no?.toUpperCase() === row.invoice_no?.toUpperCase(),
      );
      if (found?.items?.length) {
        row.items = found.items;
        return this.getPrimaryProduct(row);
      }
    } catch {}
    return '—';
  }

  getExtraProductsCount(row: SaleSummary): number {
    if (row.items && row.items.length > 0) {
      return Math.max(0, row.items.length - 1);
    }
    if (row.product_names) {
      const parts = row.product_names.split(', ');
      return Math.max(0, parts.length - 1);
    }
    return 0;
  }

  getProductTooltip(row: SaleSummary): string {
    if (row.items && row.items.length > 0) {
      return row.items
        .map(
          (it: any) =>
            `${it.product_name || 'Item'} (Qty: ${it.qty || 1}${
              it.selling_price ? ' @ ₹' + Number(it.selling_price).toFixed(2) : ''
            })`,
        )
        .join('\n');
    }
    if (row.product_names) {
      return row.product_names;
    }
    return 'Click to view line items';
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  setStatusFilter(status: 'ALL' | 'ACTIVE' | 'CANCELLED'): void {
    this.selectedStatus = status;
    this.applyFilter();
  }

  setPaymentFilter(mode: string): void {
    this.selectedPaymentMode = mode;
    this.applyFilter();
  }

  // Summary Metrics
  get totalSalesCount(): number {
    return this.sales.length;
  }

  get activeSalesCount(): number {
    return this.sales.filter((s) => s.status === 'ACTIVE').length;
  }

  get cancelledSalesCount(): number {
    return this.sales.filter((s) => s.status === 'CANCELLED').length;
  }

  get totalSalesAmount(): number {
    return this.sales
      .filter((s) => s.status === 'ACTIVE')
      .reduce((acc, s) => acc + (Number(s.bill_amount) || 0), 0);
  }

  // View Details (Products in Bill)
  viewSaleDetails(sale: SaleSummary): void {
    this.selectedSale = sale;
    this.saleItems = [];
    this.loadingItems = true;
    this.cdr.markForCheck();

    if (sale.items && sale.items.length > 0) {
      this.saleItems = sale.items;
      this.loadingItems = false;
      this.cdr.markForCheck();
      return;
    }

    // Check local backup for items
    try {
      const raw = localStorage.getItem('store_completed_sales_backup');
      const backup: any[] = raw ? JSON.parse(raw) : [];
      const found = backup.find(
        (b) => b.invoice_no?.toUpperCase() === sale.invoice_no?.toUpperCase(),
      );
      if (found?.items?.length) {
        sale.items = found.items;
        this.saleItems = found.items;
        this.loadingItems = false;
        this.cdr.markForCheck();
        return;
      }
    } catch {}

    if (sale.id) {
      this.masterService
        .getSaleById(sale.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: any) => {
            const fetched = res?.items || res?.data?.items || [];
            this.saleItems = fetched;
            if (fetched.length > 0) {
              sale.items = fetched;
            }
            this.loadingItems = false;
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.warn('Could not fetch items via API', err);
            this.saleItems = sale.items || [];
            this.loadingItems = false;
            this.cdr.markForCheck();
          },
        });
    } else {
      this.loadingItems = false;
      this.cdr.markForCheck();
    }
  }

  closeDetailsModal(): void {
    this.selectedSale = null;
    this.saleItems = [];
    this.cdr.markForCheck();
  }

  // Print Receipt
  printSaleReceipt(sale: SaleSummary): void {
    const buildPrintData = (items: any[]) => {
      this.receiptData = {
        // Flat properties expected by ReceiptPrintComponent
        invoice_no: sale.invoice_no,
        receipt_date: sale.receipt_date,
        customer_name: sale.customer_name || 'Walk-in Customer',
        customer_mobile: sale.customer_mobile || '',
        total_amount: sale.total_amount || sale.bill_amount,
        discount_amount: sale.discount_amount || 0,
        gst_amount: sale.gst_amount || 0,
        other_charges: sale.other_charges || 0,
        bill_amount: sale.bill_amount,
        payment_mode: sale.payment_mode || 'Cash',
        status: sale.status,
        header: {
          invoice_no: sale.invoice_no,
          receipt_date: sale.receipt_date,
          customer_name: sale.customer_name || 'Walk-in Customer',
          customer_mobile: sale.customer_mobile || '',
          total_amount: sale.total_amount || sale.bill_amount,
          discount_amount: sale.discount_amount || 0,
          gst_amount: sale.gst_amount || 0,
          other_charges: sale.other_charges || 0,
          bill_amount: sale.bill_amount,
          payment_mode: sale.payment_mode || 'Cash',
          status: sale.status,
        },
        items: (items || []).map((it) => ({
          product_code: it.product_code || '',
          product_name: it.product_name,
          qty: it.qty,
          selling_price: it.selling_price,
          amount: it.amount,
        })),
      };
      this.showReceipt = true;
      this.cdr.detectChanges();

      setTimeout(() => {
        this.receiptPrint?.print();
        this.showReceipt = false;
        this.cdr.detectChanges();
      }, 300);
    };

    if (sale.items && sale.items.length > 0) {
      buildPrintData(sale.items);
    } else if (sale.id) {
      this.masterService.getSaleById(sale.id).subscribe({
        next: (res: any) => {
          buildPrintData(res?.items || []);
        },
        error: () => {
          buildPrintData([]);
        },
      });
    } else {
      buildPrintData([]);
    }
  }

  // Cancel Sale & Immediately Restore Stock
  cancelSale(sale: SaleSummary): void {
    if (sale.status === 'CANCELLED') {
      this.notification.error('This bill is already cancelled');
      return;
    }

    const ref = this.dialog.open(CancelReasonDialogComponent, {
      width: '440px',
      data: {
        invoice_no: sale.invoice_no,
        type: 'sale',
        title: 'Cancel Sale Bill',
        payment_mode: sale.payment_mode || 'Cash',
      },
    });

    ref.afterClosed().subscribe((result: any) => {
      if (!result) return;
      const reason = typeof result === 'object' ? result.reason : result;
      const returnMethod =
        typeof result === 'object'
          ? result.payment_return_method || sale.payment_mode || 'Cash'
          : sale.payment_mode || 'Cash';
      if (!reason || !reason.trim()) return;

      // 1. Look for items to restore
      let itemsToRestore: any[] = sale.items && sale.items.length > 0 ? [...sale.items] : [];
      if (!itemsToRestore.length) {
        try {
          const raw = localStorage.getItem('store_completed_sales_backup');
          const backup: any[] = raw ? JSON.parse(raw) : [];
          const found = backup.find(
            (b) => b.invoice_no?.toUpperCase() === sale.invoice_no?.toUpperCase(),
          );
          if (found?.items?.length) {
            itemsToRestore = [...found.items];
            sale.items = [...found.items];
          }
        } catch (e) {
          console.warn('Failed to read backup items for cancel', e);
        }
      }

      const performLocalCancel = (restoredItems?: any[]) => {
        let finalItems = restoredItems || itemsToRestore || sale.items || [];
        if (!finalItems.length) {
          try {
            const raw = localStorage.getItem('store_completed_sales_backup');
            const backup: any[] = raw ? JSON.parse(raw) : [];
            const found = backup.find(
              (b) => b.invoice_no?.toUpperCase() === sale.invoice_no?.toUpperCase(),
            );
            if (found?.items?.length) {
              finalItems = [...found.items];
              sale.items = [...found.items];
            }
          } catch {}
        }

        sale.status = 'CANCELLED';
        sale.cancel_reason = reason.trim();
        sale.payment_return_method = returnMethod;
        sale.cancelled_at = new Date().toISOString();
        sale.cancelled_by = this.authState.user()?.id || null;
        sale.cancelled_by_name = this.authState.user()?.username || 'Current User';

        this.updateLocalBackupStatus(
          sale.invoice_no,
          'CANCELLED',
          reason.trim(),
          returnMethod,
          sale.cancelled_by_name,
          sale.cancelled_at,
          finalItems,
        );

        // ⚡ IMMEDIATELY NOTIFY STOCK RESTORATION:
        // Increments product stock in Quick Sales billing and Product Master at this exact moment!
        this.masterService.notifyStockUpdated({
          type: 'SALE_CANCELLED',
          departmentId: sale.department_id,
          items: finalItems,
        });

        this.notification.success(`Bill ${sale.invoice_no} cancelled. Product stock restored immediately.`);
        this.applyFilter();
        this.cdr.markForCheck();
      };

      const proceedCancel = (items: any[]) => {
        const finalItems = items && items.length > 0 ? items : itemsToRestore;
        this.executeCancelCall(
          sale,
          reason,
          returnMethod,
          (restored) => performLocalCancel(restored && restored.length > 0 ? restored : finalItems),
          finalItems,
        );
      };

      if (itemsToRestore.length > 0) {
        proceedCancel(itemsToRestore);
      } else if (sale.id) {
        this.masterService.getSaleById(sale.id).subscribe({
          next: (res: any) => {
            const fetched = res?.items || res?.data?.items || [];
            if (fetched.length > 0) {
              sale.items = fetched;
            }
            proceedCancel(fetched.length > 0 ? fetched : itemsToRestore);
          },
          error: () => {
            proceedCancel(itemsToRestore);
          },
        });
      } else {
        performLocalCancel(itemsToRestore);
      }
    });
  }

  private executeCancelCall(
    sale: SaleSummary,
    reason: string,
    returnMethod: string,
    onComplete: (items: any[]) => void,
    items: any[],
  ): void {
    if (sale.id) {
      this.masterService
        .cancelSale(sale.id, {
          cancel_reason: reason.trim(),
          cancelled_by: this.authState.user()?.id?.toString() ?? null,
          payment_return_method: returnMethod,
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => onComplete(items),
          error: (err) => {
            console.warn('API cancelSale failed, applying instant client cancellation & stock restore:', err);
            onComplete(items);
          },
        });
    } else {
      onComplete(items);
    }
  }

  private updateLocalBackupStatus(
    invoiceNo: string,
    status: 'ACTIVE' | 'CANCELLED',
    reason?: string,
    returnMethod?: string,
    cancelledByName?: string,
    cancelledAt?: string,
    items?: any[],
  ): void {
    try {
      const raw = localStorage.getItem('store_completed_sales_backup');
      const list: any[] = raw ? JSON.parse(raw) : [];
      let target = list.find(
        (x) => x.invoice_no?.toUpperCase() === invoiceNo?.toUpperCase(),
      );
      if (target) {
        target.status = status;
        target.cancel_reason = reason;
        target.payment_return_method = returnMethod;
        target.cancelled_by_name = cancelledByName;
        target.cancelled_at = cancelledAt || new Date().toISOString();
        if (items && items.length > 0 && (!target.items || target.items.length === 0)) {
          target.items = items;
        }
      } else {
        list.unshift({
          invoice_no: invoiceNo,
          status,
          cancel_reason: reason,
          payment_return_method: returnMethod,
          cancelled_by_name: cancelledByName,
          cancelled_at: cancelledAt || new Date().toISOString(),
          items: items || [],
        });
      }
      localStorage.setItem('store_completed_sales_backup', JSON.stringify(list));
    } catch (e) {
      console.warn('Error updating local backup status', e);
    }
  }

  openCancelledBillsModal(): void {
    this.dialog.open(CancelledSalesListComponent, {
      width: '1150px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      data: { isDialog: true },
    });
  }

  close(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }
}
