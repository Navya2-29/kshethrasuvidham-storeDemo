import { Component, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../../masters/models/product.model';
import { MasterService } from '../../../../core/services/masters/master.service';
@Component({
  selector: 'app-stock-transfer',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatInputModule,
    MatSortModule,
  ],
  templateUrl: './stock-transfer.component.html',
  styleUrl: './stock-transfer.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class StockTransferComponent {
  displayedColumns: string[] = ['index', 'Department', 'Quantity', 'action'];
  dataSource = new MatTableDataSource<any>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  productForm!: FormGroup;
  products: Product[] = [];
  selectedProduct!: Product;
  stockList: any[] = [];
  totalQty = 0;
  constructor(
    private router: Router,
    private service: MasterService,
    private fb: FormBuilder,
  ) {}

  ngOnInit() {
    this.productForm = this.fb.group({
      product_code: [''],
      product_name: [''],
    });

    this.loadProducts();
    // listen when product code changes
    this.productForm
      .get('product_code')
      ?.valueChanges.pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((code) => {
        if (code) {
          this.onProductCodeChange(code);
        }
      });

    // When product name changes
    this.productForm.get('product_name')?.valueChanges.subscribe((name) => {
      if (name) this.onProductNameChange(name);
    });
  }

  //-------------------------------------------
  // get the product list
  // -------------------------------------------
  loadProducts() {
    this.service.getProducts().subscribe({
      next: (res) => {
        this.products = res;
      },
      error: (err) => {
        console.error('Failed to load products', err);
      },
    });
  }

  //-------------------------------------------
  // get the product name based on product code
  // -------------------------------------------
  onProductCodeChange(code: string) {
    if (!code || code.trim().length === 0) return;

    this.service.getProductByCode(code).subscribe({
      next: (product) => {
        console.log(product);
        this.selectedProduct = product;
        this.productForm.patchValue({
          product_name: product.product_name,
        });

        this.loadStockByProductId(product.id);
      },
      error: (err) => {
        if (err.status === 404) {
          alert('Product not found');
        }
      },
    });
  }
  //---------------------------------
  // get the product code based on product name
  // --------------------------------
  onProductNameChange(name: string) {
    const product = this.products.find((p) => p.product_name === name);

    if (!product) return;

    this.selectedProduct = product;

    this.productForm.patchValue(
      {
        product_code: product.product_code,
      },
      { emitEvent: false },
    );

    //  CALL STOCK API USING ID
    this.loadStockByProductId(product.id);
  }
  //---------------------------------
  // get stock based on product search
  // --------------------------------
  loadStockByProductId(productId: number) {
    this.service.getProductStock(productId).subscribe({
      next: (res) => {
        this.stockList = res;
        this.dataSource.data = this.stockList;
        // total available stock
        this.totalQty = res.reduce(
          (sum: number, s: any) => sum + Number(s.total_available),
          0,
        );
      },
      error: () => alert('Stock load failed'),
    });
  }
  movetoaddstocktransfer() {
    this.router.navigate(['transaction/stock-transfer/add'], {
      state: { product: this.selectedProduct },
    });
  }
  //---------------------------------
  // filtering the data from table
  // --------------------------------
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }
}
