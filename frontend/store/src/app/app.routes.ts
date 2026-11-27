import { Routes } from '@angular/router';

export const routes: Routes = [
  // LOGIN (NO LAYOUT)
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },

  // MAIN APP (WITH LAYOUT)
  {
    path: '',
    loadComponent: () =>
      import('./layout/layout/layout/layout.component').then(
        (m) => m.LayoutComponent,
      ),

    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // DASHBOARD
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./features/auth/change-password/change-password.component').then(
            (m) => m.ChangePasswordComponent,
          ),
      },

      // MASTER

      {
        path: 'master/mater-layout',
        loadComponent: () =>
          import('./features/masters/master-layout/master-layout.component').then(
            (m) => m.MasterLayoutComponent,
          ),
      },
      {
        path: 'master/productmaster',
        loadComponent: () =>
          import('./features/masters/productmaster/productmaster.component').then(
            (m) => m.ProductmasterComponent,
          ),
      },
      {
        path: 'master/category',
        loadComponent: () =>
          import('./features/masters/categorymaster/categorymaster.component').then(
            (m) => m.CategorymasterComponent,
          ),
      },
      {
        path: 'master/department',
        loadComponent: () =>
          import('./features/masters/departmentmaster/departmentmaster.component').then(
            (m) => m.DepartmentmasterComponent,
          ),
      },
      {
        path: 'master/supplier',
        loadComponent: () =>
          import('./features/masters/suppliermaster/suppliermaster.component').then(
            (m) => m.SuppliermasterComponent,
          ),
      },
      {
        path: 'master/book',
        loadComponent: () =>
          import('./features/masters/bookmaster/bookmaster.component').then(
            (m) => m.BookmasterComponent,
          ),
      },
      {
        path: 'master/user',
        loadComponent: () =>
          import('./features/masters/user/user.component').then(
            (m) => m.UserComponent,
          ),
      },
      {
        path: 'master/settings',
        loadComponent: () =>
          import('./features/masters/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },

      // TRANSACTIONS

      {
        path: 'transaction/stock-transfer',
        loadComponent: () =>
          import('./features/transactions/stock-transaction/stock-transfer/stock-transfer.component').then(
            (m) => m.StockTransferComponent,
          ),
      },
      {
        path: 'transaction/productitemdetails/:id',
        loadComponent: () =>
          import('./features/transactions/productitemdetails/productitemdetails.component').then(
            (m) => m.ProductitemdetailsComponent,
          ),
      },
      {
        path: 'transaction/stock-transfer/add',
        loadComponent: () =>
          import('./features/transactions/stock-transaction/add-stocktransaction/add-stocktransaction.component').then(
            (m) => m.AddStocktransactionComponent,
          ),
      },
      {
        path: 'transaction/opening-stock',
        loadComponent: () =>
          import('./features/transactions/opening-stock/opening-stock.component').then(
            (m) => m.OpeningStockComponent,
          ),
      },
      {
        path: 'transaction/direct-entry',
        loadComponent: () =>
          import('./features/transactions/direct-entry/direct-entry.component').then(
            (m) => m.DirectEntryComponent,
          ),
      },
      {
        path: 'transaction/order',
        loadComponent: () =>
          import('./features/transactions/order/order.component').then(
            (m) => m.OrderComponent,
          ),
      },
      {
        path: 'transaction/purchase',
        loadComponent: () =>
          import('./features/transactions/purchase/purchase.component').then(
            (m) => m.PurchaseComponent,
          ),
      },
      {
        path: 'transaction/purchase-return-list',
        loadComponent: () =>
          import(
            './features/transactions/purchase-return-list/purchase-return-list.component'
          ).then((m) => m.PurchaseReturnListComponent),
      },
      {
        path: 'transaction/damage-list',
        loadComponent: () =>
          import(
            './features/transactions/damage-list/damage-list.component'
          ).then((m) => m.DamageListComponent),
      },
      {
        path: 'transaction/quicksales',
        loadComponent: () =>
          import('./features/transactions/quick-sales/quick-sales.component').then(
            (m) => m.QuickSalesComponent,
          ),
      },
      {
        path: 'transaction/sales-list',
        loadComponent: () =>
          import('./features/transactions/sales-list/sales-list.component').then(
            (m) => m.SalesListComponent,
          ),
      },
      {
        path: 'transaction/cancelled-sales-list',
        loadComponent: () =>
          import(
            './features/transactions/cancelled-sales-list/cancelled-sales-list.component'
          ).then((m) => m.CancelledSalesListComponent),
      },
      {
        path: 'transaction/quick-sales',
        redirectTo: 'transaction/quicksales',
        pathMatch: 'full',
      },
      {
        path: 'transaction/sales',
        loadComponent: () =>
          import('./features/transactions/sales/sales.component').then(
            (m) => m.SalesComponent,
          ),
      },

      // REPORTS
      {
        path: 'report/purchase/product-wise',
        loadComponent: () =>
          import('./features/reports/puchase-reports/product-wise/product-wise.component').then(
            (m) => m.ProductWiseComponent,
          ),
      },
      {
        path: 'report/purchase/supplier-wise',
        loadComponent: () =>
          import('./features/reports/puchase-reports/supplier-wise/supplier-wise.component').then(
            (m) => m.SupplierWiseComponent,
          ),
      },
      {
        path: 'report/stock',
        loadComponent: () =>
          import('./features/reports/stock-report/stock-report.component').then(
            (m) => m.StockReportComponent,
          ),
      },
      {
        path: 'report/stock-transfer',
        loadComponent: () =>
          import('./features/reports/stock-transfer/stock-transfer.component').then(
            (m) => m.StockTransferComponent,
          ),
      },
    ],
  },

  // WILDCARD
  { path: '**', redirectTo: 'login' },
];
