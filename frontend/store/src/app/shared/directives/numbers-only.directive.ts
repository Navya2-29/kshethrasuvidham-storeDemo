import { Directive, HostListener, Optional, Self } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: '[appNumbersOnly]',
  standalone: true
})
export class NumbersOnlyDirective {

  constructor(@Optional() @Self() private ngControl: NgControl) {}

  @HostListener('input', ['$event'])
  onInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value;

    // Allow only numbers and dot
    value = value.replace(/[^0-9.]/g, '');

    // Split by decimal point
    const parts = value.split('.');

    // Prevent more than one decimal point
    if (parts.length > 2) {
      value = parts[0] + '.' + parts[1];
    }

    // Limit to 3 decimal places
    if (parts.length === 2) {
      value = parts[0] + '.' + parts[1].substring(0, 3);
    }

    if (input.value !== value) {
      input.value = value;
    }

    // Keep the reactive/template-driven form control in sync with the
    // sanitized value - without this, formControlName still holds the
    // pre-sanitized (unfiltered) value from this same input event, so
    // validators run against stale data and appear to fire inconsistently.
    this.ngControl?.control?.setValue(value, { emitEvent: true });
  }
}
