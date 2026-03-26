import { Component, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Supplier } from '../models/supplier.model';
import { MasterService } from '../../../core/services/masters/master.service';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';
import { NumbersOnlyDirective } from '../../../shared/directives/numbers-only.directive';
@Component({
  selector: 'app-suppliermaster',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatInputModule,
    MatSortModule,
    NumbersOnlyDirective,
  ],
  templateUrl: './suppliermaster.component.html',
  styleUrl: './suppliermaster.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SuppliermasterComponent {
  // ------------------------------
  //  Table Configuration
  // ------------------------------

  displayedColumns: string[] = [
    'index',
    'supplier_code',
    'supplier_name',
    'mobile_number',
    'action',
  ];
  dataSource = new MatTableDataSource<Supplier>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  suppliers: Supplier[] = [];
  loading = false;
  editMode = false;
  editId?: number;
  errorMessage = '';
  private destroy$ = new Subject<void>();
  // ------------------------------ // Reactive Form // ------------------------------

  supplierForm = this.fb.nonNullable.group({
    supplier_code: [
      '',
      [Validators.required, Validators.pattern(/^[a-zA-Z0-9]+$/)],
    ],
    supplier_name: ['', Validators.required],
    contact_person: [''],
    mobile_number: [
      '',
      [Validators.required, Validators.pattern(/^[0-9]{10}$/)],
    ],
    office_number: [''],
    address: [''],
    email: ['', Validators.email],
    website: [''],
    gst_number: ['', [Validators.pattern(/^[A-Z0-9]{15}$/)]],
  });
  constructor(
    private fb: FormBuilder,
    private masterService: MasterService,
  ) {}
  ngOnInit(): void {
    this.loadSuppliers();
  }
  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  loadSuppliers(): void {
    this.masterService
      .getSuppliers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suppliers: Supplier[]) => {
          this.dataSource.data = suppliers;
        },
        error: (err) => {
          console.error('Error loading suppliers:', err);
        },
      });
  }

  saveSupplier(): void {
    console.log(this.supplierForm.getRawValue());
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const payload: Supplier = this.supplierForm.getRawValue();
    if (this.editMode && this.editId) {
      this.masterService.updateSupplier(this.editId, payload).subscribe({
        next: () => {
          this.afterSave('Supplier updated successfully');
        },
        error: (err) => {
          const message = err?.error?.message || 'Error saving supplier';
          alert(message);
          this.loading = false;
        },
      });
    } else {
      this.masterService.addSupplier(payload).subscribe({
        next: () => {
          this.afterSave('Supplier added successfully');
        },
        error: (err) => {
          const message = err?.error?.message || 'Error saving supplier';
          alert(message);
          this.loading = false;
        },
      });
    }
  }

  editSupplier(supplier: Supplier): void {
    console.log(supplier, 'sdsss');
    this.editMode = true;
    this.editId = supplier.id;
    this.supplierForm.patchValue({ ...supplier });
    this.supplierForm.controls.supplier_code.disable();
  }
  deleteSupplier(id: number): void {
    if (!confirm('Are you sure you want to delete this supplier?')) {
      return;
    }
    this.masterService
      .deleteSupplier(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadSuppliers(),
        error: (err) => console.error('Delete error:', err),
      });
  }
  resetForm(): void {
    this.supplierForm.reset();
    this.editMode = false;
    this.editId = undefined;
    this.supplierForm.controls.supplier_code.enable();
  }

  private afterSave(message: string): void {
    alert(message);
    this.resetForm();
    this.loadSuppliers();
    this.loading = false;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }
  get f() {
    return this.supplierForm.controls;
  }
}
