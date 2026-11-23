export interface SalesItem {
  product_id?: number;
  product_name:string;
  qty: number;
  unit: string;
  mrp: number;
  cost_price: number;
  selling_price:number;
  discount_amount?:number;
  cgst: number;
  sgst: number;
  amount: number;
  gst_percent:number;
  gst_percentage:number;
  hsn_code:string;
  author_id:string;
  publisher_id:string;

}
