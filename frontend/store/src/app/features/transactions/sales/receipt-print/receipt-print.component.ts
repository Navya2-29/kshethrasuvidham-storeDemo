import { Component, Input, OnInit } from '@angular/core';
import { SettingstoreService } from '../../../../core/services/setting/settingstore.service';
import { SettingService } from '../../../../core/services/setting/setting.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-receipt-print',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './receipt-print.component.html',
  styleUrl: './receipt-print.component.css'
})
export class ReceiptPrintComponent implements OnInit {
  @Input() bill: any;

  settings: any;

  constructor(
    private settingStore: SettingstoreService,
    private settingService: SettingService,
  ) {}

  ngOnInit(): void {
    this.settingStore.settings$.subscribe((res) => {
      if (res) {
        this.applySettings(res);
      }
    });

    const snapshot = this.settingStore.getSettingsSnapshot();
    if (snapshot) {
      this.applySettings(snapshot);
    } else {
      this.settingService.getSettings().subscribe({
        next: (res) => this.applySettings(res),
        error: (err) => console.warn('Could not load settings for receipt print', err),
      });
    }
  }

  private applySettings(res: any): void {
    if (!res) return;
    this.settings = {
      ...res,
      logo: res.logo ? this.settingService.getLogoUrl(res.logo) : '',
    };
  }

  print(): void {
    const content = document.getElementById('thermal-receipt');

    if (!content) return;

    const win = window.open('', '', 'width=320,height=600');

    if (!win) return;

    // Styles must be inlined here: the popup window is a separate document
    // and cannot see this component's scoped Angular stylesheet.
    win.document.write(`
      <!DOCTYPE html>
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
            .text-right { text-align: right; }
            .logo { width: 65px; height: 65px; object-fit: contain; display: block; margin: 0 auto 5px auto; }
            hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
            .items { width: 100%; border-collapse: collapse; }
            .items th, .items td { text-align: left; font-size: 11px; padding: 2px 0; }
            .items th.text-right, .items td.text-right { text-align: right; }
            .items th.text-center, .items td.text-center { text-align: center; }
            .totals { text-align: right; margin-top: 4px; line-height: 1.4; }
            .pay-info { margin: 3px 0; font-size: 11.5px; }
            h3 { margin: 4px 0; }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <script>
            function doPrint() {
              window.focus();
              window.print();
              window.close();
            }
            const img = document.querySelector('.logo');
            if (img && !img.complete) {
              img.onload = doPrint;
              img.onerror = doPrint;
              setTimeout(doPrint, 1200);
            } else {
              setTimeout(doPrint, 250);
            }
          </script>
        </body>
      </html>
    `);

    win.document.close();
  }
}
