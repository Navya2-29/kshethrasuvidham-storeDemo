import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { ClientSettings } from '../../../features/masters/models/settings.model';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../constants/api.constants';

@Injectable({
  providedIn: 'root'
})
export class SettingService {

  private readonly baseUrl = API_BASE_URL;

  constructor(private http: HttpClient) {}

  getSettings(): Observable<any> {
    return this.http.get(`${this.baseUrl}/client-settings/settings`);
  }

  saveSettings(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/client-settings/settings`, payload);
  }

  getLogoUrl(path: string) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const origin = this.baseUrl.replace(/\/api\/?$/, '');
    return `${origin}${path}`;
  }
}
