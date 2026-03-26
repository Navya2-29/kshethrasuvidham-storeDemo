import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Supplier } from '../../../features/masters/models/supplier.model';
import { catchError, map, Observable, throwError } from 'rxjs';
import { Department } from '../../../features/masters/models/department.model';
import { Product } from '../../../features/masters/models/product.model';
import { PurchasePayload } from '../../../features/transactions/models/purchase.model';

import { Category } from '../../../features/masters/models/category.model';
import { StockReport } from '../../../features/reports/stock-report/model/stock.model';

@Injectable({
  providedIn: 'root',
})
export class MasterService {
  private API = 'http://localhost:3000/api';

  // private API = 'https://storedemoapi.kshethrasuvidham.com/api';

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

  addProduct(data: Product): Observable<any> {
    return this.http.post(`${this.API}/products`, data);
  }

  updateProduct(id: number, data: Product): Observable<any> {
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

getAllPurchases(){
   return this.http.get(`${this.API}/purchases/allpurchase`);
}
getPurchaseById(id: number) {
  return this.http.get<any>(`${this.API}/purchases/${id}`);
}

updatePurchase(id:number,payload:PurchasePayload){
return this.http.post(`${this.API}/purchases/update/${id}`, payload);
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


  
}
