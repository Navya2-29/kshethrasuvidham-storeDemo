import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddStocktransactionComponent } from './add-stocktransaction.component';

describe('AddStocktransactionComponent', () => {
  let component: AddStocktransactionComponent;
  let fixture: ComponentFixture<AddStocktransactionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddStocktransactionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AddStocktransactionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
