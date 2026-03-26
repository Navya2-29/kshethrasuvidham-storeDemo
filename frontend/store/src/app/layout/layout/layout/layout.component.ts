import { RouterOutlet } from '@angular/router';
import { Component } from '@angular/core';
import { HeaderComponent } from '../../header/header/header.component';
import { SidebarComponent } from '../../sidebar/sidebar/sidebar.component';
import { LayoutStateService } from '../../service/layout-state.service';
import { DashbordTitleComponent } from '../../../features/dashboard/dashbord-title/dashbord-title.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [HeaderComponent,SidebarComponent,RouterOutlet,DashbordTitleComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
constructor(public layout: LayoutStateService) {}
}
