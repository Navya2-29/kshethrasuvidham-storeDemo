import { FieldConfig } from "../../masters/models/field-config.model";

export const CHANGE_PASSWORD_FIELDS: FieldConfig[] = [
  {
    name: 'current_password',
    label: 'Current Password',
    type: 'password',
    required: true,
    width: '250px',
    errors: {
      required: 'Current password required'
    }
  },
  {
    name: 'new_password',
    label: 'New Password',
    type: 'password',
    required: true,
    width: '250px',
    errors: {
      required: 'New password required',
      minlength:'Minimum 6 chars'
    }
  },
  {
    name: 'confirm_password',
    label: 'Confirm Password',
    type: 'password',
    required: true,
    width: '250px',
    errors: {
      required: 'Confirm password required',
      mismatch: 'Passwords do not match'
    }
  }
];