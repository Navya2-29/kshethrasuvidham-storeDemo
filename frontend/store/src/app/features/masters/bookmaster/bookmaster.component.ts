import { Component } from '@angular/core';
import { MasterService } from '../../../core/services/masters/master.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-bookmaster',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './bookmaster.component.html',
  styleUrl: './bookmaster.component.css',
})
export class BookmasterComponent {
  authors: any[] = [];
  authorName = '';
  authorEditId: number | null = null;
  authorSubmitted = false;
  savingAuthor = false;
  searchText: string = '';

  // PUBLISHER
  publishers: any[] = [];
  publisherName = '';
  publisherEditId: number | null = null;
  publisherSubmitted = false;
  savingPublisher = false;

  constructor(private service: MasterService) {}

  ngOnInit() {
    this.loadAuthors();
    this.loadPublishers();
  }

  // ===== AUTHOR =====
  loadAuthors() {
    this.service.getAll().subscribe({
      next: (res: any) => (this.authors = res),
      error: () => {},
    });
  }

  save() {
    this.authorSubmitted = true;

    const name = this.authorName.trim();
    if (!name || this.savingAuthor) return;

    this.savingAuthor = true;
    const payload = { author_name: name };

    const req = this.authorEditId
      ? this.service.update(this.authorEditId, payload)
      : this.service.create(payload);

    req.subscribe({
      next: () => {
        this.savingAuthor = false;
        this.resetAuthor();
        this.loadAuthors();
      },
      error: () => {
        this.savingAuthor = false;
      },
    });
  }

  editAuthor(data: any) {
    this.authorName = data.author_name;
    this.authorEditId = data.id;
    this.authorSubmitted = false;
  }

  deleteAuthor(id: number) {
    if (!confirm('Delete this author?')) return;

    this.service.delete(id).subscribe({
      next: () => this.loadAuthors(),
      error: () => {},
    });
  }

  resetAuthor() {
    this.authorName = '';
    this.authorEditId = null;
    this.authorSubmitted = false;
  }

  // ===== PUBLISHER =====
  loadPublishers() {
    this.service.getPublishers().subscribe({
      next: (res: any) => (this.publishers = res),
      error: () => {},
    });
  }

  savePublisher() {
    this.publisherSubmitted = true;

    const name = this.publisherName.trim();
    if (!name || this.savingPublisher) return;

    this.savingPublisher = true;
    const payload = { publisher_name: name };

    const req = this.publisherEditId
      ? this.service.updatePublisher(this.publisherEditId, payload)
      : this.service.createPublisher(payload);

    req.subscribe({
      next: () => {
        this.savingPublisher = false;
        this.resetPublisher();
        this.loadPublishers();
      },
      error: () => {
        this.savingPublisher = false;
      },
    });
  }

  editPublisher(p: any) {
    this.publisherName = p.publisher_name;
    this.publisherEditId = p.id;
    this.publisherSubmitted = false;
  }

  deletePublisher(id: number) {
    if (!confirm('Delete this publisher?')) return;

    this.service.deletePublisher(id).subscribe({
      next: () => this.loadPublishers(),
      error: () => {},
    });
  }

  resetPublisher() {
    this.publisherName = '';
    this.publisherEditId = null;
    this.publisherSubmitted = false;
  }
}
