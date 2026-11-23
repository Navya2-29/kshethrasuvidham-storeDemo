export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'date' | 'select'|'password' | 'file' | 'checkbox';
  required?: boolean;
  pattern?: RegExp;
  width?: string;
  disabled?: boolean | ((editMode: boolean) => boolean);
  hidden?: (editMode: boolean, formValue?: any) => boolean;
  readonly?: boolean | ((editMode: boolean) => boolean);
  errors?: {
    required?: string;
    pattern?: string;
    email?: string;
    minlength?: string;
    maxlength?:string;
    mismatch?: string;
  };
  numbersOnly?: boolean;
  options?: { label: string; value: any }[];
  optionsUrl?: string;
  roles?: string[];
  dependsOn?: {
    field: string;
    loadOptions?: (value: any) => { label: string; value: any }[];
  };
  placeholder?: string;
  defaultValue?: any;
}
