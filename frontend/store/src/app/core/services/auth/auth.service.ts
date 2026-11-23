import { Injectable } from '@angular/core';
import {
  LoginRequest,
  LoginResponse,
} from '../../../features/auth/models/auth.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../constants/api.constants';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API = `${API_BASE_URL}/auth`;
  constructor(private http: HttpClient) {}
  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API}/login`, payload);
  }
}
