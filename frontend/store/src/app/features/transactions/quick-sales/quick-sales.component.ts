import { MasterService } from '../../../core/services/masters/master.service';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatOptionModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { AuthStateService } from '../../../core/services/auth/auth-state.service';
import { Subject, takeUntil } from 'rxjs';
import { SnackbarService } from '../../../core/services/ui/snackbar.service';
import { ReceiptPrintComponent } from '../sales/receipt-print/receipt-print.component';
import { StoreContextService } from '../../../core/services/store-context/store-context.service';

@Component({
  selector: 'app-quick-sales',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatInputModule,
    MatOptionModule,
    ReceiptPrintComponent,
  ],
  templateUrl: './quick-sales.component.html',
  styleUrl: './quick-sales.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickSalesComponent implements OnInit, OnDestroy {
  salesForm!: FormGroup;
  products: any[] = [];
  billAmount: number = 0.0;
  departments: any[] = [];
  stockMap = new Map<number, number>();
  totalSellingPrice: number | string = 0.0;
  totalCgst: number | string = 0.0;
  totalSgst: number | string = 0.0;
  receiptData: any;
  showReceipt = false;

  private destroy$ = new Subject<void>();
  readonly storeContext = inject(StoreContextService);

  @ViewChild(ReceiptPrintComponent) receiptPrint?: ReceiptPrintComponent;

  constructor(
    private fb: FormBuilder,
    private salesService: MasterService,
    private authState: AuthStateService,
    private cdr: ChangeDetectorRef,
    private notification: SnackbarService,
  ) {
    this.buildForm();
  }

  ngOnInit(): void {
    this.buildForm();
    this.addRow();
    this.watchHeaderFields();
    this.watchPaymentMode();
    this.loadInvoiceNo();
    this.loadProducts();
    this.loadDepartments();
    setTimeout(() => {
      this.focusElement('code_0');
    }, 300);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* =========================================
     FORM BUILD
  ========================================= */
  buildForm(): void {
    const today = new Date().toISOString().split('T')[0];
    this.salesForm = this.fb.group({
      order_no: [''],
      invoice_no: ['', Validators.required],
      customer_name: [''],
      customer_mobile: [''],
      receipt_date: [today, Validators.required],
      department_id: ['', Validators.required],
      discount: [0, Validators.min(0)],
      total_amount: [0, Validators.min(0)],
      bill_amount: [0, Validators.min(0)],
      other_amount: [0, Validators.min(0)],
      payment_mode: ['Cash', Validators.required],
      cheque_date: [''],
      cheque_no: [''],
      bank_name: [''],
      items: this.fb.array([]),
    });
  }

  loadDepartments(): void {
    this.storeContext.refresh().then(() => {
      this.departments = this.storeContext.departments();

      const selected =
        this.storeContext.selectedDepartmentId() ?? this.departments[0]?.id;

      if (selected != null) {
        this.salesForm.patchValue({ department_id: selected });
        this.cdr.markForCheck();
        this.loaddepartmentstock(+selected);
      }
    });
  }

  onDepartmentChange(event: Event) {
    const deptId = +(event.target as HTMLSelectElement).value;
    this.storeContext.selectDepartment(deptId);
    this.loaddepartmentstock(deptId);
  }

  loaddepartmentstock(deptId: number) {
    this.salesService.getStockByDepartment(deptId).subscribe({
      next: (res) => {
        this.stockMap.clear();
        res.forEach((item: any) => {
          this.stockMap.set(Number(item.product_id), Number(item.stock_qty));
        });
        this.items.controls.forEach((_, idx) => {
          this.calculateRow(idx);
        });
        this.calculateTotals();
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error loading stock', err),
    });
  }

  loadProducts(): void {
    this.salesService.getProducts().subscribe({
      next: (res) => {
        this.products = res;
        console.log('products', this.products)
        this.cdr.markForCheck();
      },
      error: (err) => console.error(err),
    });
  }

  isDuplicateProduct(productId: number, currentIndex: number): boolean {
    return this.items.controls.some((row, index) => {
      return (
        index !== currentIndex && row.get('product_id')?.value === productId
      );
    });
  }

  getStock(productId: number | string): number {
    if (!productId) return 0;
    const numId = Number(productId);
    return this.stockMap.get(numId) ?? 0;
  }

  onProductSelect(event: any, index: number): void {
    const rawValue = event.target.value;
    if (!rawValue) return;

    const productId = +rawValue;

    if (this.isDuplicateProduct(productId, index)) {
      this.notification.error('This product is already added in another row');
      const row = this.items.at(index);
      row.patchValue({
        product_id: '',
        product_code: '',
        product_name: '',
      }, { emitEvent: false });
      return;
    }

    const product = this.products.find((p) => Number(p.id) === productId);
    if (!product) return;

    const stock = this.getStock(product.id);
    if (this.stockMap.size > 0 && stock <= 0) {
      this.notification.error(`Product "${product.product_name}" is out of stock`);
      const row = this.items.at(index);
      row.patchValue({
        product_id: '',
        product_code: '',
        product_name: '',
      }, { emitEvent: false });
      return;
    }

    const row = this.items.at(index);
    const qty = +row.get('qty')?.value || 1;
    const inHand = Math.max(0, stock - qty);

    row.patchValue({
      product_id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      author: product.author_name,
      publisher: product.publisher_name,
      unit: product.unit,
      mrp: product.mrp,
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      gst_percent: +product.gst_percent,
      stock_qty: stock,
      in_hand_qty: inHand,
    }, { emitEvent: false });

    this.calculateRow(index);
    this.calculateTotals();
    this.focusElement('qty_' + index);
  }

  onProductCodeEnter(index: number): void {
    const row = this.items.at(index);
    const code = row.get('product_code')?.value;

    if (!code) return;

    const product = this.products.find(
      (p) => p.product_code?.toString().toLowerCase() === code.toString().toLowerCase(),
    );

    if (!product) {
      this.notification.error('Product not found');
      return;
    }

    if (this.isDuplicateProduct(product.id, index)) {
      this.notification.error('This product is already added in another row');
      row.patchValue({
        product_id: '',
        product_code: '',
        product_name: '',
      }, { emitEvent: false });
      return;
    }

    const stock = this.getStock(product.id);
    if (this.stockMap.size > 0 && stock <= 0) {
      this.notification.error(`Product "${product.product_name}" is out of stock`);
      row.patchValue({
        product_id: '',
        product_code: '',
        product_name: '',
      }, { emitEvent: false });
      return;
    }

    const qty = +row.get('qty')?.value || 1;
    const inHand = Math.max(0, stock - qty);

    row.patchValue({
      product_id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      author: product.author_name,
      publisher: product.publisher_name,
      unit: product.unit,
      mrp: product.mrp,
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      gst_percent: +product.gst_percent,
      stock_qty: stock,
      in_hand_qty: inHand,
    }, { emitEvent: false });

    this.calculateRow(index);
    this.calculateTotals();
    this.focusElement('qty_' + index);
  }

  loadInvoiceNo(): void {
    this.salesService.getNextInvoice().subscribe({
      next: (res) => {
        this.salesForm.patchValue({
          invoice_no: res.invoice_no,
        });
      },
      error: (err) => {
        console.error('Invoice error', err);
      },
    });
  }

  get items(): FormArray {
    return this.salesForm.get('items') as FormArray;
  }

  createRow(): FormGroup {
    return this.fb.group({
      product_id: ['', Validators.required],
      product_code: ['', Validators.required],
      product_name: ['', Validators.required],
      author: [''],
      publisher: [''],
      qty: [1, [Validators.required, Validators.min(1)]],
      unit: ['Nos'],
      gst_percent: [0],
      mrp: [0.0],
      cost_price: [0.0],
      selling_price: [0.0],
      stock_qty: [0.0],
      in_hand_qty: [0],
      cgst: [0.0],
      sgst: [0.0],
      amount: [0.0],
    });
  }

  addRow(): void {
    const lastIndex = this.items.length - 1;

    if (lastIndex >= 0) {
      const lastRow = this.items.at(lastIndex);
      if (lastRow.invalid) {
        lastRow.markAllAsTouched();
        this.notification.error(
          'Please complete current row before adding new one',
        );
        return;
      }
    }

    const row = this.createRow();
    this.items.push(row);

    row.valueChanges.subscribe(() => {
      this.calculateRow(row);
      this.calculateTotals();
    });

    row.get('product_code')?.valueChanges.subscribe((code: string) => {
      const product = this.products.find((p) => p.product_code === code);
      if (!product) return;

      const stock = this.getStock(product.id);
      if (this.stockMap.size > 0 && stock <= 0) {
        this.notification.error(`Product "${product.product_name}" is out of stock`);
        row.patchValue(
          {
            product_id: '',
            product_name: '',
          },
          { emitEvent: false },
        );
        return;
      }

      const qty = +row.get('qty')?.value || 1;
      const inHand = Math.max(0, stock - qty);

      row.patchValue(
        {
          product_id: product.id,
          product_name: product.product_name,
          author: product.author_name,
          publisher: product.publisher_name,
          unit: product.unit,
          mrp: product.mrp,
          cost_price: product.cost_price,
          selling_price: product.selling_price,
          cgst: product.gst_percent,
          sgst: product.gst_percent,
          stock_qty: stock,
          in_hand_qty: inHand,
        },
        { emitEvent: false },
      );

      this.calculateRow(row);
    });
  }

  removeRow(index: number): void {
    if (this.items.length === 1) {
      this.items.at(0).reset({
        product_id: '',
        product_code: '',
        product_name: '',
        author: '',
        publisher: '',
        qty: 1,
        unit: 'Nos',
        gst_percent: 0,
        mrp: 0.0,
        cost_price: 0.0,
        selling_price: 0.0,
        stock_qty: 0.0,
        in_hand_qty: 0,
        cgst: 0.0,
        sgst: 0.0,
        amount: 0.0,
      });
      this.calculateTotals();
      this.cdr.markForCheck();
      return;
    }
    this.items.removeAt(index);
    this.calculateTotals();
    this.cdr.markForCheck();
  }

  watchHeaderFields(): void {
    this.salesForm
      .get('discount')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.calculateBill());

    this.salesForm
      .get('other_amount')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.calculateBill());
  }

  watchPaymentMode(): void {
    this.salesForm
      .get('payment_mode')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((mode) => {
        const chequeDate = this.salesForm.get('cheque_date');
        const chequeNo = this.salesForm.get('cheque_no');
        const bankName = this.salesForm.get('bank_name');

        if (mode === 'Cheque') {
          chequeDate?.setValidators([Validators.required]);
          chequeNo?.setValidators([Validators.required]);
          bankName?.setValidators([Validators.required]);
        } else {
          chequeDate?.clearValidators();
          chequeNo?.clearValidators();
          bankName?.clearValidators();

          chequeDate?.setValue('');
          chequeNo?.setValue('');
          bankName?.setValue('');
        }

        chequeDate?.updateValueAndValidity();
        chequeNo?.updateValueAndValidity();
        bankName?.updateValueAndValidity();
      });
  }

  trackByRow(index: number, row: any): any {
    return row;
  }

  focusElement(id: string): void {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement) {
          el.select();
        }
      }
    }, 50);
  }

  onCodeEnter(index: number, event: Event): void {
    event.preventDefault();
    const row = this.items.at(index);
    const code = row.get('product_code')?.value;

    if (code) {
      this.onProductCodeEnter(index);
      if (row.get('product_id')?.value) {
        this.focusElement('qty_' + index);
        return;
      }
    }
    this.focusElement('prod_' + index);
  }

  onProductEnter(index: number, event: Event): void {
    event.preventDefault();
    this.focusElement('qty_' + index);
  }

  onQtyEnter(index: number, event: Event): void {
    event.preventDefault();
    this.focusElement('add_' + index);
  }

  onQtyKeyDown(event: KeyboardEvent, row: AbstractControl): void {
    if (event.key === 'ArrowUp') {
      const productId = Number(row.get('product_id')?.value);
      const stock = this.getStock(productId);
      const currentQty = Number(row.get('qty')?.value) || 0;
      if (this.stockMap.size > 0 && currentQty >= stock) {
        event.preventDefault();
        this.notification.error(`Cannot increase quantity. In-hand stock is 0 (Max available: ${stock})`);
      }
    }
  }

  addRowAndFocus(targetIndex?: number): void {
    const prevCount = this.items.length;
    this.addRow();
    if (this.items.length > prevCount) {
      const nextIdx = targetIndex !== undefined && targetIndex < this.items.length ? targetIndex : this.items.length - 1;
      this.focusElement('code_' + nextIdx);
    }
  }

  calculateRow(target: number | AbstractControl): void {
    const row = typeof target === 'number' ? this.items.at(target) : target;
    if (!row) return;

    const rawProductId = row.get('product_id')?.value;
    if (!rawProductId) return;

    const productId = Number(rawProductId);
    let qty = +row.get('qty')?.value || 0;
    const stock = this.getStock(productId);
    const qtyControl = row.get('qty');

    if (this.stockMap.size > 0 && stock > 0 && qty > stock) {
      this.notification.error(`Cannot increase quantity. In-hand stock is 0 (Max available: ${stock})`);
      qty = stock;
      qtyControl?.setValue(stock, { emitEvent: false });
    } else if (this.stockMap.size > 0 && stock <= 0) {
      this.notification.error(`Product is out of stock`);
      qty = 0;
      qtyControl?.setValue(0, { emitEvent: false });
    }

    if (qtyControl?.hasError('stock')) {
      const errors = { ...qtyControl.errors };
      delete errors['stock'];
      qtyControl.setErrors(
        Object.keys(errors).length ? errors : null,
      );
    }

    const price = +row.get('selling_price')?.value || 0;
    const gst = +row.get('gst_percent')?.value || 0;

    const basic = qty * price;
    const cgst = (basic * gst) / 100 / 2;
    const sgst = (basic * gst) / 100 / 2;
    const amount = basic + cgst + sgst;

    const inHand = Math.max(0, stock - qty);

    row.patchValue(
      {
        in_hand_qty: inHand,
        cgst: cgst.toFixed(2),
        sgst: sgst.toFixed(2),
        amount: amount.toFixed(2),
      },
      { emitEvent: false },
    );
  }

  calculateTotals(): void {
    let totalSp = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let total = 0;

    this.items.controls.forEach((row: AbstractControl) => {
      const qty = Number(row.get('qty')?.value || 0);
      const price = Number(row.get('selling_price')?.value || 0);
      const gst = Number(row.get('gst_percent')?.value || 0);

      const basic = qty * price;
      const cgst = (basic * gst) / 200;
      const sgst = (basic * gst) / 200;
      totalSp += basic;
      totalCgst += cgst;
      totalSgst += sgst;
      total += basic + cgst + sgst;
    });

    this.totalSellingPrice = totalSp.toFixed(2);
    this.totalCgst = totalCgst.toFixed(2);
    this.totalSgst = totalSgst.toFixed(2);

    this.salesForm.patchValue(
      {
        total_amount: +total.toFixed(2),
      },
      { emitEvent: false },
    );

    this.calculateBill();
  }

  calculateBill(): void {
    const total = Number(this.salesForm.get('total_amount')?.value || 0);
    const discount = Number(this.salesForm.get('discount')?.value || 0);
    const other = Number(this.salesForm.get('other_amount')?.value || 0);

    const bill = total + other - discount;
    const roundedBill = this.roundAmount(bill);
    this.billAmount = roundedBill;
    this.salesForm.patchValue(
      {
        bill_amount: +bill.toFixed(2),
      },
      { emitEvent: false },
    );
  }

  roundAmount(value: number): number {
    return Math.floor(value + 0.5);
  }

  resetForm(): void {
    while (this.items.length) {
      this.items.removeAt(0);
    }

    const today = new Date().toISOString().split('T')[0];

    this.salesForm.reset({
      order_no: '',
      invoice_no: this.salesForm.get('invoice_no')?.value,
      customer_name: '',
      customer_mobile: '',
      receipt_date: today,
      department_id: this.salesForm.get('department_id')?.value || '',
      discount: 0,
      total_amount: 0,
      bill_amount: 0,
      other_amount: 0,
      payment_mode: 'Cash',
      cheque_date: '',
      cheque_no: '',
      bank_name: '',
    });

    this.billAmount = 0;
    this.addRow();
  }

  saveBill(): void {
    if (this.salesForm.invalid) {
      this.salesForm.markAllAsTouched();
      this.notification.error('Please fill all required fields correctly');
      return;
    }

    const form = this.salesForm.value;

    const payload = {
      order_no: form.order_no,
      invoice_no: form.invoice_no,
      receipt_date: form.receipt_date,
      department_id: form.department_id,
      customer_name: form.customer_name,
      customer_mobile: form.customer_mobile,
      total_amount: form.total_amount,
      discount_amount: form.discount,
      other_charges: form.other_amount,
      bill_amount: form.bill_amount,
      payment_mode: form.payment_mode,
      cheque_date: form.cheque_date,
      cheque_no: form.cheque_no,
      bank_name: form.bank_name,
      created_by: this.authState.user()?.id || null,
      items: this.items.value.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        qty: item.qty,
        unit: item.unit,
        mrp: item.mrp,
        cost_price: item.cost_price,
        selling_price: item.selling_price,
        cgst: item.cgst,
        sgst: item.sgst,
        amount: item.amount,
        gst_percentage: item.gst_percent || 0,
        hsn_code: item.hsn_code || '',
      })),
    };

    this.salesService.saveSale(payload).subscribe({
      next: (res: any) => {
        this.receiptData = res.data;
        this.showReceipt = true;
        this.cdr.detectChanges();

        setTimeout(() => {
          this.receiptPrint?.print();
          this.showReceipt = false;
          this.cdr.detectChanges();
        }, 300);

        this.resetForm();
        this.loadInvoiceNo();
        this.loadProducts();

        const deptId = form.department_id || this.storeContext.selectedDepartmentId() || this.departments[0]?.id;
        if (deptId) {
          this.loaddepartmentstock(+deptId);
        }

        this.notification.success('Sale saved successfully');
        setTimeout(() => {
          this.focusElement('code_0');
        }, 300);
      },
      error: (err) => {
        console.error('Save sale error', err);
        this.notification.error(err?.error?.message || 'Error saving sale');
      },
    });
  }
}
