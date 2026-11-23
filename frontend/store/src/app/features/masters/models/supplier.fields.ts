import { FieldConfig } from "./field-config.model";

export const SUPPLIER_FIELDS: FieldConfig[] = [
  {
    name: 'supplier_code',
    label: 'Supplier Code',
    type: 'text',
    required: true,
    width: '90px',
    disabled: (editMode) => editMode,
    errors: {
      required: 'Supplier Code is required'
    }
  },
  {
    name: 'supplier_name',
    label: 'Name',
    type: 'text',
    required: true,
    width: '240px',
    errors: {
      required: 'Supplier name is required'
    }
  },
  {
    name: 'contact_person',
    label: 'Contact Person',
    type: 'text',
    width: '180px'
  },
  {
    name: 'mobile_number',
    label: 'Mobile Number',
    type: 'text',
    required: true,
    pattern: /^[0-9]{10}$/,
    numbersOnly: true,
    width: '110px',
    errors: {
      required: 'Mobile number is required',
      pattern: 'Enter valid 10 digit mobile number'
    }
  },
  {
    name: 'office_number',
    label: 'Office Number',
    type: 'text',
    numbersOnly: true,
    width: '110px'
  },
  {
    name: 'address',
    label: 'Address',
    type: 'textarea',
    width: '240px'
  },
  {
    name: 'email',
    label: 'E-Mail ID',
    type: 'email',
    width: '240px',
    errors: {
      email: 'Enter valid email'
    }
  },
  {
    name: 'website',
    label: 'Website',
    type: 'text',
    width: '240px'
  },
  {
    name: 'gst_number',
    label: 'GST Number',
    type: 'text',
    pattern: /^[A-Z0-9]{15}$/,
    width: '123px',
    errors: {
      pattern: 'Invalid GST number'
    }
  }
];