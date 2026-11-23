export interface OpeningStock {
  id: number;

  product_id: number;
  product_code: string;
  product_name: string;

  author_id?: number;
  publisher_id?: number;
  author_name?: string;
  publisher_name?: string;

  qty: number;
  cost_price: number;

  opening_date: string;
  financial_year: string;

  remarks?: string;

  created_by?: number;
  created_at?: string;

  updated_by?: number;
  updated_at?: string;
}