import { PurchaseItem } from "./purchase-item.model";

export interface Purchase {
  order_no: string;
  invoice_no: string;
  supplier_id: number;
 
  invoice_date: string;
  receipt_date: string;
   created_by:string |null ;
  items: PurchaseItem[];

  total_amount: number;
  discount_amount: number;
  gst_amount?: number;
  other_charges: number;
  bill_amount: number;
}
export interface PurchasePayload {
  id?:string;
  header: Omit<Purchase, 'items'>;
  items: PurchaseItem[];
}