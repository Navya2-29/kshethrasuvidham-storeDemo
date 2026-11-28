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

export interface SalesBillReportRow {
  id?: number;
  invoice_no: string;
  receipt_date: string;
  payment_mode: string;
  username: string;
  cash_amount: number;
  upi_amount: number;
  cheque_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
}

@Component({
  selector: 'app-sales-bill-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sales-bill-report.component.html',
  styleUrl: './sales-bill-report.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesBillReportComponent implements OnInit, OnDestroy {
  loading = false;

  // Always show current month start from 1 and current date by default
  fromDate: string = this.getStartOfMonthDate();
  toDate: string = this.getTodayDate();
  selectedUser: string = '';
  selectedPaymentMode: string = '';

  userList: string[] = [];

  private rawSales: any[] = [];
  salesData: SalesBillReportRow[] = [];
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
    this.loadUsers();
    this.loadSales();
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

  loadUsers(): void {
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
        error: () => {},
      });
  }

  loadSales(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.masterService
      .getSalesBillReport({ from_date: this.fromDate, to_date: this.toDate })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const all = Array.isArray(res) ? res : (res?.data || []);
          this.rawSales = this.mergeWithLocalBackup(all || []);
          this.extractDropdownData();
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('API getSalesBillReport error, loading local backup:', err);
          this.rawSales = this.mergeWithLocalBackup([]);
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

    (this.rawSales || []).forEach((s) => {
      const u = s.cashier_name || s.username || s.user_name || s.created_by_name;
      if (u && typeof u === 'string') userSet.add(u.trim());
    });

    this.userList = Array.from(userSet).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  fetchReport(): void {
    this.loadSales();
  }

  showThisMonth(): void {
    this.fromDate = this.getStartOfMonthDate();
    this.toDate = this.getTodayDate();
    this.loadSales();
  }

  showAllBills(): void {
    this.fromDate = '';
    this.toDate = '';
    this.loadSales();
  }

  resetFilter(): void {
    this.fromDate = this.getStartOfMonthDate();
    this.toDate = this.getTodayDate();
    this.selectedUser = '';
    this.selectedPaymentMode = '';
    this.loadSales();
  }

  getModeAmount(row: any, mode: string): number {
    const pMode = (row.payment_mode || 'Cash').toUpperCase();
    const total = Number(row.total_amount ?? row.bill_amount ?? 0);

    switch (mode) {
      case 'CASH':
        return row.cash_amount !== undefined
          ? Number(row.cash_amount)
          : (pMode.includes('CASH') || pMode === 'CA' ? total : 0);
      case 'UPI':
        return row.upi_amount !== undefined
          ? Number(row.upi_amount)
          : (pMode.includes('UPI') || pMode === 'UP' ? total : 0);
      case 'CHEQUE':
        return row.cheque_amount !== undefined
          ? Number(row.cheque_amount)
          : (pMode.includes('CHEQUE') || pMode.includes('CHQ') || pMode === 'CH' ? total : 0);
      default:
        return 0;
    }
  }

  applyFilter(): void {
    const list = this.rawSales || [];
    const defaultUser = this.getCurrentUsername() || 'Counter';

    this.salesData = list
      .filter((s) => s.status !== 'CANCELLED')
      .filter((s) => this.matchesDateRange(s.receipt_date || s.created_at))
      .map((s) => {
        const username =
          s.cashier_name || s.username || s.user_name || s.created_by_name || defaultUser;

        const totalAmt = Number(s.total_amount ?? s.bill_amount ?? 0);

        return {
          id: s.id,
          invoice_no: s.invoice_no || '-',
          receipt_date: s.receipt_date || s.created_at || '',
          payment_mode: s.payment_mode || 'Cash',
          username: username,
          cash_amount: Number(s.cash_amount ?? this.getModeAmount(s, 'CASH')),
          upi_amount: Number(s.upi_amount ?? this.getModeAmount(s, 'UPI')),
          cheque_amount: Number(s.cheque_amount ?? this.getModeAmount(s, 'CHEQUE')),
          discount_amount: Number(s.discount_amount || 0),
          tax_amount: Number(s.tax_amount ?? s.gst_amount ?? 0),
          total_amount: totalAmt,
        };
      })
      .filter((r) => {
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
            if (localMatch.items && localMatch.items.length > 0 && (!s.items || !s.items.length)) {
              s.items = localMatch.items;
            }
            if (localMatch.status === 'CANCELLED') {
              s.status = 'CANCELLED';
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

  get totalCash(): number {
    return this.salesData.reduce((sum, r) => sum + this.getModeAmount(r, 'CASH'), 0);
  }

  get totalUpi(): number {
    return this.salesData.reduce((sum, r) => sum + this.getModeAmount(r, 'UPI'), 0);
  }

  get totalCheque(): number {
    return this.salesData.reduce((sum, r) => sum + this.getModeAmount(r, 'CHEQUE'), 0);
  }

  get totalDiscount(): number {
    return this.salesData.reduce((sum, r) => sum + Number(r.discount_amount || 0), 0);
  }

  get totalTax(): number {
    return this.salesData.reduce((sum, r) => sum + Number(r.tax_amount || 0), 0);
  }

  get grandTotal(): number {
    return this.salesData.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
  }

  exportExcel(): void {
    if (!this.salesData.length) {
      this.notification.warning('No data to export.');
      return;
    }

    const rows = this.salesData.map((r, i) => ({
      'SINO': i + 1,
      'BILL DATE': this.formatDateDisplay(r.receipt_date),
      'BILL NO': r.invoice_no,
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
      'BILL NO': 'TOTAL' as any,
      'CASH': this.totalCash,
      'UPI': this.totalUpi,
      'CHEQUE': this.totalCheque,
      'DISCOUNT': this.totalDiscount,
      'TAX / GST': this.totalTax,
      'TOTAL': this.grandTotal,
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Bill Register');
    const rangeStr = (this.fromDate || this.toDate) ? `_${this.fromDate}_to_${this.toDate}` : '_All';
    XLSX.writeFile(wb, `Sales_Bill_Register${rangeStr}.xlsx`);
  }

  printReport(): void {
    const storeName = this.getStoreName();
    const dateRange = (this.fromDate || this.toDate) ? `${this.fromDate || 'Start'} to ${this.toDate || 'Present'}` : 'All Dates';

    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sales Bill Register - ${storeName}</title>
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
          <div class="subtitle">Sales Bill Register</div>
          <div class="period">Period: ${dateRange} | Total Bills: ${this.salesData.length}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-center" style="width: 40px;">SINO</th>
              <th>BILL DATE</th>
              <th>BILL NO</th>
              <th class="text-right">CASH</th>
              <th class="text-right">UPI</th>
              <th class="text-right">CHEQUE</th>
              <th class="text-right">DISCOUNT</th>
              <th class="text-right">TAX</th>
              <th class="text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${this.salesData
              .map(
                (r, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td>${this.formatDateDisplay(r.receipt_date)}</td>
                <td class="font-bold">${r.invoice_no}</td>
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
              <td colspan="3" class="text-right">TOTAL:</td>
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
