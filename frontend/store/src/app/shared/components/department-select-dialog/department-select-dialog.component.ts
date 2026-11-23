import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Department } from '../../../features/masters/models/department.model';

@Component({
  selector: 'app-department-select-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './department-select-dialog.component.html',
  styleUrl: './department-select-dialog.component.css',
})
export class DepartmentSelectDialogComponent {
  selectedId: number | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public departments: Department[],
    private dialogRef: MatDialogRef<DepartmentSelectDialogComponent>,
  ) {}

  confirm(): void {
    if (this.selectedId == null) return;
    this.dialogRef.close(this.selectedId);
  }
}
