import { Component, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MasterService } from '../../../../core/services/masters/master.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
@Component({
  selector: 'app-add-stocktransaction',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule,MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatInputModule,
    MatSortModule,],
  templateUrl: './add-stocktransaction.component.html',
  styleUrl: './add-stocktransaction.component.css'
})
export class AddStocktransactionComponent {
  displayedColumns: string[] = [
      'index',
      'Department',
      'Available quantity',
      
    ];
    dataSource = new MatTableDataSource<any>([]);
  
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;
transferForm!: FormGroup;
product: any;
departments: any[] = [];
 stockList: any[] = [];
constructor(private fb:FormBuilder,private service:MasterService, private router:Router){

}
ngOnInit() {
  this.product = history.state.product;

  this.transferForm = this.fb.group({
    departmentId: [''],
    quantity: [''],
    transferDate: [new Date().toISOString().substring(0,10)]
  });

  this.loadDepartments();
  this.loadStockByProductId(this.product.id)
}

loadDepartments() {
  this.service.getDepartments().subscribe(res => this.departments = res);
}

submitTransfer() {
  if (this.transferForm.invalid) return;

  const payload = {
    productId: this.product.id,
    departmentId: this.transferForm.value.departmentId,
    quantity: this.transferForm.value.quantity,
    transferDate: this.transferForm.value.transferDate
  };

  this.service.transferStock(payload).subscribe({
    next: () => {
      alert('Stock transferred successfully');
      this.loadStockByProductId(this.product.id)
      this.router.navigateByUrl('/transcation/stocktransfer');
    },
    error: err => alert(err.error.message)
  });
}

loadStockByProductId(productId: number) {
  this.service.getProductStock(productId).subscribe({
    next: (res) => {
      this.stockList = res;
this.dataSource.data =this.stockList
      // total available stock
      // this.totalQty = res.reduce(
      //   (sum: number, s: any) => sum + Number(s.quantity),
      //   0
      // );
    },
    error: () => alert('Stock load failed')
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
