import { Component } from '@angular/core';
import { MasterService } from '../../../core/services/masters/master.service';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-productitemdetails',
  standalone: true,
  imports: [CommonModule,],
  templateUrl: './productitemdetails.component.html',
  styleUrl: './productitemdetails.component.css'
})
export class ProductitemdetailsComponent {
summary: any = {
  openingStock: 0,
  purchase: { totalQty: 0, freeQty: 0, total: 0 },
  directEntry: 0,
  sales: 0,
  stock: { availableStock: 0 },
  qtyInHand: 0
};
  departments: any[] = [];
  products: any[] = [];

  selectedProductId !:number;

  constructor(private stockService: MasterService,private route: ActivatedRoute) {}

  ngOnInit() {
    this.selectedProductId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadData();
    console.log(this.selectedProductId )
  }

  loadData() {
    this.stockService.getProductSummary(this.selectedProductId)
      .subscribe((res: any) => this.summary = res.data);

    this.stockService.getDepartmentStock(this.selectedProductId)
      .subscribe((res: any) =>   this.departments = Array.isArray(res) ? res : res?.data || []);

    this.stockService.getAllProductsStock()
      .subscribe((res: any) => this.products = res);
  }
}
