export interface DirectEntry {
  id: number;
  product_id: number;

  product_code: string;
  product_name: string;

  author: string;
  publisher: string;

  qty: number;
  cost_price: number;

  entry_date: string;
  remarks: string;
}