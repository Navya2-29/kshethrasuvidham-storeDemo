import { Component, inject } from '@angular/core';
import { LayoutStateService } from '../../service/layout-state.service';
import { Router, RouterModule } from '@angular/router';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { SettingstoreService } from '../../../core/services/setting/settingstore.service';
import { StoreContextService } from '../../../core/services/store-context/store-context.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  show = false;
  public sidebarService = inject(LayoutStateService);
  private router = inject(Router);
  private auth = inject(AuthStateService);
  readonly storeContext = inject(StoreContextService);
  user = this.auth.user;
  settings$ = this.settingsStore.settings$;

  constructor(private settingsStore: SettingstoreService) {}
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
  openChangePassword() {
    this.show = false;

    // simple navigation approach
    this.router.navigate(['/change-password']);
  }
}
