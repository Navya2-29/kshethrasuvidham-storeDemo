import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { MasterService } from '../../../core/services/masters/master.service';

interface ProductSummary {
  productCode?: string;
  productName?: string;
  unit?: string;
  openingStock?: number;
  purchase?: { totalQty: number; freeQty: number; total: number };
  directEntry?: number;
  sales?: number;
  stock?: { qty: number; freeQty: number; damagedQty: number; availableStock: number };
  qtyInHand?: number;
}

interface LocationStock {
  store: string;
  department_id?: number;
  qty: number;
  free_qty: number;
  damaged_qty: number;
  total_available: number;
}

@Component({
  selector: 'app-product-stock-view-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-stock-view-dialog.component.html',
  styleUrl: './product-stock-view-dialog.component.css',
})
export class ProductStockViewDialogComponent implements OnInit {
  loading = true;
  error = false;

  summary: ProductSummary = {};
  locations: LocationStock[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { productId: number; productName: string },
    private dialogRef: MatDialogRef<ProductStockViewDialogComponent>,
    private masterService: MasterService,
  ) {}

  ngOnInit(): void {
    forkJoin({
      summary: this.masterService.getProductSummary(this.data.productId),
      locations: this.masterService.getProductStock(this.data.productId),
    }).subscribe({
      next: ({ summary, locations }: any) => {
        this.summary = summary?.data || {};
        this.locations = Array.isArray(locations) ? locations : [];
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  get totalQty(): number {
    return this.locations.reduce((sum, l) => sum + Number(l.qty || 0), 0);
  }

  get totalFreeQty(): number {
    return this.locations.reduce((sum, l) => sum + Number(l.free_qty || 0), 0);
  }

  get totalDamagedQty(): number {
    return this.locations.reduce((sum, l) => sum + Number(l.damaged_qty || 0), 0);
  }

  get totalAvailable(): number {
    return this.locations.reduce((sum, l) => sum + Number(l.total_available || 0), 0);
  }

  close(): void {
    this.dialogRef.close();
  }
}
