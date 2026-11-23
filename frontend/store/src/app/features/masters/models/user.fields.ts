import { FieldConfig } from "./field-config.model";

export const USER_FIELDS: FieldConfig[] = [
  {
    name: 'username',
    label: 'Username',
    type: 'text',
    required: true,
    width: '200px',
    disabled: (edit) => edit,
    errors: {
      required: 'Username required'
    }
  },
  {
    name: 'password',
    label: 'Password',
    type: 'text',
    required: true,
    width: '200px',
   hidden: (editMode) => editMode,
    errors: {
      required: 'Password required'
    }
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    required: true,
    width: '220px',
    errors: {
      required: 'Email required',
      email: 'Invalid email'
    }
  },
  {
    name: 'mobile_number',
    label: 'Mobile',
    type: 'text',
    required: true,
    pattern: /^[0-9]{10}$/,
    numbersOnly: true,
    width: '140px',
    errors: {
      required: 'Mobile required',
      pattern: 'Enter valid 10 digit number'
    }
  },
  {
    name: 'role_id',
    label: 'Role',
    type: 'select',
    required: true,
    width: '180px',
    options: [] 
  }
];