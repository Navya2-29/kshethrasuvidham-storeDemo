import { Component, ViewChild, ViewEncapsulation } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Department } from '../models/department.model';
import { MasterService } from '../../../core/services/masters/master.service';
@Component({
  selector: 'app-departmentmaster',
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
  templateUrl: './departmentmaster.component.html',
  styleUrl: './departmentmaster.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class DepartmentmasterComponent {
  displayedColumns: string[] = [
    'index',
    'code',
    'department',
    'action',
  ];
  dataSource = new MatTableDataSource<Department>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  departmentForm!: FormGroup;
  departments: Department[] = [];
  editMode = false;
  editId?: number;
  constructor(
    private fb: FormBuilder,
    private masterService: MasterService,
  ) {}

  ngOnInit(): void {
    this.createForm();
    this.loadDepartments();
  }
  
  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  // -------------------------------
  // Load suppliers
  // -------------------------------
  loadDepartments(): void {
    this.masterService.getDepartments().subscribe({
      next: (res: Department[]) => {
        this.departments = res;
        this.dataSource.data = this.departments;
      },
      error: (err) => {
        console.error('Error loading departments', err);
      },
    });
  }
  createForm(): void {
    this.departmentForm = this.fb.nonNullable.group({
      dept_code: ['', Validators.required],
      dept_name: ['', Validators.required],
      dept_nameml: ['',Validators.required],
    });
  }
  // -------------------------------
  // Save / Update supplier
  // -------------------------------
  saveDepartment(): void {
    if (this.departmentForm.invalid) {
      this.departmentForm.markAllAsTouched();
      return;
    }

    const payload: Department = this.departmentForm.value;

    if (this.editMode && this.editId) {
    // UPDATE
    this.masterService.updateDepartment(this.editId, payload).subscribe({
      next: () => {
        this.resetForm();
        this.loadDepartments();
      },
      error: (err) => {
       const message = err?.error?.message || 'Error saving Department';
          alert(message);
      },
    });
  } else {
    // ADD
    this.masterService.addDepartment(payload).subscribe({
      next: () => {
        this.resetForm();
        this.loadDepartments();
      },
      error: (err) => {
        const message = err?.error?.message || 'Error saving Department';
          alert(message);
      },
    });
  }
  }

  // -------------------------------
  // Edit supplier
  // -------------------------------
  editDepartment(dept: Department): void {
    this.editMode = true;
    this.editId = dept.id;

    this.departmentForm.patchValue({
      dept_code: dept.dept_code,
      dept_name: dept.dept_name,
      dept_nameml: dept.dept_nameml,
    });
    this.departmentForm.get('dept_code')?.disable();
  }
  // -------------------------------
  // Delete supplier
  // -------------------------------
  deleteDepartment(id?: number): void {
    if (!id) return;

    if (confirm('Delete this department?')) {
      this.masterService.deleteDepartment(id).subscribe(() => {
        this.loadDepartments();
      });
    }
  }
  // -------------------------------
  // Reset form
  // -------------------------------
  resetForm(): void {
    this.departmentForm.reset();
    this.editMode = false;
    this.editId = undefined;
    this.departmentForm.get('dept_code')?.enable();
  }
  // -------------------------------
  // trackBy (Performance)
  // -------------------------------
  trackByDeptId(index: number, dept: Department): number | undefined {
    return dept.id;
  }
   get f() {
  return this.departmentForm.controls;
}
  //---------------------------------
  // filtering the data from table
  // --------------------------------
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }
  

}
