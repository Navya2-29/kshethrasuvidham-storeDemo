import { Component, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { NumbersOnlyDirective } from '../../../shared/directives/numbers-only.directive';
import { Supplier } from '../../masters/models/supplier.model';
@Component({
  selector: 'app-order',
  standalone: true,
  imports: [ ReactiveFormsModule,
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
export class OrderComponent {
 orderForm!: FormGroup;
suppliers: any[] = [];
products: any[] = [];

editMode = false;
editId: number | null = null;

displayedColumns = ['order_no','supplier_name','order_date','action'];
dataSource: any[] = [];
constructor(private service:MasterService, private fb:FormBuilder){}
ngOnInit() {
  this.initForm();
  this.addItem();
  this.loadMasters();
  this.loadOrders();
}

initForm() {
  this.orderForm = this.fb.group({
    order_no: [''],
    supplier_id: ['', Validators.required],
    order_date: ['', Validators.required],
    items: this.fb.array([])
  });
}

get items(): FormArray {
  return this.orderForm.get('items') as FormArray;
}

createItem() {
  return this.fb.group({
    product_id: ['', Validators.required],
    qty: [1, Validators.required]
  });
}

addItem() {
  this.items.push(this.createItem());
}

removeItem(i:number){
  this.items.removeAt(i);
}

loadMasters() {
  this.service.getSuppliers().subscribe(r => this.suppliers = r);
  this.service.getProducts().subscribe(r => this.products = r);
}

saveOrder() {
  // const payload = this.orderForm.value;

  // if (this.editMode) {
  //   this.service.updateOrder(this.editId, payload).subscribe(()=>{
  //     alert('Updated');
  //     this.reset();
  //   });
  // } else {
  //   this.service.saveOrder(payload).subscribe(()=>{
  //     alert('Saved');
  //     this.reset();
  //   });
  // }
}

editOrder(row:any) {
  // this.editMode = true;
  // this.editId = row.id;

  // this.service.getOrderById(row.id).subscribe(res=>{
  //   this.orderForm.patchValue(res.header);

  //   this.items.clear();
  //   res.items.forEach((i:any)=>{
  //     const g = this.createItem();
  //     g.patchValue(i);
  //     this.items.push(g);
  //   });
  // });
}

deleteOrder(id:number) {
  // if(confirm('Delete?')){
  //   this.service.deleteOrder(id).subscribe(()=>{
  //     this.loadOrders();
  //   });
  // }
}

loadOrders() {
  // this.service.getAllOrders().subscribe(res=>{
  //   this.dataSource = res;
  // });
}

applyFilter(event:any){
  const val = event.target.value.toLowerCase();
  this.dataSource = this.dataSource.filter((x:any)=>
    x.order_no.toLowerCase().includes(val)
  );
}

reset(){
  this.initForm();
  this.items.clear();
  this.addItem();
  this.editMode = false;
}
}
