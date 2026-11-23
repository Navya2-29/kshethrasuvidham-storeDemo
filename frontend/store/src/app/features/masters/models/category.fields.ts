import { FieldConfig } from "./field-config.model";

export const CATEGORY_FIELDS: FieldConfig[] = [
  {
    name: 'category_code',
    label: 'Category Code',
    type: 'text',
    required: true,
    width: '120px',
    disabled: (editMode) => editMode,
    errors: {
      required: 'Code is required'
    }
  },
  {
    name: 'category_name',
    label: 'Category Name',
    type: 'text',
    required: true,
    width: '200px',
    errors: {
      required: 'Name is required'
    }
  },
  {
    name: 'category_nameml',
    label: 'Category Name (Mal)',
    type: 'text',
    required: true,
    width: '200px',
    errors: {
      required: 'Name (mal) is required'
    }
  }
];