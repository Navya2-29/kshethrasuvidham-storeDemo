import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NamedRef, Product, ProductPayload } from '../models/product.model';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NumbersOnlyDirective } from '../../../shared/directives/numbers-only.directive';
import { Category } from '../models/category.model';
import { finalize, forkJoin, Subject, takeUntil } from 'rxjs';
import { SettingstoreService } from '../../../core/services/setting/settingstore.service';
import { ProductStockViewDialogComponent } from '../../../shared/components/product-stock-view-dialog/product-stock-view-dialog.component';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-productmaster',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatInputModule,
    MatSortModule,
    MatDialogModule,
    NumbersOnlyDirective,
  ],
  templateUrl: './productmaster.component.html',
  styleUrl: './productmaster.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class ProductmasterComponent implements  OnInit, AfterViewInit, OnDestroy
{
  /* ===================================================
     TABLE
  =================================================== */
  displayedColumns: string[] = [
    'index',
    'p-code',
    'product',
    'Category',
    'Price',
    'Quantity',
    'action',
  ];

  dataSource = new MatTableDataSource<Product>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  /* ===================================================
     FORM / DATA
  =================================================== */
  productForm!: FormGroup;
  products: Product[] = [];
  categories: Category[] = [];
  authors: any[] = [];
  publishers: any[] = [];
  editMode = false;
  editId?: number;
  loading = false;
  saving = false;
  isBookstore = false;
  exportingReport = false;

  // Multi author/publisher picker state
  selectedAuthors: NamedRef[] = [];
  selectedPublishers: NamedRef[] = [];
  pickedAuthorId: number | null = null;
  pickedPublisherId: number | null = null;

  /* ===================================================
     MEMORY LEAK FIX
  =================================================== */
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private masterService: MasterService,
    private settingsStore: SettingstoreService,
    private dialog: MatDialog,
  ) {
    // Product codes are free-text but typically numeric ("1", "2", ... "10") -
    // plain string sort would put "10" before "2". Sort numerically when both
    // sides parse as numbers, falling back to locale string compare otherwise.
    this.dataSource.sortingDataAccessor = (item: Product, property: string): any => {
      if (property === 'p-code') {
        const n = Number(item.product_code);
        return isNaN(n) ? item.product_code : n;
      }
      if (property === 'product') return item.product_name;
      if (property === 'Category') return item.category as any;
      if (property === 'Quantity') return Number(item.current_stock ?? 0);
      return (item as any)[property];
    };
  }

  private static compareProductCode(a: string, b: string): number {
    const na = Number(a);
    const nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return (a || '').localeCompare(b || '');
  }

  private sortProductsByCode(list: Product[]): Product[] {
    return [...list].sort((a, b) =>
      ProductmasterComponent.compareProductCode(a.product_code, b.product_code)
    );
  }

  /* ===================================================
     INIT
  =================================================== */
  ngOnInit(): void {
    this.createForm();
    this.loadInitialData();

    this.settingsStore.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.isBookstore = !!settings?.is_bookstore;
        this.productForm.get('author_ids')?.updateValueAndValidity();
        this.productForm.get('publisher_ids')?.updateValueAndValidity();
      });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ===================================================
     FORM
  =================================================== */
  private requiredForBookstore = (): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
    const value: number[] = control.value || [];
    return this.isBookstore && value.length === 0 ? { required: true } : null;
  };

  private createForm(): void {
    this.productForm = this.fb.group(
      {
        product_code: ['', Validators.required],
        product_name: ['', Validators.required],
        product_nameml: ['', Validators.required],

        unit: ['', Validators.required],
        category: ['', Validators.required],

        min_qty: [0, [Validators.min(0)]],
        max_qty: [0, [Validators.min(0)]],

        cost_price: [0, Validators.required],
        mrp: [0, Validators.required],
        selling_price: [0, Validators.required],

        gst_percent: [0, [Validators.min(0), Validators.max(100)]],

        sale_item: ['', Validators.required],
        hsn_code: [''],

        author_ids: [[] as number[], [this.requiredForBookstore()]],
        publisher_ids: [[] as number[], [this.requiredForBookstore()]],
      },
      { validators: [this.priceValidator, this.qtyValidator] }
    );
  }

  /* ===================================================
     FAST PAGE LOAD (parallel APIs)
  =================================================== */
  private loadInitialData(): void {
    this.loading = true;

    forkJoin({
      products: this.masterService.getProducts(),
      categories: this.masterService.getCategories(),
      authors: this.masterService.getAll(),
      publishers: this.masterService.getPublishers(),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (res: any) => {
          this.products = this.sortProductsByCode(res.products);
          this.categories = res.categories;
          this.authors = res.authors;
          this.publishers = res.publishers;

          this.dataSource.data = this.products;
          console.log('productlist', this.products);
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  /* ===================================================
     AUTHOR / PUBLISHER MULTI-SELECT
  =================================================== */
  addAuthor(): void {
    if (!this.pickedAuthorId) return;

    if (!this.selectedAuthors.some((a) => a.id === this.pickedAuthorId)) {
      const author = this.authors.find((a) => a.id === this.pickedAuthorId);
      if (author) {
        this.selectedAuthors = [...this.selectedAuthors, { id: author.id, author_name: author.author_name }];
        this.syncAuthorIds();
      }
    }
    this.pickedAuthorId = null;
  }

  removeAuthor(id: number): void {
    this.selectedAuthors = this.selectedAuthors.filter((a) => a.id !== id);
    this.syncAuthorIds();
  }

  private syncAuthorIds(): void {
    const control = this.productForm.get('author_ids');
    control?.setValue(this.selectedAuthors.map((a) => a.id));
    control?.markAsTouched();
  }

  addPublisher(): void {
    if (!this.pickedPublisherId) return;

    if (!this.selectedPublishers.some((p) => p.id === this.pickedPublisherId)) {
      const publisher = this.publishers.find((p) => p.id === this.pickedPublisherId);
      if (publisher) {
        this.selectedPublishers = [
          ...this.selectedPublishers,
          { id: publisher.id, publisher_name: publisher.publisher_name },
        ];
        this.syncPublisherIds();
      }
    }
    this.pickedPublisherId = null;
  }

  removePublisher(id: number): void {
    this.selectedPublishers = this.selectedPublishers.filter((p) => p.id !== id);
    this.syncPublisherIds();
  }

  private syncPublisherIds(): void {
    const control = this.productForm.get('publisher_ids');
    control?.setValue(this.selectedPublishers.map((p) => p.id));
    control?.markAsTouched();
  }

  /* ===================================================
     SAVE / UPDATE
  =================================================== */
  saveProduct(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const raw = this.productForm.getRawValue();

    const payload: ProductPayload = {
      product_code: raw.product_code?.trim(),
      product_name: raw.product_name?.trim(),
      product_nameml: raw.product_nameml?.trim(),

      unit: raw.unit,
      category: Number(raw.category),

      min_qty: Number(raw.min_qty || 0),
      max_qty: Number(raw.max_qty || 0),

      cost_price: Number(raw.cost_price || 0),
      mrp: Number(raw.mrp || 0),
      selling_price: Number(raw.selling_price || 0),

      gst_percent: Number(raw.gst_percent || 0),

      sale_item: raw.sale_item,
      hsn_code: raw.hsn_code?.trim() || '',

      author_ids: this.isBookstore ? raw.author_ids : [],
      publisher_ids: this.isBookstore ? raw.publisher_ids : [],
    };

    this.saving = true;

    const request$ =
      this.editMode && this.editId
        ? this.masterService.updateProduct(this.editId, payload)
        : this.masterService.addProduct(payload);

    request$
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.saving = false))
      )
      .subscribe({
        next: () => {
          this.resetForm();
          this.refreshProductsOnly();
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  /* ===================================================
     REFRESH ONLY PRODUCTS (fast)
  =================================================== */
  private refreshProductsOnly(): void {
    this.masterService
      .getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: Product[]) => {
          this.products = this.sortProductsByCode(res);
          this.dataSource.data = this.products;
          console.log('productlist', this.products)
        },
        error: (err) => console.error(err),
      });
  }

  /* ===================================================
     EDIT
  =================================================== */
  editProduct(product: Product): void {
    this.editMode = true;
    this.editId = product.id;

    this.selectedAuthors = (product.authors || []).map((a) => ({ id: a.id, author_name: a.author_name }));
    this.selectedPublishers = (product.publishers || []).map((p) => ({ id: p.id, publisher_name: p.publisher_name }));

    this.productForm.patchValue({
      product_code: product.product_code,
      product_name: product.product_name,
      product_nameml: product.product_nameml,
      unit: product.unit,
      category: product.cid ?? product.category,

      min_qty: product.min_qty,
      max_qty: product.max_qty,

      cost_price: product.cost_price,
      mrp: product.mrp,
      selling_price: product.selling_price,

      gst_percent: product.gst_percent,

      sale_item: product.sale_item,
      hsn_code: product.hsn_code,

      author_ids: this.selectedAuthors.map((a) => a.id),
      publisher_ids: this.selectedPublishers.map((p) => p.id),
    });

    this.productForm.get('product_code')?.disable();
  }

  /* ===================================================
     DELETE
  =================================================== */
  deleteProduct(id?: number): void {
    if (!id) return;

    if (!confirm('Delete this product?')) return;

    this.masterService
      .deleteProduct(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.refreshProductsOnly();
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  /* ===================================================
     RESET
  =================================================== */
  resetForm(): void {
    this.productForm.reset({
      min_qty: 0,
      max_qty: 0,
      cost_price: 0,
      mrp: 0,
      selling_price: 0,
      gst_percent: 0,
      author_ids: [],
      publisher_ids: [],
    });

    this.selectedAuthors = [];
    this.selectedPublishers = [];
    this.pickedAuthorId = null;
    this.pickedPublisherId = null;

    this.editMode = false;
    this.editId = undefined;

    this.productForm.get('product_code')?.enable();
  }

  /* ===================================================
     FILTER
  =================================================== */
  applyFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.dataSource.filter = value
      .trim()
      .toLowerCase();
  }

  /* ===================================================
     VIEW STOCK
  =================================================== */
  viewProductStock(product: Product): void {
    if (!product.id) return;

    this.dialog.open(ProductStockViewDialogComponent, {
      width: '650px',
      data: { productId: product.id, productName: product.product_name },
    });
  }

  /* ===================================================
     TRACK BY (FAST TABLE)
  =================================================== */
  trackByProductId(
    index: number,
    item: Product
  ): number | undefined {
    return item.id;
  }

  joinNames(list: NamedRef[] | undefined, key: 'author_name' | 'publisher_name'): string {
    return (list || []).map((item) => item[key]).filter(Boolean).join(', ');
  }

  /* ===================================================
     CSV EXPORT (bulk)
  =================================================== */
  exportCsv(): void {
    const rows = this.dataSource.filteredData;

    if (!rows.length) return;

    const headers = [
      'Product Code',
      'Product Name',
      'Regional Name',
      'Category',
      'Unit',
      'Min Qty',
      'Max Qty',
      'Stock Qty',
      'Cost Price',
      'Selling Price',
      'MRP',
      'GST %',
      'HSN Code',
      'Sale Item',
      'Authors',
      'Publishers',
      'Created By',
    ];

    const csvEscape = (value: any): string => {
      const str = value === null || value === undefined ? '' : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const lines = rows.map((p) =>
      [
        p.product_code,
        p.product_name,
        p.product_nameml,
        p.category,
        p.unit,
        p.min_qty,
        p.max_qty,
        p.current_stock ?? 0,
        p.cost_price,
        p.selling_price,
        p.mrp,
        p.gst_percent,
        p.hsn_code,
        p.sale_item,
        this.joinNames(p.authors, 'author_name'),
        this.joinNames(p.publishers, 'publisher_name'),
        p.created_by_name,
      ]
        .map(csvEscape)
        .join(',')
    );

    const csvContent = [headers.map(csvEscape).join(','), ...lines].join('\r\n');
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  /* ===================================================
     FULL REPORT (active + inactive) - PDF / Excel
  =================================================== */
  private readonly reportHeaders = [
    'Code', 'Name', 'Regional Name', 'Category', 'Unit',
    'Min Qty', 'Max Qty', 'Stock Qty', 'Cost', 'Selling', 'MRP', 'GST %',
    'HSN', 'Sale Item', 'Authors', 'Publishers', 'Status', 'Created By',
  ];

  private reportRow(p: Product): (string | number)[] {
    return [
      p.product_code,
      p.product_name,
      p.product_nameml,
      p.category as any,
      p.unit,
      p.min_qty,
      p.max_qty,
      p.current_stock ?? 0,
      p.cost_price,
      p.selling_price,
      p.mrp,
      p.gst_percent,
      p.hsn_code || '',
      p.sale_item === 'Y' ? 'Yes' : 'No',
      this.joinNames(p.authors, 'author_name'),
      this.joinNames(p.publishers, 'publisher_name'),
      p.is_active ? 'Active' : 'Inactive',
      p.created_by_name || '',
    ];
  }

  private fetchReport(onLoaded: (products: Product[]) => void): void {
    if (this.exportingReport) return;

    this.exportingReport = true;
    this.masterService
      .getProductsReport()
      .pipe(takeUntil(this.destroy$), finalize(() => (this.exportingReport = false)))
      .subscribe({
        next: (products) => onLoaded(this.sortProductsByCode(products)),
        error: (err) => console.error(err),
      });
  }

  exportPdfReport(): void {
    this.fetchReport((products) => {
      if (!products.length) return;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      doc.setFontSize(12);
      doc.text('Product Report (Active + Inactive)', 40, 30);

      autoTable(doc, {
        startY: 45,
        head: [this.reportHeaders],
        body: products.map((p) => this.reportRow(p)),
        styles: { fontSize: 6, cellPadding: 2 },
        headStyles: { fillColor: [216, 142, 37] },
        margin: { left: 20, right: 20 },
      });

      doc.save(`products-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    });
  }

  exportExcelReport(): void {
    this.fetchReport((products) => {
      if (!products.length) return;

      const rows = products.map((p) => {
        const row = this.reportRow(p);
        return this.reportHeaders.reduce((acc, header, i) => {
          acc[header] = row[i];
          return acc;
        }, {} as Record<string, string | number>);
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      XLSX.writeFile(wb, `products-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  }

  pricesTouched(): boolean {
    return (
      !!this.f['cost_price'].touched ||
      !!this.f['selling_price'].touched ||
      !!this.f['mrp'].touched
    );
  }

  /* ===================================================
     VALIDATORS
  =================================================== */
  private priceValidator(
    group: AbstractControl
  ): ValidationErrors | null {
    const cost = Number(group.get('cost_price')?.value || 0);
    const mrp = Number(group.get('mrp')?.value || 0);
    const selling = Number(group.get('selling_price')?.value || 0);

    const errors: any = {};

    // Cost Price < Selling Price < MRP (strict), checked pairwise so every
    // field shows its own reason rather than relying on one combined check.
    if (!(cost < selling)) {
      errors.costNotLessThanSelling = true;
    }
    if (!(cost < mrp)) {
      errors.costNotLessThanMrp = true;
    }
    if (!(selling < mrp)) {
      errors.sellingNotLessThanMrp = true;
    }

    return Object.keys(errors).length ? errors : null;
  }

  private qtyValidator(group: AbstractControl): ValidationErrors | null {
    const min = Number(group.get('min_qty')?.value || 0);
    const max = Number(group.get('max_qty')?.value || 0);

    if (max > 0 && min > max) {
      return { minQtyGreaterThanMax: true };
    }
    return null;
  }

  /* ===================================================
     GETTERS
  =================================================== */
  get f() {
    return this.productForm.controls;
  }
}
