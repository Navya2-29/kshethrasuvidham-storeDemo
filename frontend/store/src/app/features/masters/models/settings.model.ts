export interface ClientSettings {
  id?: number;

  client_name: string;
  address: string;
  email: string;
  phone: string;

  logo?: string;

  installation_date: string;
  expiry_date: string;

  notify_before_days: number;
  notification: string;

  status: 'ACTIVE' | 'EXPIRED';

  printer: string;
  department_count: number;
  is_bookstore: boolean;

  version_no: string;

  created_at?: string;
  updated_at?: string;
}
