import { Component } from '@angular/core';
import { HeaderComponent } from '../../../layout/header/header/header.component';
import { CommonModule } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { MasterService } from '../../../core/services/masters/master.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule,],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
dashboard: any = {};
  loading = false;

  constructor(private dashboardService: MasterService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard() {
    this.loading = true;

    this.dashboardService.getDashboard().subscribe({
      next: (res:any) => {
        this.dashboard = res?.data;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }
}
