import { computed, Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {

  private _user = signal<any | null>(null);
  private _token = signal<string | null>(null);

  //  READONLY SIGNALS
  user = this._user.asReadonly();
  token = this._token.asReadonly();

  //  DERIVED STATE
  isLoggedIn = computed(() => !!this._token());

  //  ROLE (IMPORTANT)
  role = computed(() => this._user()?.role_name || null);

  //  ROLE CHECK (VERY USEFUL)
  hasRole = (roles: string[]) =>
    computed(() => roles.includes(this.role() || ''));

  //  LOGIN
  setAuth(res: any) {
    this._token.set(res.accessToken);
    this._user.set(res.user);

    localStorage.setItem('token', res.accessToken);
    localStorage.setItem('user', JSON.stringify(res.user));
  }

  //  INIT (ON APP START)
  initAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token) this._token.set(token);
    if (user) this._user.set(JSON.parse(user));
  }

  // LOGOUT
  logout() {
    this._token.set(null);
    this._user.set(null);

    localStorage.clear();
  }
}
