import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MasterService } from '../../../core/services/masters/master.service';
import { SettingstoreService } from '../../../core/services/setting/settingstore.service';
import { SettingService } from '../../../core/services/setting/setting.service';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import * as XLSX from 'xlsx';

export interface ItemWiseRow {
  item_id?: number;
  invoice_no: string;
  product_name: string;
  quantity: number;
  payment_mode: string;
  username: string;
  receipt_date: string;
  total_amount: number;
}

@Component({
  selector: 'app-item-wise-sales-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './item-wise-sales-report.component.html',
  styleUrl: './item-wise-sales-report.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemWiseSalesReportComponent implements OnInit, OnDestroy {
  loading = false;

  // Filters
  fromDate: string = '';
  toDate: string = '';
  selectedProduct: string = '';
  selectedUser: string = '';
  selectedPaymentMode: string = '';

  productList: string[] = [];
  userList: string[] = [];

  private rawSales: any[] = [];
  itemsData: ItemWiseRow[] = [];
  storeSettings: any = null;

  private destroy$ = new Subject<void>();

  constructor(
    private masterService: MasterService,
    private settingStore: SettingstoreService,
    private settingService: SettingService,
    private authState: AuthStateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadProducts();
    this.loadUsers();
    this.loadSales();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSettings(): void {
    this.settingStore.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        if (res) {
          this.storeSettings = {
            ...res,
            logo: res.logo ? this.settingService.getLogoUrl(res.logo) : '',
          };
        }
      });
  }

  getCurrentUsername(): string {
    const u = this.authState.user();
    if (u?.username) return u.username;
    if (u?.name) return u.name;
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.username || parsed?.name || '';
      }
    } catch {}
    return '';
  }

  private loadProducts(): void {
    this.masterService
      .getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (prods: any[]) => {
          if (Array.isArray(prods)) {
            const set = new Set<string>(this.productList);
            prods.forEach((p) => {
              if (p.product_name) set.add(p.product_name.trim());
            });
            this.productList = Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
            this.cdr.markForCheck();
          }
        },
        error: () => {},
      });
  }

  private loadUsers(): void {
    const set = new Set<string>();
    const cur = this.getCurrentUsername();
    if (cur) set.add(cur);

    this.masterService
      .getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const list = Array.isArray(res) ? res : (res?.data || []);
          list.forEach((u: any) => {
            const name = u.username || u.name;
            if (name) set.add(String(name).trim());
          });
          this.userList = Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
          this.cdr.markForCheck();
        },
        error: () => {
          this.extractUsersFromSales();
        },
      });
  }

  private extractUsersFromSales(): void {
    const set = new Set<string>(this.userList);
    const cur = this.getCurrentUsername();
    if (cur) set.add(cur);

    (this.rawSales || []).forEach((s) => {
      const u = s.cashier_name || s.username || s.user_name || s.created_by_name;
      if (u && typeof u === 'string') set.add(u.trim());
    });

    this.userList = Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  loadSales(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.masterService
      .getAllSales()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (all: any[]) => {
          this.rawSales = this.mergeWithLocalBackup(all || []);
          this.extractUsersFromSales();
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('API getAllSales error in ItemWiseReport, loading local backup:', err);
          this.rawSales = this.mergeWithLocalBackup([]);
          this.extractUsersFromSales();
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  fetchReport(): void {
    if (this.rawSales && this.rawSales.length > 0) {
      this.applyFilter();
    } else {
      this.loadSales();
    }
  }

  resetFilter(): void {
    this.fromDate = '';
    this.toDate = '';
    this.selectedProduct = '';
    this.selectedUser = '';
    this.selectedPaymentMode = '';
    this.applyFilter();
  }

  applyFilter(): void {
    const list = this.rawSales || [];
    const allRows: ItemWiseRow[] = [];
    const defaultUser = this.getCurrentUsername() || 'Counter';
    const prodSet = new Set<string>(this.productList);

    list
      .filter((s) => s.status !== 'CANCELLED')
      .filter((s) => this.matchesDateRange(s.receipt_date || s.created_at))
      .forEach((s) => {
        const inv = s.invoice_no || '-';
        const user =
          s.cashier_name || s.username || s.user_name || s.created_by_name || defaultUser;
        const pMode = s.payment_mode || 'Cash';
        const rDate = s.receipt_date || s.created_at || '';
        const items = s.items;

        if (Array.isArray(items) && items.length > 0) {
          items.forEach((it: any) => {
            const pName = it.product_name || 'Item';
            prodSet.add(pName.trim());
            const qty = Number(it.qty ?? it.quantity ?? 1);
            const amt = Number(
              it.amount ?? (it.selling_price ? Number(it.selling_price) * qty : 0) ?? 0,
            );
            allRows.push({
              item_id: it.id,
              invoice_no: inv,
              product_name: pName,
              quantity: qty > 0 ? qty : 1,
              payment_mode: pMode,
              username: user,
              receipt_date: rDate,
              total_amount: amt,
            });
          });
        } else if (s.product_names) {
          const names = String(s.product_names).split(',');
          const pieceCount = names.length;
          const billAmt = Number(s.bill_amount ?? s.total_amount ?? 0);

          names.forEach((name) => {
            const trimmed = name.trim();
            if (!trimmed) return;
            const match = trimmed.match(/^(.*?)(?:\s*\(x(\d+)\))?$/);
            const prodName = match && match[1] ? match[1].trim() : trimmed;
            const prodQty = match && match[2] ? parseInt(match[2], 10) : 1;
            const itemAmt = pieceCount > 0 ? billAmt / pieceCount : billAmt;
            prodSet.add(prodName);

            allRows.push({
              invoice_no: inv,
              product_name: prodName,
              quantity: prodQty,
              payment_mode: pMode,
              username: user,
              receipt_date: rDate,
              total_amount: itemAmt,
            });
          });
        } else {
          const pName = s.product_name || 'General Item';
          prodSet.add(pName.trim());
          allRows.push({
            invoice_no: inv,
            product_name: pName,
            quantity: Number(s.total_items || 1),
            payment_mode: pMode,
            username: user,
            receipt_date: rDate,
            total_amount: Number(s.bill_amount ?? s.total_amount ?? 0),
          });
        }
      });

    this.productList = Array.from(prodSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

    // Filter by Item, User, Payment
    this.itemsData = allRows.filter((r) => {
      // Item-wise filter
      if (this.selectedProduct) {
        if (r.product_name.toLowerCase() !== this.selectedProduct.toLowerCase()) {
          return false;
        }
      }
      // User-wise filter
      if (this.selectedUser) {
        if (r.username.toLowerCase() !== this.selectedUser.toLowerCase()) {
          return false;
        }
      }
      // Payment-wise filter
      if (this.selectedPaymentMode) {
        if (!this.matchesPaymentMode(r.payment_mode, this.selectedPaymentMode)) {
          return false;
        }
      }
      return true;
    });

    this.cdr.markForCheck();
  }

  matchesPaymentMode(mode: string, selected: string): boolean {
    if (!selected) return true;
    const m = (mode || '').toLowerCase();
    const sel = selected.toLowerCase();
    if (sel === 'ca' || sel === 'cash') return m === 'ca' || m === 'cash';
    if (sel === 'cd' || sel === 'card') return m === 'cd' || m === 'card';
    if (sel === 'up' || sel === 'upi') return m === 'up' || m === 'upi';
    if (sel === 'ch' || sel === 'cheque') return m === 'ch' || m === 'cheque';
    return m === sel;
  }

  private matchesDateRange(dateVal: any): boolean {
    if (!this.fromDate && !this.toDate) return true;
    if (!dateVal) return false;

    let rowDateStr = '';
    if (typeof dateVal === 'string') {
      const isoMatch = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        rowDateStr = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      } else {
        const ddmmyyyy = dateVal.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
        if (ddmmyyyy) {
          rowDateStr = `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
        } else {
          const d = new Date(dateVal);
          if (!isNaN(d.getTime())) {
            rowDateStr = d.toISOString().substring(0, 10);
          }
        }
      }
    } else if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      rowDateStr = dateVal.toISOString().substring(0, 10);
    }

    if (!rowDateStr) return true;

    if (this.fromDate && rowDateStr < this.fromDate) return false;
    if (this.toDate && rowDateStr > this.toDate) return false;
    return true;
  }

  formatDateDisplay(dateVal: any): string {
    if (!dateVal) return '-';
    if (typeof dateVal === 'string') {
      const isoMatch = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
      }
      const ddmmyyyy = dateVal.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
      if (ddmmyyyy) {
        return `${ddmmyyyy[1]}-${ddmmyyyy[2]}-${ddmmyyyy[3]}`;
      }
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const mon = String(d.getMonth() + 1).padStart(2, '0');
      const yr = d.getFullYear();
      return `${day}-${mon}-${yr}`;
    }
    return String(dateVal);
  }

  private mergeWithLocalBackup(serverSales: any[]): any[] {
    try {
      const raw = localStorage.getItem('store_completed_sales_backup');
      const backup: any[] = raw ? JSON.parse(raw) : [];
      const map = new Map<string, any>();

      (serverSales || []).forEach((s) => {
        if (s.invoice_no) {
          const invKey = s.invoice_no.toUpperCase();
          const localMatch = backup.find(
            (b) => b.invoice_no?.toUpperCase() === invKey,
          );
          if (localMatch) {
            if (localMatch.items && localMatch.items.length > 0) {
              s.items = s.items && s.items.length > 0 ? s.items : localMatch.items;
            }
            if (localMatch.status === 'CANCELLED') {
              s.status = 'CANCELLED';
            }
            if (!s.cashier_name && localMatch.cashier_name) {
              s.cashier_name = localMatch.cashier_name;
            }
          }
          map.set(invKey, s);
        }
      });

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

  get totalQty(): number {
    return this.itemsData.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  }

  get totalAmount(): number {
    return this.itemsData.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
  }

  getPaymentLabel(mode: string): string {
    const m = (mode || '').toLowerCase();
    if (m === 'ca' || m === 'cash') return 'Cash';
    if (m === 'cd' || m === 'card') return 'Card';
    if (m === 'up' || m === 'upi') return 'UPI';
    if (m === 'ch' || m === 'cheque') return 'Cheque';
    return mode || 'Cash';
  }

  exportExcel(): void {
    if (!this.itemsData.length) {
      alert('No data to export.');
      return;
    }

    const rows = this.itemsData.map((r, i) => ({
      'Sl No': i + 1,
      'Invoice': r.invoice_no,
      'Product Name': r.product_name,
      'Quantity': Number(r.quantity || 0),
      'Payment Mode': this.getPaymentLabel(r.payment_mode),
      'User': r.username,
      'Date': this.formatDateDisplay(r.receipt_date),
      'Total Amount': Number(r.total_amount || 0),
    }));

    rows.push({
      'Sl No': '' as any,
      'Invoice': '' as any,
      'Product Name': 'Total',
      'Quantity': this.totalQty,
      'Payment Mode': '' as any,
      'User': '' as any,
      'Date': '' as any,
      'Total Amount': this.totalAmount,
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Item-Wise Sales');
    const rangeStr = (this.fromDate || this.toDate) ? `_${this.fromDate}_to_${this.toDate}` : '_All';
    XLSX.writeFile(wb, `Item_Wise_Sales_Report${rangeStr}.xlsx`);
  }

  printReport(): void {
    const storeName = this.storeSettings?.company_name || this.storeSettings?.store_name || 'STORE MANAGEMENT SYSTEM';
    const storeAddress = this.storeSettings?.address || '';
    const dateRange = (this.fromDate || this.toDate) ? `${this.fromDate || 'Start'} to ${this.toDate || 'Present'}` : 'All Dates';
    const itemLabel = this.selectedProduct ? ` | Item: ${this.selectedProduct}` : '';
    const userLabel = this.selectedUser ? ` | User: ${this.selectedUser}` : '';
    const payLabel = this.selectedPaymentMode ? ` | Payment: ${this.getPaymentLabel(this.selectedPaymentMode)}` : '';

    const win = window.open('', '_blank', 'width=840,height=800');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Item-Wise Sales Report - ${dateRange}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px; color: #1e293b; font-size: 13px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
          .subtitle { font-size: 14px; font-weight: 600; color: #2563eb; margin-top: 4px; }
          .period { font-size: 12px; color: #64748b; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 10px; font-size: 12px; }
          th { background: #f8fafc; font-weight: 700; text-align: left; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .total-row td { background: #f1f5f9; font-weight: bold; border-top: 2px solid #334155; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${storeName}</div>
          ${storeAddress ? `<div style="font-size: 12px; color: #64748b;">${storeAddress}</div>` : ''}
          <div class="subtitle">Item-Wise Sales Report</div>
          <div class="period">Date: ${dateRange}${itemLabel}${userLabel}${payLabel} | Total Items: ${this.itemsData.length}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-center" style="width: 50px;">Sl No</th>
              <th>Invoice</th>
              <th>Product Name</th>
              <th class="text-right">Quantity</th>
              <th>Payment Mode</th>
              <th>User</th>
              <th>Date</th>
              <th class="text-right">Total Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${this.itemsData
              .map(
                (r, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td><strong>${r.invoice_no}</strong></td>
                <td>${r.product_name}</td>
                <td class="text-right font-bold">${r.quantity}</td>
                <td>${this.getPaymentLabel(r.payment_mode)}</td>
                <td>${r.username}</td>
                <td>${this.formatDateDisplay(r.receipt_date)}</td>
                <td class="text-right">₹${Number(r.total_amount || 0).toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3">Total</td>
              <td class="text-right">${this.totalQty}</td>
              <td colspan="3"></td>
              <td class="text-right">₹${this.totalAmount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `);
    win.document.close();
  }
}
