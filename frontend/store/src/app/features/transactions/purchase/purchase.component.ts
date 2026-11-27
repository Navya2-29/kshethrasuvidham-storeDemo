import { Component, OnDestroy, OnInit } from '@angular/core';
import { PurchaseItem } from '../models/purchase-item.model';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MasterService } from '../../../core/services/masters/master.service';
import { CommonModule } from '@angular/common';
import { PurchasePayload } from '../models/purchase.model';
import { NumbersOnlyDirective } from '../../../shared/directives/numbers-only.directive';
import { MatDialog } from '@angular/material/dialog';
import { PurchaseListDialogComponent } from '../../../shared/components/purchase-list-dialog/purchase-list-dialog.component';
import { PurchaseReturnListComponent } from '../purchase-return-list/purchase-return-list.component';
import { SnackbarService } from '../../../core/services/ui/snackbar.service';
import { SettingstoreService } from '../../../core/services/setting/settingstore.service';
import { StoreContextService } from '../../../core/services/store-context/store-context.service';
import { Product } from '../../masters/models/product.model';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-purchase',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, NumbersOnlyDirective],
  templateUrl: './purchase.component.html',
  styleUrl: './purchase.component.css',
})
export class PurchaseComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  filteredSuppliers: any[] = [];
  suppliers: any[] = [];
  products: Product[] = [];
  departments: any[] = [];
  isEditMode: boolean = false;
  editId: number | null = null;
  userId: string | null = '';
  isBookstore = false;
  isSaving = false;

  // Parallel to the `items` FormArray - the resolved Product for each row,
  // so the Author/Publisher dropdowns know which options to offer.
  rowProducts: (Product | null)[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private purchaseService: MasterService,
    private dialog: MatDialog,
    private notification: SnackbarService,
    private settingsStore: SettingstoreService,
    public storeContext: StoreContextService,
  ) {
    this.userId = localStorage.getItem('userId');
  }

  ngOnInit(): void {
    this.initForm();
    this.loadMasters();
    this.addItem();
    this.form.get('supplier_code')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.onSupplierCodeChange();
    });

    // Look up the order shortly after the user stops typing - not on every
    // keystroke (would hammer the API) and not only on blur (too slow).
    this.form.get('order_no')?.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.onOrderNoChange());

    this.settingsStore.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.isBookstore = !!settings?.is_bookstore;
        this.items.controls.forEach((c) => {
          c.get('author_id')?.updateValueAndValidity();
          c.get('publisher_id')?.updateValueAndValidity();
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm() {
    const today = new Date().toISOString().split('T')[0];
    this.form = this.fb.group({
      order_no: [''],
      invoice_no: ['', Validators.required],
      supplier_code: [''],
      supplier_id: ['', Validators.required],

      invoice_date: [today, Validators.required],
      receipt_date: [today, Validators.required],

      items: this.fb.array([]),

      total_amount: [0],
      discount_amount: [0],
      gst_amount: [0],
      other_charges: [0],
      bill_amount: [0],
    });
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  // Only required when the product actually has at least one author/publisher
  // to pick from - otherwise a product with no author/publisher configured
  // would permanently block this row with no way to satisfy the validator.
  private requiredForBookstore = (kind: 'authors' | 'publishers'): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
    if (!this.isBookstore) return null;

    const group = control.parent;
    if (!group) return null;

    const index = this.items.controls.indexOf(group as FormGroup);
    const product = this.rowProducts[index];
    const hasOptions = !!product?.[kind]?.length;

    return hasOptions && !control.value ? { required: true } : null;
  };

  createItem(): FormGroup {
    return this.fb.group({
      product_id: ['', Validators.required],
      hsn_code: [''],
      qty: [1, [Validators.required, Validators.min(1)]],
      free_qty: [0],
      unit: ['Nos'],
      mrp: [0],
      discount: [0],
      cost_price: [0],
      gst_percent: [0],
      cgst: [0],
      sgst: [0],
      amount: [0],
      author_id: this.fb.control<number | null>(null, [this.requiredForBookstore('authors')]),
      publisher_id: this.fb.control<number | null>(null, [this.requiredForBookstore('publishers')]),
    });
  }

  addItem() {
    if (this.canAddNewItem()) {
      this.items.push(this.createItem());
      this.rowProducts.push(null);
    } else {
      this.notification.error('Please fill all required fields in the current row before adding a new item.');
    }
  }

  removeItem(index: number) {
    this.items.removeAt(index);
    this.rowProducts.splice(index, 1);
    this.calculateTotal();
  }

  loadMasters() {
    this.purchaseService.getSuppliers().pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.suppliers = res;
      this.filteredSuppliers = [...this.suppliers];
    });
    this.purchaseService.getProducts().pipe(takeUntil(this.destroy$)).subscribe((r) => (this.products = r));
    this.purchaseService.getDepartments().pipe(takeUntil(this.destroy$)).subscribe((r) => (this.departments = r));
  }

  private applyRowAuthorPublisher(index: number, product: Product | null): void {
    this.rowProducts[index] = product;

    const authorId = product?.authors?.length === 1 ? product.authors[0].id : null;
    const publisherId = product?.publishers?.length === 1 ? product.publishers[0].id : null;

    this.items.at(index).patchValue({ author_id: authorId, publisher_id: publisherId }, { emitEvent: false });
  }

  /* ==========================================
     MIN / MAX STOCK (from Product Master)
     Both checks are based on CURRENT stock alone - they fire as soon as a
     product is picked and don't depend on the qty being typed.
  ========================================== */

  // Current stock below Min Qty - needs restocking.
  isLowStock(product: Product): boolean {
    return !!product.min_qty && (product.current_stock ?? 0) < product.min_qty;
  }

  // Current stock already at/above Max Qty - likely doesn't need more.
  isOverMax(product: Product): boolean {
    return !!product.max_qty && (product.current_stock ?? 0) >= product.max_qty;
  }

  // Either state means the dropdown option gets flagged/coloured.
  needsAttention(product: Product): boolean {
    return this.isLowStock(product) || this.isOverMax(product);
  }

  // "Stock: 5 | Min: 10 | Max: 50" shown under the row once a product is picked.
  stockHint(index: number): string | null {
    const product = this.rowProducts[index];
    if (!product) return null;

    const stock = product.current_stock ?? 0;
    return `Stock: ${stock} | Min: ${product.min_qty || 0} | Max: ${product.max_qty || 0}`;
  }

  minQtyWarning(index: number): string | null {
    const product = this.rowProducts[index];
    if (!product) return null;

    return this.isLowStock(product)
      ? `Current stock (${product.current_stock ?? 0}) is below Min Qty (${product.min_qty})`
      : null;
  }

  maxQtyWarning(index: number): string | null {
    const product = this.rowProducts[index];
    if (!product) return null;

    return this.isOverMax(product)
      ? `Current stock (${product.current_stock ?? 0}) is already at/above Max Qty (${product.max_qty})`
      : null;
  }

  onProductChange(index: number) {
    const row = this.items.at(index);
    const product = this.products.find((p) => p.id == (row.value.product_id as any)) || null;

    this.applyRowAuthorPublisher(index, product);
    this.applyPricingFromProduct(index, product);
  }

  // Fills unit/price/gst fields from the product - deliberately does NOT
  // touch author_id/publisher_id, so callers (like the order autofill) can
  // set those separately without this overwriting them.
  private applyPricingFromProduct(index: number, product: Product | null): void {
    const row = this.items.at(index);

    if (product) {
      const costPrice = Number(product.cost_price || 0);
      const gstPercent = Number(product.gst_percent || 0);
      const cgst = +(gstPercent / 2).toFixed(2);
      const sgst = +(gstPercent / 2).toFixed(2);
      const qty = Number(row.value.qty || 0);

      const baseAmount = +(qty * costPrice).toFixed(2);
      const cgstAmount = +((baseAmount * cgst) / 100).toFixed(2);
      const sgstAmount = +((baseAmount * sgst) / 100).toFixed(2);
      const totalAmount = +(baseAmount + cgstAmount + sgstAmount).toFixed(2);

      row.patchValue(
        {
          unit: product.unit,
          cost_price: costPrice,
          mrp: Number(product.mrp || 0),
          cgst: cgstAmount,
          sgst: sgstAmount,
          amount: totalAmount,
          hsn_code: product.hsn_code || '',
          gst_percent: product.gst_percent,
        },
        { emitEvent: false },
      );

      this.calculateTotal();
    } else {
      row.patchValue(
        {
          unit: '',
          cost_price: 0,
          mrp: 0,
          cgst: 0,
          sgst: 0,
          amount: 0,
          hsn_code: '',
          gst_percent: 0,
        },
        { emitEvent: false },
      );
    }
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  calculateRow(index: number) {
    const row = this.items.at(index);

    const product = this.products.find((p) => p.id == (row.value.product_id as any));

    if (!product) return;

    const qty = Number(row.value.qty || 0);
    const cost = Number(product.cost_price || 0);
    const gstPercent = Number(product.gst_percent || 0);
    const discount = Number(row.value.discount || 0);

    const baseAmount = qty * cost;
    const discountedBase = baseAmount - discount;

    const cgstPercent = gstPercent / 2;
    const sgstPercent = gstPercent / 2;

    const cgstAmount = (discountedBase * cgstPercent) / 100;
    const sgstAmount = (discountedBase * sgstPercent) / 100;

    const totalAmount = discountedBase + cgstAmount + sgstAmount;

    row.patchValue(
      {
        gst_percent: gstPercent,
        cgst: this.round2(cgstAmount),
        sgst: this.round2(sgstAmount),
        amount: this.round2(totalAmount),
      },
      { emitEvent: false },
    );

    this.calculateTotal();
  }

  calculateTotal() {
    let total = 0;
    this.items.controls.forEach((i) => (total += Number(i.value.amount || 0)));
    total = this.round2(total);
    const discount = Number(this.form.value.discount_amount || 0);
    const others = Number(this.form.value.other_charges || 0);
    const bill = this.round2(total - discount + others);

    this.form.patchValue(
      {
        total_amount: total,
        bill_amount: bill,
      },
      { emitEvent: false },
    );
  }

  /* ==========================================
     ORDER NO -> AUTOFILL FROM ORDER
  ========================================== */
  onOrderNoChange(): void {
    const orderNo = this.form.get('order_no')?.value?.toString().trim();
    if (!orderNo) return;

    this.purchaseService.getOrderByNumber(orderNo).subscribe({
      next: (order: any) => {
        if (!order?.items?.length) {
          this.notification.error('No items found for this order number');
          return;
        }

        const supplier = this.suppliers.find((s) => s.id === order.supplier_id);
        this.form.patchValue({
          supplier_id: order.supplier_id,
          supplier_code: supplier ? supplier.supplier_code : this.form.value.supplier_code,
        });

        this.items.clear();
        this.rowProducts = [];

        order.items.forEach((orderItem: any) => {
          const group = this.createItem();
          this.items.push(group);
          this.rowProducts.push(null);

          const index = this.items.length - 1;
          const product = this.products.find((p) => p.id === orderItem.product_id) || null;

          group.patchValue({ product_id: orderItem.product_id, qty: orderItem.qty }, { emitEvent: false });

          // Resolve the row's product (for the Author/Publisher option lists),
          // then restore the exact author/publisher this order line was saved
          // with - applyRowAuthorPublisher alone would only auto-pick when a
          // product has exactly one option, clearing it otherwise.
          this.applyRowAuthorPublisher(index, product);
          group.patchValue(
            {
              author_id: orderItem.author_id || group.value.author_id,
              publisher_id: orderItem.publisher_id || group.value.publisher_id,
            },
            { emitEvent: false },
          );

          this.applyPricingFromProduct(index, product);
        });

        this.notification.success(`Loaded ${order.items.length} item(s) from order ${orderNo}`);
      },
      error: () => {
        this.notification.error(`Order "${orderNo}" not found`);
      },
    });
  }

  save() {
    if (this.form.invalid || this.items.length === 0) {
      this.form.markAllAsTouched();
      const errors = this.getFormValidationErrors();
      this.notification.error(errors[0] || 'Please fill all required fields correctly');
      return;
    }

    const payload: PurchasePayload = {
      header: {
        order_no: this.form.value.order_no,
        invoice_no: this.form.value.invoice_no,
        supplier_id: this.form.value.supplier_id,

        invoice_date: this.form.value.invoice_date,
        receipt_date: this.form.value.receipt_date,
        total_amount: this.form.value.total_amount,
        discount_amount: this.form.value.discount_amount,
        other_charges: this.form.value.other_charges,
        bill_amount: this.form.value.bill_amount,
        created_by: this.userId,
      },
      items: this.form.value.items as PurchaseItem[],
    };

    this.isSaving = true;

    const request$ =
      this.isEditMode && this.editId
        ? this.purchaseService.updatePurchase(this.editId, payload)
        : this.purchaseService.savePurchase(payload);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.resetForm();
      },
      error: (err) => {
        this.isSaving = false;
        console.error(err);
      },
    });
  }

  resetForm() {
    this.initForm();
    this.items.clear();
    this.rowProducts = [];
    this.addItem();

    this.isEditMode = false;
    this.editId = null;
  }

  getFormValidationErrors(): string[] {
    const messages: string[] = [];

    Object.keys(this.form.controls).forEach((key) => {
      const control = this.form.get(key);

      if (control && control.invalid && key !== 'items') {
        if (control.errors?.['required']) {
          messages.push(`${this.getFieldLabel(key)} is required`);
        }
      }
    });

    if (this.items.length === 0) {
      messages.push('At least one product item is required');
    }

    this.items.controls.forEach((item, index) => {
      Object.keys((item as FormGroup).controls).forEach((field) => {
        const fieldControl = item.get(field);

        if (fieldControl && fieldControl.invalid) {
          if (fieldControl.errors?.['required']) {
            messages.push(
              `Row ${index + 1} - ${this.getItemFieldLabel(field)} is required`,
            );
          }
        }
      });
    });

    return messages;
  }

  getFieldLabel(key: string): string {
    const labels: any = {
      invoice_no: 'Invoice Number',
      supplier_id: 'Supplier',
      invoice_date: 'Invoice Date',
      receipt_date: 'Receipt Date',
    };

    return labels[key] || key;
  }

  getItemFieldLabel(field: string): string {
    const labels: any = {
      product_id: 'Product',
      qty: 'Quantity',
      author_id: 'Author',
      publisher_id: 'Publisher',
    };

    return labels[field] || field;
  }

  onSupplierCodeChange() {
    const code = this.form.get('supplier_code')?.value?.toLowerCase() || '';

    this.filteredSuppliers = this.suppliers.filter((s) =>
      s.supplier_code.toLowerCase().includes(code),
    );

    const exactMatch = this.suppliers.find(
      (s) => s.supplier_code.toLowerCase() === code,
    );
    if (exactMatch) {
      this.form.patchValue(
        { supplier_id: exactMatch.id },
        { emitEvent: false },
      );
    } else {
      this.form.patchValue({ supplier_id: null }, { emitEvent: false });
    }
  }

  canAddNewItem(): boolean {
    if (this.items.length === 0) return true;

    const lastIndex = this.items.length - 1;
    const lastRow = this.items.at(lastIndex);

    const requiredFields = ['product_id', 'qty'];

    for (let field of requiredFields) {
      const control = lastRow.get(field);
      if (
        !control ||
        control.invalid ||
        control.value === '' ||
        control.value === null
      ) {
        return false;
      }
    }

    return true;
  }

  listAllpurchase() {
    this.purchaseService.getAllPurchases().subscribe({
      next: (res) => {
        const dialogRef = this.dialog.open(PurchaseListDialogComponent, {
          width: '900px',
          maxWidth: '95vw',
          data: res,
        });

        dialogRef.afterClosed().subscribe((result) => {
          if (!result) return;

          if (result.action === 'edit') {
            this.editPurchase(result.data.id);
          }
        });
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  openPurchaseReturnList() {
    this.dialog.open(PurchaseReturnListComponent, {
      width: '1150px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      data: { isDialog: true },
    });
  }

  editPurchase(id: number) {
    this.purchaseService.getPurchaseById(id).subscribe((res) => {
      this.initForm();
      this.items.clear();
      this.rowProducts = [];

      const formatDate = (date: string) => {
        return date ? date.split('T')[0] : '';
      };

      this.form.patchValue({
        order_no: res.header.order_no,
        invoice_no: res.header.invoice_no,
        supplier_id: res.header.supplier_id,

        invoice_date: formatDate(res.header.invoice_date),
        receipt_date: formatDate(res.header.receipt_date),
        total_amount: res.header.total_amount,
        discount_amount: res.header.discount_amount,
        other_charges: res.header.other_charges,
        bill_amount: res.header.bill_amount,
        created_by: res.header.created_by,
      });

      const supplier = this.suppliers.find(
        (s) => s.id == res.header.supplier_id,
      );
      this.form.patchValue({
        supplier_code: supplier ? supplier.supplier_code : '',
      });

      res.items.forEach((item: any) => {
        const group = this.createItem();

        group.patchValue({
          product_id: item.product_id,
          hsn_code: item.hsn_code || '',
          qty: item.qty,
          free_qty: item.free_qty,
          unit: item.unit,
          mrp: item.mrp,
          cost_price: item.cost_price,
          discount: item.discount,
          cgst: item.cgst,
          sgst: item.sgst,
          amount: item.amount,
          gst_percent: item.gst_percent,
          author_id: item.author_id || null,
          publisher_id: item.publisher_id || null,
        });

        this.items.push(group);
        this.rowProducts.push(this.products.find((p) => p.id === item.product_id) || null);
      });

      this.isEditMode = true;
      this.editId = id;

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
