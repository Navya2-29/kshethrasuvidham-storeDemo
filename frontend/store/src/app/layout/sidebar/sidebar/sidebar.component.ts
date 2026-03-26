import { LayoutStateService } from './../../service/layout-state.service';
import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
export interface MenuItem {
  label: string;
  icon?: string;
  route?: string;
  children?: MenuItem[];
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
        { label: 'Book Master', route: '/master/book'},
      ],
    },
    {
      label: 'Transactions',
      icon: 'remixicon-contacts-line',
      children: [
        {label:"Opening",route:'/transaction/opening-stock'},
        {label:"Order",route:'/transaction/order'}, 
        { label: 'Purchase', route: '/transaction/purchase'},
        { label: 'Stock Transfer', route: '/transaction/stock-transfer'},
        { label: 'Sales', route: '/transaction/sales' },
      ],
    },
    {
      label: 'Reports',
      icon: 'remixicon-contacts-line',
      children: [
        {
          label: 'Purchase Report',
          children: [
            { label: 'ProductWise', route: 'report/purchase/product-wise' },
            { label: 'SupplierWise', route: 'report/purchase/supplier-wise' },
          ],
        },
        { label: 'Stock Report', route: 'report/stock-report' },
        { label: 'Stock Transfer', route: '/reports/stock-transfer' },
      ],
    },
  ];

  constructor(public sidebarService: LayoutStateService) {
    effect(() => {
      const sidebarOpen = this.sidebarService.isOpen();
      if (!sidebarOpen) {
        this.openMenu.set(null);
        this.openSubMenu.set(null);
      }
    },{ allowSignalWrites: true });
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
}
