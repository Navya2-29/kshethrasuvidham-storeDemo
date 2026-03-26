export interface Order {
  id?: number;                
  orderno: string;
  supplier_id: string;
  contact_person?: string;
  mobile_number: string;
  address?: string;
  office_number?: string;
  email?: string;
  website?: string;
  gst_number?: string;
}
