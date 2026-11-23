import { SalesItem } from "../models/sales-item.model";

export interface SalesHeader {
  order_no?: string;
  invoice_no?: string;
  customer_name: string;
  receipt_date:Date;
  customer_mobile?: string;
  department_id: number;
  invoice_date: string;
  total_amount: number;
  discount_amount: number;
  cheque_date:Date;
  cheque_no:string;
  bank_name:string;
  gst_amount?: number;
  other_charges: number;
  bill_amount: number;
  status:string;
  created_by:string;
  payment_mode:string;
  cancelled_at?:Date;
  cancelled_by?:string;
  cancel_reason?:string;
  updated_at?:Date;
}



export interface SalesPayload {
  header: SalesHeader;
  items: SalesItem[];
}
