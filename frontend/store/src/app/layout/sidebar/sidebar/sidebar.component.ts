import { LayoutStateService } from './../../service/layout-state.service';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { SettingstoreService } from '../../../core/services/setting/settingstore.service';
import { SettingService } from '../../../core/services/setting/setting.service';
import { StoreContextService } from '../../../core/services/store-context/store-context.service';
export interface MenuItem {
  label: string;
  icon?: string;
  route?: string;
  children?: MenuItem[];
  bookstoreOnly?: boolean;
  multiDepartmentOnly?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  openMenu = signal<string | null>(null);
  openSubMenu = signal<string | null>(null);
  settingsStore = inject(SettingstoreService);
  settings$ = this.settingsStore.settings$;
  private destroyRef = inject(DestroyRef);
  isBookstore = signal(false);
  storeContext = inject(StoreContextService);
  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'remixicon-home-8-line', route: '/dashboard' },
    {
      label: 'Masters',
      icon: 'remixicon-contacts-line',
      children: [
        { label: 'Supplier Details', route: '/master/supplier' },
        { label: 'Department Master', route: '/master/department' },
        { label: 'Category Master', route: '/master/category' },
        { label: 'Product Master', route: '/master/productmaster' },
        { label: 'Author / Publisher Master', route: '/master/book', bookstoreOnly: true },
        { label: 'User Management', route: '/master/user' },
        { label: 'Settings', route: '/master/settings' },
      ],
    },
    {
      label: 'Transactions',
      icon: 'remixicon-contacts-line',
      children: [
        { label: 'Opening', route: '/transaction/opening-stock' },
        { label: 'Direct-entry', route: '/transaction/direct-entry' },
        { label: 'Order', route: '/transaction/order' },
        { label: 'Purchase', route: '/transaction/purchase' },
        { label: 'Stock Transfer', route: '/transaction/stock-transfer', multiDepartmentOnly: true },
        { label: 'Sales', route: '/transaction/sales' },
      ],
    },
    // {
    //   label: 'Reports',
    //   icon: 'remixicon-contacts-line',
    //   children: [
    //     {
    //       label: 'Purchase Report',
    //       children: [
    //         { label: 'ProductWise', route: 'report/purchase/product-wise' },
    //         { label: 'SupplierWise', route: 'report/purchase/supplier-wise' },
    //       ],
    //     },
    //     { label: 'Stock Report', route: 'report/stock-report' },
    //     { label: 'Stock Transfer', route: '/reports/stock-transfer' },
    //   ],
    // },
  ];

  constructor(
    public sidebarService: LayoutStateService,
    private setting: SettingService,
  ) {
    effect(
      () => {
        const sidebarOpen = this.sidebarService.isOpen();
        if (!sidebarOpen) {
          this.openMenu.set(null);
          this.openSubMenu.set(null);
        }
      },
      { allowSignalWrites: true },
    );

    this.settings$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => this.isBookstore.set(!!settings?.is_bookstore));
  }

  toggleMenu(menu: string) {
    if (!this.sidebarService.isOpen()) {
      return;
    }
    const isOpening = this.openMenu() !== menu;
    this.openMenu.set(isOpening ? menu : null);
    if (isOpening) {
      this.openSubMenu.set(null);
    }
  }

  toggleSubMenu(menu: string) {
    if (!this.sidebarService.isOpen()) return;
    const isOpening = this.openSubMenu() !== menu;
    this.openSubMenu.set(isOpening ? menu : null);
  }

  getImageUrl(path: string) {
    return this.setting.getLogoUrl(path);
  }
}
