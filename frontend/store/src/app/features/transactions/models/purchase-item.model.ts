export interface PurchaseItem {
  product_id: number;
  qty: number;
  free_qty:number;
  unit: string;
  mrp: number;
  cost_price: number;
  cgst: number;
  sgst: number;
  amount: number;
  hsn_code:string;
  gst_percent:number;
}
