import { Component, Input } from '@angular/core';
import { SettingstoreService } from '../../../../core/services/setting/settingstore.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-receipt-print',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './receipt-print.component.html',
  styleUrl: './receipt-print.component.css'
})
export class ReceiptPrintComponent {
  @Input() bill: any;

  settings: any;

  constructor(private settingStore: SettingstoreService) {
    this.settingStore.settings$.subscribe(res => {
      this.settings = res;
    });
  }

  print(): void {
    const content = document.getElementById('thermal-receipt');

    if (!content) return;

    const win = window.open('', '', 'width=320,height=600');

    if (!win) return;

    // Styles must be inlined here: the popup window is a separate document
    // and cannot see this component's scoped Angular stylesheet.
    win.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              margin: 0;
              padding: 5px;
            }
            .receipt { width: 280px; color: #000; }
            .text-center { text-align: center; }
            .logo { width: 60px; height: 60px; object-fit: contain; }
            hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
            .items { width: 100%; border-collapse: collapse; }
            .items th, .items td { text-align: left; font-size: 11px; }
            .totals { text-align: right; }
            h3 { margin: 4px 0; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${content.innerHTML}
        </body>
      </html>
    `);

    win.document.close();
  }
}
