import { Component } from '@angular/core';
import { MasterService } from '../../../../core/services/masters/master.service';
import { CommonModule } from '@angular/common';
import { ReportHeaderComponent } from '../../report-productwiseheader/report-header.component';

@Component({
  selector: 'app-product-wise',
  standalone: true,
  imports: [CommonModule, ReportHeaderComponent],
  templateUrl: './product-wise.component.html',
  styleUrl: './product-wise.component.css',
})
export class ProductWiseComponent {
  reportTitle: string = '';
  productname!: string;
  reportData: any[] = [];
  totalAmount: number = 0;
  totalDiscount: number = 0;
  totalTax: number = 0;
  showResult = false;

  constructor(private reportService: MasterService) {}

  receiveData(data: any) {
    console.log('Received from child:', data);
    this.productname = data.product_name;
    const fromDate = data.from_date ? this.formatDate(data.from_date) : '';
    const toDate = data.to_date ? this.formatDate(data.to_date) : '';
    this.reportTitle = fromDate && toDate
      ? `Purchase Report for the Period from ${fromDate} to ${toDate}`
      : `Purchase Report`;

    this.reportService.getProductWiseReport(data).subscribe((res) => {
      if (res.success) {
        this.reportData = res.data;
        this.totalAmount = res.total || 0;
        this.totalDiscount = res.total_discount || 0;
        this.totalTax = res.total_tax || 0;
        this.showResult = true;
      }
    });
  }

  formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
}
