import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ErrorService {

  getErrorMessage(error: any): string {
    if (!error) return 'Unknown error occurred';

    // API error
    if (error.error?.message) {
      return error.error.message;
    }

    // HTTP status-based
    switch (error.status) {
      case 0:
        return 'Network error. Please check your connection.';
      case 400:
        return 'Bad request';
      case 401:
        return 'Unauthorized. Please login again.';
      case 403:
        return 'Access denied';
      case 404:
        return 'Resource not found';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return 'Something went wrong';
    }
  }
}
