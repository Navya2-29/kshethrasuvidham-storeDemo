import { Component } from '@angular/core';
import { StockReport } from './model/stock.model';
import { MasterService } from '../../../core/services/masters/master.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stock-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stock-report.component.html',
  styleUrl: './stock-report.component.css'
})
export class StockReportComponent {
 stockList: StockReport[] = [];

  constructor(private stockService: MasterService) {}

  ngOnInit(): void {
    this.loadStock();
  }

  loadStock() {
    this.stockService.getStockReport().subscribe({
      next: (res) => {
        this.stockList = res;
      },
      error: (err) => console.error(err)
    });
  }
}
