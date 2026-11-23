import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnChanges, OnInit, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MasterService } from '../../../core/services/masters/master.service';
import { USER_FIELDS } from '../models/user.fields';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { DynamicTableComponent } from '../../../shared/components/dynamic-table/dynamic-table.component';
import { MasterLayoutComponent } from '../master-layout/master-layout.component';
import { USER_COLUMNS } from '../models/user.columns';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [DynamicFormComponent,DynamicTableComponent,MasterLayoutComponent],
  templateUrl: './user.component.html',
  styleUrl: './user.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserComponent implements OnInit {
     // =========================
  // CORE
  // =========================
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;

  fields = USER_FIELDS; // NEVER mutate directly
  columns = USER_COLUMNS;

  users: any[] = [];

  loading = false;
  editMode = false;
  editId: number | null = null;

  loggedUser: any;

  // =========================
  // CONSTRUCTOR
  // =========================
  constructor(
    private fb: FormBuilder,
    private userService: MasterService,
    private authState: AuthStateService,
    private cdr: ChangeDetectorRef
  ) {}

  // =========================
  // INIT
  // =========================
  ngOnInit(): void {

    this.loggedUser = this.authState.role();

    this.buildForm();
this.updatePasswordValidator();
    this.loadRoles();   // ONLY ONCE
    this.loadUsers();   // ONLY ONCE
  }

  // =========================
  // FORM
  // =========================
  private buildForm(): void {
     const group: any = {};

    this.fields.forEach(field => {
      const validators = [];

      if (field.required) validators.push(Validators.required);
      if (field.pattern) validators.push(Validators.pattern(field.pattern));
      if (field.type === 'email') validators.push(Validators.email);

      group[field.name] = ['', validators];
    });

    this.form = this.fb.group(group);
  }

  // =========================
  // LOAD USERS (MEMORY SAFE)
  // =========================
  loadUsers(): void {
    this.userService.getUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: any) => {
        this.users = res;
        this.cdr.markForCheck();
      });
  }

  // =========================
  // LOAD ROLES (NO MUTATION BUG)
  // =========================
  loadRoles(): void {

    this.userService.getRoles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((roles: any[]) => {

        const options = roles.map(role => ({
          label: role.role_name,
          value: role.id
        }));

        // IMPORTANT: immutable update
        this.fields = USER_FIELDS.map(field =>
          field.name === 'role_id'
            ? { ...field, options }
            : field
        );

        this.cdr.markForCheck();
      });
  }

  // =========================
  // SAVE (SAFE GUARD)
  // =========================
  save(data: any): void {

   
 if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }
   if (this.loading) return; 
    this.loading = true;

    const request$ =
      this.editMode && this.editId
        ? this.userService.updateUser(this.editId, data)
        : this.userService.createUser(data);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.afterSave(),
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  // =========================
  // AFTER SAVE
  // =========================
  private afterSave(): void {

    this.loading = false;

    this.reset();

    this.loadUsers();

    this.cdr.markForCheck();
  }

  // =========================
  // EDIT USER
  // =========================
  editUser(row: any): void {

    this.editMode = true;
    this.editId = row.id;

    this.form.patchValue({
      username: row.username,
      email: row.email,
      mobile_number: row.mobile_number,
      role_id: row.role_id
    });
this.updatePasswordValidator();
    this.cdr.markForCheck();
  }

  // =========================
  // DELETE / STATUS TOGGLE
  // =========================
  deleteUser(id:number): void {
    this.userService.deleteUser(id )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadUsers();
      });
  }

  // =========================
  // RESET (CLEAN - NO SIDE EFFECTS)
  // =========================
  reset(): void {

    this.editMode = false;
    this.editId = null;

    this.form.reset();
    this.updatePasswordValidator();
  }
  private updatePasswordValidator(): void {

  const passwordControl = this.form.get('password');

  if (!passwordControl) return;

  if (this.editMode) {
    // UPDATE → NOT REQUIRED
    passwordControl.clearValidators();
  } else {
    // CREATE → REQUIRED
    passwordControl.setValidators([Validators.required]);
  }

  passwordControl.updateValueAndValidity();
}
}
