import { Component } from '@angular/core';
import { HeaderComponent } from '../../../layout/header/header/header.component';
import { CommonModule } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule,],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
summaryCards = [
    { title: 'Products', value: 120 },
    { title: 'Categories', value: 8 },
    { title: 'Suppliers', value: 15 },
    { title: 'Low Stock', value: 6 }
  ];

  stockItems = [
    { name: 'Paper', qty: '250 bdl' },
    { name: 'Keyboard', qty: '10 Nos' },
    { name: 'Table', qty: '75 Nos' }
  ];

  // ngAfterViewInit() {
  //   new Chart('purchaseChart', {
  //     type: 'bar',
  //     data: {
  //       labels: ['Apr','May','Jun','Jul'],
  //       datasets: [{
  //         label: 'Purchase',
  //         data: [12, 19, 8, 15],
  //         backgroundColor: '#d88e25'
  //       }]
  //     }
  //   });
  // }
  ngOnInit() {
    const behavior = new BehaviorSubject<number>(0);

behavior.subscribe(val => console.log('A:', val));

behavior.next(1);
behavior.next(2);

behavior.subscribe(val => console.log('B:', val));

behavior.next(3);
  }
}
