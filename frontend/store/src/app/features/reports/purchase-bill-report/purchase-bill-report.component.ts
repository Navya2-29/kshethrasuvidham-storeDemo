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

export interface PurchaseBillReportRow {
  id?: number;
  invoice_no: string;
  order_no?: string;
  supplier_name: string;
  receipt_date: string;
  username: string;
  payment_mode?: string;
  cash_amount: number;
  upi_amount: number;
  cheque_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
}

@Component({
  selector: 'app-purchase-bill-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './purchase-bill-report.component.html',
  styleUrl: './purchase-bill-report.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseBillReportComponent implements OnInit, OnDestroy {
  loading = false;

  // Always show current month start from 1 and current date by default
  fromDate: string = this.getStartOfMonthDate();
  toDate: string = this.getTodayDate();
  selectedUser: string = '';
  selectedSupplier: string = '';
  selectedPaymentMode: string = '';

  userList: string[] = [];
  supplierList: string[] = [];

  private rawPurchases: any[] = [];
  purchaseData: PurchaseBillReportRow[] = [];
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
    this.loadUsers();
    this.loadPurchases();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
      .getPurchaseBillReport({ from_date: this.fromDate, to_date: this.toDate })
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
          console.warn('API getPurchaseBillReport error, loading local backup:', err);
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

    (this.rawPurchases || []).forEach((p) => {
      const u = p.created_by_name || p.username || p.user_name || p.created_by;
      if (u && typeof u === 'string') userSet.add(u.trim());

      const s = p.supplier_name;
      if (s && typeof s === 'string') supSet.add(s.trim());
    });

    this.userList = Array.from(userSet).filter(Boolean).sort((a, b) => a.localeCompare(b));
    this.supplierList = Array.from(supSet).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  fetchReport(): void {
    this.loadPurchases();
  }

  showThisMonth(): void {
    this.fromDate = this.getStartOfMonthDate();
    this.toDate = this.getTodayDate();
    this.loadPurchases();
  }

  showAllBills(): void {
    this.fromDate = '';
    this.toDate = '';
    this.loadPurchases();
  }

  resetFilter(): void {
    this.fromDate = this.getStartOfMonthDate();
    this.toDate = this.getTodayDate();
    this.selectedUser = '';
    this.selectedSupplier = '';
    this.selectedPaymentMode = '';
    this.loadPurchases();
  }

  getModeAmount(row: any, mode: string): number {
    const modeKey = mode.toUpperCase();
    if (modeKey === 'CASH' && row.cash_amount !== undefined && Number(row.cash_amount) > 0) return Number(row.cash_amount);
    if (modeKey === 'UPI' && row.upi_amount !== undefined && Number(row.upi_amount) > 0) return Number(row.upi_amount);
    if (modeKey === 'CHEQUE' && row.cheque_amount !== undefined && Number(row.cheque_amount) > 0) return Number(row.cheque_amount);

    const pm = String(row.payment_mode || '').trim().toUpperCase();
    const total = Number(row.total_amount || 0);

    if (modeKey === 'CASH') {
      if (pm.includes('CASH') || pm === 'CA' || !pm) return total;
    } else if (modeKey === 'UPI') {
      if (pm.includes('UPI') || pm === 'UP') return total;
    } else if (modeKey === 'CHEQUE') {
      if (pm.includes('CHEQUE') || pm.includes('CHQ') || pm === 'CH') return total;
    }
    return 0;
  }

  applyFilter(): void {
    const list = this.rawPurchases || [];
    const defaultUser = this.getCurrentUsername() || 'Admin';

    this.purchaseData = list
      .filter((p) => p.status !== 'CANCELLED')
      .filter((p) => this.matchesDateRange(p.receipt_date || p.invoice_date || p.created_at))
      .map((p) => {
        const username =
          p.created_by_name || p.username || p.user_name || defaultUser;

        const disc = Number(p.discount_amount || 0);
        let tax = Number(p.tax_amount ?? p.gst_amount ?? 0);
        if (!tax && p.items && Array.isArray(p.items)) {
          tax = p.items.reduce((sum: number, it: any) => sum + (Number(it.cgst || 0) + Number(it.sgst || 0)), 0);
        }

        const totalAmount = Number(p.bill_amount ?? p.total_amount ?? 0);
        const pMode = String(p.payment_mode || 'Cash').trim();

        return {
          id: p.id,
          invoice_no: p.invoice_no || p.order_no || '-',
          order_no: p.order_no,
          supplier_name: p.supplier_name || 'General Supplier',
          receipt_date: p.receipt_date || p.invoice_date || p.created_at || '',
          username: username,
          payment_mode: pMode,
          cash_amount: Number(p.cash_amount ?? (pMode.toUpperCase().includes('CASH') ? totalAmount : 0)),
          upi_amount: Number(p.upi_amount ?? (pMode.toUpperCase().includes('UPI') ? totalAmount : 0)),
          cheque_amount: Number(p.cheque_amount ?? (pMode.toUpperCase().includes('CHEQUE') || pMode.toUpperCase().includes('CHQ') ? totalAmount : 0)),
          discount_amount: disc,
          tax_amount: tax,
          total_amount: totalAmount,
        };
      })
      .filter((r) => {
        if (this.selectedSupplier) {
          if (r.supplier_name.toLowerCase() !== this.selectedSupplier.toLowerCase()) {
            return false;
          }
        }
        if (this.selectedUser) {
          if (r.username.toLowerCase() !== this.selectedUser.toLowerCase()) {
            return false;
          }
        }
        if (this.selectedPaymentMode) {
          const pm = (r.payment_mode || '').toLowerCase();
          const target = this.selectedPaymentMode.toLowerCase();
          if (!pm.includes(target) && target !== 'all') {
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
    let d: Date | null = null;
    if (typeof dateVal === 'string') {
      const isoMatch = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
      }
      d = new Date(dateVal);
    } else if (dateVal instanceof Date) {
      d = dateVal;
    }
    if (d && !isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
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

  get totalCash(): number {
    return this.purchaseData.reduce((sum, r) => sum + this.getModeAmount(r, 'CASH'), 0);
  }

  get totalUpi(): number {
    return this.purchaseData.reduce((sum, r) => sum + this.getModeAmount(r, 'UPI'), 0);
  }

  get totalCheque(): number {
    return this.purchaseData.reduce((sum, r) => sum + this.getModeAmount(r, 'CHEQUE'), 0);
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
      'SINO': i + 1,
      'BILL DATE': this.formatDateDisplay(r.receipt_date),
      'BILL NO': r.invoice_no,
      'SUPPLIER': r.supplier_name,
      'CASH': this.getModeAmount(r, 'CASH'),
      'UPI': this.getModeAmount(r, 'UPI'),
      'CHEQUE': this.getModeAmount(r, 'CHEQUE'),
      'DISCOUNT': Number(r.discount_amount || 0),
      'TAX / GST': Number(r.tax_amount || 0),
      'TOTAL': Number(r.total_amount || 0),
    }));

    rows.push({
      'SINO': '' as any,
      'BILL DATE': '' as any,
      'BILL NO': '' as any,
      'SUPPLIER': 'TOTAL' as any,
      'CASH': this.totalCash,
      'UPI': this.totalUpi,
      'CHEQUE': this.totalCheque,
      'DISCOUNT': this.totalDiscount,
      'TAX / GST': this.totalTax,
      'TOTAL': this.grandTotal,
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Bill Register');
    const rangeStr = (this.fromDate || this.toDate) ? `_${this.fromDate}_to_${this.toDate}` : '_All';
    XLSX.writeFile(wb, `Purchase_Bill_Register${rangeStr}.xlsx`);
  }

  printReport(): void {
    const storeName = this.getStoreName();
    const dateRange = (this.fromDate || this.toDate) ? `${this.fromDate || 'Start'} to ${this.toDate || 'Present'}` : 'All Dates';
    const supLabel = this.selectedSupplier ? ` | Supplier: ${this.selectedSupplier}` : '';

    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Bill Register - ${storeName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px; color: #1e293b; font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; }
          .subtitle { font-size: 14px; font-weight: 700; color: #1e3a5f; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
          .period { font-size: 12px; color: #64748b; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; }
          thead tr { background: #1b3248 !important; }
          th { color: #ffffff !important; font-weight: 700; text-align: left; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .total-row td { background: #f1f5f9; font-weight: bold; border-top: 2px solid #1b3248; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${storeName}</div>
          <div class="subtitle">Purchase Bill Register</div>
          <div class="period">Period: ${dateRange}${supLabel} | Total Bills: ${this.purchaseData.length}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-center" style="width: 40px;">SINO</th>
              <th>BILL DATE</th>
              <th>BILL NO</th>
              <th>SUPPLIER</th>
              <th class="text-right">CASH</th>
              <th class="text-right">UPI</th>
              <th class="text-right">CHEQUE</th>
              <th class="text-right">DISCOUNT</th>
              <th class="text-right">TAX / GST</th>
              <th class="text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${this.purchaseData
              .map(
                (r, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td>${this.formatDateDisplay(r.receipt_date)}</td>
                <td class="font-bold">${r.invoice_no}</td>
                <td>${r.supplier_name}</td>
                <td class="text-right">${this.getModeAmount(r, 'CASH').toFixed(2)}</td>
                <td class="text-right">${this.getModeAmount(r, 'UPI').toFixed(2)}</td>
                <td class="text-right">${this.getModeAmount(r, 'CHEQUE').toFixed(2)}</td>
                <td class="text-right">${Number(r.discount_amount || 0).toFixed(2)}</td>
                <td class="text-right">${Number(r.tax_amount || 0).toFixed(2)}</td>
                <td class="text-right font-bold">${Number(r.total_amount || 0).toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="4" class="text-right">TOTAL:</td>
              <td class="text-right">${this.totalCash.toFixed(2)}</td>
              <td class="text-right">${this.totalUpi.toFixed(2)}</td>
              <td class="text-right">${this.totalCheque.toFixed(2)}</td>
              <td class="text-right">${this.totalDiscount.toFixed(2)}</td>
              <td class="text-right">${this.totalTax.toFixed(2)}</td>
              <td class="text-right font-bold">₹${this.grandTotal.toFixed(2)}</td>
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
