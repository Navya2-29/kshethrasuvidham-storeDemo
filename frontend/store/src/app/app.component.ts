import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStateService } from './core/services/auth/auth-state.service';
import { SettingstoreService } from './core/services/setting/settingstore.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'store';

  constructor(
    private authState: AuthStateService,
    private settingsStore: SettingstoreService,
  ) {
    this.authState.initAuth();
  }

  ngOnInit() {
    this.settingsStore.loadSettings();
  }
}
