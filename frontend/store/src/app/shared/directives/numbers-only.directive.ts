import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: '[appNumbersOnly]',
  standalone: true
})
export class NumbersOnlyDirective {

  
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

    input.value = value;
  }
}
