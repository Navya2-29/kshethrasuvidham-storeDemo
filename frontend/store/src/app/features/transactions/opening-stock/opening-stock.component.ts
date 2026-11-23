import { Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MasterService } from '../../../core/services/masters/master.service';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../masters/models/product.model';
import { OpeningStock } from '../models/opening-stock.model';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { SettingstoreService } from '../../../core/services/setting/settingstore.service';
import { finalize, Subject, takeUntil } from 'rxjs';
@Component({
  selector: 'app-opening-stock',
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
  templateUrl: './opening-stock.component.html',
  styleUrl: './opening-stock.component.css',
  encapsulation: ViewEncapsulation.None
})
export class OpeningStockComponent implements OnInit, OnDestroy {
  openings: OpeningStock[] = [];
  editId: number | null = null;

  private destroy$ = new Subject<void>();

  isLoading = false;
  isSaving = false;
  isDeleting = false;

  buttonText = 'Save';

  get displayedColumns(): string[] {
    return this.isBookstore
      ? ['index', 'product_code', 'product_name', 'author_name', 'publisher_name', 'qty', 'transaction_date', 'action']
      : ['index', 'product_code', 'product_name', 'qty', 'transaction_date', 'action'];
  }

  dataSource = new MatTableDataSource<OpeningStock>();
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  products: Product[] = [];
  isBookstore = false;
  selectedProduct: Product | null = null;

  constructor(
    private fb: FormBuilder,
    private masterService: MasterService,
    private authState: AuthStateService,
    private settingsStore: SettingstoreService,
  ) {}

  // Only required when the product actually has at least one author/publisher
  // to pick from - otherwise a product with no author/publisher configured
  // (missing Product Master data) would permanently block this form with no
  // way to satisfy the validator.
  private requiredForBookstore = (kind: 'authors' | 'publishers'): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
    const hasOptions = !!this.selectedProduct?.[kind]?.length;
    return this.isBookstore && hasOptions && !control.value ? { required: true } : null;
  };

  openingForm = this.fb.group({
    product_code: [''],
    product_id: ['', Validators.required],
    author_id: this.fb.control<number | null>(null, [this.requiredForBookstore('authors')]),
    publisher_id: this.fb.control<number | null>(null, [this.requiredForBookstore('publishers')]),
    qty: ['1', Validators.required],
    cost_price: [0, Validators.required],
    opening_date: [this.getTodayDate(), Validators.required],
    remarks: [''],
    created_by: [this.authState.user()?.id || null],
    updated_by: [null],
  });

  /** Auto-select when the product has exactly one author/publisher; otherwise
   *  leave blank so the user must pick one (Book Store products can have several). */
  private applyProductAuthorPublisher(product: Product | null): void {
    this.selectedProduct = product;

    const authorId = product?.authors?.length === 1 ? product.authors[0].id : null;
    const publisherId = product?.publishers?.length === 1 ? product.publishers[0].id : null;

    this.openingForm.patchValue({ author_id: authorId, publisher_id: publisherId });
  }

  getTodayDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  }
  get f() {
    return this.openingForm.controls;
  }
  onProductCodeChange() {
    const code = this.openingForm.get('product_code')?.value;

    if (!code) {
      this.applyProductAuthorPublisher(null);
      this.openingForm.patchValue({ product_id: '' });
      return;
    }

    const product = this.products.find(
      (p) => p.product_code?.toLowerCase() === code.toLowerCase(),
    );

    this.applyProductAuthorPublisher(product || null);

    if (product) {
      const cost = Number(product.cost_price);
      this.openingForm.patchValue({
        product_id: product.id.toString(),
        cost_price: cost,
      });
    } else {
      this.openingForm.patchValue({
        product_id: '',
        cost_price: 0,
      });
    }
  }

  loadProducts() {
    this.masterService
      .getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: Product[]) => {
          this.products = res;
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  ngOnInit() {
    this.loadProducts();
    this.loadOpenings();

    this.settingsStore.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.isBookstore = !!settings?.is_bookstore;
        this.f.author_id.updateValueAndValidity();
        this.f.publisher_id.updateValueAndValidity();
      });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  onProductChange(event: any) {
    const selectedId = Number(event.target.value);
    const selectedProduct = this.products.find((p) => p.id === selectedId);
    this.applyProductAuthorPublisher(selectedProduct || null);

    if (selectedProduct) {
      const cost_price = Number(selectedProduct.cost_price);

      this.openingForm.patchValue({
        cost_price: cost_price,
        product_code: selectedProduct.product_code,
      });
    }
  }

  onSubmit(): void {
    if (this.openingForm.invalid || this.isSaving) {
      this.openingForm.markAllAsTouched();
      return;
    }

    const payload = {
      ...this.openingForm.value,
    };

    this.isSaving = true;

    /* CREATE */

    if (this.editId === null) {
      payload.created_by = this.authState.user()?.id || null;

      this.masterService
        .createOpening(payload)
        .pipe(
          takeUntil(this.destroy$),

          finalize(() => {
            this.isSaving = false;
          }),
        )
        .subscribe({
          next: () => {
            this.reset();
            this.loadOpenings();
          },
        });
    } else {
      /* UPDATE */
      payload.updated_by = this.authState.user()?.id || null;

      this.masterService
        .updateOpening(this.editId, payload)
        .pipe(
          takeUntil(this.destroy$),

          finalize(() => {
            this.isSaving = false;
          }),
        )
        .subscribe({
          next: () => {
            this.reset();
            this.loadOpenings();
          },
        });
    }
  }

  loadOpenings() {
    this.masterService
      .getOpenings()
      .pipe(
        takeUntil(this.destroy$),

        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe((res) => {
        this.openings = res as any[];
        console.log(this.openings);
        this.dataSource = new MatTableDataSource(this.openings);
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  reset() {
    this.selectedProduct = null;
    this.openingForm.reset({
      product_code: '',
      product_id: '',
      author_id: null,
      publisher_id: null,
      qty: '1',
      cost_price: 0,
      remarks: '',
      opening_date: this.getTodayDate(),
    });
  }

  editRow(row: any): void {
    this.editId = row.id;
    this.selectedProduct = this.products.find((p) => p.id === row.product_id) || null;

    this.openingForm.patchValue({
      product_code: row.product_code,
      product_id: row.product_id,
      author_id: row.author_id,
      publisher_id: row.publisher_id,
      qty: row.qty,
      cost_price: row.cost_price,
      opening_date: this.formatDate(row.opening_date),
      remarks: row.remarks,
    });

    this.buttonText = 'Update';

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
  formatDate(date: string): string {
    return date ? date.substring(0, 10) : '';
  }
  deleteRow(row: OpeningStock): void {
    const ok = confirm(`Delete ${row.product_name}?`);

    if (!ok) return;

    this.isDeleting = true;

    const payload = {
      deleted_by: this.authState.user()?.id || null,
    };

    this.masterService
      .deleteOpening(row.id, payload)
      .pipe(
        takeUntil(this.destroy$),

        finalize(() => {
          this.isDeleting = false;
        }),
      )
      .subscribe({
        next: () => {
          this.loadOpenings();

          if (this.editId === row.id) {
            this.reset();
          }
        },
      });
  }
}
