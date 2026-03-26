import { Component } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

@Component({
  selector: 'app-dashbord-title',
  standalone: true,
  imports: [],
  templateUrl: './dashbord-title.component.html',
  styleUrl: './dashbord-title.component.css',
})
export class DashbordTitleComponent {
  pageTitle: string = '';
  username: any;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.username = localStorage.getItem('user');
  }

  ngOnInit() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => {
          let currentRoute = this.route;
          while (currentRoute.firstChild) {
            currentRoute = currentRoute.firstChild;
          }
          return currentRoute.snapshot.data['title'];
        }),
      )
      .subscribe((title) => {
        this.pageTitle = title;
      });
  }
}
