import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DirectEntryComponent } from './direct-entry.component';

describe('DirectEntryComponent', () => {
  let component: DirectEntryComponent;
  let fixture: ComponentFixture<DirectEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DirectEntryComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DirectEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
