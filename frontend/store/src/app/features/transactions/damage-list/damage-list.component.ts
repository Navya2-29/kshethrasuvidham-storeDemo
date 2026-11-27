import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MasterService } from '../../../core/services/masters/master.service';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { SnackbarService } from '../../../core/services/ui/snackbar.service';
import { SettingstoreService } from '../../../core/services/setting/settingstore.service';
import { SettingService } from '../../../core/services/setting/setting.service';
import { Product } from '../../masters/models/product.model';
import { Department } from '../../masters/models/department.model';

export interface DamageRecord {
  id: number;
  damage_no: string;
  product_id: number;
  product_name?: string;
  product_code?: string;
  unit?: string;
  department_id?: number | null;
  dept_name?: string;
  damaged_qty: number;
  cost_price: number;
  selling_price?: number;
  total_loss: number;
  damage_type: string;
  damage_date: string;
  remarks?: string;
  created_by?: number | null;
  reported_by_name?: string;
  created_at?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-damage-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatInputModule,
    RouterModule,
  ],
  templateUrl: './damage-list.component.html',
  styleUrl: './damage-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DamageListComponent implements OnInit, OnDestroy {
  damageRecords: DamageRecord[] = [];
  filteredRecords: DamageRecord[] = [];
  loading = false;
  saving = false;

  // Filters
  searchText = '';
  selectedTypeFilter: string = 'ALL';
  selectedDateFilter: 'ALL' | 'TODAY' | 'MONTH' = 'ALL';

  readonly damageTypes = [
    { value: 'Broken', label: 'Broken / Damaged', color: '#ef4444' },
    { value: 'Expired', label: 'Expired', color: '#f59e0b' },
    { value: 'Transit', label: 'Transit Damage', color: '#3b82f6' },
    { value: 'Water', label: 'Water / Weather', color: '#06b6d4' },
    { value: 'Defect', label: 'Manufacturer Defect', color: '#8b5cf6' },
    { value: 'Other', label: 'Other Loss', color: '#64748b' },
  ];

  // Mat Table
  displayedColumns: string[] = [
    'index',
    'damage_no',
    'product',
    'department',
    'damaged_qty',
    'damage_type',
    'total_loss',
    'damage_date',
    'reported_by',
    'action',
  ];
  dataSource = new MatTableDataSource<DamageRecord>([]);

  // Master Data
  products: Product[] = [];
  departments: Department[] = [];

  // Report Damage Modal Form
  showReportModal = false;
  selectedProduct: Product | null = null;
  formDepartmentId: number | null = null;
  formProductId: number | null = null;
  formDamagedQty: number | null = 1;
  formDamageType: string = 'Broken';
  formDamageDate: string = this.getTodayDate();
  formRemarks: string = '';

  // Details Modal
  selectedRecord: DamageRecord | null = null;

  // Store Settings for Slip Printing
  settings: any = null;

  private destroy$ = new Subject<void>();
  private readonly BACKUP_STORAGE_KEY = 'store_damage_records_backup';

  constructor(
    private masterService: MasterService,
    private authState: AuthStateService,
    private snackbarService: SnackbarService,
    private settingStore: SettingstoreService,
    private settingService: SettingService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadProducts();
    this.loadDepartments();
    this.loadDamageRecords();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ========================================================
     MASTER & SETTINGS LOADING
  ======================================================== */

  private loadSettings(): void {
    this.settingStore.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        if (res) {
          this.settings = {
            ...res,
            logo: res.logo ? this.settingService.getLogoUrl(res.logo) : '',
          };
        }
      });
  }

  loadProducts(): void {
    this.masterService
      .getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (prods: Product[]) => {
          this.products = prods || [];
          this.cdr.markForCheck();
        },
        error: (err) => console.warn('Could not load products', err),
      });
  }

  loadDepartments(): void {
    this.masterService
      .getDepartments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depts: Department[]) => {
          this.departments = depts || [];
          this.cdr.markForCheck();
        },
        error: (err) => console.warn('Could not load departments', err),
      });
  }

  /* ========================================================
     DATA LOADING & STORAGE
  ======================================================== */

  loadDamageRecords(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.masterService
      .getDamageRecords()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          const apiRecords = Array.isArray(res) ? res : [];
          const localBackups = this.getLocalDamageBackups();

          // Merge without duplicate damage_no or id
          const mergedMap = new Map<string, DamageRecord>();

          // Add local first
          localBackups.forEach((rec) => {
            const key = rec.damage_no || `ID_${rec.id}`;
            mergedMap.set(key, rec);
          });

          // API records take precedence for live server data
          apiRecords.forEach((rec) => {
            const key = rec.damage_no || `ID_${rec.id}`;
            mergedMap.set(key, { ...mergedMap.get(key), ...rec });
          });

          this.damageRecords = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.damage_date || b.created_at || '').getTime() - new Date(a.damage_date || a.created_at || '').getTime()
          );

          this.applyFilters();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('API error loading damage records, using local backup', err);
          this.damageRecords = this.getLocalDamageBackups();
          this.applyFilters();
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private getLocalDamageBackups(): DamageRecord[] {
    try {
      const raw = localStorage.getItem(this.BACKUP_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalDamageBackup(record: DamageRecord): void {
    try {
      const current = this.getLocalDamageBackups();
      const filtered = current.filter(
        (r) => r.damage_no !== record.damage_no && r.id !== record.id
      );
      filtered.unshift(record);
      localStorage.setItem(this.BACKUP_STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Failed to save damage backup to localStorage', e);
    }
  }

  /* ========================================================
     FILTERS & SEARCH
  ======================================================== */

  applyFilters(): void {
    let list = [...this.damageRecords];

    // Search text
    if (this.searchText && this.searchText.trim()) {
      const query = this.searchText.trim().toLowerCase();
      list = list.filter((r) => {
        const dNo = (r.damage_no || '').toLowerCase();
        const pName = (r.product_name || '').toLowerCase();
        const pCode = (r.product_code || '').toLowerCase();
        const dept = (r.dept_name || 'Main Store').toLowerCase();
        const reason = (r.damage_type || '').toLowerCase();
        const rem = (r.remarks || '').toLowerCase();
        const user = (r.reported_by_name || '').toLowerCase();

        return (
          dNo.includes(query) ||
          pName.includes(query) ||
          pCode.includes(query) ||
          dept.includes(query) ||
          reason.includes(query) ||
          rem.includes(query) ||
          user.includes(query)
        );
      });
    }

    // Type filter
    if (this.selectedTypeFilter && this.selectedTypeFilter !== 'ALL') {
      list = list.filter(
        (r) => (r.damage_type || '').toLowerCase() === this.selectedTypeFilter.toLowerCase()
      );
    }

    // Date filter
    const now = new Date();
    const todayStr = this.getTodayDate();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (this.selectedDateFilter === 'TODAY') {
      list = list.filter((r) => (r.damage_date || '').startsWith(todayStr));
    } else if (this.selectedDateFilter === 'MONTH') {
      list = list.filter((r) => (r.damage_date || '').startsWith(currentMonthPrefix));
    }

    this.filteredRecords = list;
    this.dataSource.data = list;
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  setTypeFilter(type: string): void {
    this.selectedTypeFilter = type;
    this.applyFilters();
  }

  setDateFilter(filter: 'ALL' | 'TODAY' | 'MONTH'): void {
    this.selectedDateFilter = filter;
    this.applyFilters();
  }

  /* ========================================================
     SUMMARY METRICS
  ======================================================== */

  get totalDamageCount(): number {
    return this.filteredRecords.length;
  }

  get totalUnitsDamaged(): number {
    return this.filteredRecords.reduce(
      (sum, r) => sum + (Number(r.damaged_qty) || 0),
      0
    );
  }

  get totalFinancialLoss(): number {
    return this.filteredRecords.reduce(
      (sum, r) => sum + (Number(r.total_loss) || (Number(r.cost_price || 0) * Number(r.damaged_qty || 0))),
      0
    );
  }

  /* ========================================================
     REPORT DAMAGE MODAL ACTIONS
  ======================================================== */

  openReportModal(): void {
    this.formDepartmentId = null;
    this.formProductId = null;
    this.selectedProduct = null;
    this.formDamagedQty = 1;
    this.formDamageType = 'Broken';
    this.formDamageDate = this.getTodayDate();
    this.formRemarks = '';
    this.showReportModal = true;
    this.cdr.markForCheck();
  }

  closeReportModal(): void {
    this.showReportModal = false;
    this.selectedProduct = null;
    this.cdr.markForCheck();
  }

  onProductChange(): void {
    const pId = Number(this.formProductId);
    this.selectedProduct = this.products.find((p) => p.id === pId) || null;
    this.cdr.markForCheck();
  }

  getProductStock(prod: Product | null): number {
    if (!prod) return 0;
    const baseStock = Number((prod as any).current_stock ?? (prod as any).stock ?? (prod as any).opening_stock ?? 0);
    const adj = this.masterService.getStockAdjustment(prod.id);
    return Math.max(0, baseStock + adj);
  }

  get estimatedFinancialLoss(): number {
    if (!this.selectedProduct || !this.formDamagedQty) return 0;
    const cost = Number(this.selectedProduct.cost_price || 0);
    const qty = Number(this.formDamagedQty || 0);
    return cost * qty;
  }

  submitDamageReport(): void {
    if (!this.formProductId) {
      this.snackbarService.error('Please select a product.');
      return;
    }

    const qty = Number(this.formDamagedQty);
    if (!qty || qty <= 0) {
      this.snackbarService.error('Please enter a valid damaged quantity.');
      return;
    }

    const product = this.products.find((p) => p.id === Number(this.formProductId));
    if (!product) {
      this.snackbarService.error('Product not found.');
      return;
    }

    const availableStock = this.getProductStock(product);
    if (availableStock <= 0) {
      this.snackbarService.error('Current available stock is 0. Product quantity cannot be negative.');
      return;
    }
    if (qty > availableStock) {
      this.snackbarService.error(
        `Damaged quantity (${qty}) exceeds available stock (${availableStock}). Product quantity cannot be negative.`
      );
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    const currentUser = this.authState.user();
    const dept = this.departments.find((d) => d.id === Number(this.formDepartmentId));
    const costPrice = Number(product.cost_price || 0);
    const sellingPrice = Number(product.selling_price || 0);
    const totalLoss = Number((costPrice * qty).toFixed(2));
    const today = this.formDamageDate || this.getTodayDate();

    // Auto-generate damage ref number for client (e.g. DMG-0001)
    const seq = String(this.damageRecords.length + 1).padStart(4, '0');
    const localDamageNo = `DMG-${seq}`;

    const payload = {
      damage_no: localDamageNo,
      product_id: product.id,
      department_id: this.formDepartmentId || null,
      damaged_qty: qty,
      damage_type: this.formDamageType,
      damage_date: today,
      remarks: this.formRemarks.trim(),
      created_by: currentUser?.id || null,
    };

    const newLocalRecord: DamageRecord = {
      id: Date.now(),
      damage_no: localDamageNo,
      product_id: product.id,
      product_name: product.product_name,
      product_code: product.product_code,
      unit: product.unit || 'Nos',
      department_id: this.formDepartmentId || null,
      dept_name: dept?.dept_name || 'Main Store',
      damaged_qty: qty,
      cost_price: costPrice,
      selling_price: sellingPrice,
      total_loss: totalLoss,
      damage_type: this.formDamageType,
      damage_date: today,
      remarks: this.formRemarks.trim(),
      created_by: currentUser?.id || null,
      reported_by_name: currentUser?.username || 'Current User',
      created_at: new Date().toISOString(),
    };

    // 1. Immediately deduct stock locally and broadcast across the app
    this.masterService.recordStockAdjustment(product.id, -qty);
    this.masterService.notifyStockUpdated({
      type: 'STOCK_CHANGED',
      departmentId: this.formDepartmentId ? Number(this.formDepartmentId) : undefined,
      items: [{ product_id: product.id, qty: -qty }],
    });

    // 2. Persist local backup
    this.saveLocalDamageBackup(newLocalRecord);

    // 3. Post to API
    this.masterService
      .createDamageRecord(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (apiRes: any) => {
          if (apiRes && apiRes.damage_no) {
            newLocalRecord.damage_no = apiRes.damage_no;
            newLocalRecord.id = apiRes.id || newLocalRecord.id;
            this.saveLocalDamageBackup(newLocalRecord);
          }

          this.saving = false;
          this.snackbarService.success(
            `Damaged stock recorded: ${qty} ${product.unit || 'units'} of "${product.product_name}"`
          );
          this.closeReportModal();
          this.loadDamageRecords();
        },
        error: (err) => {
          console.warn('Damage API failed; fallback to local record', err);
          this.saving = false;
          this.snackbarService.success(
            `Damaged stock saved locally: ${qty} units of "${product.product_name}"`
          );
          this.closeReportModal();
          this.loadDamageRecords();
        },
      });
  }

  /* ========================================================
     DETAILS MODAL
  ======================================================== */

  viewDetails(record: DamageRecord): void {
    this.selectedRecord = record;
    this.cdr.markForCheck();
  }

  closeDetails(): void {
    this.selectedRecord = null;
    this.cdr.markForCheck();
  }

  /* ========================================================
     PRINT WRITE-OFF VOUCHER
  ======================================================== */

  printDamageSlip(record: DamageRecord): void {
    const storeName = this.settings?.company_name || this.settings?.store_name || 'STORE MANAGEMENT SYSTEM';
    const storeAddress = this.settings?.address || '';
    const storePhone = this.settings?.phone || this.settings?.mobile || '';
    const storeLogo = this.settings?.logo || '';

    const win = window.open('', '_blank', 'width=720,height=800');
    if (!win) return;

    const damageDate = record.damage_date
      ? new Date(record.damage_date).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        })
      : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Damage Write-off Slip - ${record.damage_no}</title>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          body { padding: 24px; color: #1e293b; background: #fff; font-size: 13px; }
          .voucher-container { max-width: 650px; margin: 0 auto; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 24px; }
          .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 16px; margin-bottom: 20px; }
          .logo { max-height: 50px; margin-bottom: 8px; }
          .store-name { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
          .store-sub { font-size: 12px; color: #64748b; margin-top: 3px; }
          .badge-banner { display: inline-block; background: #fee2e2; color: #991b1b; padding: 4px 14px; border-radius: 20px; font-weight: 700; font-size: 12px; margin-top: 10px; border: 1px solid #fecaca; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 14px; border-radius: 6px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
          .meta-row { display: flex; justify-content: space-between; font-size: 12.5px; padding: 2px 0; }
          .meta-label { color: #64748b; font-weight: 500; }
          .meta-value { color: #0f172a; font-weight: 600; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .items-table th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 12px; font-weight: 700; color: #334155; border: 1px solid #cbd5e1; }
          .items-table td { padding: 10px; border: 1px solid #cbd5e1; font-size: 13px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .loss-box { display: flex; justify-content: flex-end; margin-bottom: 24px; }
          .loss-card { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px 18px; text-align: right; min-width: 200px; }
          .loss-label { font-size: 11px; text-transform: uppercase; color: #991b1b; font-weight: 700; letter-spacing: 0.5px; }
          .loss-value { font-size: 18px; font-weight: 800; color: #b91c1c; margin-top: 4px; }
          .remarks-section { background: #f8fafc; border-left: 3px solid #f59e0b; padding: 10px 14px; margin-bottom: 28px; border-radius: 0 4px 4px 0; font-size: 12px; }
          .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 20px; }
          .sign-box { text-align: center; }
          .sign-line { border-top: 1px solid #94a3b8; margin-bottom: 6px; }
          .sign-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
          @media print {
            body { padding: 0; background: none; }
            .voucher-container { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="voucher-container">
          <div class="header">
            ${storeLogo ? `<img src="${storeLogo}" class="logo" alt="Logo" />` : ''}
            <div class="store-name">${storeName}</div>
            ${storeAddress ? `<div class="store-sub">${storeAddress}</div>` : ''}
            ${storePhone ? `<div class="store-sub">Phone: ${storePhone}</div>` : ''}
            <div class="badge-banner">DAMAGE & STOCK WRITE-OFF SLIP</div>
          </div>

          <div class="meta-grid">
            <div>
              <div class="meta-row"><span class="meta-label">Damage No:</span> <span class="meta-value">${record.damage_no}</span></div>
              <div class="meta-row"><span class="meta-label">Date:</span> <span class="meta-value">${damageDate}</span></div>
              <div class="meta-row"><span class="meta-label">Department:</span> <span class="meta-value">${record.dept_name || 'Main Store'}</span></div>
            </div>
            <div>
              <div class="meta-row"><span class="meta-label">Damage Type:</span> <span class="meta-value">${record.damage_type}</span></div>
              <div class="meta-row"><span class="meta-label">Reported By:</span> <span class="meta-value">${record.reported_by_name || 'Staff'}</span></div>
              <div class="meta-row"><span class="meta-label">Status:</span> <span class="meta-value" style="color: #ef4444;">DEDUCTED FROM STOCK</span></div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 50px;" class="text-center">#</th>
                <th>Product Description</th>
                <th class="text-center">Code</th>
                <th class="text-right">Damaged Qty</th>
                <th class="text-right">Cost Price (₹)</th>
                <th class="text-right">Total Loss (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center">1</td>
                <td>
                  <strong>${record.product_name || 'Product'}</strong>
                  <div style="font-size: 11px; color: #64748b;">Reason: ${record.damage_type}</div>
                </td>
                <td class="text-center">${record.product_code || '-'}</td>
                <td class="text-right"><strong>${record.damaged_qty}</strong> ${record.unit || 'Nos'}</td>
                <td class="text-right">₹${Number(record.cost_price || 0).toFixed(2)}</td>
                <td class="text-right" style="color: #b91c1c; font-weight: 700;">₹${Number(record.total_loss || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="loss-box">
            <div class="loss-card">
              <div class="loss-label">Total Financial Write-off</div>
              <div class="loss-value">₹${Number(record.total_loss || 0).toFixed(2)}</div>
            </div>
          </div>

          ${
            record.remarks
              ? `<div class="remarks-section"><strong>Remarks / Cause:</strong> ${record.remarks}</div>`
              : ''
          }

          <div class="signature-row">
            <div class="sign-box">
              <div class="sign-line"></div>
              <div class="sign-label">Reported / Handed Over By</div>
            </div>
            <div class="sign-box">
              <div class="sign-line"></div>
              <div class="sign-label">Manager / Authorized Signature</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    win.document.open();
    win.document.write(htmlContent);
    win.document.close();
  }

  /* ========================================================
     HELPERS
  ======================================================== */

  getTodayDate(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  getTypeBadgeColor(type: string): string {
    const match = this.damageTypes.find(
      (t) => t.value.toLowerCase() === (type || '').toLowerCase()
    );
    return match ? match.color : '#64748b';
  }
}
