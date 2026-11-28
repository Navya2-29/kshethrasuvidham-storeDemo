import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuickSalesComponent } from './quick-sales.component';

describe('QuickSalesComponent', () => {
  let component: QuickSalesComponent;
  let fixture: ComponentFixture<QuickSalesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickSalesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(QuickSalesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
