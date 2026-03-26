import { Component, ViewEncapsulation } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LoginRequest } from '../models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class LoginComponent {
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {}

  loginForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  login() {
    if (this.loginForm.invalid) return;

    this.loading = true;
    const payload:LoginRequest = this.loginForm.getRawValue();
    this.authService.login(payload).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.accessToken);
        localStorage.setItem('role', res.user.role);
        localStorage.setItem('username',res.user.username)
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        alert(err.error?.message || 'Login failed');
        this.loading = false;
      },
    });
  }
}
