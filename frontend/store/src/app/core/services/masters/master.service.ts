import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Supplier } from '../../../features/masters/models/supplier.model';
import {  Observable} from 'rxjs';
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

  constructor(private http: HttpClient) {}

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

  getAllPurchases() {
    return this.http.get(`${this.API}/purchases/allpurchase`);
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

  getSaleProduct(){
 return this.http.get<Product[]>(
      `${this.API}/sales/saleproduct`,
    );
  }

  getStockByDepartment(deptId: number){
 return this.http.get<any[]>(
      `${this.API}/sales/stock/department/${deptId}`,
    );
  }

  // ==========================report==========================

  getProductWiseReport(data: any): Observable<any> {
    return this.http.post(
      `${this.API}/report/purchasereport/product-wise`,
      data,
    );
  }

  getStockReport(): Observable<StockReport[]> {
    return this.http.get<StockReport[]>(`${this.API}/report/stock-report`);
  }

  getAvailableStockbystocktransferreport(productId: number) {
    return this.http.get<any>(
      `${this.API}/report/stock-transfer-report/${productId}`,
    );
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

  createDirectEntry(data:any){
 return this.http.post(
   `${this.API}/direct-entry/create`,
   data
 );
}

getDirectEntries(){
 return this.http.get(
   `${this.API}/direct-entry/list`
 );
}

updateDirectEntry(id:number,data:any){
 return this.http.put(
   `${this.API}/direct-entry/update/${id}`,
   data
 );
}

deleteDirectEntry(id:number,data:any){
 return this.http.request(
   'delete',
   `${this.API}/direct-entry/delete/${id}`,
   { body:data }
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
