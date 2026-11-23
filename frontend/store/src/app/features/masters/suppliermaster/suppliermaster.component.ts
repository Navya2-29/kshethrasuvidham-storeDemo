import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Supplier } from '../models/supplier.model';
import { MasterService } from '../../../core/services/masters/master.service';
import { SUPPLIER_FIELDS } from '../models/supplier.fields';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { DynamicTableComponent } from '../../../shared/components/dynamic-table/dynamic-table.component';
import { FieldConfig } from '../models/field-config.model';
import { SUPPLIER_COLUMNS } from '../models/supplier-columns';
import { MasterLayoutComponent } from '../master-layout/master-layout.component';
import { Subject, takeUntil } from 'rxjs';
@Component({
  selector: 'app-suppliermaster',
  standalone: true,
  imports: [
  
    DynamicTableComponent,
    MasterLayoutComponent,
    DynamicFormComponent,
    
  ],
  templateUrl: './suppliermaster.component.html',
  styleUrl: './suppliermaster.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SuppliermasterComponent implements OnInit, OnDestroy {
 form!: FormGroup;

  fields: FieldConfig[] = SUPPLIER_FIELDS;
  columns = SUPPLIER_COLUMNS;

  suppliers: Supplier[] = [];

  editMode = false;
  private editId: number | null = null;

  loading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private masterService: MasterService
  ) {}

  //  INIT
  ngOnInit(): void {
    this.buildForm();
    this.loadSuppliers();
  }

  //  BUILD FORM (Dynamic)
  buildForm() {
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

  //  LOAD DATA
  loadSuppliers() {
    this.masterService.getSuppliers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.suppliers = res,
        error: (err) => console.error(err)
      });
  }

  //  SAVE / UPDATE
  save(data: any) {
    if (this.loading) return;
    this.loading = true;

    const request$ = this.editMode && this.editId
      ? this.masterService.updateSupplier(this.editId, data)
      : this.masterService.addSupplier(data);

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.afterSave(),
        error: () => {
          
          this.loading = false;
        }
      });
  }

  //  EDIT
  editSupplier(data: Supplier) {
    this.editMode = true;
    this.editId = data.id ?? null;

    this.form.patchValue(data);
  }

  //  DELETE
  deleteSupplier(id: number) {
    if (!confirm('Delete this supplier?')) return;

    this.loading = true;

    this.masterService.deleteSupplier(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadSuppliers();
          this.loading = false;
        },
        error: () => {
         
          this.loading = false;
        }
      });
  }

  //  AFTER SAVE
  afterSave() {
    this.reset();
    this.loadSuppliers();
    this.loading = false;
  }

  //  RESET
  reset() {
    this.form.reset();
    this.editMode = false;
    this.editId = null;
  }

  //  CLEANUP
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
