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
import { ReceiptPrintComponent } from './receipt-print/receipt-print.component';
import { StoreContextService } from '../../../core/services/store-context/store-context.service';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatInputModule,
    MatOptionModule,
    ReceiptPrintComponent
  ],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesComponent implements OnInit, OnDestroy {
  salesForm!: FormGroup;
  products: any[] = [];
  billAmount: number = 0.00;
  departments: any[] = [];
  stockMap = new Map<number, number>();
  totalSellingPrice: number | string = 0.00;
totalCgst: number | string = 0.00;
totalSgst: number | string = 0.00;
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
      customer_mobile: ['', [Validators.pattern('^[0-9]{10}$')]],
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
    this.salesService.getStockByDepartment(deptId).subscribe((res) => {
      this.cdr.markForCheck();
      this.stockMap.clear();

      res.forEach((item: any) => {
        this.stockMap.set(Number(item.product_id), Number(item.stock_qty));
      });

      console.log('Stock Loaded:', this.stockMap);
    });
  }

  // load products
  loadProducts(): void {
    this.salesService.getProducts().subscribe({
      next: (res) => {
        this.products = res;
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
  onProductSelect(event: any, index: number): void {
    const productId = +event.target.value;

    //  CHECK DUPLICATE FIRST
    if (this.isDuplicateProduct(productId, index)) {
      this.notification.error('This product is already added in another row');

      // reset selection
      const row = this.items.at(index);
      row.patchValue({
        product_id: '',
        product_code: '',
        product_name: '',
      });

      return;
    }

    const product = this.products.find((p) => p.id === productId);

    if (!product) return;

    const row = this.items.at(index);

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
    });

    const stock = this.stockMap.get(product.id) || 0;
    console.log(stock);
    row.patchValue(
      {
        stock_qty: stock,
      },
      { emitEvent: false },
    );
    console.log(row.get('stock_qty')?.value);

    this.calculateRow(index);
    this.calculateTotals();
  }

  onProductCodeEnter(index: number): void {
    const row = this.items.at(index);
    const code = row.get('product_code')?.value;

    if (!code) return;

    const product = this.products.find(
      (p) => p.product_code?.toString() === code.toString(),
    );

    if (!product) {
      alert('Product not found');
      return;
    }

    row.patchValue({
      product_id: product.id,
      product_name: product.product_name,
      author: product.author_name,
      publisher: product.publisher_name,

      unit: product.unit,

      mrp: product.mrp,
      cost_price: product.cost_price,
      selling_price: product.selling_price,

      gst_percent: +product.gst_percent,
    });

    this.calculateRow(index);
    this.calculateTotals();
  }
  // lod invoice number

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

  /* =========================================
     GETTER
  ========================================= */
  get items(): FormArray {
    return this.salesForm.get('items') as FormArray;
  }

  /* =========================================
     CREATE ITEM ROW
  ========================================= */
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
      mrp: [0.00],
      cost_price: [0.00],
      selling_price: [0.00],
      stock_qty: [0.00],
      cgst: [0.00],
      sgst: [0.00],

      amount: [0.00],
    });
  }

  /* =========================================
     ADD ROW
  ========================================= */
  addRow(): void {
    //  prevent adding new row if last row is invalid
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

    // ➕ create new row
    const row = this.createRow();
    this.items.push(row);

    const rowIndex = this.items.length - 1;

    //  important: auto-calc on change
    row.valueChanges.subscribe(() => {
      this.calculateRow(rowIndex);
      this.calculateTotals(); // if you have totals
    });

    row.get('product_code')?.valueChanges.subscribe((code: string) => {
      const product = this.products.find((p) => p.product_code === code);

      if (!product) return;

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
        },
        { emitEvent: false },
      );

      this.calculateRow(this.items.controls.indexOf(row));
    });
  }

  /* =========================================
     REMOVE ROW
  ========================================= */
  removeRow(index: number): void {
    if (this.items.length === 1) return;

    this.items.removeAt(index);

    this.calculateTotals();
  }

  /* =========================================
     HEADER WATCH
  ========================================= */
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

  /* =========================================
     PAYMENT MODE WATCH
  ========================================= */
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

  trackByRow(index: number): number {
    return index;
  }

  calculateRow(index: number): void {
    const row = this.items.at(index);

    const qty = +row.get('qty')?.value || 0;

    const productId = row.get('product_id')?.value;
    const stock = this.stockMap.get(productId) || 0;

    if (productId && qty > 0) {
      const qtyControl = row.get('qty');
      console.log(stock, 'jddj');
      if (qty > stock) {
        qtyControl?.setErrors({ stock: true });
        qtyControl?.markAsTouched();
        console.log(stock, 'jj');
        this.notification.error(`Only ${stock} items available in stock`);

        return;
      } else {
        if (qtyControl?.hasError('stock')) {
          const errors = qtyControl.errors;
          delete errors?.['stock'];

          qtyControl.setErrors(
            Object.keys(errors || {}).length ? errors : null,
          );
        }
      }
    }
    const price = +row.get('selling_price')?.value || 0;
    const gst = +row.get('gst_percent')?.value || 0;

    const basic = qty * price;

    // GST split
    const cgst = (basic * gst) / 100 / 2;
    const sgst = (basic * gst) / 100 / 2;

    const amount = basic + cgst + sgst;

    row.patchValue(
      {
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
    //  SET FORM VALUE
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
    this.billAmount =roundedBill;
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
      invoice_no: this.salesForm.get('invoice_no')?.value, // keep generated invoice
      customer_name: '',
      customer_mobile: '',
      receipt_date: today,
      department_id: '',

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
      next: (res:any) => {

        // 1. store bill
      this.receiptData = res.data;

      // 2. show receipt component
      this.showReceipt = true;

      this.cdr.detectChanges();

      // 3. auto print after render
      setTimeout(() => {
        this.receiptPrint?.print();

        this.showReceipt = false;
        this.cdr.detectChanges();
      }, 300);

      this.resetForm();
      this.loadInvoiceNo();
    }
  });
      
    
  }
}
