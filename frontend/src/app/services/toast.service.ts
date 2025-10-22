import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  public toasts$ = this.toastsSubject.asObservable();

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string, duration: number = 5000): string {
    const id = this.generateId();
    const toast: ToastMessage = {
      id,
      type,
      title: title || this.getDefaultTitle(type),
      message,
      duration
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, toast]);

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  success(message: string, title?: string, duration?: number): string {
    return this.show(message, 'success', title, duration);
  }

  error(message: string, title?: string, duration?: number): string {
    return this.show(message, 'error', title, duration);
  }

  warning(message: string, title?: string, duration?: number): string {
    return this.show(message, 'warning', title, duration);
  }

  info(message: string, title?: string, duration?: number): string {
    return this.show(message, 'info', title, duration);
  }

  remove(id: string): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(toast => toast.id !== id));
  }

  clear(): void {
    this.toastsSubject.next([]);
  }

  private getDefaultTitle(type: string): string {
    switch (type) {
      case 'success': return 'Success';
      case 'error': return 'Error';
      case 'warning': return 'Warning';
      case 'info': return 'Information';
      default: return 'Notification';
    }
  }
}
