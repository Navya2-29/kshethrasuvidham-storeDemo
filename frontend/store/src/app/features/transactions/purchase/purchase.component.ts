import { Component } from '@angular/core';
import { PurchaseItem } from '../models/purchase-item.model';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MasterService } from '../../../core/services/masters/master.service';
import { CommonModule } from '@angular/common';
import { PurchasePayload } from '../models/purchase.model';
import { NumbersOnlyDirective } from '../../../shared/directives/numbers-only.directive';
import { MatDialog } from '@angular/material/dialog';
import { PurchaseListDialogComponent } from '../../../shared/components/purchase-list-dialog/purchase-list-dialog.component';

@Component({
  selector: 'app-purchase',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule,NumbersOnlyDirective],
  templateUrl: './purchase.component.html',
  styleUrl: './purchase.component.css',
})
export class PurchaseComponent {
  form!: FormGroup;
filteredSuppliers: any[] = [];
  suppliers: any[] = [];
  products: any[] = [];
  departments: any[] = [];
isEditMode: boolean = false;
editId: number | null = null
  constructor(
    private fb: FormBuilder,
    private purchaseService: MasterService,
     private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadMasters();
    // this.loadPurchaseNo();
    this.addItem();
    this.form.get('supplier_code')?.valueChanges.subscribe(() => {
    this.onSupplierCodeChange();
  });
  }

  initForm() {
    const today = new Date().toISOString().split('T')[0];
    this.form = this.fb.group({
      order_no: [''],
      invoice_no: ['', Validators.required],
      supplier_code:[''],
      supplier_id: ['', Validators.required],
      department_id: [''],
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

  createItem(): FormGroup {
    return this.fb.group({
      product_id: ['', Validators.required],
      hsn_code:[''],
      qty: [1, Validators.required],
      free_qty:[0],
      unit: ['Nos'],
      mrp: [0],
      cost_price: [0],
      cgst: [0],
      sgst: [0],
      amount: [0],
    });
  }

  addItem() {

    if (this.canAddNewItem()) {
   this.items.push(this.createItem());
  } else {
    alert('Please fill all required fields in the current row before adding a new item.');
  }
    
  }

  removeItem(index: number) {
    this.items.removeAt(index);
    this.calculateTotal();
  }

  loadMasters() {
   this.purchaseService.getSuppliers().subscribe((res) => {
    this.suppliers = res;
    this.filteredSuppliers = [...this.suppliers]; 
  });
    this.purchaseService.getProducts().subscribe((r) => (this.products = r));
    this.purchaseService
      .getDepartments()
      .subscribe((r) => (this.departments = r));
    // console.log(this.suppliers,this.products,this.departments)
  }

  // loadPurchaseNo() {
  //   this.purchaseService.getNextPurchaseNo().subscribe(r => {
  //     this.form.patchValue({ order_no: r.order_no });
  //   });
  // }

onProductChange(index: number) {
  const row = this.items.at(index);
  const product = this.products.find(p => p.id == row.value.product_id);

  if (product) {
    const costPrice = Number(product.cost_price || 0);
    const gstPercent = Number(product.gst_percent || 0);
    const cgst = +(gstPercent / 2).toFixed(2);
    const sgst = +(gstPercent / 2).toFixed(2);
    const qty = Number(row.value.qty || 0);
    const freeQty = Number(row.value.free_qty || 0);

    // Base amount (qty * cost price)
    const baseAmount = +(qty * costPrice).toFixed(2);

    // GST amounts
    const cgstAmount = +(baseAmount * cgst / 100).toFixed(2);
    const sgstAmount = +(baseAmount * sgst / 100).toFixed(2);

    // Total amount
    const totalAmount = +(baseAmount + cgstAmount + sgstAmount).toFixed(2);

    row.patchValue({
      unit: product.unit,
      cost_price: costPrice,
      mrp: Number(product.mrp || 0),
      cgst: cgstAmount,
      sgst: sgstAmount,
      amount: totalAmount,
      hsn_code: product.hsn_code || ''
    }, { emitEvent: false });

    this.calculateTotal(); // recalculate total bill
  } else {
    // If product is removed, clear fields
    row.patchValue({
      unit: '',
      cost_price: 0,
      mrp: 0,
      cgst: 0,
      sgst: 0,
      amount: 0,
      hsn_code: ''
    }, { emitEvent: false });
  }
}
  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
  
  calculateRow(index: number) {
  const row = this.items.at(index);
  const product = this.products.find(p => p.id == row.value.product_id);

  if (!product) return;

  const qty = Number(row.value.qty || 0);
  const cost = Number(product.cost_price || 0);
  const gstPercent = Number(product.gst_percent || 0);

  // Half of GST for CGST and SGST
  const cgstPercent = gstPercent / 2;
  const sgstPercent = gstPercent / 2;

  // Base amount (qty * cost price)
  const baseAmount = +(qty * cost).toFixed(2);

  // GST amounts
  const cgstAmount = +(baseAmount * cgstPercent / 100).toFixed(2);
  const sgstAmount = +(baseAmount * sgstPercent / 100).toFixed(2);

  // Total amount
  const totalAmount = +(baseAmount + cgstAmount + sgstAmount).toFixed(2);

  row.patchValue({
    cgst: cgstAmount,
    sgst: sgstAmount,
    amount: totalAmount
  }, { emitEvent: false });

  this.calculateTotal();
}

  calculateTotal() {
    let total = 0;
    this.items.controls.forEach((i) => (total += Number(i.value.amount || 0)));
    total = this.round2(total);
    const discount = Number(this.form.value.discount_amount || 0);
    const others = Number(this.form.value.other_charges || 0);
    // const gst = this.round2(total * 0.18);
    const bill = this.round2(total - discount + others);

    this.form.patchValue(
      {
        total_amount: total,
        // gst_amount: gst,
        bill_amount: bill,
      },
      { emitEvent: false },
    );
  }
save() {
  console.log(this.form.value);

  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const payload: PurchasePayload = {
    header: {
      order_no: this.form.value.order_no,
      invoice_no: this.form.value.invoice_no,
      supplier_id: this.form.value.supplier_id,
      department_id: this.form.value.department_id,
      invoice_date: this.form.value.invoice_date,
      receipt_date: this.form.value.receipt_date,
      total_amount: this.form.value.total_amount,
      discount_amount: this.form.value.discount_amount,
      other_charges: this.form.value.other_charges,
      bill_amount: this.form.value.bill_amount,
    },
    items: this.form.value.items as PurchaseItem[],
  };

  // ✅ EDIT MODE
  if (this.isEditMode && this.editId) {

    this.purchaseService.updatePurchase(this.editId, payload).subscribe({
      next: () => {
        alert('Purchase updated successfully');

        this.resetForm();
      },
      error: (err) => {
        alert('Update failed');
        console.error(err);
      }
    });

  } 
  // ✅ CREATE MODE (YOUR EXISTING CODE)
  else {

    this.purchaseService.savePurchase(payload).subscribe({
      next: () => {
        alert('Purchase saved');

        this.resetForm();
      },
      error: (err) => {
        if (err.status === 400 && err.error?.message) {
          alert(err.error.message);
        } else {
          alert('Something went wrong while saving purchase.');
          console.error(err);
        }
      }
    });

  }
}
resetForm() {
  this.initForm();
  this.items.clear();
  this.addItem();

  this.isEditMode = false;
  this.editId = null;
}
  getFormValidationErrors(): string[] {
  const messages: string[] = [];

  Object.keys(this.form.controls).forEach(key => {
    const control = this.form.get(key);

    if (control && control.invalid && key !== 'items') {
      if (control.errors?.['required']) {
        messages.push(`${this.getFieldLabel(key)} is required`);
      }
    }
  });

  // Validate Items
  if (this.items.length === 0) {
    messages.push('At least one product item is required');
  }

  this.items.controls.forEach((item, index) => {
    Object.keys((item as FormGroup).controls).forEach(field => {
      const fieldControl = item.get(field);

      if (fieldControl && fieldControl.invalid) {
        if (fieldControl.errors?.['required']) {
          messages.push(
            `Row ${index + 1} - ${this.getItemFieldLabel(field)} is required`
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
  };

  return labels[field] || field;
}
onSupplierCodeChange() {
  const code = this.form.get('supplier_code')?.value?.toLowerCase() || '';
  
  // Filter suppliers whose code matches typed value
  this.filteredSuppliers = this.suppliers.filter((s) =>
    s.supplier_code.toLowerCase().includes(code)
  );

  // If exact match found, select supplier_id
  const exactMatch = this.suppliers.find(
    (s) => s.supplier_code.toLowerCase() === code
  );
  if (exactMatch) {
    this.form.patchValue({ supplier_id: exactMatch.id }, { emitEvent: false });
  } else {
    this.form.patchValue({ supplier_id: null }, { emitEvent: false });
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
    if (!control || control.invalid || control.value === '' || control.value === null) {
      return false; // Last row is invalid, cannot add new row
    }
  }

  return true; // Last row is valid, can add new row
}

listAllpurchase() {
  this.purchaseService.getAllPurchases().subscribe({
    next: (res) => {

      const dialogRef = this.dialog.open(PurchaseListDialogComponent, {
        width: '900px',
        data: res
      });

      // ✅ HANDLE ACTION FROM POPUP
      dialogRef.afterClosed().subscribe(result => {

        if (!result) return;

        if (result.action === 'edit') {
          this.editPurchase(result.data.id);
        }

        if (result.action === 'delete') {
          // this.deletePurchase(result.data.id);
        }

      });

    },
    error: (err) => {
      console.error(err);
      alert('Failed to load purchase list');
    }
  });
}




editPurchase(id: number) {
  this.purchaseService.getPurchaseById(id).subscribe(res => {

    // 🔴 Step 1: Reset form
    this.initForm();
    this.items.clear();
const formatDate = (date: string) => {
      return date ? date.split('T')[0] : '';
    };

    // 🔴 Step 2: Patch header
    this.form.patchValue({
      order_no: res.header.order_no,
      invoice_no: res.header.invoice_no,
      supplier_id: res.header.supplier_id,
      department_id: res.header.department_id,
      invoice_date: formatDate(res.header.invoice_date),
      receipt_date: formatDate(res.header.receipt_date),
      total_amount: res.header.total_amount,
      discount_amount: res.header.discount_amount,
      other_charges: res.header.other_charges,
      bill_amount: res.header.bill_amount
    });

    // 🔴 Step 3: Patch supplier code (important)
    const supplier = this.suppliers.find(
      s => s.id == res.header.supplier_id
    );

    // this.form.patchValue({
    //   supplier_code: supplier ? supplier.supplier_code : ''
    // });

    // 🔴 Step 4: Load items
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
        cgst: item.cgst,
        sgst: item.sgst,
        amount: item.amount
      });

      this.items.push(group);
    });

    // 🔴 Step 5: Enable edit mode
    this.isEditMode = true;
    this.editId = id;

    // 🔴 Step 6: Scroll to form (optional)
    window.scrollTo({ top: 0, behavior: 'smooth' });

  });
}
}
