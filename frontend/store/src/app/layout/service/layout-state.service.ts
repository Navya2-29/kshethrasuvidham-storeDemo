import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutStateService {
 isOpen = signal<boolean>(true);

  toggle() {
    this.isOpen.update(v => !v);
  }
  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }
}
