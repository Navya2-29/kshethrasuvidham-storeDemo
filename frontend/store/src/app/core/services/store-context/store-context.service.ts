import { Injectable, computed, inject, signal } from '@angular/core';
import { Department } from '../../../features/masters/models/department.model';
import { MasterService } from '../masters/master.service';

const STORAGE_KEY = 'selected_department_id';

@Injectable({
  providedIn: 'root',
})
export class StoreContextService {
  private readonly masterService = inject(MasterService);

  readonly departments = signal<Department[]>([]);
  readonly selectedDepartmentId = signal<number | null>(this.readStoredId());

  readonly isMultiDepartment = computed(() => this.departments().length > 1);

  readonly selectedDepartment = computed(
    () =>
      this.departments().find((d) => d.id === this.selectedDepartmentId()) ??
      null,
  );

  private readStoredId(): number | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  }

  selectDepartment(id: number): void {
    this.selectedDepartmentId.set(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }

  private clearSelection(): void {
    this.selectedDepartmentId.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Loads active departments and reconciles the saved selection against them.
   * Returns true when the caller must prompt the user to pick a department
   * (more than one active department and no still-valid saved selection).
   */
  refresh(): Promise<boolean> {
    return new Promise((resolve) => {
      this.masterService.getDepartments().subscribe({
        next: (depts) => {
          this.departments.set(depts);

          const savedId = this.selectedDepartmentId();
          const stillValid = depts.some((d) => d.id === savedId);

          if (depts.length <= 1) {
            // Single-store (or not-yet-configured): auto-select the only
            // department, if any - no popup needed.
            if (depts.length === 1 && depts[0].id != null) {
              this.selectDepartment(depts[0].id);
            } else {
              this.clearSelection();
            }
            resolve(false);
            return;
          }

          if (!stillValid) {
            this.clearSelection();
          }

          resolve(!stillValid);
        },
        error: () => resolve(false),
      });
    });
  }
}
