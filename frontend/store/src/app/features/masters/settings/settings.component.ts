import { Component, DestroyRef, inject, ViewEncapsulation } from '@angular/core';
import { ClientSettings } from '../models/settings.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MasterService } from '../../../core/services/masters/master.service';
import { settingsFields } from '../models/settings.fields';
import { SettingService } from '../../../core/services/setting/setting.service';
import { CommonModule } from '@angular/common';
import { MasterLayoutComponent } from '../master-layout/master-layout.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, MasterLayoutComponent, DynamicFormComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(SettingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly fields = settingsFields;

  loading = false;
  editMode = true;

  logoPreview = '';

  form: FormGroup = this.buildForm();

  ngOnInit(): void {
    this.loadSettings();
  }

  // =====================================================
  // FORM BUILD
  // =====================================================
  private buildForm(): FormGroup {
    return this.fb.group({
      id: [1],

      client_name: ['', Validators.required],
      address: [''],
      email: ['', Validators.email],
      phone: [''],

      logo: [''],

      installation_date: [''],
      expiry_date: [''],

      notify_before_days: [7],
      notification: [''],

      status: ['ACTIVE'],

      printer: [''],
      department_count: [1],
      is_bookstore: [false],

      version_no: [''],
    });
  }

  // =====================================================
  // LOAD DATA
  // =====================================================
  loadSettings(): void {
    this.loading = true;

    this.api
      .getSettings()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (res: ClientSettings) => {
          if (!res) return;

          const formatted = {
            ...res,
            installation_date: this.formatDate(res.installation_date),
            expiry_date: this.formatDate(res.expiry_date),
          };

          this.form.patchValue(formatted);

          // right side preview
          if (res.logo) {
            this.logoPreview = this.getLogoUrl(res.logo);
          }
        },
        error: (err) => {
          console.error('Load settings failed:', err);
        },
      });
  }

  // =====================================================
  // SAVE
  // =====================================================
  save(payload: any): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    const body = payload instanceof FormData ? payload : this.preparePayload();

    this.api
      .saveSettings(body)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          // this.loadSettings();
        },
        error: (error: any) => {
          console.error('Save failed:', error);
        },
      });
  }

  // =====================================================
  // RESET
  // =====================================================
  reset(): void {
    this.form.reset({
      id: 1,
      notify_before_days: 7,
      department_count: 1,
      is_bookstore: false,
      status: 'ACTIVE',
    });

    this.logoPreview = '';
  }

  // =====================================================
  // FILE UPLOAD (OPTIONAL DIRECT METHOD)
  // =====================================================
  uploadLogo(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) return;

    const file = input.files[0];

    const formData = new FormData();
    formData.append('logo', file);

    this.loading = true;

    this.api
      .saveSettings(formData)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (res: any) => {
          if (res?.file) {
            this.form.patchValue({ logo: res.file });
            this.logoPreview = this.getLogoUrl(res.file);
          }
        },
        error: (error: any) => {
          console.error('Logo upload failed:', error);
        },
      });
  }

  // =====================================================
  // HELPERS
  // =====================================================
  private preparePayload(): ClientSettings {
    return {
      ...this.form.getRawValue(),
    } as ClientSettings;
  }

  getLogoUrl(path: string): string {
    
    return this.api.getLogoUrl(path);
  }

  isExpired(): boolean {
    if (this.form.value.status === 'EXPIRED') return true;
    if (this.form.value.expiry_date) {
      const exp = new Date(this.form.value.expiry_date);
      const now = new Date();
      if (!isNaN(exp.getTime()) && exp < now) {
        return true;
      }
    }
    return false;
  }

  get statusText(): string {
    if (this.isExpired()) return 'EXPIRED';
    return this.form.value.status || 'ACTIVE';
  }

  // date  format
  private formatDate(date: any): string | null {
    if (!date) return null;

    const d = new Date(date);

    if (isNaN(d.getTime())) return null;

    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }
}
