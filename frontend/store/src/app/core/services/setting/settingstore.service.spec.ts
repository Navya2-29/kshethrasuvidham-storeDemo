import { TestBed } from '@angular/core/testing';

import { SettingstoreService } from './settingstore.service';

describe('SettingstoreService', () => {
  let service: SettingstoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SettingstoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
