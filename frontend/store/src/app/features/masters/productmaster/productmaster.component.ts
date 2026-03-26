import { Component, ViewChild, ViewEncapsulation } from '@angular/core';
import { Product } from '../models/product.model';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
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
import { NumbersOnlyDirective } from '../../../shared/directives/numbers-only.directive';
import { Category } from '../models/category.model';
@Component({
  selector: 'app-productmaster',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatInputModule,
    MatSortModule,
    NumbersOnlyDirective,
  ],
  templateUrl: './productmaster.component.html',
  styleUrl: './productmaster.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class ProductmasterComponent {
  displayedColumns: string[] = [
    'index',
    'p-code',
    'product',
    'Unit',
    'Category',
    'Min.Qty',
    'Max-Qty',
    'CPrice',
    'MRP',
    'action',
  ];
  dataSource = new MatTableDataSource<any>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  productForm!: FormGroup;
  products: Product[] = [];
  editMode = false;
  editId?: number;
  categories: Category[] = [];
  constructor(
    private fb: FormBuilder,
    private masterService: MasterService,
  ) {}
  ngOnInit(): void {
    this.createForm();
    this.loadProducts();
  }
  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.loadCategories();
  }
  createForm(): void {
    this.productForm = this.fb.group({
      product_code: ['', Validators.required],
      product_name: ['', Validators.required],
      product_nameml: ['',Validators.required],
      unit: ['', Validators.required],
      category: ['', Validators.required],
      min_qty: [0],
      max_qty: [0],
      cost_price: [0, Validators.required],
      mrp: [0, Validators.required],
      gst_percent: ['0.00', Validators.required],
      sale_item: ['', Validators.required],
      hsn_code:['']
    });
  }
  // -------------------------------
  // Load suppliers
  // -------------------------------
  loadProducts() {
    this.masterService.getProducts().subscribe({
      next: (res: Product[]) => {
        this.products = res;
        this.dataSource.data = this.products;
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  // -------------------------------
  // Load Categories
  // -------------------------------

  loadCategories(): void {
    this.masterService.getCategories().subscribe({
      next: (res: any[]) => {
        this.categories = res;
      },
      error: (err) => {
        console.error('Error loading categories', err);
      },
    });
  }

  // -------------------------------
  // Save / Update supplier
  // -------------------------------
  saveProduct(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      
      return;
    }
const raw = this.productForm.getRawValue();

  const payload: Product = {
    ...raw,
    product_name: raw.product_name ?? '',
    product_nameml: raw.product_nameml ?? '',
    unit: raw.unit ?? '',
    category: raw.category ?? '',
    sale_item: raw.sale_item ?? '',
  };  

    const request$ =
      this.editMode && this.editId
        ? this.masterService.updateProduct(this.editId, payload)
        : this.masterService.addProduct(payload);

    request$.subscribe({
      next: () => {
        this.resetForm();
        this.loadProducts();
      },
      error: (err) => {
        const message = err?.error?.message || 'Error saving products';
        alert(message);
      },
    });
  }
  // -------------------------------
  // Edit supplier
  // -------------------------------

  editProduct(product: Product): void {
    console.log(product, 'n');
    this.editMode = true;
    this.editId = product.id;
    this.productForm.patchValue(product);
    this.productForm.patchValue({
      category: product.cid,
    });
    this.productForm.get('product_code')?.disable();
  }
  // -------------------------------
  // Delete product
  // -------------------------------
  deleteProduct(id?: number): void {
    if (!id) return;
    if (confirm('Delete this product?')) {
      this.masterService.deleteProduct(id).subscribe(() => {
        this.loadProducts();
      });
    }
  }
  // -------------------------------
  // Reset form
  // -------------------------------
  resetForm(): void {
    this.productForm.reset({
      min_qty: 0,
      max_qty: 0,
      cost_price: 0,
      mrp: 0,
    });
    this.editMode = false;
    this.editId = undefined;
    this.productForm.get('product_code')?.enable();
  }

  // -------------------------------
  // trackBy (Performance)
  // -------------------------------
  trackByProductId(index: number, product: Product): number | undefined {
    return product.id;
  }

  //---------------------------------
  // filtering the data from table
  // --------------------------------
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  get f() {
    return this.productForm.controls;
  }
}
