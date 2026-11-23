import { Injectable } from '@angular/core';
import { SettingService } from './setting.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingstoreService {

  private settingsSubject = new BehaviorSubject<any>(null);

  settings$ = this.settingsSubject.asObservable();

  constructor(private api: SettingService) {}

  loadSettings(): void {
    this.api.getSettings().subscribe((data) => {
      this.settingsSubject.next(data);
    });
  }

  getSettingsSnapshot() {
    return this.settingsSubject.value;
  }
}
