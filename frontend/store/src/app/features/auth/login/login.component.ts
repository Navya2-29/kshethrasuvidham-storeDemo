import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { CommonModule } from '@angular/common';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { finalize } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SettingService } from '../../../core/services/setting/setting.service';
import { SettingstoreService } from '../../../core/services/setting/settingstore.service';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, MatProgressSpinnerModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements AfterViewInit {
  @ViewChild('usernameInput')
  private usernameInput!: ElementRef<HTMLInputElement>;

  @ViewChild('passwordInput')
  private passwordInput!: ElementRef<HTMLInputElement>;

  // ---------------- Inject ----------------
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly settings = inject(SettingService);
  private settingsStore = inject(SettingstoreService);
  settings$ = this.settingsStore.settings$;
  // ---------------- UI State ----------------
  readonly loading = signal(false);
  readonly hidePassword = signal(true);

  // ---------------- Form ----------------
  readonly loginForm = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  // ---------------- Lifecycle ----------------
  ngAfterViewInit(): void {
    queueMicrotask(() => this.usernameInput?.nativeElement.focus());
  }

  // ---------------- Actions ----------------
  togglePassword(): void {
    this.hidePassword.update((v) => !v);
  }

  focusPassword(): void {
    this.passwordInput?.nativeElement.focus();
  }

  onLogin(): void {
    if (this.loading()) return;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    this.authService
      .login(this.loginForm.getRawValue())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.authState.setAuth(response);
          this.router.navigateByUrl('/dashboard');
        },
      });
  }

  getImageUrl(path: string) {
    return this.settings.getLogoUrl(path);
  }
}
