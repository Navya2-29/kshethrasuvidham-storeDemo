import { FieldConfig } from '../models/field-config.model';

export const settingsFields: FieldConfig[] = [
  {
    name: 'client_name',
    label: 'Client Name',
    type: 'text',
    required: true,
    width: '240px'
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    width: '240px'
  },
  {
    name: 'phone',
    label: 'Phone',
    type: 'text',
    width: '240px'
  },
  {
    name: 'address',
    label: 'Address',
    type: 'textarea',
    width: '240px'
  },
  {
    name: 'installation_date',
    label: 'Installation Date',
    type: 'date',
    width: '240px'
  },
  {
    name: 'expiry_date',
    label: 'Expiry Date',
    type: 'date',
    width: '240px'
  },
  {
    name: 'notify_before_days',
    label: 'Notify Before Days',
    type: 'number',
    width: '240px'
  },
  {
    name: 'notification',
    label: 'Notification Message',
    type: 'textarea',
    width: '240px'
  },
  {
    name: 'printer',
    label: 'Printer Name',
    type: 'text',
    width: '240px'
  },
  {
    name: 'department_count',
    label: 'Department Count',
    type: 'number',
    width: '240px'
  },
  // {
  //   name: 'is_bookstore',
  //   label: 'Book Store',
  //   type: 'checkbox'
  // },
  {
    name: 'version_no',
    label: 'Version No',
    type: 'text',
    width: '240px'
  },
  {
  name: 'logo',
  label: 'Company Logo',
  type: 'file',
  width: '240px'
}
];