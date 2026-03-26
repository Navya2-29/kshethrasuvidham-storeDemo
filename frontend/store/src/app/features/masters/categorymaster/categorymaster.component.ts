import { Component, ViewChild } from '@angular/core';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Category } from '../models/category.model';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MasterService } from '../../../core/services/masters/master.service';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-categorymaster',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatInputModule,
    MatSortModule,
    MatButtonModule,
  ],
  templateUrl: './categorymaster.component.html',
  styleUrl: './categorymaster.component.css',
})
export class CategorymasterComponent {
  displayedColumns: string[] = ['index', 'code', 'name', 'action'];

  dataSource = new MatTableDataSource<Category>([]);
  categoryForm!: FormGroup;
  editMode = false;
  editId?: number;
  errorMessage = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private fb: FormBuilder,
    private masterService: MasterService,
  ) {}

  ngOnInit() {
    this.categoryForm = this.fb.group({
      category_code: ['', Validators.required],
      category_name: ['', Validators.required],
      category_nameml: ['', Validators.required],
    });

    this.loadCategories();
  }

  loadCategories() {
    this.masterService.getCategories().subscribe((res) => {
      this.dataSource.data = res;
    });
  }

  saveCategory() {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const payload = this.categoryForm.getRawValue();

    if (this.editMode && this.editId) {
      this.masterService.updateCategory(this.editId, payload).subscribe({
        next: () => {
          this.resetForm();
          this.loadCategories();
        },
        error: (err) => {
          const message = err?.error?.message || 'Error saving Category';
          alert(message);
        },
      });
    } else {
      this.masterService.addCategory(payload).subscribe({
        next: () => {
          this.resetForm();
          this.loadCategories();
        },
        error: (err) => {
          const message = err?.error?.message || 'Error saving Category';
          alert(message);
        },
      });
    }
  }

  editCategory(cat: Category) {
    this.editMode = true;
    this.editId = cat.id;

    this.categoryForm.patchValue(cat);
    this.categoryForm.get('category_code')?.disable();
  }

  deleteCategory(id?: number) {
    if (!id) return;

    if (confirm('Delete this category?')) {
      this.masterService.deleteCategory(id).subscribe(() => {
        this.loadCategories();
      });
    }
  }

  resetForm() {
    this.categoryForm.reset();
    this.editMode = false;
    this.editId = undefined;
    this.errorMessage = '';
    this.categoryForm.get('category_code')?.enable();
  }

  get f() {
    return this.categoryForm.controls;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }
}
