import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MasterService } from '../../../core/services/masters/master.service';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { SnackbarService } from '../../../core/services/ui/snackbar.service';

export interface RecordDamageDialogData {
  productId: number;
  productName: string;
  productCode?: string;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  currentStock?: number;
  departmentId?: number | null;
}

@Component({
  selector: 'app-record-damage-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './record-damage-dialog.component.html',
  styleUrl: './record-damage-dialog.component.css',
})
export class RecordDamageDialogComponent implements OnInit {
  damagedQty: number = 1;
  damageType: string = 'Broken';
  damageDate: string = this.getTodayDate();
  remarks: string = '';
  saving = false;

  readonly damageReasons = [
    { value: 'Broken', label: 'Broken / Damaged' },
    { value: 'Expired', label: 'Expired' },
    { value: 'Transit', label: 'Transit Damage' },
    { value: 'Defect', label: 'Manufacturer Defect' },
    { value: 'Water', label: 'Water / Moisture Damage' },
    { value: 'Other', label: 'Other Loss' },
  ];

  private readonly BACKUP_STORAGE_KEY = 'store_damage_records_backup';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: RecordDamageDialogData,
    private dialogRef: MatDialogRef<RecordDamageDialogComponent>,
    private masterService: MasterService,
    private authState: AuthStateService,
    private snackbarService: SnackbarService,
  ) {}

  ngOnInit(): void {
    if (!this.data) return;
  }

  get availableStock(): number {
    const base = Number(this.data?.currentStock ?? 0);
    const adj = this.masterService.getStockAdjustment(this.data.productId);
    return Math.max(0, base + adj);
  }

  get estimatedLoss(): number {
    const cost = Number(this.data?.costPrice || 0);
    const qty = Number(this.damagedQty || 0);
    return cost * qty;
  }

  getTodayDate(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  close(): void {
    this.dialogRef.close(null);
  }

  submitDamage(): void {
    const qty = Number(this.damagedQty);
    if (!qty || qty <= 0) {
      this.snackbarService.error('Please enter a valid damaged quantity.');
      return;
    }

    if (this.availableStock <= 0) {
      this.snackbarService.error('Current available stock is 0. Product quantity cannot be negative.');
      return;
    }

    if (qty > this.availableStock) {
      this.snackbarService.error(
        `Damaged quantity (${qty}) exceeds available stock (${this.availableStock} ${this.data.unit || 'Nos'}). Product quantity cannot be negative.`
      );
      return;
    }

    this.saving = true;

    const currentUser = this.authState.user();
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const localDamageNo = `DMG-${year}-${String(timestamp).slice(-4)}`;
    const costPrice = Number(this.data.costPrice || 0);
    const sellingPrice = Number(this.data.sellingPrice || 0);
    const totalLoss = Number((costPrice * qty).toFixed(2));
    const entryDate = this.damageDate || this.getTodayDate();

    const payload = {
      damage_no: localDamageNo,
      product_id: this.data.productId,
      department_id: this.data.departmentId || null,
      damaged_qty: qty,
      damage_type: this.damageType,
      damage_date: entryDate,
      remarks: this.remarks.trim(),
      created_by: currentUser?.id || null,
    };

    const newRecord = {
      id: timestamp,
      damage_no: localDamageNo,
      product_id: this.data.productId,
      product_name: this.data.productName,
      product_code: this.data.productCode || '',
      unit: this.data.unit || 'Nos',
      department_id: this.data.departmentId || null,
      dept_name: this.data.departmentId ? 'Department' : 'Main Store',
      damaged_qty: qty,
      cost_price: costPrice,
      selling_price: sellingPrice,
      total_loss: totalLoss,
      damage_type: this.damageType,
      damage_date: entryDate,
      remarks: this.remarks.trim(),
      created_by: currentUser?.id || null,
      reported_by_name: currentUser?.username || 'Staff',
      created_at: new Date().toISOString(),
    };

    // 1. Immediately deduct stock locally and broadcast across the app
    this.masterService.recordStockAdjustment(this.data.productId, -qty);
    this.masterService.notifyStockUpdated({
      type: 'STOCK_CHANGED',
      departmentId: this.data.departmentId ? Number(this.data.departmentId) : undefined,
      items: [{ product_id: this.data.productId, qty: -qty }],
    });

    // 2. Persist local backup
    this.saveToBackup(newRecord);

    // 3. Send to Backend API
    this.masterService.createDamageRecord(payload).subscribe({
      next: (res: any) => {
        if (res?.damage_no) {
          newRecord.damage_no = res.damage_no;
          newRecord.id = res.id || newRecord.id;
          this.saveToBackup(newRecord);
        }
        this.saving = false;
        this.snackbarService.success(
          `Damaged stock recorded: ${qty} ${this.data.unit || 'Nos'} of "${this.data.productName}" added to Damage List & deducted from stock.`
        );
        this.dialogRef.close({ success: true, damaged_qty: qty, record: newRecord });
      },
      error: (err) => {
        console.warn('API call failed; record saved to local backup', err);
        this.saving = false;
        this.snackbarService.success(
          `Damaged stock recorded: ${qty} ${this.data.unit || 'Nos'} deducted from stock and added to Damage List.`
        );
        this.dialogRef.close({ success: true, damaged_qty: qty, record: newRecord });
      },
    });
  }

  private saveToBackup(record: any): void {
    try {
      const raw = localStorage.getItem(this.BACKUP_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const filtered = list.filter((r: any) => r.damage_no !== record.damage_no && r.id !== record.id);
      filtered.unshift(record);
      localStorage.setItem(this.BACKUP_STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Failed to save damage backup to localStorage', e);
    }
  }
}
