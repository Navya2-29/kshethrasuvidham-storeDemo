import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FieldConfig } from '../../../features/masters/models/field-config.model';

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dynamic-form.component.html',
  styleUrl: './dynamic-form.component.css',
})
export class DynamicFormComponent implements OnChanges{
  @Input() form!: FormGroup;
  @Input() fields: FieldConfig[] = [];
  @Input() editMode = false;
  @Input() loading = false;

  @Output() submit = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
 previewUrls: Record<string, string> = {};
  disabledMap: Record<string, boolean> = {};
  controlMap: Record<string, any> = {};

  ngOnChanges( changes: SimpleChanges) {
    if (changes['fields']) {
      console.log('fields received:', this.fields);
    }
    this.disabledMap = {};
    this.controlMap = {};

    this.fields.forEach(field => {
      this.disabledMap[field.name] =
        typeof field.disabled === 'function'
          ? field.disabled(this.editMode)
          : !!field.disabled;

      this.controlMap[field.name] = this.form.get(field.name);
    });
  }

 submitForm(event?: Event) {
  event?.preventDefault(); // 🚨 THIS LINE FIXES YOUR ISSUE

  if (this.form.invalid || this.loading) {
    this.form.markAllAsTouched();
    return;
  }

  this.submit.emit(this.form.getRawValue());
}
onFileChange(event: Event, fieldName: string): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  const file = input.files[0];

  const reader = new FileReader();

  reader.onload = () => {
    const base64 = reader.result as string;

    // ✅ THIS IS THE MOST IMPORTANT FIX
    this.form.get(fieldName)?.setValue(base64);

    // preview
    this.previewUrls[fieldName] = base64;
  };

  reader.readAsDataURL(file);
}
}
