export interface User {
  id?: number;
  username: string;
  email: string;
  mobile_number: string;
  role_id: number;
  role_name?: string;
  is_active?: boolean;
}