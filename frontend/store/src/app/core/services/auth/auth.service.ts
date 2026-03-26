import { Injectable } from '@angular/core';
import { LoginRequest, LoginResponse } from '../../../features/auth/models/auth.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
   private API = 'http://localhost:3000/api/auth';
// private API = 'https://storedemoapi.kshethrasuvidham.com/api/auth';
  constructor(private http: HttpClient) {}
  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API}/login`, payload);
  }
  
}
