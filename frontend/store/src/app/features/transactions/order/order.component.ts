import { Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
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

import { Order } from '../models/order.model';
import { Product } from '../../masters/models/product.model';
import { SettingstoreService } from '../../../core/services/setting/settingstore.service';

@Component({
  selector: 'app-order',
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
  templateUrl: './order.component.html',
  styleUrl: './order.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class OrderComponent implements OnInit, OnDestroy {
  orderForm!: FormGroup;
  suppliers: any[] = [];
  products: Product[] = [];
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  editMode = false;
  editId: number | null = null;
  isBookstore = false;
  isSaving = false;

  // Parallel to the `items` FormArray - the resolved Product for each row,
  // so the Author/Publisher dropdowns know which options to offer.
  rowProducts: (Product | null)[] = [];

  private destroy$ = new Subject<void>();

  displayedColumns = [
    'index',
    'order_no',
    'supplier_name',
    'order_date',
    'action',
  ];
  dataSource = new MatTableDataSource<Order>();

  constructor(
    private service: MasterService,
    private fb: FormBuilder,
    private settingsStore: SettingstoreService,
  ) {}

  ngOnInit() {
    this.initForm();

    this.loadMasters();
    this.loadOrders();
    this.loadNextOrderNo();

    this.settingsStore.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.isBookstore = !!settings?.is_bookstore;
        this.items.controls.forEach((c) => {
          c.get('author_id')?.updateValueAndValidity();
          c.get('publisher_id')?.updateValueAndValidity();
        });
      });
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm() {
    this.orderForm = this.fb.group({
      order_no: [{ value: '', disabled: true }],
      supplier_id: ['', Validators.required],
      supplier_code: [''],
      order_date: [this.getTodayDate(), Validators.required],
      items: this.fb.array([this.createItem()]),
    });
    this.rowProducts = [null];
  }

  getTodayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = ('0' + (today.getMonth() + 1)).slice(-2);
    const day = ('0' + today.getDate()).slice(-2);

    return `${year}-${month}-${day}`;
  }

  get items(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }

  // Only required when the product actually has at least one author/publisher
  // to pick from - otherwise a product with no author/publisher configured
  // would permanently block this row with no way to satisfy the validator.
  private requiredForBookstore = (kind: 'authors' | 'publishers'): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
    if (!this.isBookstore) return null;

    const group = control.parent;
    if (!group) return null;

    const index = this.items.controls.indexOf(group as FormGroup);
    const product = this.rowProducts[index];
    const hasOptions = !!product?.[kind]?.length;

    return hasOptions && !control.value ? { required: true } : null;
  };

  createItem() {
    return this.fb.group({
      product_id: ['', Validators.required],
      product_code: [''],
      author_id: this.fb.control<number | null>(null, [this.requiredForBookstore('authors')]),
      publisher_id: this.fb.control<number | null>(null, [this.requiredForBookstore('publishers')]),
      qty: [1, [Validators.required, Validators.min(1)]],
    });
  }

  addItem() {
    this.items.push(this.createItem());
    this.rowProducts.push(null);
  }

  removeItem(i: number) {
    if (this.items.length > 1) {
      this.items.removeAt(i);
      this.rowProducts.splice(i, 1);
    }
  }

  private applyRowAuthorPublisher(index: number, product: Product | null): void {
    this.rowProducts[index] = product;

    const authorId = product?.authors?.length === 1 ? product.authors[0].id : null;
    const publisherId = product?.publishers?.length === 1 ? product.publishers[0].id : null;

    this.items.at(index).patchValue({ author_id: authorId, publisher_id: publisherId });
  }

  onProductChange(event: any, index: number) {
    const productId = Number(event.target.value);
    const product = this.products.find((p) => p.id === productId) || null;

    this.applyRowAuthorPublisher(index, product);

    if (product) {
      this.items.at(index).patchValue({
        product_code: product.product_code,
      });
    }
  }

  onProductCodeChange(index: number) {
    const control = this.items.at(index);
    const code = control.get('product_code')?.value;

    if (!code) {
      this.applyRowAuthorPublisher(index, null);
      return;
    }

    const product = this.products.find(
      (p: any) => p.product_code?.toLowerCase() === code.toLowerCase(),
    ) || null;

    this.applyRowAuthorPublisher(index, product);

    if (product) {
      control.patchValue({
        product_id: product.id,
      });
    }
  }

  onSupplierCodeChange() {
    const code = this.orderForm.get('supplier_code')?.value;

    if (!code) return;

    const supplier = this.suppliers.find(
      (s: any) => s.supplier_code?.toLowerCase() === code.toLowerCase(),
    );

    if (supplier) {
      this.orderForm.patchValue({
        supplier_id: supplier.id,
      });
    }
  }

  loadMasters() {
    this.service.getSuppliers().pipe(takeUntil(this.destroy$)).subscribe((r) => (this.suppliers = r));
    this.service.getProducts().pipe(takeUntil(this.destroy$)).subscribe((r) => (this.products = r));
  }

  loadNextOrderNo() {
    this.service
      .getNextOrderNo()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.orderForm.patchValue({ order_no: res.order_no }),
        error: (err) => console.error(err),
      });
  }

  onSupplierChange(event: any) {
    const supplierId = Number(event.target.value);

    const supplier = this.suppliers.find((s) => s.id === supplierId);

    if (supplier) {
      this.orderForm.patchValue({
        supplier_code: supplier.supplier_code,
      });
    }
  }

  onSubmit() {
    if (this.orderForm.invalid || this.isSaving) {
      this.orderForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.orderForm.getRawValue();

    const request$ =
      this.editMode && this.editId !== null
        ? this.service.updateOrder(this.editId, payload)
        : this.service.createOrder(payload);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSaving = false;
        this.afterSave();
      },
      error: (err) => {
        this.isSaving = false;
        console.error(err);
      },
    });
  }

  afterSave() {
    this.reset();
    this.loadOrders();
  }

  editOrder(row: any) {
    this.editMode = true;
    this.editId = row.id;

    this.service
      .getOrderById(row.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: any) => {
        const formattedDate = this.formatDate(res.order_date);
        this.orderForm.patchValue({
          order_no: res.order_no,
          supplier_id: res.supplier_id,
          supplier_code: res.supplier_code,
          order_date: formattedDate,
        });

        this.items.clear();
        this.rowProducts = [];

        res.items.forEach((i: any) => {
          const g = this.createItem();
          g.patchValue(i);
          this.items.push(g);
          this.rowProducts.push(this.products.find((p) => p.id === i.product_id) || null);
        });
      });
  }

  formatDate(date: any): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  deleteOrder(id: number) {
    if (confirm('Delete?')) {
      this.service
        .deleteOrder(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.loadOrders();
        });
    }
  }

  loadOrders() {
    this.service
      .getOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.dataSource.data = res;
      });
  }

  applyFilter(event: any) {
    const val = event.target.value.trim().toLowerCase();
    this.dataSource.filter = val;
  }

  reset() {
    this.orderForm.reset({
      order_no: '',
      supplier_id: '',
      supplier_code: '',
      order_date: this.getTodayDate(),
    });

    this.items.clear();
    this.rowProducts = [];
    this.addItem();

    this.editMode = false;
    this.editId = null;

    this.loadNextOrderNo();
  }
}
