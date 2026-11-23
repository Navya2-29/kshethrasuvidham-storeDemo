import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Product } from '../../masters/models/product.model';
import { MasterService } from '../../../core/services/masters/master.service';

import { finalize, Subject, takeUntil } from 'rxjs';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { SettingstoreService } from '../../../core/services/setting/settingstore.service';

@Component({
  selector: 'app-direct-entry',
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
  ],
  templateUrl: './direct-entry.component.html',
  styleUrl: './direct-entry.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class DirectEntryComponent implements OnInit, OnDestroy {
  /* ==========================================
     DESTROY
  ========================================== */

  private destroy$ = new Subject<void>();

  /* ==========================================
     DATA
  ========================================== */

  products: Product[] = [];
  entries: any[] = [];

  dataSource = new MatTableDataSource<any>();

  get displayedColumns(): string[] {
    return this.isBookstore
      ? ['index', 'product_code', 'product_name', 'author_name', 'publisher_name', 'qty', 'entry_date', 'action']
      : ['index', 'product_code', 'product_name', 'qty', 'entry_date', 'action'];
  }

  @ViewChild(MatPaginator)
  paginator!: MatPaginator;

  @ViewChild(MatSort)
  sort!: MatSort;

  /* ==========================================
     UI STATE
  ========================================== */

  isLoading = false;
  isSaving = false;
  isDeleting = false;

  editId: number | null = null;

  buttonText = 'Save';

  isBookstore = false;
  selectedProduct: Product | null = null;

  /* ==========================================
     FORM
  ========================================== */

  // Only required when the product actually has at least one author/publisher
  // to pick from - otherwise a product with no author/publisher configured
  // (missing Product Master data) would permanently block this form with no
  // way to satisfy the validator.
  private requiredForBookstore = (kind: 'authors' | 'publishers'): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
    const hasOptions = !!this.selectedProduct?.[kind]?.length;
    return this.isBookstore && hasOptions && !control.value ? { required: true } : null;
  };

  directForm = this.fb.group({
    product_code: [''],

    product_id: this.fb.control<number | null>(null, Validators.required),

    author_id: this.fb.control<number | null>(null, [this.requiredForBookstore('authors')]),
    publisher_id: this.fb.control<number | null>(null, [this.requiredForBookstore('publishers')]),

    qty: [1, Validators.required],

    cost_price: [0, Validators.required],

    entry_date: [this.getTodayDate(), Validators.required],

    remarks: [''],

    created_by: [this.authState.user()?.id || null],

    updated_by: [null],
  });

  constructor(
    private fb: FormBuilder,
    private masterService: MasterService,
    private authState: AuthStateService,
    private settingsStore: SettingstoreService,
  ) {}

  /* ==========================================
     INIT
  ========================================== */

  ngOnInit(): void {
    this.loadProducts();
    this.loadEntries();

    this.settingsStore.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.isBookstore = !!settings?.is_bookstore;
        this.f.author_id.updateValueAndValidity();
        this.f.publisher_id.updateValueAndValidity();
      });
  }

  joinNames(list: { author_name?: string; publisher_name?: string }[] | undefined, key: 'author_name' | 'publisher_name'): string {
    return (list || []).map((item) => item[key]).filter(Boolean).join(', ');
  }

  /** Auto-select when the product has exactly one author/publisher; otherwise
   *  leave blank so the user must pick one (Book Store products can have several). */
  private applyProductAuthorPublisher(product: Product | null): void {
    this.selectedProduct = product;

    const authorId = product?.authors?.length === 1 ? product.authors[0].id : null;
    const publisherId = product?.publishers?.length === 1 ? product.publishers[0].id : null;

    this.directForm.patchValue({ author_id: authorId, publisher_id: publisherId });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get f() {
    return this.directForm.controls;
  }

  /* ==========================================
     DATE
  ========================================== */

  getTodayDate(): string {
    const d = new Date();

    const y = d.getFullYear();

    const m = String(d.getMonth() + 1).padStart(2, '0');

    const day = String(d.getDate()).padStart(2, '0');

    return `${y}-${m}-${day}`;
  }

  formatDate(value: any): string {
    return value ? value.substring(0, 10) : '';
  }

  /* ==========================================
     LOAD PRODUCTS
  ========================================== */

  loadProducts(): void {
    this.masterService
      .getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: Product[]) => {
          this.products = res || [];
        },
      });
  }

  /* ==========================================
     LOAD LIST
  ========================================== */

  loadEntries(): void {
    this.isLoading = true;

    this.masterService
      .getDirectEntries()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (res: any) => {
          this.entries = res || [];

          this.dataSource = new MatTableDataSource(this.entries);

          this.dataSource.paginator = this.paginator;

          this.dataSource.sort = this.sort;
        },
      });
  }

  /* ==========================================
     PRODUCT CODE CHANGE
  ========================================== */

  onProductCodeChange(): void {
    const code = this.f.product_code.value?.toString().trim().toLowerCase();

    if (!code) {
      this.applyProductAuthorPublisher(null);
      this.directForm.patchValue({
        product_id: null,

        cost_price: 0,
      });
      return;
    }

    const product = this.products.find(
      (p) => p.product_code?.toLowerCase().trim() === code,
    );

    if (!product) {
      this.applyProductAuthorPublisher(null);
      this.directForm.patchValue({
        product_id: null,

        cost_price: 0,
      });
      return;
    }

    this.applyProductAuthorPublisher(product);
    this.directForm.patchValue({
      product_id: Number(product.id),

      cost_price: Number(product.cost_price || 0),
    });
  }

  /* ==========================================
     PRODUCT SELECT
  ========================================== */

  onProductChange(event: any): void {
    const id = Number(event.target.value);

    const product = this.products.find((p) => p.id === id);

    if (!product) return;

    this.applyProductAuthorPublisher(product);
    this.directForm.patchValue({
      product_code: product.product_code,

      product_id: product.id,

      cost_price: Number(product.cost_price || 0),
    });
  }

  /* ==========================================
     SAVE / UPDATE
  ========================================== */

  onSubmit(): void {
    if (this.directForm.invalid || this.isSaving) {
      this.directForm.markAllAsTouched();
      return;
    }

    const payload = this.directForm.getRawValue();

    this.isSaving = true;

    /* CREATE */

    if (this.editId === null) {
      payload.created_by = this.authState.user()?.id || null;

      this.masterService
        .createDirectEntry(payload)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            this.isSaving = false;
          }),
        )
        .subscribe({
          next: () => {
            this.reset();
            this.loadEntries();
          },
        });
    } else {

    /* UPDATE */
      payload.updated_by = this.authState.user()?.id || null;

      this.masterService
        .updateDirectEntry(this.editId, payload)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            this.isSaving = false;
          }),
        )
        .subscribe({
          next: () => {
            this.reset();
            this.loadEntries();
          },
        });
    }
  }

  /* ==========================================
     EDIT
  ========================================== */

  editRow(row: any): void {
    this.editId = row.id;

    this.buttonText = 'Update';

    this.selectedProduct = this.products.find((p) => p.id === row.product_id) || null;

    this.directForm.patchValue({
      product_code: row.product_code,

      product_id: row.product_id,

      author_id: row.author_id,
      publisher_id: row.publisher_id,

      qty: row.qty,

      cost_price: row.cost_price,

      entry_date: this.formatDate(row.entry_date),

      remarks: row.remarks,
    });

    /* lock product */

    this.f.product_code.disable();
    this.f.product_id.disable();

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  /* ==========================================
     DELETE
  ========================================== */

  deleteRow(row: any): void {
    const ok = confirm(`Delete ${row.product_name}?`);
    if (!ok) return;
    this.isDeleting = true;
    this.masterService
      .deleteDirectEntry(row.id, {
        deleted_by: this.authState.user()?.id || null,
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isDeleting = false;
        }),
      )
      .subscribe({
        next: () => {
          this.loadEntries();

          if (this.editId === row.id) {
            this.reset();
          }
        },
      });
  }

  /* ==========================================
     FILTER
  ========================================== */

  applyFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dataSource.filter = value.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /* ==========================================
     RESET
  ========================================== */

  reset(): void {
    this.editId = null;
    this.buttonText = 'Save';
    this.selectedProduct = null;
    this.f.product_code.enable();
    this.f.product_id.enable();
    this.directForm.reset({
      product_code: '',
      product_id: null,
      author_id: null,
      publisher_id: null,
      qty: 1,
      cost_price: 0,
      entry_date: this.getTodayDate(),
      remarks: '',
      created_by: this.authState.user()?.id || null,
      updated_by: null,
    });
  }
}
