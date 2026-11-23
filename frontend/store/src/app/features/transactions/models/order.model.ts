export interface OrderItem {
  product_id: number;
  product_name?: string; // for UI display
  author_id?: number;
  publisher_id?: number;
  author_name?: string;
  publisher_name?: string;
  qty: number;
}
export interface Order {
  id?: number; // optional for edit
  order_no: string;
  supplier_id: number;
  order_date: string;
  items: OrderItem[];
}