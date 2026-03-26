import { Component, inject } from '@angular/core';
import { LayoutStateService } from '../../service/layout-state.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  show = false;
  public sidebarService = inject(LayoutStateService);
  private router=inject(Router)
  toggleSidebar() {
    this.sidebarService.toggle();
  }
  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
  toggleProfile() {
  this.show = !this.show;
}
}
