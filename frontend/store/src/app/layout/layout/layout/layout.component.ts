import { RouterOutlet } from '@angular/router';
import { Component, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HeaderComponent } from '../../header/header/header.component';
import { SidebarComponent } from '../../sidebar/sidebar/sidebar.component';
import { LayoutStateService } from '../../service/layout-state.service';
import { DashbordTitleComponent } from '../../../features/dashboard/dashbord-title/dashbord-title.component';
import { StoreContextService } from '../../../core/services/store-context/store-context.service';
import { DepartmentSelectDialogComponent } from '../../../shared/components/department-select-dialog/department-select-dialog.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [HeaderComponent,SidebarComponent,RouterOutlet,DashbordTitleComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit {
  private readonly storeContext = inject(StoreContextService);
  private readonly dialog = inject(MatDialog);

  constructor(public layout: LayoutStateService) {}

  ngOnInit(): void {
    this.storeContext.refresh().then((needsPrompt) => {
      if (needsPrompt) {
        this.promptForDepartment();
      }
    });
  }

  private promptForDepartment(): void {
    const dialogRef = this.dialog.open(DepartmentSelectDialogComponent, {
      width: '400px',
      disableClose: true,
      data: this.storeContext.departments(),
    });

    dialogRef.afterClosed().subscribe((selectedId: number | null) => {
      if (selectedId != null) {
        this.storeContext.selectDepartment(selectedId);
      } else {
        // user closed without choosing (shouldn't happen with disableClose) - re-prompt
        this.promptForDepartment();
      }
    });
  }
}
