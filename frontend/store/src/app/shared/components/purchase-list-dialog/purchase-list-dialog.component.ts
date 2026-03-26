import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
@Component({
  selector: 'app-purchase-list-dialog',
  standalone: true,
  imports: [CommonModule,
    FormsModule,
    MatTableModule,  
    MatInputModule],
  templateUrl: './purchase-list-dialog.component.html',
  styleUrl: './purchase-list-dialog.component.css'
})
export class PurchaseListDialogComponent {
searchText: string = '';
  displayedColumns: string[] = [
    'invoice_no',
    'supplier_name',
    'invoice_date',
    'receipt_date',
    'bill_amount',
    'action'
  ];

  constructor(@Inject(MAT_DIALOG_DATA) public data: any[],private dialogRef: MatDialogRef<PurchaseListDialogComponent>) {}

  get filteredData() {
    return this.data.filter((p: any) =>
      p.invoice_no.toLowerCase().includes(this.searchText.toLowerCase()) ||
      p.supplier_name.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }
  onEdit(row: any) {
  this.dialogRef.close({ action: 'edit', data: row });
}

onDelete(row: any) {
  this.dialogRef.close({ action: 'delete', data: row });
}
}
