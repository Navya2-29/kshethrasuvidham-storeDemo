import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PurchaseListDialogComponent } from './purchase-list-dialog.component';

describe('PurchaseListDialogComponent', () => {
  let component: PurchaseListDialogComponent;
  let fixture: ComponentFixture<PurchaseListDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseListDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PurchaseListDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
