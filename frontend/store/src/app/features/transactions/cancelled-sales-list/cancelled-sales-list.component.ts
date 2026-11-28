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
import { ReceiptPrintComponent } from '../sales/receipt-print/receipt-print.component';
import { Subject, takeUntil } from 'rxjs';
import { RouterModule } from '@angular/router';

export interface CancelledSaleRecord {
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
  status: 'CANCELLED';
  cancel_reason?: string;
  cancelled_by?: string | number | null;
  cancelled_by_name?: string;
  cancelled_at?: string;
  payment_return_method?: string;
  total_items?: number;
  created_at?: string;
  items?: any[];
  product_names?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-cancelled-sales-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatInputModule,
    MatDialogModule,
    ReceiptPrintComponent,
    RouterModule,
  ],
  templateUrl: './cancelled-sales-list.component.html',
  styleUrl: './cancelled-sales-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelledSalesListComponent implements OnInit, OnDestroy {
  cancelledSales: CancelledSaleRecord[] = [];
  filteredSales: CancelledSaleRecord[] = [];
  loading = false;
  searchText = '';
  selectedReturnMethod = 'ALL';

  // Details Modal
  selectedSale: any = null;
  saleItems: any[] = [];
  loadingItems = false;

  // Receipt / Voucher Printing
  receiptData: any = null;
  showReceipt = false;

  displayedColumns: string[] = [
    'index',
    'invoice_no',
    'customer',
    'products',
    'receipt_date',
    'cancelled_at',
    'cancelled_by',
    'payment_return_method',
    'cancel_reason',
    'refund_amount',
    'action',
  ];

  dataSource = new MatTableDataSource<CancelledSaleRecord>([]);

  private destroy$ = new Subject<void>();
  isDialog = false;

  @ViewChild(ReceiptPrintComponent) receiptPrint?: ReceiptPrintComponent;

  constructor(
    private masterService: MasterService,
    private authState: AuthStateService,
    private notification: SnackbarService,
    private cdr: ChangeDetectorRef,
    @Optional() private dialogRef?: MatDialogRef<CancelledSalesListComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public dialogData?: any,
  ) {
    this.isDialog = !!dialogRef || !!dialogData?.isDialog;
  }

  ngOnInit(): void {
    this.loadCancelledSales();

    // Listen for real-time stock/cancel updates
    this.masterService.stockUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadCancelledSales();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCancelledSales(): void {
    this.loading = true;
    this.masterService
      .getAllSales()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          this.cancelledSales = this.extractCancelledRecords(res || []);
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('API getAllSales error, loading local cancelled backup:', err);
          this.cancelledSales = this.extractCancelledRecords([]);
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private extractCancelledRecords(serverSales: any[]): CancelledSaleRecord[] {
    const map = new Map<string, CancelledSaleRecord>();

    // 1. Server sales with status = 'CANCELLED'
    (serverSales || []).forEach((s) => {
      if (s.status === 'CANCELLED' && s.invoice_no) {
        map.set(s.invoice_no.toUpperCase(), {
          ...s,
          payment_return_method: s.payment_return_method || this.extractReturnMethodFromReason(s.cancel_reason) || s.payment_mode || 'Cash',
          cancelled_by_name: s.cancelled_by_name || s.cashier_name || 'Admin',
        });
      }
    });

    // 2. Local backup sales
    try {
      const raw = localStorage.getItem('store_completed_sales_backup');
      const backup: any[] = raw ? JSON.parse(raw) : [];
      backup.forEach((b) => {
        if (b.invoice_no) {
          const inv = b.invoice_no.toUpperCase();
          const existing = map.get(inv);
          if (existing) {
            if (b.items && b.items.length > 0 && (!existing.items || !existing.items.length)) {
              existing.items = b.items;
            }
            if (b.payment_return_method) existing.payment_return_method = b.payment_return_method;
            if (b.cancelled_by_name) existing.cancelled_by_name = b.cancelled_by_name;
            if (b.cancel_reason) existing.cancel_reason = b.cancel_reason;
            if (b.cancelled_at) existing.cancelled_at = b.cancelled_at;
          } else if (b.status === 'CANCELLED') {
            const serverRec = (serverSales || []).find((s: any) => s.invoice_no?.toUpperCase() === inv);
            map.set(inv, {
              ...(serverRec || {}),
              ...b,
              status: 'CANCELLED',
              payment_return_method: b.payment_return_method || this.extractReturnMethodFromReason(b.cancel_reason) || b.payment_mode || 'Cash',
              cancelled_by_name: b.cancelled_by_name || 'Admin',
            });
          }
        }
      });
    } catch (e) {
      console.warn('Error reading local cancelled backup', e);
    }

    return Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(a.cancelled_at || a.receipt_date).getTime() || 0;
      const dateB = new Date(b.cancelled_at || b.receipt_date).getTime() || 0;
      return dateB - dateA;
    });
  }

  private extractReturnMethodFromReason(reason?: string): string | null {
    if (!reason) return null;
    const match = reason.match(/\(Returned via ([^)]+)\)/i);
    return match ? match[1] : null;
  }

  applyFilter(): void {
    let list = [...this.cancelledSales];

    // Filter by Return Method
    if (this.selectedReturnMethod !== 'ALL') {
      list = list.filter((s) =>
        (s.payment_return_method || s.payment_mode || 'Cash').toLowerCase() ===
        this.selectedReturnMethod.toLowerCase(),
      );
    }

    // Filter by Search Text
    if (this.searchText && this.searchText.trim()) {
      const q = this.searchText.trim().toLowerCase();
      list = list.filter((s) => {
        const inv = (s.invoice_no || '').toLowerCase();
        const cust = (s.customer_name || '').toLowerCase();
        const mob = (s.customer_mobile || '').toLowerCase();
        const by = (s.cancelled_by_name || '').toLowerCase();
        const reason = (s.cancel_reason || '').toLowerCase();
        const method = (s.payment_return_method || '').toLowerCase();
        const prods = (s.product_names || '').toLowerCase();
        const itemsMatch = s.items?.some((it: any) =>
          it.product_name?.toLowerCase().includes(q) ||
          it.product_code?.toLowerCase().includes(q),
        );
        return (
          inv.includes(q) ||
          cust.includes(q) ||
          mob.includes(q) ||
          by.includes(q) ||
          reason.includes(q) ||
          method.includes(q) ||
          prods.includes(q) ||
          itemsMatch
        );
      });
    }

    this.filteredSales = list;
    this.dataSource.data = list;
    this.cdr.markForCheck();
  }

  // Product Name Display Helpers
  getPrimaryProduct(row: CancelledSaleRecord): string {
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

  getExtraProductsCount(row: CancelledSaleRecord): number {
    if (row.items && row.items.length > 0) {
      return Math.max(0, row.items.length - 1);
    }
    if (row.product_names) {
      const parts = row.product_names.split(', ');
      return Math.max(0, parts.length - 1);
    }
    return 0;
  }

  getProductTooltip(row: CancelledSaleRecord): string {
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
    return 'Click to view returned items';
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  setReturnMethodFilter(method: string): void {
    this.selectedReturnMethod = method;
    this.applyFilter();
  }

  // Summary Metrics
  get totalCancelledCount(): number {
    return this.cancelledSales.length;
  }

  get totalRefundAmount(): number {
    return this.cancelledSales.reduce(
      (acc, s) => acc + (Number(s.bill_amount) || 0),
      0,
    );
  }

  get cashRefundCount(): number {
    return this.cancelledSales.filter(
      (s) => (s.payment_return_method || 'Cash').toLowerCase() === 'cash',
    ).length;
  }

  get upiRefundCount(): number {
    return this.cancelledSales.filter((s) =>
      (s.payment_return_method || '').toLowerCase().includes('upi'),
    ).length;
  }

  // View Returned Items
  viewReturnedDetails(sale: CancelledSaleRecord): void {
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

    // Check local backup
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
          error: () => {
            this.saleItems = sale.items || [];
            this.loadingItems = false;
            this.cdr.markForCheck();
          },
        });
    } else {
      this.saleItems = sale.items || [];
      this.loadingItems = false;
      this.cdr.markForCheck();
    }
  }

  closeDetailsModal(): void {
    this.selectedSale = null;
    this.saleItems = [];
  }

  // Print Cancellation Voucher / Slip
  printCancellationSlip(sale: CancelledSaleRecord): void {
    const buildPrintData = (items: any[]) => {
      this.receiptData = {
        invoice_no: `${sale.invoice_no} (CANCELLED)`,
        receipt_date: sale.cancelled_at || sale.receipt_date,
        customer_name: sale.customer_name || 'Walk-in Customer',
        customer_mobile: sale.customer_mobile || '',
        total_amount: sale.total_amount || sale.bill_amount,
        discount_amount: sale.discount_amount || 0,
        gst_amount: sale.gst_amount || 0,
        other_charges: sale.other_charges || 0,
        bill_amount: sale.bill_amount,
        payment_mode: `REFUND VIA ${sale.payment_return_method || sale.payment_mode || 'Cash'}`,
        status: 'CANCELLED',
        cancel_reason: sale.cancel_reason,
        cancelled_by_name: sale.cancelled_by_name,
        header: {
          invoice_no: `${sale.invoice_no} [CANCELLED]`,
          receipt_date: sale.cancelled_at || sale.receipt_date,
          customer_name: sale.customer_name || 'Walk-in Customer',
          customer_mobile: sale.customer_mobile || '',
          bill_amount: sale.bill_amount,
          payment_mode: `REFUND: ${sale.payment_return_method || 'Cash'}`,
        },
        items: (items || []).map((it) => ({
          product_code: it.product_code || '',
          product_name: `[RESTORED] ${it.product_name}`,
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
      }, 350);
    };

    if (sale.items && sale.items.length > 0) {
      buildPrintData(sale.items);
      return;
    }

    // Check local backup
    try {
      const raw = localStorage.getItem('store_completed_sales_backup');
      const backup: any[] = raw ? JSON.parse(raw) : [];
      const found = backup.find(
        (b) => b.invoice_no?.toUpperCase() === sale.invoice_no?.toUpperCase(),
      );
      if (found?.items?.length) {
        sale.items = found.items;
        buildPrintData(found.items);
        return;
      }
    } catch {}

    if (sale.id) {
      this.masterService.getSaleById(sale.id).subscribe({
        next: (res: any) => {
          const fetched = res?.items || res?.data?.items || [];
          buildPrintData(fetched);
        },
        error: () => buildPrintData([]),
      });
    } else {
      buildPrintData([]);
    }
  }

  close(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }
}
