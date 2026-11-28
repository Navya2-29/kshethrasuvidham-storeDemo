import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Supplier } from '../../../features/masters/models/supplier.model';
import { Observable, Subject } from 'rxjs';
import { Department } from '../../../features/masters/models/department.model';
import { Product, ProductPayload } from '../../../features/masters/models/product.model';
import { PurchasePayload } from '../../../features/transactions/models/purchase.model';
import { Category } from '../../../features/masters/models/category.model';
import { StockReport } from '../../../features/reports/stock-report/model/stock.model';
import { Order } from '../../../features/transactions/models/order.model';
import { API_BASE_URL } from '../../constants/api.constants';
@Injectable({
  providedIn: 'root',
})
export class MasterService {
  private readonly API = API_BASE_URL;
  private readonly STOCK_ADJ_KEY = 'store_local_stock_adjustments';

  // Real-time stock change event stream across Quick Sales, Product Master, and Cancelled Bills
  private stockUpdatedSubject = new Subject<{
    type: 'SALE_CANCELLED' | 'SALE_CREATED' | 'STOCK_CHANGED';
    departmentId?: number;
    items?: any[];
  }>();

  readonly stockUpdated$ = this.stockUpdatedSubject.asObservable();

  getAllStockAdjustments(): Record<string, number> {
    try {
      const raw = localStorage.getItem(this.STOCK_ADJ_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  getStockAdjustment(productId: number | string): number {
    if (!productId) return 0;
    const map = this.getAllStockAdjustments();
    return Number(map[String(productId)]) || 0;
  }

  recordStockAdjustment(productId: number | string, deltaQty: number): void {
    if (!productId || !deltaQty) return;
    try {
      const map = this.getAllStockAdjustments();
      const current = Number(map[String(productId)]) || 0;
      map[String(productId)] = current + deltaQty;
      localStorage.setItem(this.STOCK_ADJ_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('Failed to record stock adjustment', e);
    }
  }

  notifyStockUpdated(event: {
    type: 'SALE_CANCELLED' | 'SALE_CREATED' | 'STOCK_CHANGED';
    departmentId?: number;
    items?: any[];
  }): void {
    if (event.type === 'SALE_CANCELLED' && event.items && Array.isArray(event.items)) {
      event.items.forEach((it: any) => {
        const pId = Number(it.product_id || it.id);
        const qty = Number(it.qty || 0);
        if (pId && qty > 0) {
          this.recordStockAdjustment(pId, qty);
        }
      });
    }
    this.stockUpdatedSubject.next(event);
  }

  constructor(private http: HttpClient) { }

  // ================= SUPPLIER =================
  getSuppliers() {
    return this.http.get<Supplier[]>(`${this.API}/suppliers`);
  }

  addSupplier(data: Supplier) {
    return this.http.post(`${this.API}/suppliers`, data);
  }

  updateSupplier(id: number, data: Supplier) {
    return this.http.put(`${this.API}/suppliers/${id}`, data);
  }

  deleteSupplier(id: number) {
    return this.http.delete(`${this.API}/suppliers/${id}`);
  }

  // ================= PRODUCT =================
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API}/products`);
  }

  getProductsReport(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API}/products/report`);
  }

  addProduct(data: ProductPayload): Observable<any> {
    return this.http.post(`${this.API}/products`, data);
  }

  updateProduct(id: number, data: ProductPayload): Observable<any> {
    return this.http.put(`${this.API}/products/${id}`, data);
  }

  deleteProduct(id: number): Observable<any> {
    return this.http.delete(`${this.API}/products/${id}`);
  }
  getProductByCode(code: string) {
    return this.http.get<Product>(`${this.API}/products/by-code/${code}`);
  }

  // ================= DEPARTMENT =================
  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(`${this.API}/departments`);
  }

  addDepartment(data: Department): Observable<any> {
    return this.http.post(`${this.API}/departments`, data);
  }

  updateDepartment(id: number, data: Department): Observable<any> {
    return this.http.put(`${this.API}/departments/${id}`, data);
  }

  deleteDepartment(id: number): Observable<any> {
    return this.http.delete(`${this.API}/departments/${id}`);
  }

  // ============= PUCHASE ITEM =====================
  getNextPurchaseNo(): Observable<{ purchase_no: string }> {
    return this.http.get<{ purchase_no: string }>(
      `${this.API}/purchase/next-number`,
    );
  }

  savePurchase(payload: PurchasePayload) {
    return this.http.post(`${this.API}/purchases`, payload);
  }

  getAllPurchases(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/purchases/allpurchase`, {
      headers: { 'skip-error-notification': 'true' },
    });
  }
  getPurchaseById(id: number) {
    return this.http.get<any>(`${this.API}/purchases/${id}`);
  }

  updatePurchase(id: number, payload: PurchasePayload) {
    return this.http.post(`${this.API}/purchases/update/${id}`, payload);
  }

  cancelPurchase(id: number, payload: { cancel_reason: string; cancelled_by: string | null }) {
    return this.http.post(`${this.API}/purchases/cancel/${id}`, payload);
  }

  // ==================categories==========================

  getCategories() {
    return this.http.get<Category[]>(`${this.API}/categories`);
  }

  addCategory(data: Category) {
    return this.http.post(`${this.API}/categories`, data);
  }

  updateCategory(id: number, data: Category) {
    return this.http.put(`${this.API}/categories/${id}`, data);
  }

  deleteCategory(id: number) {
    return this.http.delete(`${this.API}/categories/${id}`);
  }

  // ==================STOCK==========================
  getProductStock(productId: number) {
    return this.http.get<any>(`${this.API}/stocks/${productId}`);
  }

  // ================== DAMAGE RECORDS ==================
  getDamageRecords(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/damage`, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  createDamageRecord(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/damage`, data, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  deleteDamageRecord(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API}/damage/${id}`, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  transferStock(data: any) {
    return this.http.post(`${this.API}/stocks/transfer`, data);
  }

  // ====================sales===========================

  getProductsByDepartment(deptId: number) {
    return this.http.get<any[]>(`${this.API}/sales/products/${deptId}`);
  }

  saveSale(data: any) {
    return this.http.post(`${this.API}/sales`, data);
  }
  getNextInvoice() {
    return this.http.get<{ invoice_no: string }>(
      `${this.API}/sales/next-invoice`,
    );
  }

  getSaleProduct() {
    return this.http.get<Product[]>(
      `${this.API}/sales/saleproduct`,
    );
  }

  getStockByDepartment(deptId: number) {
    return this.http.get<any[]>(
      `${this.API}/sales/stock/department/${deptId}`,
    );
  }

  getAllSales(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/sales/all`, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  getSaleById(id: number): Observable<any> {
    return this.http.get<any>(`${this.API}/sales/${id}`, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  cancelSale(
    id: number,
    data: {
      cancel_reason: string;
      cancelled_by?: string | null;
      payment_return_method?: string;
    },
  ): Observable<any> {
    return this.http.put(`${this.API}/sales/cancel/${id}`, data, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  getCancelledSales(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/sales/cancelled`, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  // ========================== Reports ==========================

  getPurchaseReport(filter?: any): Observable<any> {
    return this.http.post<any>(`${this.API}/report/purchasereport`, filter || {}, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  getPurchaseBillReport(filter?: any): Observable<any> {
    return this.http.post<any>(`${this.API}/report/purchasebillreport`, filter || {}, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  getPurchaseReturnReport(filter?: any): Observable<any> {
    return this.http.post<any>(`${this.API}/report/purchasereturnreport`, filter || {}, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  getSalesReport(filter?: any): Observable<any> {
    return this.http.post<any>(`${this.API}/report/salesreport`, filter || {}, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  getSalesBillReport(filter?: any): Observable<any> {
    return this.http.post<any>(`${this.API}/report/salesbillreport`, filter || {}, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  getItemWiseSalesReport(filter?: any): Observable<any> {
    return this.http.post<any>(`${this.API}/report/itemwisesalesreport`, filter || {}, {
      headers: { 'skip-error-notification': 'true' },
    });
  }

  getProductWisePurchaseReport(data: any): Observable<any> {
    return this.http.post<any>(
      `${this.API}/report/productwisepurchasereport`,
      data,
    );
  }

  // Backward compatibility alias for product-wise purchase report
  getProductWiseReport(data: any): Observable<any> {
    return this.getProductWisePurchaseReport(data);
  }

  getStockReport(): Observable<StockReport[]> {
    return this.http.get<StockReport[]>(`${this.API}/report/stockreport`);
  }

  getStockTransferReport(productId: number): Observable<any> {
    return this.http.get<any>(
      `${this.API}/report/stocktransferreport/${productId}`,
    );
  }

  getAvailableStockbystocktransferreport(productId: number) {
    return this.getStockTransferReport(productId);
  }

  // ================opening ==========================
  createOpening(data: any) {
    return this.http.post(`${this.API}/opening/create`, data);
  }

  getOpenings() {
    return this.http.get(`${this.API}/opening/list`);
  }
  updateOpening(
    id: number,
    payload: any
  ): Observable<any> {
    return this.http.put(
      `${this.API}/opening/update/${id}`,
      payload
    );
  }

  /* DELETE */
  deleteOpening(
    id: number,
    payload?: any
  ): Observable<any> {
    return this.http.request(
      'delete',
      `${this.API}/opening/delete/${id}`,
      {
        body: payload || {},
      }
    );
  }
  // book
  getAll() {
    return this.http.get<any[]>(`${this.API}/author`);
  }

  create(data: any) {
    return this.http.post(`${this.API}/author`, data);
  }

  update(id: number, data: any) {
    return this.http.put(`${this.API}/author/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete(`${this.API}/author/${id}`);
  }

  // orderform
  getNextOrderNo() {
    return this.http.get<{ order_no: string }>(`${this.API}/orders/next-number`);
  }

  createOrder(data: any) {
    return this.http.post(`${this.API}/orders`, data);
  }

  getOrders() {
    return this.http.get<Order[]>(`${this.API}/orders`);
  }

  getOrderById(id: number) {
    return this.http.get(`${this.API}/orders/${id}`);
  }

  getOrderByNumber(orderNo: string) {
    return this.http.get<any>(`${this.API}/orders/by-number/${encodeURIComponent(orderNo)}`);
  }

  updateOrder(id: number, data: any) {
    return this.http.put(`${this.API}/orders/${id}`, data);
  }

  deleteOrder(id: number) {
    return this.http.delete(`${this.API}/orders/${id}`);
  }

  // product summery

  getDepartmentStock(productId: number) {
    return this.http.get(
      `${this.API}/product-summary/department-stock/${productId}`,
    );
  }

  getAllProductsStock() {
    return this.http.get(`${this.API}/product-summary/all-products-stock`);
  }

  getProductSummary(productId: number) {
    return this.http.get(
      `${this.API}/product-summary/all-product/${productId}`,
    );
  }

  // ================= PUBLISHER =================

  getPublishers(): Observable<any> {
    return this.http.get(`${this.API}/publishers`);
  }

  createPublisher(data: any): Observable<any> {
    return this.http.post(`${this.API}/publishers`, data);
  }

  updatePublisher(id: number, data: any): Observable<any> {
    return this.http.put(`${this.API}/publishers/${id}`, data);
  }

  deletePublisher(id: number): Observable<any> {
    return this.http.delete(`${this.API}/publishers/${id}`);
  }

  // ================= direct entry =================

  createDirectEntry(data: any) {
    return this.http.post(
      `${this.API}/direct-entry/create`,
      data
    );
  }

  getDirectEntries() {
    return this.http.get(
      `${this.API}/direct-entry/list`
    );
  }

  updateDirectEntry(id: number, data: any) {
    return this.http.put(
      `${this.API}/direct-entry/update/${id}`,
      data
    );
  }

  deleteDirectEntry(id: number, data: any) {
    return this.http.request(
      'delete',
      `${this.API}/direct-entry/delete/${id}`,
      { body: data }
    );
  }



  // -------------user-----------------------


  getRoles() {
    return this.http.get<any[]>(`${this.API}/roles`);
  }


  getUsers(): Observable<any> {
    return this.http.get(`${this.API}/users`);
  }

  getUser(id: number): Observable<any> {
    return this.http.get(`${this.API}/users/${id}`);
  }

  createUser(data: any): Observable<any> {
    return this.http.post(`${this.API}/users`, data);
  }

  updateUser(id: number, data: any): Observable<any> {
    return this.http.put(`${this.API}/users/${id}`, data);
  }

  deleteUser(id: number) {
    return this.http.delete(
      `${this.API}/users/status/${id}`,

    );
  }

  // -------------------change password-------------------
  changePassword(id: number, data: any) {
    return this.http.post(
      `${this.API}/users/change-password/${id}`,
      data
    );
  }

  // --------------------dashboard--------------
  getDashboard() {
    return this.http.get(
      `${this.API}/dashboard`,

    );
  }
}
