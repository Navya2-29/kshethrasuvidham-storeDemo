import { AfterViewInit, Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { TableColumn } from '../../../features/masters/models/table-column.model';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dynamic-table',
  standalone: true,
  imports: [MatPaginatorModule,MatSortModule,CommonModule,MatTableModule,MatIconModule,],
  templateUrl: './dynamic-table.component.html',
  styleUrl: './dynamic-table.component.css'
})
export class DynamicTableComponent implements AfterViewInit {
   @Input() columns: any[] = [];
  @Input() data: any[] = [];

 @Output() edit = new EventEmitter<any>();
@Output() delete = new EventEmitter<number>();

  dataSource = new MatTableDataSource<any>();

  displayedColumns: string[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnChanges() {
    this.dataSource.data = this.data;
    this.displayedColumns = [
      'index',
      ...this.columns.map((c) => c.columnDef),
      'action',
    ];
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.dataSource.filter = value.trim().toLowerCase();
  }
  onEdit(row: any) {
  this.edit.emit(row); // full object
}

onDelete(row: any) {
  this.delete.emit(row.id); // only id
}
}
