import { Component, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { SettingstoreService } from '../../../core/services/setting/settingstore.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashbord-title',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashbord-title.component.html',
  styleUrl: './dashbord-title.component.css',
})
export class DashbordTitleComponent {
  pageTitle: string = '';
  username: any;
settingsStore = inject(SettingstoreService);
  settings$ = this.settingsStore.settings$;
  constructor(
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.username = localStorage.getItem('user.username');
  }

 
    
}
