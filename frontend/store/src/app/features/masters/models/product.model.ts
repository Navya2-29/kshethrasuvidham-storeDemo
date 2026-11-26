export interface NamedRef {
  id: number;
  author_name?: string;
  publisher_name?: string;
}

export interface Product {
  id: number;
  product_code: string;
  product_name: string;
  product_nameml: string;
  unit: string;
  category: number;
  cid: number;
  min_qty: number;
  max_qty: number;
  cost_price: number;
  mrp: number;
  gst_percent: number;
  auther?: string;
  sale_item: string;
  hsn_code: string;
  author_id?: number;
  publisher_id?: number;
  selling_price: number;
  is_price_editable?: number | boolean;
  author_name?: string;
  publisher_name?: string;
  authors?: NamedRef[];
  publishers?: NamedRef[];
  created_by?: number;
  created_by_name?: string;
  is_active?: number;
  created_at?: string;
  updated_at?: string;
  current_stock?: number;
}
  export interface ProductPayload {
  product_code: string;
  product_name: string;
  product_nameml: string;
  unit: string;

  category: number;

  min_qty: number;
  max_qty: number;

  cost_price: number;
  mrp: number;
  selling_price: number;
  is_price_editable?: number | boolean;
  gst_percent: number;

  sale_item: string;
  hsn_code?: string;

  author_ids?: number[];
  publisher_ids?: number[];
}
