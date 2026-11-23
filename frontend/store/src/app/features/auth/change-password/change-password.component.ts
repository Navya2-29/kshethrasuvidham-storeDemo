import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { MasterLayoutComponent } from '../../masters/master-layout/master-layout.component';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MasterService } from '../../../core/services/masters/master.service';
import { CHANGE_PASSWORD_FIELDS } from '../models/change-password.fields';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [DynamicFormComponent, MasterLayoutComponent],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css',
})
export class ChangePasswordComponent {
  private destroyRef = inject(DestroyRef);
  form!: FormGroup;
  fields = CHANGE_PASSWORD_FIELDS;
  loading = false;
  user = this.authState.user;
editMode=false;
  // ==========================
  // CONSTRUCTOR
  // ==========================
  constructor(
    private fb: FormBuilder,
    private service: MasterService,
    private authState: AuthStateService,
    private cdr: ChangeDetectorRef,
  ) {}

  // ==========================
  // INIT
  // ==========================
  ngOnInit(): void {
    this.buildForm();
  }

  // ==========================
  // FORM BUILD
  // ==========================
  private buildForm(): void {
    this.form = this.fb.group(
      {
        current_password: ['', [Validators.required]],

        new_password: [
          '',
          [
            Validators.required,
            Validators.minLength(6),
            Validators.maxLength(50),
          ],
        ],

        confirm_password: ['', [Validators.required]],
      },
      {
        validators: this.passwordMatchValidator(),
      },
    );
  }

  // ==========================
  // PASSWORD MATCH VALIDATOR
  // ==========================
 private passwordMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const newPassword =
      group.get('new_password');

    const confirmPassword =
      group.get('confirm_password');

    if (!newPassword || !confirmPassword) {
      return null;
    }

    const newValue = newPassword.value;
    const confirmValue = confirmPassword.value;

    if (!newValue || !confirmValue) {
      return null;
    }

    if (newValue !== confirmValue) {
      confirmPassword.setErrors({
        ...confirmPassword.errors,
        mismatch: true
      });

      return { mismatch: true };
    }

    // remove mismatch only
    if (confirmPassword.errors?.['mismatch']) {
      const errors = { ...confirmPassword.errors };
      delete errors['mismatch'];

      confirmPassword.setErrors(
        Object.keys(errors).length ? errors : null
      );
    }

    return null;
  };
}

  // ==========================
  // SAVE PASSWORD
  // ==========================
save(data: any): void {

  // -----------------------
  // VALIDATION
  // -----------------------
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  if (this.loading) {
    return;
  }

  // -----------------------
  // USER ID FROM LOGIN STATE
  // -----------------------
  const userId = this.user()?.id;

  if (!userId) {
    return;
  }



  // -----------------------
  // REQUEST PAYLOAD
  // -----------------------
  const payload = {
    password: data.new_password
  };

  // -----------------------
  // API CALL
  // -----------------------
  this.loading = true;
  this.editMode=true
  this.cdr.markForCheck();

  this.service
    .changePassword(
      userId,
      payload
    )
    .pipe(
      takeUntilDestroyed(
        this.destroyRef
      )
    )
    .subscribe({
      next: (res: any) => {

        

        this.loading = false;
this.editMode=false;
        this.reset();
      },

      error: (err) => {

       
this.editMode=false;
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
}

  // ==========================
  // AFTER SUCCESS
  // ==========================
  private afterSave(): void {
    this.editMode=false;
    this.loading = false;

    this.form.reset();

    this.form.markAsPristine();
    this.form.markAsUntouched();

    this.cdr.markForCheck();
  }

  // ==========================
  // CANCEL / RESET
  // ==========================
  reset(): void {
    this.loading = false;
this.editMode=false;
    this.form.reset();

    this.form.markAsPristine();
    this.form.markAsUntouched();

    this.cdr.markForCheck();
  }
}
