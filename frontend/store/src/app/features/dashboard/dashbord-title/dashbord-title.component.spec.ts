import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashbordTitleComponent } from './dashbord-title.component';

describe('DashbordTitleComponent', () => {
  let component: DashbordTitleComponent;
  let fixture: ComponentFixture<DashbordTitleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashbordTitleComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DashbordTitleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
