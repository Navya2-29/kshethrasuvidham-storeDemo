import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MasterService } from '../../../core/services/masters/master.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Product } from '../../masters/models/product.model';
import { StockTransferReport } from './model/stock-transfer.model';

@Component({
  selector: 'app-stock-transfer',
  standalone: true,
  imports: [ReactiveFormsModule,CommonModule],
  templateUrl: './stock-transfer.component.html',
  styleUrl: './stock-transfer.component.css'
})
export class StockTransferComponent {
productForm!: FormGroup;
products: Product[] = [];
  selectedProduct!: Product;
  stockList:StockTransferReport[]=[]
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

        // this.getAvailableStockbystocktransferreport(product.id);
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
    this.getAvailableStockbystocktransferreport(product.id);
  }
  //---------------------------------
  // get stock based on product search
  // --------------------------------
  getAvailableStockbystocktransferreport(productId: number) {
    this.service.getAvailableStockbystocktransferreport(productId).subscribe({
      next: (res) => {
        this.stockList = res.data;
        // this.dataSource.data = this.stockList;
        // total available stock
        // this.totalQty = res.reduce(
        //   (sum: number, s: any) => sum + Number(s.total_available),
        //   0,
        // );
      },
      error: () => alert('Stock load failed'),
    });
  }
}
