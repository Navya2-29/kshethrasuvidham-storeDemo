import {
  Component,
  OnDestroy,
  OnInit,

  ViewEncapsulation,
} from '@angular/core';

import { Category } from '../models/category.model';
import {
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MasterService } from '../../../core/services/masters/master.service';
import { CommonModule } from '@angular/common';
import { FieldConfig } from '../models/field-config.model';
import { CATEGORY_FIELDS } from '../models/category.fields';
import { CATEGORY_COLUMNS } from '../models/category-columns';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { DynamicTableComponent } from '../../../shared/components/dynamic-table/dynamic-table.component';
import { MasterLayoutComponent } from '../master-layout/master-layout.component';

@Component({
  selector: 'app-categorymaster',
  standalone: true,
  imports: [
    DynamicFormComponent,
    DynamicTableComponent,
    MasterLayoutComponent,
  ],
  templateUrl: './categorymaster.component.html',
  styleUrl: './categorymaster.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class CategorymasterComponent implements OnInit {
  form!: FormGroup;
  fields: FieldConfig[] = CATEGORY_FIELDS;
  columns = CATEGORY_COLUMNS;
  categories: Category[] = [];
  editMode = false;
  editId: number | null = null;
  loading = false;
  constructor(
    private fb: FormBuilder,
    private service: MasterService,
  ) {}

  ngOnInit() {
    this.buildForm();
    this.loadCategories();
  }

  buildForm() {
    const group: any = {};

    this.fields.forEach((field) => {
      const validators = [];
      if (field.required) validators.push(Validators.required);
      group[field.name] = ['', validators];
    });

    this.form = this.fb.group(group);
  }

  loadCategories() {
    this.service.getCategories().subscribe((res) => {
      this.categories = res;
    });
  }

  save(data: any) {
    if (this.loading) return;

    this.loading = true;

    const request$ =
      this.editMode && this.editId
        ? this.service.updateCategory(this.editId, data)
        : this.service.addCategory(data);

    request$.subscribe({
      next: () => this.afterSave(),
      error: () => (this.loading = false),
    });
  }

  editCategory(data: any) {
    this.editMode = true;
    this.editId = data.id;
    this.form.patchValue(data);
  }

  deleteCategory(id: number) {
    this.service.deleteCategory(id).subscribe(() => {
      this.loadCategories();
    });
  }

  afterSave() {
    this.reset();
    this.loadCategories();
    this.loading = false;
  }

  reset() {
    this.form.reset();
    this.editMode = false;
    this.editId = null;
  }
}
