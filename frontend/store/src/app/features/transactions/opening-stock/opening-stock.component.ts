import { Component, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { Product } from '../../masters/models/product.model';
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
})
export class OpeningStockComponent {

  openings: any[] = [];

  displayedColumns: string[] = [
    'index',
    'product_name',
    'qty',
    'opening_date',
    
  ];

  dataSource = new MatTableDataSource<any>();
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  products: Product[] = [];
  constructor(
    private fb: FormBuilder,
    private masterService: MasterService,
  ) {}
  openingForm = this.fb.group({
    product_id: ['', Validators.required],
    qty: ['', Validators.required],
    rate: [0, Validators.required],
    amount: [''],
    opening_date: ['', Validators.required],
  });

  get f() {
    return this.openingForm.controls;
  }

  calculateAmount() {
    const qty = Number(this.openingForm.value.qty || 0);
    const rate = Number(this.openingForm.value.rate || 0);

    const amount = qty * rate;

    this.openingForm.patchValue(
      {
        amount: amount.toFixed(2),
      },
      { emitEvent: false },
    );
  }



  loadProducts() {
    this.masterService.getProducts().subscribe({
      next: (res: Product[]) => {
        console.log(res);
        this.products = res;
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  ngOnInit() {
    this.loadProducts();
    this.loadOpenings()
    
  }


  onProductChange(event: any) {
    const selectedId = Number(event.target.value);
    const selectedProduct = this.products.find((p) => p.id === selectedId);
    if (selectedProduct) {
      const mrp = Number(selectedProduct.mrp);

      this.openingForm.patchValue({
        rate: mrp,
      });

      this.calculateAmount();
    }
  }

   // 🔹 Submit
  onSubmit() {
    if (this.openingForm.invalid) return;

    this.masterService.createOpening(this.openingForm.value)
      .subscribe({
        next: (res: any) => {
          alert(res.message);
          this.openingForm.reset();
          this.loadOpenings();
        },
        error: (err) => {
          alert(err.error.error);
        }
      });
  }

  // 🔹 Load Opening List
  loadOpenings() {
    this.masterService.getOpenings().subscribe(res => {
      this.openings = res as any[];
      console.log(this.openings)
      this.dataSource = new MatTableDataSource(this.openings);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }
}
