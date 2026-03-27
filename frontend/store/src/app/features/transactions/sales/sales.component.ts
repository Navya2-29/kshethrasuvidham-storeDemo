import { MasterService } from '../../../core/services/masters/master.service';
import { Component } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NumbersOnlyDirective } from '../../../shared/directives/numbers-only.directive';
@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NumbersOnlyDirective],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.css',
})
export class SalesComponent {
  form!: FormGroup;

  products: any[] = [];
  departments: any[] = [];
  userId:string|null='';
  constructor(
    private fb: FormBuilder,
    private salesService: MasterService,
  ) {
    this.userId=localStorage.getItem('userId')
  }

  ngOnInit(): void {
    this.initForm();
    this.loadMasters();
    // this.loadPurchaseNo();
    this.addItem();
    this.loadNextInvoice();
    this.validatepaymentmode();
  }

  validatepaymentmode() {
    this.form.get('payment_mode')?.valueChanges.subscribe((mode) => {
      const chequeDate = this.form.get('cheque_date');
      const chequeNo = this.form.get('cheque_no');

      if (mode === 'ch') {
        chequeDate?.setValidators([Validators.required]);
        chequeNo?.setValidators([Validators.required]);
      } else {
        chequeDate?.clearValidators();
        chequeNo?.clearValidators();

        chequeDate?.setValue('');
        chequeNo?.setValue('');
      }

      chequeDate?.updateValueAndValidity();
      chequeNo?.updateValueAndValidity();
    });
  }

  initForm() {
    const today = new Date().toISOString().substring(0, 10);
    this.form = this.fb.group({
      order_no: [''],
      invoice_no: ['', Validators.required],
      customer_name: [''],
      department_id: ['', Validators.required],
      invoice_date: [today, Validators.required],
      customer_mob: ['', Validators.pattern(/^[0-9]{10}$/)],
      items: this.fb.array([]),
      sub_total: [0],
      payment_mode: ['cs', Validators.required],
      cheque_date: [''],
      cheque_no: [''],
      total_amount: [0, Validators.required],
      discount_amount: [0],
 
      other_charges: [0],
      bill_amount: [0, Validators.required],
    });
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  createItem(): FormGroup {
    return this.fb.group({
      product_id: ['', Validators.required],
      qty: [1, Validators.required],
      unit: ['Nos', Validators.required],
      mrp: [0, Validators.required],
      cost_price: [0],
      gst_percent:[0],
      cgst: [0],
      sgst: [0],
      amount: [0, Validators.required],
      hsn_code: [''],
    });
  }

  addItem() {
if (this.canAddNewItem()) {
      this.items.push(this.createItem());
    } else {
      alert(
        'Please fill all required fields in the current row before adding a new item.',
      );
    }


    
  }


   canAddNewItem(): boolean {
    if (this.items.length === 0) return true;

    const lastIndex = this.items.length - 1;
    const lastRow = this.items.at(lastIndex);

    // Required fields in each row
    const requiredFields = ['product_id', 'qty'];

    for (let field of requiredFields) {
      const control = lastRow.get(field);
      if (
        !control ||
        control.invalid ||
        control.value === '' ||
        control.value === null
      ) {
        return false; // Last row is invalid, cannot add new row
      }
    }

    return true; // Last row is valid, can add new row
  }
  removeItem(index: number) {
    this.items.removeAt(index);
    this.calculateTotal();
  }

  loadMasters() {
    // this.salesService.getProducts().subscribe(r => this.products = r);
    this.salesService.getDepartments().subscribe((r) => (this.departments = r));
    // console.log(this.products, this.departments);
  }

  onDepartmentChange() {
    const deptId = this.form.value.department_id;
    this.salesService
      .getProductsByDepartment(deptId)
      .subscribe((res) => (this.products = res));
  }
  onProductChange(index: number) {
    const row = this.items.at(index);
    const product = this.products.find((p) => p.id == row.value.product_id);

    if (product) {
      row.patchValue({
        unit: product.unit,
        mrp: product.mrp,
        cost_price: product.cost_price,
        gst_percent: product.gst_percent || 0, // ✅ ADD
        hsn_code: product.hsn_code || '' 
      });
      this.calculateRow(index);
    }
  }
  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
    calculateRow(i: number) {
    const row = this.items.at(i).value;

    const base = this.round2(row.qty * row.cost_price);

    const gstPercent = Number(row.gst_percent || 0);
    const cgstPercent = gstPercent / 2;
    const sgstPercent = gstPercent / 2;

    const cgst = this.round2((base * cgstPercent) / 100);
    const sgst = this.round2((base * sgstPercent) / 100);

    const amount = this.round2(base + cgst + sgst);

    this.items.at(i).patchValue(
      {
        cgst,
        sgst,
        amount,
      },
      { emitEvent: false }
    );

    this.calculateTotal();
  }

 calculateTotal() {
    let subTotal = 0;

    this.items.controls.forEach((r) => {
      subTotal += Number(r.value.amount || 0);
    });

    const discount = Number(this.form.value.discount_amount || 0);
    const other = Number(this.form.value.other_charges || 0);

    const bill = this.round2(subTotal - discount + other);

    this.form.patchValue(
      {
        sub_total: this.round2(subTotal),
        bill_amount: bill,
      },
      { emitEvent: false }
    );
  }


  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      order_no: this.form.value.order_no,
      invoice_no: this.form.value.invoice_no,
      receipt_date: this.form.value.invoice_date,
      department_id: this.form.value.department_id,
      customer_name: this.form.value.customer_name,
      customer_mobile: this.form.value.customer_mob,
      created_by: this.userId,
      sub_total: this.form.value.sub_total,
      payment_mode: this.form.value.payment_mode,
      cheque_date: this.form.value.cheque_date,
      cheque_no: this.form.value.cheque_no,
      discount_amount: this.form.value.discount_amount,
      gst_amount: this.form.value.gst_amount,
      other_charges: this.form.value.other_charges,
      bill_amount: this.form.value.bill_amount,
      items: this.items.value.map((i: any) => ({
        product_id: i.product_id,
        qty: i.qty,
        unit: i.unit,
        mrp: i.mrp,
        rate: i.cost_price,
        cgst: i.cgst,
        sgst: i.sgst,
        amount: i.amount,
        gst_percent:i.gst_percent
      })),
    };

    this.salesService.saveSale(payload).subscribe({
      next: () => {
        alert('Sale saved successfully');
        this.initForm();
        this.items.clear();
        this.addItem();
        this.loadNextInvoice()
      },
      error: (err) => {
        alert(err.error.message || 'Error saving sale');
      },
    });
  }

  loadNextInvoice() {
    this.salesService
      .getNextInvoice()
      .subscribe((r) => this.form.patchValue({ invoice_no: r.invoice_no }));
  }
  
  getFieldLabel(key: string): string {
    const labels: any = {
      customer_name: 'Customer Name',
      department_id: 'Department',
      customer_mob: 'Mobile Number',
      payment_mode: 'Payment Mode',
      cheque_date: 'Cheque Date',
      cheque_no: 'Cheque Number',
    };

    return labels[key] || key;
  }

  getFormValidationErrors(): string[] {
    const messages: string[] = [];
    Object.keys(this.form.controls).forEach((key) => {
      const control = this.form.get(key);
      if (control && control.invalid) {
        const errors = control.errors;

        if (errors?.['required']) {
          messages.push(`${this.getFieldLabel(key)} is required`);
        }

        if (errors?.['pattern']) {
          if (key === 'customer_mob') {
            messages.push('Mobile number must be 10 digits');
          }
        }
      }
    });

    return messages;
  }
}
