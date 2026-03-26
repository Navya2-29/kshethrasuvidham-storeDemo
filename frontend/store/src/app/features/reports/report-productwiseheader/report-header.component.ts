import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Product } from '../../masters/models/product.model';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { MasterService } from '../../../core/services/masters/master.service';

@Component({
  selector: 'app-report-header',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './report-header.component.html',
  styleUrl: './report-header.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class ReportHeaderComponent {
  searchForm!: FormGroup;
  @Output() formSubmitted = new EventEmitter<any>();
  products: Product[] = [];
  selectedProduct!: Product;
  constructor(
    private fb: FormBuilder,
    private service: MasterService,
  ) {}
  ngOnInit() {
    const today = new Date().toISOString().split('T')[0];

    this.searchForm = this.fb.group({
      product_code: [''],
      product_name: [''],
      from_date: [today],
      to_date: [today],
    });

    this.loadProducts();
    // listen when product code changes
    this.searchForm
      .get('product_code')
      ?.valueChanges.pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((code) => {
        if (code) {
          this.onProductCodeChange(code);
        }
      });

    // When product name changes
    this.searchForm.get('product_name')?.valueChanges.subscribe((name) => {
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
        this.searchForm.patchValue({
          product_name: product.product_name,
        });
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

    this.searchForm.patchValue(
      {
        product_code: product.product_code,
      },
      { emitEvent: false },
    );

    //  CALL STOCK API USING ID
  }
  onSubmit() {
    if (this.searchForm.valid) {
      this.formSubmitted.emit(this.searchForm.value);
    }
  }
}
