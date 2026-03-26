export interface Product {
  id: number;
  product_code: string;
  product_name: string;
  unit: string;
  category: string;
  min_qty: number;
  max_qty: number;
  cost_price: number;
  mrp: number;
  gst:string;
  auther?:string;
  cid:number,
  product_nameml:string;
  sale_item:string;
  hsn_code:string;
}
