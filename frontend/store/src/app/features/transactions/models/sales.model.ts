import { SalesItem } from "../models/sales-item.model";

export interface SalesHeader {
  sales_no?: string;
  invoice_no?: string;
  customer_name: string;
  customer_mob?: string;
  department_id: number;
  invoice_date: string;
  total_amount: number;
  discount_amount: number;
  gst_amount?: number;
  other_charges: number;
  bill_amount: number;
}

export interface SalesPayload {
  header: SalesHeader;
  items: SalesItem[];
}
