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
import { SnackbarService } from '../../../core/services/ui/snackbar.service';
import * as XLSX from 'xlsx';

export interface PurchaseReportRow {
  id?: number;
  invoice_no: string;
  order_no?: string;
  supplier_name: string;
  product_name: string;
  receipt_date: string;
  username: string;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
}

@Component({
  selector: 'app-purchase-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './purchase-report.component.html',
  styleUrl: './purchase-report.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseReportComponent implements OnInit, OnDestroy {
  loading = false;

  // Filters (empty by default to show all records, user can filter by dates)
  fromDate: string = '';
  toDate: string = '';
  selectedItem: string = '';
  selectedUser: string = '';
  selectedSupplier: string = '';

  itemList: string[] = [];
  userList: string[] = [];
  supplierList: string[] = [];

  private rawPurchases: any[] = [];
  purchaseData: PurchaseReportRow[] = [];
  storeSettings: any = null;

  private destroy$ = new Subject<void>();

  constructor(
    private masterService: MasterService,
    private settingStore: SettingstoreService,
    private settingService: SettingService,
    private authState: AuthStateService,
    private notification: SnackbarService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadSuppliers();
    this.loadProducts();
    this.loadUsers();
    this.loadPurchases();
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
          this.applySettings(res);
        }
      });

    const snapshot = this.settingStore.getSettingsSnapshot();
    if (snapshot) {
      this.applySettings(snapshot);
    } else {
      this.settingService.getSettings().subscribe({
        next: (res) => this.applySettings(res),
        error: () => {},
      });
    }
  }

  private applySettings(res: any): void {
    if (!res) return;
    this.storeSettings = {
      ...res,
      logo: res.logo ? this.settingService.getLogoUrl(res.logo) : '',
    };
    this.cdr.markForCheck();
  }

  getStoreName(): string {
    return (
      this.storeSettings?.client_name ||
      this.storeSettings?.company_name ||
      this.storeSettings?.store_name ||
      this.storeSettings?.app_title ||
      this.storeSettings?.name ||
      'STORE MANAGEMENT SYSTEM'
    );
  }

  getStartOfMonthDate(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  getTodayDate(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  private loadSuppliers(): void {
    this.masterService
      .getSuppliers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suppliers: any[]) => {
          if (Array.isArray(suppliers)) {
            const set = new Set<string>(this.supplierList);
            suppliers.forEach((s) => {
              if (s.supplier_name) set.add(s.supplier_name.trim());
            });
            this.supplierList = Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
            this.cdr.markForCheck();
          }
        },
        error: () => {},
      });
  }

  private loadProducts(): void {
    this.masterService
      .getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (prods: any[]) => {
          if (Array.isArray(prods)) {
            const set = new Set<string>(this.itemList);
            prods.forEach((p) => {
              if (p.product_name) set.add(p.product_name.trim());
            });
            this.itemList = Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
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
          this.extractDropdownData();
        },
      });
  }

  loadPurchases(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.masterService
      .getPurchaseReport({ from_date: this.fromDate, to_date: this.toDate })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const all = Array.isArray(res) ? res : (res?.data || []);
          this.rawPurchases = this.mergeWithLocalPurchases(all || []);
          this.extractDropdownData();
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('API getPurchaseReport error in PurchaseReport, loading local backup:', err);
          this.rawPurchases = this.mergeWithLocalPurchases([]);
          this.extractDropdownData();
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private extractDropdownData(): void {
    const curUser = this.getCurrentUsername();
    const userSet = new Set<string>(this.userList);
    if (curUser) userSet.add(curUser);

    const supSet = new Set<string>(this.supplierList);
    const itemSet = new Set<string>(this.itemList);

    (this.rawPurchases || []).forEach((p) => {
      const u = p.created_by_name || p.username || p.user_name || p.created_by;
      if (u && typeof u === 'string') userSet.add(u.trim());

      const s = p.supplier_name;
      if (s && typeof s === 'string') supSet.add(s.trim());

      if (p.product_names) {
        String(p.product_names).split(',').forEach((part) => {
          const cleaned = part.replace(/\(x\d+\)/g, '').trim();
          if (cleaned) itemSet.add(cleaned);
        });
      }
      if (Array.isArray(p.items)) {
        p.items.forEach((it: any) => {
          if (it.product_name) itemSet.add(it.product_name.trim());
        });
      }
    });

    this.userList = Array.from(userSet).filter(Boolean).sort((a, b) => a.localeCompare(b));
    this.supplierList = Array.from(supSet).filter(Boolean).sort((a, b) => a.localeCompare(b));
    this.itemList = Array.from(itemSet).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  fetchReport(): void {
    this.loadPurchases();
  }

  resetFilter(): void {
    this.fromDate = '';
    this.toDate = '';
    this.selectedItem = '';
    this.selectedUser = '';
    this.selectedSupplier = '';
    this.loadPurchases();
  }

  applyFilter(): void {
    const list = this.rawPurchases || [];
    const defaultUser = this.getCurrentUsername() || 'Admin';

    this.purchaseData = list
      .filter((p) => p.status !== 'CANCELLED')
      .filter((p) => this.matchesDateRange(p.receipt_date || p.invoice_date || p.created_at))
      .map((p) => {
        let prods = p.product_names;
        if (!prods && p.items && Array.isArray(p.items) && p.items.length > 0) {
          prods = p.items.map((it: any) => it.product_name).filter(Boolean).join(', ');
        }
        if (!prods && p.total_items) {
          prods = `${p.total_items} items`;
        }

        const username =
          p.created_by_name || p.username || p.user_name || defaultUser;

        const disc = Number(p.discount_amount || 0);
        let tax = Number(p.gst_amount || 0);
        if (!tax && p.items && Array.isArray(p.items)) {
          tax = p.items.reduce((sum: number, it: any) => sum + (Number(it.cgst || 0) + Number(it.sgst || 0)), 0);
        }

        return {
          id: p.id,
          invoice_no: p.invoice_no || p.order_no || '-',
          order_no: p.order_no,
          supplier_name: p.supplier_name || 'General Supplier',
          product_name: prods || 'General Purchase',
          receipt_date: p.receipt_date || p.invoice_date || p.created_at || '',
          username: username,
          discount_amount: disc,
          tax_amount: tax,
          total_amount: Number(p.bill_amount ?? p.total_amount ?? 0),
        };
      })
      .filter((r) => {
        // Item-wise filter
        if (this.selectedItem) {
          const itemLower = this.selectedItem.toLowerCase();
          if (!r.product_name.toLowerCase().includes(itemLower)) {
            return false;
          }
        }
        // User filter
        if (this.selectedUser) {
          if (r.username.toLowerCase() !== this.selectedUser.toLowerCase()) {
            return false;
          }
        }
        // Supplier filter
        if (this.selectedSupplier) {
          if (r.supplier_name.toLowerCase() !== this.selectedSupplier.toLowerCase()) {
            return false;
          }
        }
        return true;
      });

    this.cdr.markForCheck();
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

  private mergeWithLocalPurchases(serverPurchases: any[]): any[] {
    try {
      const raw = localStorage.getItem('store_completed_purchases_backup');
      const backup: any[] = raw ? JSON.parse(raw) : [];
      const map = new Map<string, any>();

      (serverPurchases || []).forEach((p) => {
        if (p.invoice_no) {
          map.set(p.invoice_no.toUpperCase(), p);
        }
      });

      backup.forEach((b) => {
        if (b.invoice_no && !map.has(b.invoice_no.toUpperCase())) {
          map.set(b.invoice_no.toUpperCase(), b);
        }
      });

      return Array.from(map.values()).sort((a, b) => {
        const dateA = new Date(a.receipt_date || a.invoice_date || a.created_at || 0).getTime();
        const dateB = new Date(b.receipt_date || b.invoice_date || b.created_at || 0).getTime();
        return dateB - dateA;
      });
    } catch {
      return serverPurchases || [];
    }
  }

  get totalDiscount(): number {
    return this.purchaseData.reduce((sum, r) => sum + Number(r.discount_amount || 0), 0);
  }

  get totalTax(): number {
    return this.purchaseData.reduce((sum, r) => sum + Number(r.tax_amount || 0), 0);
  }

  get grandTotal(): number {
    return this.purchaseData.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
  }

  exportExcel(): void {
    if (!this.purchaseData.length) {
      this.notification.warning('No data to export.');
      return;
    }

    const rows = this.purchaseData.map((r, i) => ({
      'Sl No': i + 1,
      'Invoice Number': r.invoice_no,
      'Supplier': r.supplier_name,
      'Product Name': r.product_name,
      'Date': this.formatDateDisplay(r.receipt_date),
      'User': r.username,
      'Discount (₹)': Number(r.discount_amount || 0),
      'Tax / GST (₹)': Number(r.tax_amount || 0),
      'Total Amount (₹)': Number(r.total_amount || 0),
    }));

    rows.push({
      'Sl No': '' as any,
      'Invoice Number': '' as any,
      'Supplier': '' as any,
      'Product Name': 'Total',
      'Date': '' as any,
      'User': '' as any,
      'Discount (₹)': this.totalDiscount,
      'Tax / GST (₹)': this.totalTax,
      'Total Amount (₹)': this.grandTotal,
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Report');
    const rangeStr = (this.fromDate || this.toDate) ? `_${this.fromDate}_to_${this.toDate}` : '_All';
    XLSX.writeFile(wb, `Purchase_Report${rangeStr}.xlsx`);
  }

  printReport(): void {
    const storeName = this.getStoreName();
    const storeAddress = this.storeSettings?.address || '';
    const storePhone = this.storeSettings?.phone || '';
    const dateRange = (this.fromDate || this.toDate) ? `${this.fromDate || 'Start'} to ${this.toDate || 'Present'}` : 'All Dates';
    const itemLabel = this.selectedItem ? ` | Item: ${this.selectedItem}` : '';
    const userLabel = this.selectedUser ? ` | User: ${this.selectedUser}` : '';
    const supLabel = this.selectedSupplier ? ` | Supplier: ${this.selectedSupplier}` : '';

    const win = window.open('', '_blank', 'width=920,height=800');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Report - ${storeName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px; color: #1e293b; font-size: 13px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; }
          .address { font-size: 12px; color: #475569; margin-top: 3px; }
          .phone { font-size: 11px; color: #64748b; margin-top: 2px; }
          .subtitle { font-size: 14px; font-weight: 700; color: #2563eb; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
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
          ${storeAddress ? `<div class="address">${storeAddress}</div>` : ''}
          ${storePhone ? `<div class="phone">Phone: ${storePhone}</div>` : ''}
          <div class="subtitle">Purchase Report</div>
          <div class="period">Period: ${dateRange}${itemLabel}${userLabel}${supLabel} | Total Records: ${this.purchaseData.length}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-center" style="width: 45px;">Sl No</th>
              <th>Invoice Number</th>
              <th>Supplier</th>
              <th>Product Name</th>
              <th>Date</th>
              <th>User</th>
              <th class="text-right">Discount (₹)</th>
              <th class="text-right">Tax / GST (₹)</th>
              <th class="text-right">Total Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${this.purchaseData
              .map(
                (r, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td><strong>${r.invoice_no}</strong></td>
                <td>${r.supplier_name}</td>
                <td>${r.product_name}</td>
                <td>${this.formatDateDisplay(r.receipt_date)}</td>
                <td>${r.username}</td>
                <td class="text-right">₹${Number(r.discount_amount || 0).toFixed(2)}</td>
                <td class="text-right">₹${Number(r.tax_amount || 0).toFixed(2)}</td>
                <td class="text-right font-bold">₹${Number(r.total_amount || 0).toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="6">Total</td>
              <td class="text-right">₹${this.totalDiscount.toFixed(2)}</td>
              <td class="text-right">₹${this.totalTax.toFixed(2)}</td>
              <td class="text-right">₹${this.grandTotal.toFixed(2)}</td>
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
