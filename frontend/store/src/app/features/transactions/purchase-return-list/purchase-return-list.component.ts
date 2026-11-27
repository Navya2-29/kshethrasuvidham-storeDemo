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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MasterService } from '../../../core/services/masters/master.service';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { SnackbarService } from '../../../core/services/ui/snackbar.service';
import { ReceiptPrintComponent } from '../sales/receipt-print/receipt-print.component';
import { Subject, takeUntil } from 'rxjs';
import { RouterModule } from '@angular/router';

export interface CancelledPurchaseRecord {
  id: number;
  order_no?: string;
  invoice_no: string;
  supplier_id?: number;
  supplier_name: string;
  supplier_mobile?: string;
  invoice_date: string;
  receipt_date: string;
  total_amount?: number;
  discount_amount?: number;
  other_charges?: number;
  bill_amount: number;
  status: 'CANCELLED';
  cancel_reason?: string;
  cancelled_by?: string | number | null;
  cancelled_by_name?: string;
  cancelled_at?: string;
  total_items?: number;
  items?: any[];
  product_names?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-purchase-return-list',
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
  templateUrl: './purchase-return-list.component.html',
  styleUrl: './purchase-return-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseReturnListComponent implements OnInit, OnDestroy {
  cancelledPurchases: CancelledPurchaseRecord[] = [];
  filteredPurchases: CancelledPurchaseRecord[] = [];
  loading = false;
  searchText = '';
  selectedDateFilter: 'ALL' | 'TODAY' | 'MONTH' = 'ALL';

  // Details Modal
  selectedPurchase: CancelledPurchaseRecord | null = null;
  purchaseItems: any[] = [];
  loadingItems = false;

  // Voucher Printing
  receiptData: any = null;
  showReceipt = false;

  displayedColumns: string[] = [
    'index',
    'invoice_no',
    'supplier_name',
    'products',
    'receipt_date',
    'cancelled_at',
    'cancelled_by',
    'cancel_reason',
    'bill_amount',
    'action',
  ];

  dataSource = new MatTableDataSource<CancelledPurchaseRecord>([]);

  private destroy$ = new Subject<void>();
  isDialog = false;

  @ViewChild(ReceiptPrintComponent) receiptPrint?: ReceiptPrintComponent;

  constructor(
    private masterService: MasterService,
    private authState: AuthStateService,
    private notification: SnackbarService,
    private cdr: ChangeDetectorRef,
    @Optional() private dialogRef?: MatDialogRef<PurchaseReturnListComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public dialogData?: any,
  ) {
    this.isDialog = !!dialogRef || !!dialogData?.isDialog;
  }

  ngOnInit(): void {
    this.loadCancelledPurchases();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCancelledPurchases(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.masterService
      .getAllPurchases()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.cancelledPurchases = this.extractCancelledRecords(res || []);
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('API getAllPurchases error, loading local backup:', err);
          this.cancelledPurchases = this.extractCancelledRecords([]);
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private extractCancelledRecords(serverPurchases: any[]): CancelledPurchaseRecord[] {
    const map = new Map<string, CancelledPurchaseRecord>();

    // 1. Server purchases with status = 'CANCELLED'
    (serverPurchases || []).forEach((p) => {
      if (p.status === 'CANCELLED' && p.invoice_no) {
        map.set(p.invoice_no.toUpperCase(), {
          ...p,
          supplier_name: p.supplier_name || 'General Supplier',
          cancelled_by_name: p.cancelled_by_name || 'Admin',
        });
      }
    });

    // 2. Local backup cancelled purchases
    try {
      const raw = localStorage.getItem('store_cancelled_purchases_backup');
      const backup: any[] = raw ? JSON.parse(raw) : [];
      backup.forEach((b) => {
        if (b.invoice_no) {
          const inv = b.invoice_no.toUpperCase();
          const existing = map.get(inv);
          if (existing) {
            if (b.items && b.items.length > 0 && (!existing.items || !existing.items.length)) {
              existing.items = b.items;
            }
            if (b.cancelled_by_name) existing.cancelled_by_name = b.cancelled_by_name;
            if (b.cancel_reason) existing.cancel_reason = b.cancel_reason;
            if (b.cancelled_at) existing.cancelled_at = b.cancelled_at;
            if (b.product_names) existing.product_names = b.product_names;
          } else if (b.status === 'CANCELLED') {
            const serverRec = (serverPurchases || []).find((s: any) => s.invoice_no?.toUpperCase() === inv);
            map.set(inv, {
              ...(serverRec || {}),
              ...b,
              status: 'CANCELLED',
              supplier_name: b.supplier_name || serverRec?.supplier_name || 'General Supplier',
              cancelled_by_name: b.cancelled_by_name || 'Admin',
            });
          }
        }
      });
    } catch (e) {
      console.warn('Error reading local cancelled purchases backup', e);
    }

    return Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(a.cancelled_at || a.receipt_date || a.invoice_date || 0).getTime();
      const dateB = new Date(b.cancelled_at || b.receipt_date || b.invoice_date || 0).getTime();
      return dateB - dateA;
    });
  }

  applyFilter(): void {
    let list = [...this.cancelledPurchases];

    // Filter by Date
    if (this.selectedDateFilter !== 'ALL') {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();

      list = list.filter((p) => {
        const dateVal = p.cancelled_at || p.receipt_date || p.invoice_date;
        if (!dateVal) return false;
        const d = new Date(dateVal);

        if (this.selectedDateFilter === 'TODAY') {
          return dateVal.startsWith(todayStr);
        } else if (this.selectedDateFilter === 'MONTH') {
          return d.getFullYear() === curYear && d.getMonth() === curMonth;
        }
        return true;
      });
    }

    // Filter by Search Text
    if (this.searchText && this.searchText.trim()) {
      const q = this.searchText.trim().toLowerCase();
      list = list.filter((p) => {
        const inv = (p.invoice_no || '').toLowerCase();
        const ord = (p.order_no || '').toLowerCase();
        const sup = (p.supplier_name || '').toLowerCase();
        const mob = (p.supplier_mobile || '').toLowerCase();
        const by = (p.cancelled_by_name || '').toLowerCase();
        const reason = (p.cancel_reason || '').toLowerCase();
        const prods = (p.product_names || '').toLowerCase();
        const itemsMatch = p.items?.some((it: any) =>
          it.product_name?.toLowerCase().includes(q) ||
          it.product_code?.toLowerCase().includes(q),
        );
        return (
          inv.includes(q) ||
          ord.includes(q) ||
          sup.includes(q) ||
          mob.includes(q) ||
          by.includes(q) ||
          reason.includes(q) ||
          prods.includes(q) ||
          itemsMatch
        );
      });
    }

    this.filteredPurchases = list;
    this.dataSource.data = list;
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  setDateFilter(mode: 'ALL' | 'TODAY' | 'MONTH'): void {
    this.selectedDateFilter = mode;
    this.applyFilter();
  }

  // Summary Metrics
  get totalCancelledCount(): number {
    return this.cancelledPurchases.length;
  }

  get totalRefundAmount(): number {
    return this.cancelledPurchases.reduce(
      (acc, p) => acc + (Number(p.bill_amount) || 0),
      0,
    );
  }

  get totalItemsReturned(): number {
    return this.cancelledPurchases.reduce((acc, p) => {
      const count = p.total_items || (p.items?.length ?? 1);
      return acc + (Number(count) || 0);
    }, 0);
  }

  // Product Name Display Helpers
  getPrimaryProduct(row: CancelledPurchaseRecord): string {
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
    // Check local backup
    try {
      const raw = localStorage.getItem('store_cancelled_purchases_backup');
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

  getExtraProductsCount(row: CancelledPurchaseRecord): number {
    if (row.items && row.items.length > 0) {
      return Math.max(0, row.items.length - 1);
    }
    if (row.product_names) {
      const parts = row.product_names.split(', ');
      return Math.max(0, parts.length - 1);
    }
    return 0;
  }

  getProductTooltip(row: CancelledPurchaseRecord): string {
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
    return 'Click to view returned line items';
  }

  // View Details Modal
  viewReturnedDetails(purchase: CancelledPurchaseRecord): void {
    this.selectedPurchase = purchase;
    this.purchaseItems = [];
    this.loadingItems = true;
    this.cdr.markForCheck();

    if (purchase.items && purchase.items.length > 0) {
      this.purchaseItems = purchase.items;
      this.loadingItems = false;
      this.cdr.markForCheck();
      return;
    }

    // Check local backup
    try {
      const raw = localStorage.getItem('store_cancelled_purchases_backup');
      const backup: any[] = raw ? JSON.parse(raw) : [];
      const found = backup.find(
        (b) => b.invoice_no?.toUpperCase() === purchase.invoice_no?.toUpperCase(),
      );
      if (found?.items?.length) {
        purchase.items = found.items;
        this.purchaseItems = found.items;
        this.loadingItems = false;
        this.cdr.markForCheck();
        return;
      }
    } catch {}

    if (purchase.id) {
      this.masterService
        .getPurchaseById(purchase.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: any) => {
            const fetched = res?.items || [];
            this.purchaseItems = fetched;
            if (fetched.length > 0) {
              purchase.items = fetched;
            }
            this.loadingItems = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.purchaseItems = purchase.items || [];
            this.loadingItems = false;
            this.cdr.markForCheck();
          },
        });
    } else {
      this.purchaseItems = purchase.items || [];
      this.loadingItems = false;
      this.cdr.markForCheck();
    }
  }

  closeDetailsModal(): void {
    this.selectedPurchase = null;
    this.purchaseItems = [];
  }

  // Print Return Slip / Debit Note
  printReturnSlip(purchase: CancelledPurchaseRecord): void {
    const buildPrintData = (items: any[]) => {
      this.receiptData = {
        invoice_no: `RET-${purchase.invoice_no}`,
        receipt_date: purchase.cancelled_at || purchase.receipt_date || purchase.invoice_date,
        customer_name: purchase.supplier_name,
        customer_mobile: purchase.supplier_mobile || '',
        total_amount: purchase.total_amount || purchase.bill_amount,
        discount_amount: purchase.discount_amount || 0,
        other_charges: purchase.other_charges || 0,
        bill_amount: purchase.bill_amount,
        payment_mode: 'PURCHASE RETURN / DEBIT',
        status: 'CANCELLED',
        cancel_reason: purchase.cancel_reason,
        cancelled_by_name: purchase.cancelled_by_name,
        header: {
          invoice_no: `RET-${purchase.invoice_no} [CANCELLED]`,
          receipt_date: purchase.cancelled_at || purchase.receipt_date,
          customer_name: `Supplier: ${purchase.supplier_name}`,
          customer_mobile: purchase.supplier_mobile || '',
          bill_amount: purchase.bill_amount,
          payment_mode: 'PURCHASE RETURN / DEBIT',
        },
        items: (items || []).map((it) => ({
          product_code: it.product_code || '',
          product_name: `[RETURNED] ${it.product_name || 'Product'}`,
          qty: it.qty,
          selling_price: it.cost_price || it.rate || 0,
          amount: it.amount || (Number(it.qty || 1) * Number(it.cost_price || 0)),
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

    if (purchase.items && purchase.items.length > 0) {
      buildPrintData(purchase.items);
      return;
    }

    // Check local backup
    try {
      const raw = localStorage.getItem('store_cancelled_purchases_backup');
      const backup: any[] = raw ? JSON.parse(raw) : [];
      const found = backup.find(
        (b) => b.invoice_no?.toUpperCase() === purchase.invoice_no?.toUpperCase(),
      );
      if (found?.items?.length) {
        purchase.items = found.items;
        buildPrintData(found.items);
        return;
      }
    } catch {}

    if (purchase.id) {
      this.masterService.getPurchaseById(purchase.id).subscribe({
        next: (res: any) => {
          const fetched = res?.items || [];
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
