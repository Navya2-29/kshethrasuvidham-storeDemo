import { MasterService } from '../../../core/services/masters/master.service';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
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

export interface PendingSale {
  id: string;
  tempId: string;
  createdAt: string;
  customer_name?: string;
  customer_mobile?: string;
  department_id?: number | string;
  receipt_date?: string;
  totalSellingPrice: number | string;
  total_amount: number;
  discount_percent: number;
  discount: number;
  other_amount: number;
  billAmount: number;
  payment_mode: string;
  lastDiscountMode?: 'percent' | 'rupee';
  items: any[];
}

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
  isSaving = false;
  lastDiscountMode: 'percent' | 'rupee' = 'rupee';

  // Pending / Hold Bills
  pendingBills: PendingSale[] = [];
  activePendingId: string | null = null;
  showPendingModal = false;
  viewingPendingBill: PendingSale | null = null;

  // Barcode Scanner detection
  private barcodeBuffer: string = '';
  private lastBarcodeKeyTime: number = 0;
  readonly BARCODE_SCAN_MAX_INTERVAL = 60; // Max ms between keystrokes from a scanner

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
    this.loadPendingBills();
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
      invoice_no: ['Auto on Payment'],
      customer_name: [''],
      customer_mobile: [''],
      receipt_date: [today, Validators.required],
      department_id: ['', Validators.required],
      discount_percent: [0, [Validators.min(0), Validators.max(100)]],
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
        this.products = this.mergePriceEditable(res);
        console.log('products', this.products);
        this.cdr.markForCheck();
      },
      error: (err) => console.error(err),
    });
  }

  private mergePriceEditable(products: any[]): any[] {
    try {
      const raw = localStorage.getItem('store_product_price_editable_overrides');
      const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      return (products || []).map((p) => {
        const idKey = String(p.id);
        const codeKey = p.product_code
          ? String(p.product_code).trim().toLowerCase()
          : '';
        let isEditable = false;
        if (idKey && map[idKey] !== undefined) {
          isEditable = !!map[idKey];
        } else if (codeKey && map[codeKey] !== undefined) {
          isEditable = !!map[codeKey];
        } else {
          isEditable = !!(
            p.is_price_editable === 1 ||
            p.is_price_editable === true ||
            p.is_price_editable === '1' ||
            p.is_price_editable === 'Y'
          );
        }
        return {
          ...p,
          is_price_editable: isEditable ? 1 : 0,
        };
      });
    } catch {
      return products;
    }
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

  getFilteredProducts(row: AbstractControl): any[] {
    const rawVal = row.get('product_name')?.value;
    if (!rawVal || typeof rawVal !== 'string') {
      return this.products;
    }
    const filter = rawVal.trim().toLowerCase();
    if (!filter) {
      return this.products;
    }

    const selectedProdId = row.get('product_id')?.value;
    const selectedProd = this.products.find((p) => p.id === selectedProdId);
    if (selectedProd && selectedProd.product_name?.toLowerCase() === filter) {
      return this.products;
    }

    return this.products.filter(
      (p) =>
        p.product_name?.toLowerCase().includes(filter) ||
        p.product_code?.toString().toLowerCase().includes(filter),
    );
  }

  trackByProductId(index: number, item: any): any {
    return item?.id ?? index;
  }

  selectProduct(product: any, index: number): boolean {
    if (!product) return false;

    if (this.isDuplicateProduct(product.id, index)) {
      this.notification.error('This product is already added in another row');
      const row = this.items.at(index);
      row.patchValue(
        {
          product_id: '',
          product_code: '',
          product_name: '',
          selling_price: 0,
          amount: 0,
          in_hand_qty: 0,
        },
        { emitEvent: false },
      );
      return false;
    }

    const stock = this.getStock(product.id);
    if (this.stockMap.size > 0 && stock <= 0) {
      this.notification.error(`Product "${product.product_name}" is out of stock`);
      const row = this.items.at(index);
      row.patchValue(
        {
          product_id: '',
          product_code: '',
          product_name: '',
          selling_price: 0,
          amount: 0,
          in_hand_qty: 0,
        },
        { emitEvent: false },
      );
      return false;
    }

    const row = this.items.at(index);
    const qty = +row.get('qty')?.value || 1;
    const inHand = Math.max(0, stock - qty);

    row.patchValue(
      {
        product_id: product.id,
        product_code: product.product_code,
        product_name: product.product_name,
        author: product.author_name,
        publisher: product.publisher_name,
        unit: product.unit,
        mrp: product.mrp,
        cost_price: product.cost_price,
        selling_price: product.selling_price,
        is_price_editable: !!(
          product.is_price_editable === 1 ||
          product.is_price_editable === true ||
          product.is_price_editable === '1' ||
          product.is_price_editable === 'Y'
        ),
        gst_percent: +product.gst_percent,
        stock_qty: stock,
        in_hand_qty: inHand,
      },
      { emitEvent: false },
    );

    this.calculateRow(index);
    this.calculateTotals();
    this.cdr.markForCheck();
    this.focusElement('qty_' + index);
    return true;
  }

  onProductSearchChange(index: number, event: Event): void {
    const row = this.items.at(index);
    const text = (event.target as HTMLInputElement).value;
    const currentId = row.get('product_id')?.value;
    const currentProd = this.products.find((p) => p.id === currentId);
    if (currentProd && currentProd.product_name !== text) {
      row.patchValue(
        {
          product_id: '',
          product_code: '',
          selling_price: 0,
          amount: 0,
          in_hand_qty: 0,
        },
        { emitEvent: false },
      );
      this.calculateRow(index);
      this.calculateTotals();
    }
  }

  onProductSelect(event: any, index: number): void {
    const rawValue = event.target.value;
    if (!rawValue) return;
    const productId = +rawValue;
    const product = this.products.find((p) => Number(p.id) === productId);
    if (product) {
      this.selectProduct(product, index);
    }
  }

  onProductCodeEnter(index: number): void {
    const row = this.items.at(index);
    const code = row.get('product_code')?.value;
    if (code) {
      this.processScannedCode(code, index);
    }
  }

  /* =========================================
     BARCODE & SCANNER PROCESSING
  ========================================= */
  processScannedCode(code: string | number, targetRowIndex?: number): boolean {
    if (code === null || code === undefined) return false;
    const cleanCode = code.toString().trim();
    if (!cleanCode) return false;

    // 1. Find product matching product_code / barcode
    const product = this.products.find(
      (p) =>
        p.product_code?.toString().trim().toLowerCase() ===
        cleanCode.toLowerCase(),
    );

    if (!product) {
      this.notification.error(`Product with barcode "${cleanCode}" not found`);
      return false;
    }

    // 2. Check stock
    const stock = this.getStock(product.id);
    if (this.stockMap.size > 0 && stock <= 0) {
      this.notification.error(`Product "${product.product_name}" is out of stock`);
      return false;
    }

    // 3. Check if product is ALREADY added in another row (Duplicate handling for Barcode)
    const existingIndex = this.items.controls.findIndex(
      (r) => Number(r.get('product_id')?.value) === Number(product.id),
    );

    if (existingIndex >= 0) {
      // Product already in bill: increment quantity by 1!
      const existingRow = this.items.at(existingIndex);
      const currentQty = +existingRow.get('qty')?.value || 0;

      if (this.stockMap.size > 0 && currentQty + 1 > stock) {
        this.notification.error(
          `Cannot increase quantity for "${product.product_name}". In-hand stock is 0 (Max available: ${stock})`,
        );
        return false;
      }

      existingRow.patchValue({ qty: currentQty + 1 });
      this.calculateRow(existingIndex);
      this.calculateTotals();
      this.playScanBeep();
      this.notification.success(`Scanned: ${product.product_name} (+1, Total: ${currentQty + 1})`);

      // If user typed/scanned on a separate empty row, clear that row's product_code
      if (targetRowIndex !== undefined && targetRowIndex !== existingIndex) {
        const curRow = this.items.at(targetRowIndex);
        if (!curRow.get('product_id')?.value) {
          curRow.patchValue({ product_code: '' }, { emitEvent: false });
        }
      }

      this.cdr.markForCheck();
      return true;
    }

    // 4. Product is not yet in bill: determine target row
    let rowIndex = targetRowIndex;
    if (rowIndex === undefined || this.items.at(rowIndex)?.get('product_id')?.value) {
      const emptyIndex = this.items.controls.findIndex(
        (r) => !r.get('product_id')?.value,
      );
      if (emptyIndex >= 0) {
        rowIndex = emptyIndex;
      } else {
        this.addRow();
        rowIndex = this.items.length - 1;
      }
    }

    const row = this.items.at(rowIndex);
    // Ensure product_code displays in the Code column
    row.patchValue({ product_code: product.product_code }, { emitEvent: false });

    const success = this.selectProduct(product, rowIndex);
    if (success) {
      this.playScanBeep();
      // Ensure a next empty row is ready for continuous barcode scanning
      const hasEmptyRow = this.items.controls.some((r) => !r.get('product_id')?.value);
      if (!hasEmptyRow) {
        this.addRow();
      }
      const nextEmptyIndex = this.items.controls.findIndex((r) => !r.get('product_id')?.value);
      if (nextEmptyIndex >= 0) {
        setTimeout(() => this.focusElement('code_' + nextEmptyIndex), 80);
      }
    }

    this.cdr.markForCheck();
    return success;
  }

  private playScanBeep(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // AudioContext not supported or requires gesture
    }
  }

  focusActiveCodeInput(): void {
    const emptyIndex = this.items.controls.findIndex((r) => !r.get('product_id')?.value);
    const target = emptyIndex >= 0 ? emptyIndex : 0;
    this.focusElement('code_' + target);
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
      is_price_editable: [false],
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
          is_price_editable: !!(
            product.is_price_editable === 1 ||
            product.is_price_editable === true ||
            product.is_price_editable === '1' ||
            product.is_price_editable === 'Y'
          ),
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
      const handled = this.processScannedCode(code, index);
      if (handled) return;
    }
    this.focusElement('prod_' + index);
  }

  onProductEnter(index: number, event: Event): void {
    event.preventDefault();
    const row = this.items.at(index);
    const productId = row.get('product_id')?.value;

    if (productId) {
      this.focusElement('qty_' + index);
      return;
    }

    const typed = (row.get('product_name')?.value || '').toString().trim().toLowerCase();
    if (!typed) {
      this.focusElement('qty_' + index);
      return;
    }

    let matched = this.products.find(
      (p) =>
        p.product_code?.toString().toLowerCase() === typed ||
        p.product_name?.toLowerCase() === typed,
    );

    if (!matched) {
      matched = this.products.find(
        (p) =>
          p.product_code?.toString().toLowerCase().includes(typed) ||
          p.product_name?.toLowerCase().includes(typed),
      );
    }

    if (matched) {
      this.selectProduct(matched, index);
    } else {
      this.notification.error('Product not found');
    }
  }

  onQtyEnter(index: number, event: Event): void {
    event.preventDefault();
    const row = this.items.at(index);
    if (row.get('is_price_editable')?.value) {
      this.focusElement('rate_' + index);
    } else {
      this.focusElement('add_' + index);
    }
  }

  onRateEnter(index: number, event: Event): void {
    event.preventDefault();
    this.focusElement('add_' + index);
  }

  onRateInput(index: number): void {
    this.calculateRow(index);
    this.calculateTotals();
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
      this.focusElement('prod_' + nextIdx);
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

  onDiscountPercentInput(event: Event): void {
    this.lastDiscountMode = 'percent';
    const input = event.target as HTMLInputElement;
    const rawVal = input.value;

    if (rawVal === '' || rawVal === null) {
      this.salesForm.patchValue(
        {
          discount_percent: '',
          discount: 0,
        },
        { emitEvent: false },
      );
      this.calculateBill();
      this.cdr.markForCheck();
      return;
    }

    let percent = parseFloat(rawVal) || 0;
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;

    const total = Number(this.salesForm.get('total_amount')?.value || 0);
    const rupee = total > 0 ? (total * percent) / 100 : 0;
    const roundedRupee = Number(rupee.toFixed(2));

    this.salesForm.patchValue(
      {
        discount: roundedRupee,
      },
      { emitEvent: false },
    );

    this.calculateBill();
    this.cdr.markForCheck();
  }

  onDiscountRupeeInput(event: Event): void {
    this.lastDiscountMode = 'rupee';
    const input = event.target as HTMLInputElement;
    const rawVal = input.value;

    if (rawVal === '' || rawVal === null) {
      this.salesForm.patchValue(
        {
          discount: '',
          discount_percent: 0,
        },
        { emitEvent: false },
      );
      this.calculateBill();
      this.cdr.markForCheck();
      return;
    }

    let rupee = parseFloat(rawVal) || 0;
    if (rupee < 0) rupee = 0;

    const total = Number(this.salesForm.get('total_amount')?.value || 0);
    const percent = total > 0 ? (rupee / total) * 100 : 0;
    const roundedPercent = Number(percent.toFixed(2));

    this.salesForm.patchValue(
      {
        discount_percent: roundedPercent,
      },
      { emitEvent: false },
    );

    this.calculateBill();
    this.cdr.markForCheck();
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

    const totalAmt = +total.toFixed(2);
    if (this.lastDiscountMode === 'percent') {
      const percent = Number(this.salesForm.get('discount_percent')?.value || 0);
      const rupeeDiscount = totalAmt > 0 ? (totalAmt * percent) / 100 : 0;
      this.salesForm.patchValue(
        { discount: Number(rupeeDiscount.toFixed(2)) },
        { emitEvent: false },
      );
    } else {
      const rupee = Number(this.salesForm.get('discount')?.value || 0);
      const percent = totalAmt > 0 ? (rupee / totalAmt) * 100 : 0;
      this.salesForm.patchValue(
        { discount_percent: Number(percent.toFixed(2)) },
        { emitEvent: false },
      );
    }

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
      invoice_no: 'Auto on Payment',
      customer_name: '',
      customer_mobile: '',
      receipt_date: today,
      department_id: this.salesForm.get('department_id')?.value || '',
      discount_percent: 0,
      discount: 0,
      total_amount: 0,
      bill_amount: 0,
      other_amount: 0,
      payment_mode: 'Cash',
      cheque_date: '',
      cheque_no: '',
      bank_name: '',
    });

    this.activePendingId = null;
    this.lastDiscountMode = 'rupee';
    this.billAmount = 0;
    this.addRow();
  }

  /* =========================================
     PENDING / HOLD BILLS FUNCTIONALITY
  ========================================= */
  loadPendingBills(): void {
    try {
      const data = localStorage.getItem('ks_pending_sales');
      this.pendingBills = data ? JSON.parse(data) : [];
    } catch {
      this.pendingBills = [];
    }
    this.cdr.markForCheck();
  }

  savePendingBills(): void {
    try {
      localStorage.setItem('ks_pending_sales', JSON.stringify(this.pendingBills));
    } catch (e) {
      console.error('Error saving pending bills to localStorage', e);
    }
    this.cdr.markForCheck();
  }

  generateTempId(): string {
    const key = 'ks_hold_counter';
    let counter = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, counter.toString());
    return `HOLD-${String(counter).padStart(3, '0')}`;
  }

  newBill(): void {
    const hasItems = this.items.controls.some(
      (c) => !!c.get('product_id')?.value && Number(c.get('qty')?.value) > 0,
    );

    if (hasItems) {
      const confirmNew = confirm(
        'Start a new bill? Any unheld changes on this screen will be discarded. (Click Cancel and click "Hold Bill" if you want to keep them).',
      );
      if (!confirmNew) return;
    }

    this.activePendingId = null;
    this.resetForm();
    this.notification.success('New bill session started');
    setTimeout(() => this.focusElement('code_0'), 150);
  }

  holdBill(): void {
    const validItems = this.items.controls
      .filter((c) => !!c.get('product_id')?.value && Number(c.get('qty')?.value) > 0)
      .map((c) => c.getRawValue());

    if (!validItems.length) {
      this.notification.error('Cannot hold an empty bill. Please add at least one product.');
      return;
    }

    const tempId = this.activePendingId || this.generateTempId();
    const pendingSale: PendingSale = {
      id: tempId,
      tempId,
      createdAt: new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
      customer_name: this.salesForm.get('customer_name')?.value || '',
      customer_mobile: this.salesForm.get('customer_mobile')?.value || '',
      department_id: this.salesForm.get('department_id')?.value,
      receipt_date: this.salesForm.get('receipt_date')?.value,
      totalSellingPrice: this.totalSellingPrice,
      total_amount: Number(this.salesForm.get('total_amount')?.value || 0),
      discount_percent: Number(this.salesForm.get('discount_percent')?.value || 0),
      discount: Number(this.salesForm.get('discount')?.value || 0),
      other_amount: Number(this.salesForm.get('other_amount')?.value || 0),
      billAmount: this.billAmount,
      payment_mode: this.salesForm.get('payment_mode')?.value || 'Cash',
      lastDiscountMode: this.lastDiscountMode,
      items: validItems,
    };

    const existingIdx = this.pendingBills.findIndex((p) => p.id === tempId);
    if (existingIdx >= 0) {
      this.pendingBills[existingIdx] = pendingSale;
    } else {
      this.pendingBills.unshift(pendingSale);
    }

    this.savePendingBills();
    this.activePendingId = null;
    this.resetForm();
    this.notification.success(`Bill held successfully as ${tempId}`);
    setTimeout(() => this.focusElement('prod_0'), 150);
  }

  openPendingModal(): void {
    this.loadPendingBills();
    this.viewingPendingBill = null;
    this.showPendingModal = true;
    this.cdr.markForCheck();
  }

  closePendingModal(): void {
    this.showPendingModal = false;
    this.viewingPendingBill = null;
    this.cdr.markForCheck();
  }

  resumeBill(bill: PendingSale): void {
    const hasCurrentItems = this.items.controls.some(
      (c) => !!c.get('product_id')?.value && Number(c.get('qty')?.value) > 0,
    );

    if (hasCurrentItems && this.activePendingId !== bill.id) {
      const confirmResume = confirm(
        `Current screen has active items. Discard current screen and load held bill ${bill.tempId}? (Click Cancel and click "Hold Bill" first if you want to keep current items).`,
      );
      if (!confirmResume) return;
    }

    while (this.items.length) {
      this.items.removeAt(0);
    }

    this.salesForm.patchValue(
      {
        customer_name: bill.customer_name || '',
        customer_mobile: bill.customer_mobile || '',
        department_id: bill.department_id || this.salesForm.get('department_id')?.value,
        receipt_date: bill.receipt_date || new Date().toISOString().split('T')[0],
        discount_percent: bill.discount_percent || 0,
        discount: bill.discount || 0,
        other_amount: bill.other_amount || 0,
        payment_mode: bill.payment_mode || 'Cash',
      },
      { emitEvent: false },
    );

    this.lastDiscountMode = bill.lastDiscountMode || 'rupee';

    bill.items.forEach((itemData: any) => {
      const row = this.createRow();
      row.patchValue(
        {
          product_id: itemData.product_id,
          product_code: itemData.product_code,
          product_name: itemData.product_name,
          author: itemData.author || '',
          publisher: itemData.publisher || '',
          qty: itemData.qty,
          unit: itemData.unit || 'Nos',
          gst_percent: itemData.gst_percent || 0,
          mrp: itemData.mrp || 0,
          cost_price: itemData.cost_price || 0,
          selling_price: itemData.selling_price || 0,
          is_price_editable: !!itemData.is_price_editable,
          stock_qty: itemData.stock_qty || 0,
          in_hand_qty: itemData.in_hand_qty || 0,
          cgst: itemData.cgst || 0,
          sgst: itemData.sgst || 0,
          amount: itemData.amount || 0,
        },
        { emitEvent: false },
      );

      row.valueChanges.subscribe(() => {
        this.calculateRow(row);
        this.calculateTotals();
      });

      this.items.push(row);
    });

    if (this.items.length === 0) {
      this.addRow();
    }

    this.activePendingId = bill.tempId;
    this.closePendingModal();
    this.calculateTotals();
    this.notification.success(`Loaded pending bill ${bill.tempId}`);
    setTimeout(() => this.focusElement('qty_0'), 150);
  }

  discardPendingBill(bill: PendingSale, event?: Event): void {
    if (event) event.stopPropagation();
    if (!confirm(`Are you sure you want to cancel and remove pending bill ${bill.tempId}?`)) {
      return;
    }
    this.pendingBills = this.pendingBills.filter((p) => p.id !== bill.id);
    this.savePendingBills();
    if (this.activePendingId === bill.id) {
      this.activePendingId = null;
    }
    if (this.viewingPendingBill?.id === bill.id) {
      this.viewingPendingBill = null;
    }
    this.notification.success(`Pending bill ${bill.tempId} removed`);
    this.cdr.markForCheck();
  }

  viewPendingDetails(bill: PendingSale, event?: Event): void {
    if (event) event.stopPropagation();
    this.viewingPendingBill = bill;
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (this.showPendingModal) {
        this.closePendingModal();
        return;
      }
      if (!this.showReceipt && !this.isSaving) {
        this.saveBill();
      }
      return;
    }

    if (event.key === 'F6') {
      event.preventDefault();
      event.stopPropagation();
      this.holdBill();
      return;
    }

    if (event.key === 'F7') {
      event.preventDefault();
      event.stopPropagation();
      if (this.showPendingModal) {
        this.closePendingModal();
      } else {
        this.openPendingModal();
      }
      return;
    }

    if (event.key === 'F9') {
      event.preventDefault();
      event.stopPropagation();
      this.newBill();
      return;
    }

    if (event.key === 'F2') {
      event.preventDefault();
      event.stopPropagation();
      this.setPaymentMode('Cash');
      return;
    }

    if (event.key === 'F3') {
      event.preventDefault();
      event.stopPropagation();
      this.setPaymentMode('UPI');
      return;
    }

    if (event.key === 'F4') {
      event.preventDefault();
      event.stopPropagation();
      this.setPaymentMode('Card');
      return;
    }

    // Hardware Barcode Scanner listener
    const now = Date.now();
    const timeDiff = now - this.lastBarcodeKeyTime;

    if (event.key === 'Enter') {
      if (this.barcodeBuffer.length >= 2 && timeDiff <= this.BARCODE_SCAN_MAX_INTERVAL * 2) {
        const scannedCode = this.barcodeBuffer.trim();
        this.barcodeBuffer = '';
        this.lastBarcodeKeyTime = 0;

        const activeEl = document.activeElement as HTMLElement | null;
        const isCodeInput = activeEl?.id?.startsWith('code_');

        if (!isCodeInput && scannedCode) {
          event.preventDefault();
          event.stopPropagation();
          this.processScannedCode(scannedCode);
          return;
        }
      }
      this.barcodeBuffer = '';
      return;
    }

    if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    if (timeDiff > this.BARCODE_SCAN_MAX_INTERVAL && this.barcodeBuffer.length > 0) {
      this.barcodeBuffer = '';
    }

    this.barcodeBuffer += event.key;
    this.lastBarcodeKeyTime = now;
  }

  setPaymentMode(mode: string): void {
    this.salesForm.patchValue({ payment_mode: mode });
    this.notification.success(`Payment Mode: ${mode}`);
    this.cdr.markForCheck();
  }

  saveBill(): void {
    if (this.isSaving) return;

    // Clean up trailing empty row if there's at least one valid filled row
    if (this.items.length > 1) {
      const lastRow = this.items.at(this.items.length - 1);
      if (!lastRow.get('product_id')?.value && !lastRow.get('product_name')?.value) {
        this.items.removeAt(this.items.length - 1);
        this.calculateTotals();
      }
    }

    if (this.salesForm.invalid) {
      this.salesForm.markAllAsTouched();
      this.notification.error('Please fill all required fields correctly');
      return;
    }

    this.isSaving = true;
    const form = this.salesForm.value;

    const payload = {
      order_no: form.order_no,
      invoice_no: form.invoice_no,
      receipt_date: form.receipt_date,
      department_id: form.department_id,
      customer_name: form.customer_name,
      customer_mobile: form.customer_mobile,
      total_amount: form.total_amount,
      discount_amount: Number(form.discount || 0),
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
        this.isSaving = false;
        this.receiptData = res.data;
        this.showReceipt = true;
        this.cdr.detectChanges();

        setTimeout(() => {
          this.receiptPrint?.print();
          this.showReceipt = false;
          this.cdr.detectChanges();
        }, 300);

        if (this.activePendingId) {
          this.pendingBills = this.pendingBills.filter((p) => p.id !== this.activePendingId);
          this.savePendingBills();
          this.activePendingId = null;
        }

        this.resetForm();
        this.loadProducts();

        const deptId = form.department_id || this.storeContext.selectedDepartmentId() || this.departments[0]?.id;
        if (deptId) {
          this.loaddepartmentstock(+deptId);
        }

        this.notification.success('Sale saved successfully');
        setTimeout(() => {
          this.focusElement('prod_0');
        }, 300);
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Save sale error', err);
        this.notification.error(err?.error?.message || 'Error saving sale');
      },
    });
  }
}
